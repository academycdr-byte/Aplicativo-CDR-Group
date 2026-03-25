import { prisma } from "@/lib/prisma";
import { CreativeStatus } from "@prisma/client";
import { getDateRange, buildDateOnlyFilter } from "@/lib/date-utils";

/**
 * Strip " — Cópia", " — Cópia 2", etc. from ad names.
 * Duplicating an ad in Meta Ads auto-appends "— Cópia" — same creative.
 */
function normalizeCreativeName(name: string): string {
  return name.replace(/\s*[—–-]\s*C[oó]pia(\s*\d+)?$/i, "").trim();
}

function isDynamicCatalogAd(name: string): boolean {
  return name.includes("{{");
}

function classifyCreative(
  roas: number,
  purchases: number,
  minPurchases: number,
  roasBreakeven: number,
  roasIdeal: number,
  previousStatus: CreativeStatus | null
): CreativeStatus {
  if (purchases < minPurchases) return CreativeStatus.EM_TESTE;
  if (roas >= roasIdeal) return CreativeStatus.CAMPEOES_ATIVOS;
  if (roas >= roasBreakeven) return CreativeStatus.RECICLAGEM;
  if (previousStatus === CreativeStatus.CAMPEOES_ATIVOS) return CreativeStatus.CAMPEOES_INATIVOS;
  return CreativeStatus.DESATIVADOS;
}

/**
 * Classify creatives for a specific organization.
 * Can be called from cron (no session needed) or from server actions.
 */
