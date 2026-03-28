"use server";

import { prisma } from "@/lib/prisma";
import { getSessionWithOrg } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { decrypt } from "@/lib/encryption";
import { fetchNuvemshopProductsByIds, type NuvemshopProduct } from "@/lib/integrations/nuvemshop";
import { type ShopifyProduct } from "@/lib/integrations/shopify";

// ─── Types ────────────────────────────────────────

export type ActionPlanSummary = {
  id: string;
  title: string;
  periodStart: Date;
  periodEnd: Date;
  status: "DRAFT" | "FINALIZED";
  publicToken: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { name: string | null; email: string };
};

export type PlanMetrics = {
  faturamento: number;
  investido: number;
  convertido: number;
  roas: number;
  cpa: number;
  ticketMedio: number;
  totalPedidos: number;
  totalConversoes: number;
  /** % change vs previous period (same duration) — optional for backwards compat */
  changes?: {
    faturamento: number | null;
    investido: number | null;
    convertido: number | null;
    roas: number | null;
    cpa: number | null;
    ticketMedio: number | null;
  };
};

export type TopProduct = {
  name: string;
  quantity: number;
  revenue: number;
  imageUrl?: string;
  vendor?: string;
};

export type TopCollection = {
  name: string;
  quantity: number;
  revenue: number;
};

export type TopCreative = {
  adId: string;
  name: string;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  spend: number;
  sales: number;
  roas: number;
  score: number;
};

