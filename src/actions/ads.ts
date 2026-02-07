"use server";

import { prisma } from "@/lib/prisma";
import { getSessionWithOrg } from "@/lib/session";

function getSince(days: number): Date {
  const since = new Date();
  if (days === 0) {
    since.setHours(0, 0, 0, 0);
  } else {
    since.setDate(since.getDate() - days);
  }
  return since;
}

export async function getAdMetrics(params?: {
  platform?: string;
  days?: number;
}) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { metrics: [], totals: null };

  const days = params?.days || 30;
  const since = getSince(days);

  const where: Record<string, unknown> = {
    organizationId: ctx.organization.id,
    date: { gte: since },
  };

  if (params?.platform) {
    where.platform = params.platform;
  }

  // Run both queries in parallel for speed
  const [metrics, totals] = await Promise.all([
    prisma.adMetric.findMany({
      where,
      orderBy: { date: "desc" },
      select: {
        id: true, platform: true, campaignId: true, campaignName: true,
        adSetId: true, adSetName: true, adId: true, adName: true,
        thumbnailUrl: true, date: true, impressions: true, reach: true,
        clicks: true, spend: true, conversions: true, revenue: true, currency: true,
      },
    }),
    prisma.adMetric.aggregate({
      where,
      _sum: {
        impressions: true, reach: true, clicks: true,
        spend: true, conversions: true, revenue: true,
      },
    }),
  ]);

  return {
    metrics: metrics.map((m) => ({
      id: m.id,
      platform: m.platform,
      campaignId: m.campaignId,
      campaignName: m.campaignName,
      adSetId: m.adSetId,
      adSetName: m.adSetName,
      adId: m.adId,
      adName: m.adName,
      thumbnailUrl: m.thumbnailUrl,
      date: m.date,
      impressions: m.impressions,
      reach: m.reach,
      clicks: m.clicks,
      spend: Number(m.spend),
      conversions: m.conversions,
      revenue: Number(m.revenue),
      currency: m.currency,
    })),
    totals: {
      impressions: totals._sum.impressions || 0,
      reach: totals._sum.reach || 0,
      clicks: totals._sum.clicks || 0,
      spend: Number(totals._sum.spend || 0),
      conversions: totals._sum.conversions || 0,
      revenue: Number(totals._sum.revenue || 0),
    },
  };
}

export async function getAdMetricsByDay(days: number = 30) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return [];

  const since = getSince(days);

  const metrics = await prisma.adMetric.findMany({
    where: {
      organizationId: ctx.organization.id,
      date: { gte: since },
    },
    select: { date: true, spend: true, impressions: true, clicks: true, conversions: true, revenue: true },
    orderBy: { date: "asc" },
  });

  // Group by date
  const grouped: Record<string, { date: string; spend: number; impressions: number; clicks: number; conversions: number; revenue: number }> = {};

  for (const m of metrics) {
    const dateKey = m.date.toISOString().split("T")[0];
    if (!grouped[dateKey]) {
      grouped[dateKey] = { date: dateKey, spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
    }
    grouped[dateKey].spend += Number(m.spend);
    grouped[dateKey].impressions += m.impressions;
    grouped[dateKey].clicks += m.clicks;
    grouped[dateKey].conversions += m.conversions;
    grouped[dateKey].revenue += Number(m.revenue);
  }

  return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Aggregates ad metrics by creative (adId) for the "Top Creatives" view.
 * Groups all daily metrics for each ad and returns totals + computed metrics.
 */
export async function getCreativePerformance(params?: {
  platform?: string;
  days?: number;
}) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return [];

  const days = params?.days || 30;
  const since = getSince(days);

  const where: Record<string, unknown> = {
    organizationId: ctx.organization.id,
    date: { gte: since },
    adId: { not: null },
  };

  if (params?.platform) {
    where.platform = params.platform;
  }

  const metrics = await prisma.adMetric.findMany({
    where,
    select: {
      adId: true, adName: true, campaignName: true, adSetName: true,
      platform: true, thumbnailUrl: true, impressions: true, reach: true,
      clicks: true, spend: true, conversions: true, revenue: true,
    },
    orderBy: { date: "desc" },
  });

  // Group by adId
  const byAd: Record<string, {
    adId: string;
    adName: string | null;
    campaignName: string | null;
    adSetName: string | null;
    platform: string;
    thumbnailUrl: string | null;
    impressions: number;
    reach: number;
    clicks: number;
    spend: number;
    conversions: number;
    revenue: number;
  }> = {};

  for (const m of metrics) {
    const key = m.adId || "unknown";
    if (!byAd[key]) {
      byAd[key] = {
        adId: key,
        adName: m.adName,
        campaignName: m.campaignName,
        adSetName: m.adSetName,
        platform: m.platform,
        thumbnailUrl: m.thumbnailUrl,
        impressions: 0,
        reach: 0,
        clicks: 0,
        spend: 0,
        conversions: 0,
        revenue: 0,
      };
    }
    byAd[key].impressions += m.impressions;
    byAd[key].reach += m.reach;
    byAd[key].clicks += m.clicks;
    byAd[key].spend += Number(m.spend);
    byAd[key].conversions += m.conversions;
    byAd[key].revenue += Number(m.revenue);
    // Keep the latest non-null thumbnail
    if (m.thumbnailUrl && !byAd[key].thumbnailUrl) {
      byAd[key].thumbnailUrl = m.thumbnailUrl;
    }
  }

  // Sort by spend desc (highest spend first)
  return Object.values(byAd).sort((a, b) => b.spend - a.spend);
}