export async function classifyCreativesForOrg(orgId: string) {
  const benchmarkRow = await prisma.creativeBenchmark.findUnique({
    where: { organizationId: orgId },
  });

  const roasBreakeven = benchmarkRow ? Number(benchmarkRow.roasBreakeven) : 1.5;
  const roasIdeal = benchmarkRow ? Number(benchmarkRow.roasIdeal) : 2.5;
  const minPurchases = benchmarkRow?.minPurchases ?? 5;
  const lookbackDays = benchmarkRow?.lookbackDays ?? 7;

  const range = getDateRange(lookbackDays);
  const dateFilter = buildDateOnlyFilter(range);

  const metrics = await prisma.adMetric.findMany({
    where: {
      organizationId: orgId,
      platform: "FACEBOOK_ADS",
      date: dateFilter,
      adName: { not: null },
    },
    select: {
      adName: true,
      spend: true,
      revenue: true,
      conversions: true,
      impressions: true,
      clicks: true,
      thumbnailUrl: true,
    },
  });

  // Aggregate by normalized name
  const aggregated: Record<string, {
    spend: number;
    revenue: number;
    purchases: number;
    impressions: number;
    clicks: number;
    thumbnailUrl: string | null;
  }> = {};

  for (const m of metrics) {
    if (!m.adName || isDynamicCatalogAd(m.adName)) continue;
    const name = normalizeCreativeName(m.adName);
    if (!name) continue;

    if (!aggregated[name]) {
      aggregated[name] = { spend: 0, revenue: 0, purchases: 0, impressions: 0, clicks: 0, thumbnailUrl: null };
    }
    aggregated[name].spend += Number(m.spend);
    aggregated[name].revenue += Number(m.revenue);
    aggregated[name].purchases += m.conversions;
    aggregated[name].impressions += m.impressions;
    aggregated[name].clicks += m.clicks;
    if (m.thumbnailUrl && !aggregated[name].thumbnailUrl) {
      aggregated[name].thumbnailUrl = m.thumbnailUrl;
    }
  }

  // Fetch existing classifications
  const existing = await prisma.creativeClassification.findMany({
    where: { organizationId: orgId },
    select: { creativeName: true, status: true },
  });
  const existingMap = new Map(existing.map((e) => [e.creativeName, e.status]));

  const transitions: { name: string; from: CreativeStatus | null; to: CreativeStatus }[] = [];
  const now = new Date();

  const upserts = Object.entries(aggregated).map(([name, data]) => {
    const roas = data.spend > 0 ? data.revenue / data.spend : 0;
    const prevStatus = existingMap.get(name) ?? null;
    const newStatus = classifyCreative(roas, data.purchases, minPurchases, roasBreakeven, roasIdeal, prevStatus);

    if (prevStatus !== newStatus) {
      transitions.push({ name, from: prevStatus, to: newStatus });
    }

    // Only update previousStatus when the status actually changes
    // to preserve meaningful transition history
    const statusChanged = prevStatus !== null && prevStatus !== newStatus;

    return prisma.creativeClassification.upsert({
      where: {
        organizationId_creativeName: { organizationId: orgId, creativeName: name },
      },
      create: {
        organizationId: orgId,
        creativeName: name,
        status: newStatus,
        previousStatus: prevStatus,
        roas,
        purchases: data.purchases,
        spend: data.spend,
        revenue: data.revenue,
        impressions: data.impressions,
        clicks: data.clicks,
        thumbnailUrl: data.thumbnailUrl,
        lastClassifiedAt: now,
      },
      update: {
        status: newStatus,
        ...(statusChanged ? { previousStatus: prevStatus } : {}),
        roas,
        purchases: data.purchases,
        spend: data.spend,
        revenue: data.revenue,
        impressions: data.impressions,
        clicks: data.clicks,
        thumbnailUrl: data.thumbnailUrl,
        lastClassifiedAt: now,
      },
    });
  });

  await Promise.all(upserts);

  // ─── STALE CREATIVE HANDLING ─────────────────────
  // Creatives that exist in the DB but have NO metrics in the lookback window
  // are likely paused/campaign killed. Reclassify them to appropriate inactive status.
  const activeNames = new Set(Object.keys(aggregated));
  const allClassifications = await prisma.creativeClassification.findMany({
    where: { organizationId: orgId },
    select: { id: true, creativeName: true, status: true, roas: true, purchases: true, spend: true, lastClassifiedAt: true },
  });

  const staleUpdates = [];
  for (const c of allClassifications) {
    // Skip creatives that were just classified (active in lookback)
    if (activeNames.has(c.creativeName)) continue;

    // Skip creatives already in a final inactive state
    if (c.status === "RECICLAGEM" || c.status === "CAMPEOES_INATIVOS" || c.status === "DESATIVADOS") continue;

    // Creative is stale (no recent metrics) and in an active state
    let newStatus: CreativeStatus;

    if (c.status === "CAMPEOES_ATIVOS") {
      // Was champion but no longer running → Campeões Inativos
      newStatus = CreativeStatus.CAMPEOES_INATIVOS;
    } else if (c.status === "EM_TESTE") {
      // Was being tested but paused/killed → evaluate with stored metrics
      const storedRoas = Number(c.roas);
      if (c.purchases >= minPurchases && storedRoas >= roasIdeal) {
        newStatus = CreativeStatus.CAMPEOES_INATIVOS;
      } else if (c.purchases >= minPurchases && storedRoas >= roasBreakeven) {
        newStatus = CreativeStatus.RECICLAGEM;
      } else if (Number(c.spend) > 0) {
        // Spent money but didn't perform → Desativados
        newStatus = CreativeStatus.DESATIVADOS;
      } else {
        continue; // No spend yet, keep EM_TESTE
      }
    } else {
      continue;
    }

    transitions.push({ name: c.creativeName, from: c.status, to: newStatus });
    staleUpdates.push(
      prisma.creativeClassification.update({
        where: { id: c.id },
        data: {
          previousStatus: c.status,
          status: newStatus,
        },
      })
    );
  }

  if (staleUpdates.length > 0) {
    await Promise.all(staleUpdates);
  }

  return {
    classified: Object.keys(aggregated).length,
    transitions: transitions.length,
  };
}