export type ActionPlanFull = {
  id: string;
  title: string;
  periodStart: Date;
  periodEnd: Date;
  status: "DRAFT" | "FINALIZED";
  publicToken: string;
  metrics: PlanMetrics | null;
  topProducts: TopProduct[] | null;
  topCollections: TopCollection[] | null;
  topCreatives: TopCreative[] | null;
  gaps: GapNode[];
  levers: LeverNode[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: { name: string | null; email: string };
};

export type TreeNode = {
  id: string;
  text: string;
  children: TreeNode[];
};

export type GapNode = {
  id: string;
  title: string;
  children: TreeNode[];
  currentMetric?: string;
  targetMetric?: string;
  financialImpact?: string;
  imageUrl?: string;
};

export type LeverNode = {
  id: string;
  title: string;
  children: TreeNode[];
  currentMetric?: string;
  targetMetric?: string;
  financialImpact?: string;
  imageUrl?: string;
};

// ─── List Action Plans ────────────────────────────

export async function getActionPlans() {
  const ctx = await getSessionWithOrg();
  if (!ctx) return [];

  const plans = await prisma.actionPlan.findMany({
    where: { organizationId: ctx.organization.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      periodStart: true,
      periodEnd: true,
      status: true,
      publicToken: true,
      createdAt: true,
      updatedAt: true,
      createdBy: {
        select: { name: true, email: true },
      },
    },
  });

  return plans as ActionPlanSummary[];
}

// ─── Get Single Action Plan ───────────────────────

export async function getActionPlan(planId: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return null;

  const plan = await prisma.actionPlan.findFirst({
    where: {
      id: planId,
      organizationId: ctx.organization.id,
    },
    include: {
      createdBy: {
        select: { name: true, email: true },
      },
    },
  });

  if (!plan) return null;

  return {
    ...plan,
    metrics: plan.metrics as PlanMetrics | null,
    topProducts: plan.topProducts as TopProduct[] | null,
    topCollections: plan.topCollections as TopCollection[] | null,
    topCreatives: plan.topCreatives as TopCreative[] | null,
    gaps: (plan.gaps as GapNode[]) || [],
    levers: (plan.levers as LeverNode[]) || [],
  } as ActionPlanFull;
}

// ─── Helpers ──────────────────────────────────────

function extractNuvemshopImageUrl(imageField: unknown): string {
  if (typeof imageField === "string") return imageField;
  if (Array.isArray(imageField)) {
    const first = imageField[0];
    if (!first) return "";
    if (typeof first === "string") return first;
    if (typeof first === "object" && first !== null) {
      const obj = first as Record<string, unknown>;
      return String(obj.src || obj.url || "");
    }
  }
  if (imageField && typeof imageField === "object") {
    const obj = imageField as Record<string, unknown>;
    return String(obj.src || obj.url || "");
  }
  return "";
}

function extractI18nName(nameField: unknown): string {
  if (typeof nameField === "string") return nameField || "Produto";
  if (nameField && typeof nameField === "object") {
    const obj = nameField as Record<string, string>;
    return obj.pt || obj.es || obj.en || Object.values(obj).find(v => typeof v === "string" && v) || "Produto";
  }
  return "Produto";
}

// ─── Aggregate Metrics for Period ─────────────────

async function aggregateMetrics(
  orgId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<{
  metrics: PlanMetrics;
  topProducts: TopProduct[];
  topCollections: TopCollection[];
  topCreatives: TopCreative[];
}> {
  // 1. Order metrics (Faturamento, Ticket Médio)
  type OrderAgg = { paid_count: bigint; paid_revenue: number };
  const [orderAgg] = await prisma.$queryRaw<OrderAgg[]>`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('paid','partially_refunded')) as paid_count,
      COALESCE(SUM("totalAmount") FILTER (WHERE status IN ('paid','partially_refunded')), 0) as paid_revenue
    FROM orders
    WHERE "organizationId" = ${orgId}
      AND "orderDate" >= ${periodStart}
      AND "orderDate" <= ${periodEnd}
  `;

  // 2. Ad metrics (Investido, Convertido, ROAS, CPA)
  const periodStartDate = periodStart.toISOString().split("T")[0];
  const periodEndDate = periodEnd.toISOString().split("T")[0];

  type AdAgg = { total_spend: number; total_revenue: number; total_conversions: bigint };
  const [adAgg] = await prisma.$queryRaw<AdAgg[]>`
    SELECT
      COALESCE(SUM(spend), 0) as total_spend,
      COALESCE(SUM(revenue), 0) as total_revenue,
      COALESCE(SUM(conversions), 0) as total_conversions
    FROM ad_metrics
    WHERE "organizationId" = ${orgId}
      AND platform = 'FACEBOOK_ADS'
      AND date >= ${periodStartDate}::date
      AND date <= ${periodEndDate}::date
  `;

  const faturamento = Number(orderAgg?.paid_revenue || 0);
  const totalPedidos = Number(orderAgg?.paid_count || 0);
  const investido = Number(adAgg?.total_spend || 0);
  const convertido = Number(adAgg?.total_revenue || 0);
  const totalConversoes = Number(adAgg?.total_conversions || 0);
  const roas = investido > 0 ? convertido / investido : 0;
  const cpa = totalConversoes > 0 ? investido / totalConversoes : 0;
  const ticketMedio = totalPedidos > 0 ? faturamento / totalPedidos : 0;

  // ── Previous period (same duration, shifted back) ──
  const durationMs = periodEnd.getTime() - periodStart.getTime();
  const prevEnd = new Date(periodStart.getTime() - 1); // day before current start
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  const prevStartDate = prevStart.toISOString().split("T")[0];
  const prevEndDate = prevEnd.toISOString().split("T")[0];

  const [prevOrderAgg] = await prisma.$queryRaw<OrderAgg[]>`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('paid','partially_refunded')) as paid_count,
      COALESCE(SUM("totalAmount") FILTER (WHERE status IN ('paid','partially_refunded')), 0) as paid_revenue
    FROM orders
    WHERE "organizationId" = ${orgId}
      AND "orderDate" >= ${prevStart}
      AND "orderDate" <= ${prevEnd}
  `;
  const [prevAdAgg] = await prisma.$queryRaw<AdAgg[]>`
    SELECT
      COALESCE(SUM(spend), 0) as total_spend,
      COALESCE(SUM(revenue), 0) as total_revenue,
      COALESCE(SUM(conversions), 0) as total_conversions
    FROM ad_metrics
    WHERE "organizationId" = ${orgId}
      AND platform = 'FACEBOOK_ADS'
      AND date >= ${prevStartDate}::date
      AND date <= ${prevEndDate}::date
  `;

  const pFat = Number(prevOrderAgg?.paid_revenue || 0);
  const pPed = Number(prevOrderAgg?.paid_count || 0);
  const pInv = Number(prevAdAgg?.total_spend || 0);
  const pConv = Number(prevAdAgg?.total_revenue || 0);
  const pConvs = Number(prevAdAgg?.total_conversions || 0);
  const pRoas = pInv > 0 ? pConv / pInv : 0;
  const pCpa = pConvs > 0 ? pInv / pConvs : 0;
  const pTkt = pPed > 0 ? pFat / pPed : 0;

  const pct = (cur: number, prev: number) => prev > 0 ? ((cur - prev) / prev) * 100 : null;

  const metrics: PlanMetrics = {
    faturamento,
    investido,
    convertido,
    roas,
    cpa,
    ticketMedio,
    totalPedidos,
    totalConversoes,
    changes: {
      faturamento: pct(faturamento, pFat),
      investido: pct(investido, pInv),
      convertido: pct(convertido, pConv),
      roas: pct(roas, pRoas),
      cpa: pct(cpa, pCpa),
      ticketMedio: pct(ticketMedio, pTkt),
    },
  };

  // 3. Products: aggregate from orders, then enrich via platform API
  const orders = await prisma.order.findMany({
    where: {
      organizationId: orgId,
      orderDate: { gte: periodStart, lte: periodEnd },
      status: { in: ["paid", "partially_refunded"] },
      rawData: { not: Prisma.DbNull },
    },
    select: { rawData: true, platform: true },
  });

  // Find active e-commerce integration
  const integration = await prisma.integration.findFirst({
    where: {
      organizationId: orgId,
      status: "CONNECTED",
      platform: { in: ["SHOPIFY", "NUVEMSHOP", "CARTPANDA", "YAMPI"] },
    },
  });

  // Aggregate by product_id for enrichment, and by name as fallback
  const salesById = new Map<string, { quantity: number; revenue: number }>();
  const salesByName = new Map<string, { quantity: number; revenue: number }>();
  const productIds = new Set<string>();

  for (const order of orders) {
    const raw = order.rawData as Record<string, unknown>;
    const lineItems =
      (raw?.line_items as Array<Record<string, unknown>>) ||
      (raw?.products as Array<Record<string, unknown>>) ||
      (raw?.items as Array<Record<string, unknown>>) ||
      [];

    for (const item of lineItems) {
      const pid = String(item.product_id || "");
      const name = (item.name as string) || (item.title as string) || "Produto sem nome";
      const qty = Number(item.quantity || 1);
      const price = Number(item.price || 0);
      const revenue = qty * price;

      // By name (always)
      const existingName = salesByName.get(name);
      if (existingName) {
        existingName.quantity += qty;
        existingName.revenue += revenue;
      } else {
        salesByName.set(name, { quantity: qty, revenue });
      }

      // By product_id (for API enrichment)
      if (pid) {
        productIds.add(pid);
        const existingId = salesById.get(pid);
        if (existingId) {
          existingId.quantity += qty;
          existingId.revenue += revenue;
        } else {
          salesById.set(pid, { quantity: qty, revenue });
        }
      }
    }
  }

  // Sort by quantity, get top product IDs for API enrichment
  const sortedByName = Array.from(salesByName.entries())
    .sort((a, b) => b[1].quantity - a[1].quantity);

  const sortedById = Array.from(salesById.entries())
    .sort((a, b) => b[1].quantity - a[1].quantity)
    .slice(0, 50);

  const topProductIds = sortedById.map(([id]) => id);

  // Fetch product details from platform API (images + vendor)
  const productDetailsMap = new Map<string, { imageUrl: string; vendor: string; title: string }>();

  if (integration && topProductIds.length > 0) {
    try {
      if (integration.platform === "SHOPIFY" && integration.accessToken && integration.externalStoreId) {
        const accessToken = decrypt(integration.accessToken);
        const shop = integration.externalStoreId;
        const idsParam = topProductIds.join(",");
        const url = `https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION || "2025-01"}/products.json?ids=${idsParam}&fields=id,title,vendor,image,images`;
        const response = await fetch(url, {
          headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
        });
        if (response.ok) {
          const data = await response.json();
          for (const p of (data.products || []) as ShopifyProduct[]) {
            productDetailsMap.set(String(p.id), {
              imageUrl: p.image?.src || p.images?.[0]?.src || "",
              vendor: p.vendor || "",
              title: p.title,
            });
          }
        }
      } else if (integration.platform === "NUVEMSHOP") {
        const products = await fetchNuvemshopProductsByIds(integration.id, topProductIds);
        for (const p of products as NuvemshopProduct[]) {
          productDetailsMap.set(String(p.id), {
            imageUrl: extractNuvemshopImageUrl(p.images?.[0]),
            vendor: p.brand || "",
            title: extractI18nName(p.name),
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch product details for action plan:", err);
    }
  }

  // Build top products with images — match by product_id first, fall back to name
  const topProducts: TopProduct[] = [];
  const usedNames = new Set<string>();

  // First pass: enriched products (have API data)
  for (const [pid, sales] of sortedById) {
    if (topProducts.length >= 5) break;
    const details = productDetailsMap.get(pid);
    if (details) {
      topProducts.push({
        name: details.title,
        quantity: sales.quantity,
        revenue: sales.revenue,
        imageUrl: details.imageUrl || undefined,
        vendor: details.vendor || undefined,
      });
      usedNames.add(details.title);
    }
  }

  // Second pass: fill remaining from name-based aggregation
  if (topProducts.length < 5) {
    for (const [name, sales] of sortedByName) {
      if (topProducts.length >= 5) break;
      if (usedNames.has(name)) continue;
      topProducts.push({ name, quantity: sales.quantity, revenue: sales.revenue });
    }
  }

  // Build top 3 collections from vendor grouping
  const vendorMap = new Map<string, { quantity: number; revenue: number }>();
  for (const [pid, sales] of salesById) {
    const details = productDetailsMap.get(pid);
    const vendor = details?.vendor;
    if (vendor) {
      const existing = vendorMap.get(vendor);
      if (existing) {
        existing.quantity += sales.quantity;
        existing.revenue += sales.revenue;
      } else {
        vendorMap.set(vendor, { quantity: sales.quantity, revenue: sales.revenue });
      }
    }
  }

  const topCollections: TopCollection[] = Array.from(vendorMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 3);

  // 4. Top 5 Creatives with composite score + videoUrl
  type CreativeRow = {
    ad_id: string;
    ad_name: string | null;
    thumbnail_url: string | null;
    video_url: string | null;
    total_spend: number;
    total_conversions: bigint;
    total_revenue: number;
  };

  const creativeRows = await prisma.$queryRaw<CreativeRow[]>`
    SELECT
      "adId" as ad_id,
      MAX("adName") as ad_name,
      MAX("thumbnailUrl") as thumbnail_url,
      MAX("videoUrl") as video_url,
      COALESCE(SUM(spend), 0) as total_spend,
      COALESCE(SUM(conversions), 0) as total_conversions,
      COALESCE(SUM(revenue), 0) as total_revenue
    FROM ad_metrics
    WHERE "organizationId" = ${orgId}
      AND platform = 'FACEBOOK_ADS'
      AND date >= ${periodStartDate}::date
      AND date <= ${periodEndDate}::date
      AND "adId" IS NOT NULL
    GROUP BY "adId"
    HAVING SUM(spend) > 0
    ORDER BY SUM(revenue) DESC
    LIMIT 50
  `;

  let topCreatives: TopCreative[] = [];

  if (creativeRows.length > 0) {
    const creatives = creativeRows.map((row) => {
      const spend = Number(row.total_spend);
      const sales = Number(row.total_conversions);
      const revenue = Number(row.total_revenue);
      const roas = spend > 0 ? revenue / spend : 0;
      return {
        adId: row.ad_id,
        name: row.ad_name || row.ad_id,
        thumbnailUrl: row.thumbnail_url,
        videoUrl: row.video_url,
        spend,
        sales,
        roas,
        score: 0,
      };
    });

    const maxRoas = Math.max(...creatives.map((c) => c.roas), 0.001);
    const minRoas = Math.min(...creatives.map((c) => c.roas));
    const maxSales = Math.max(...creatives.map((c) => c.sales), 0.001);
    const minSales = Math.min(...creatives.map((c) => c.sales));
    const maxSpend = Math.max(...creatives.map((c) => c.spend), 0.001);
    const minSpend = Math.min(...creatives.map((c) => c.spend));

    const normalize = (val: number, min: number, max: number) =>
      max === min ? 0.5 : (val - min) / (max - min);

    for (const c of creatives) {
      c.score =
        (normalize(c.roas, minRoas, maxRoas) +
          normalize(c.sales, minSales, maxSales) +
          normalize(c.spend, minSpend, maxSpend)) /
        3;
    }

    topCreatives = creatives
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  return { metrics, topProducts, topCollections, topCreatives };
}

// ─── Create Action Plan (with auto-populate) ──────

export async function createActionPlan(data: {
  title: string;
  periodStart: string;
  periodEnd: string;
}) {
  const ctx = await getSessionWithOrg();
  if (!ctx) throw new Error("Não autenticado");

  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    throw new Error("Sem permissão para criar planos de ação");
  }

  const periodStart = new Date(data.periodStart);
  const periodEnd = new Date(data.periodEnd);

  // Auto-populate metrics
  const { metrics, topProducts, topCollections, topCreatives } = await aggregateMetrics(
    ctx.organization.id,
    periodStart,
    periodEnd
  );

  const plan = await prisma.actionPlan.create({
    data: {
      title: data.title,
      periodStart,
      periodEnd,
      organizationId: ctx.organization.id,
      createdById: ctx.user.id,
      metrics: metrics as unknown as Prisma.JsonObject,
      topProducts: topProducts as unknown as Prisma.JsonArray,
      topCollections: topCollections as unknown as Prisma.JsonArray,
      topCreatives: topCreatives as unknown as Prisma.JsonArray,
    },
  });

  revalidatePath("/plano-de-acao");
  return plan;
}

// ─── Update Action Plan ───────────────────────────

export async function updateActionPlan(
  planId: string,
  data: {
    title?: string;
    metrics?: PlanMetrics;
    topProducts?: TopProduct[];
    topCollections?: TopCollection[];
    topCreatives?: TopCreative[];
    gaps?: GapNode[];
    levers?: LeverNode[];
    status?: "DRAFT" | "FINALIZED";
  }
) {
  const ctx = await getSessionWithOrg();
  if (!ctx) throw new Error("Não autenticado");

  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    throw new Error("Sem permissão para editar planos de ação");
  }

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.metrics !== undefined)
    updateData.metrics = data.metrics as unknown as Prisma.JsonObject;
  if (data.topProducts !== undefined)
    updateData.topProducts = data.topProducts as unknown as Prisma.JsonArray;
  if (data.topCollections !== undefined)
    updateData.topCollections = data.topCollections as unknown as Prisma.JsonArray;
  if (data.topCreatives !== undefined)
    updateData.topCreatives = data.topCreatives as unknown as Prisma.JsonArray;
  if (data.gaps !== undefined)
    updateData.gaps = data.gaps as unknown as Prisma.JsonArray;
  if (data.levers !== undefined)
    updateData.levers = data.levers as unknown as Prisma.JsonArray;

  const plan = await prisma.actionPlan.update({
    where: {
      id: planId,
      organizationId: ctx.organization.id,
    },
    data: updateData,
  });

  revalidatePath("/plano-de-acao");
  revalidatePath(`/plano-de-acao/${planId}`);
  return plan;
}

// ─── Delete Action Plan ───────────────────────────

export async function deleteActionPlan(planId: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) throw new Error("Não autenticado");

  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    throw new Error("Sem permissão para excluir planos de ação");
  }

  await prisma.actionPlan.delete({
    where: {
      id: planId,
      organizationId: ctx.organization.id,
    },
  });

  revalidatePath("/plano-de-acao");
}

// ─── Re-aggregate Metrics ─────────────────────────

export async function refreshActionPlanMetrics(planId: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) throw new Error("Não autenticado");

  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    throw new Error("Sem permissão");
  }

  const plan = await prisma.actionPlan.findFirst({
    where: { id: planId, organizationId: ctx.organization.id },
  });

  if (!plan) throw new Error("Plano não encontrado");

  const { metrics, topProducts, topCollections, topCreatives } = await aggregateMetrics(
    ctx.organization.id,
    plan.periodStart,
    plan.periodEnd
  );

  await prisma.actionPlan.update({
    where: { id: planId },
    data: {
      metrics: metrics as unknown as Prisma.JsonObject,
      topProducts: topProducts as unknown as Prisma.JsonArray,
      topCollections: topCollections as unknown as Prisma.JsonArray,
      topCreatives: topCreatives as unknown as Prisma.JsonArray,
    },
  });

  revalidatePath(`/plano-de-acao/${planId}`);
  return { metrics, topProducts, topCollections, topCreatives };
}

// ─── Get Plan by Public Token (no auth) ───────────

export async function getActionPlanByToken(token: string) {
  const plan = await prisma.actionPlan.findFirst({
    where: {
      publicToken: token,
      status: "FINALIZED",
    },
    include: {
      organization: {
        select: { name: true, logo: true },
      },
      createdBy: {
        select: { name: true, image: true },
      },
    },
  });

  if (!plan) return null;

  return {
    id: plan.id,
    title: plan.title,
    periodStart: plan.periodStart,
    periodEnd: plan.periodEnd,
    metrics: plan.metrics as PlanMetrics | null,
    topProducts: plan.topProducts as TopProduct[] | null,
    topCollections: plan.topCollections as TopCollection[] | null,
    topCreatives: plan.topCreatives as TopCreative[] | null,
    gaps: (plan.gaps as GapNode[]) || [],
    levers: (plan.levers as LeverNode[]) || [],
    organization: plan.organization,
    createdBy: plan.createdBy,
    createdAt: plan.createdAt,
  };
}
