"use server";

import { prisma } from "@/lib/prisma";
import { getSessionWithOrg } from "@/lib/session";
import { Prisma } from "@prisma/client";

function getDateRange(days: number, from?: string, to?: string): { since: Date; until?: Date } {
  if (from && to) {
    return { since: new Date(from), until: new Date(to) };
  }
  const since = new Date();
  if (days === 0) {
    since.setHours(0, 0, 0, 0);
  } else {
    since.setDate(since.getDate() - days);
  }
  return { since };
}

function getPreviousDateRange(days: number, from?: string, to?: string): { since: Date; until: Date } {
  let currentSince: Date;
  let currentUntil: Date;

  if (from && to) {
    currentSince = new Date(from);
    currentUntil = new Date(to);
  } else {
    currentUntil = new Date();
    currentSince = new Date();
    if (days === 0) {
      currentSince.setHours(0, 0, 0, 0);
    } else {
      currentSince.setDate(currentSince.getDate() - days);
    }
  }

  const duration = currentUntil.getTime() - currentSince.getTime();
  const previousUntil = new Date(currentSince.getTime() - 1); // 1ms before current start
  const previousSince = new Date(previousUntil.getTime() - duration);

  return { since: previousSince, until: previousUntil };
}

type FilterParams = {
  platform?: string;
  days?: number;
  from?: string;
  to?: string;
  search?: string;
  exclude?: string[];
};

function buildWhereClause(
  orgId: string,
  dateFilter: { gte: Date; lte?: Date },
  params?: FilterParams
): Prisma.AdMetricWhereInput {
  const where: Prisma.AdMetricWhereInput = {
    organizationId: orgId,
    date: dateFilter,
  };

  if (params?.platform && params.platform !== "all") {
    where.platform = params.platform as any;
  }

  const conditions: Prisma.AdMetricWhereInput[] = [];

  if (params?.search) {
    conditions.push({
      adName: { contains: params.search, mode: "insensitive" },
    });
  }

  if (params?.exclude && params.exclude.length > 0) {
    params.exclude.forEach((term) => {
      conditions.push({
        NOT: {
          adName: { contains: term, mode: "insensitive" },
        },
      });
    });
  }

  if (conditions.length > 0) {
    where.AND = conditions;
  }

  return where;
}

export async function getAdMetrics(params?: FilterParams) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { metrics: [], totals: null, previousTotals: null };

  const days = params?.days || 30;

  // Current Period
  const currentRange = getDateRange(days, params?.from, params?.to);
  const currentDateFilter = currentRange.until
    ? { gte: currentRange.since, lte: currentRange.until }
    : { gte: currentRange.since };

  const currentWhere = buildWhereClause(ctx.organization.id, currentDateFilter, params);

  // Previous Period
  const prevRange = getPreviousDateRange(days, params?.from, params?.to);
  const prevDateFilter = { gte: prevRange.since, lte: prevRange.until };
  const prevWhere = buildWhereClause(ctx.organization.id, prevDateFilter, params);

  // Run queries in parallel
  const [metrics, currentAgg, prevAgg] = await Promise.all([
    prisma.adMetric.findMany({
      where: currentWhere,
      orderBy: { date: "desc" },
      select: {
        id: true, platform: true, campaignId: true, campaignName: true,
        adSetId: true, adSetName: true, adId: true, adName: true,
        thumbnailUrl: true, date: true, impressions: true, reach: true,
        clicks: true, spend: true, conversions: true, revenue: true, currency: true,
        addToCart: true, initiateCheckout: true,
      },
    }),
    prisma.adMetric.aggregate({
      where: currentWhere,
      _sum: {
        impressions: true, reach: true, clicks: true,
        spend: true, conversions: true, revenue: true,
        addToCart: true, initiateCheckout: true,
      },
    }),
    prisma.adMetric.aggregate({
      where: prevWhere,
      _sum: {
        impressions: true, reach: true, clicks: true,
        spend: true, conversions: true, revenue: true,
        addToCart: true, initiateCheckout: true,
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
      addToCart: m.addToCart,
      initiateCheckout: m.initiateCheckout,
      currency: m.currency,
    })),
    totals: {
      impressions: currentAgg._sum.impressions || 0,
      reach: currentAgg._sum.reach || 0,
      clicks: currentAgg._sum.clicks || 0,
      spend: Number(currentAgg._sum.spend || 0),
      conversions: currentAgg._sum.conversions || 0,
      revenue: Number(currentAgg._sum.revenue || 0),
      addToCart: currentAgg._sum.addToCart || 0,
      initiateCheckout: currentAgg._sum.initiateCheckout || 0,
    },
    previousTotals: {
      impressions: prevAgg._sum.impressions || 0,
      reach: prevAgg._sum.reach || 0,
      clicks: prevAgg._sum.clicks || 0,
      spend: Number(prevAgg._sum.spend || 0),
      conversions: prevAgg._sum.conversions || 0,
      revenue: Number(prevAgg._sum.revenue || 0),
      addToCart: prevAgg._sum.addToCart || 0,
      initiateCheckout: prevAgg._sum.initiateCheckout || 0,
    },
  };
}

export async function getAdMetricsByDay(days: number = 30, from?: string, to?: string, search?: string, exclude?: string[], platform?: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return [];

  const { since, until } = getDateRange(days, from, to);
  const dateFilter = until ? { gte: since, lte: until } : { gte: since };

  // Reuse logic by constructing params object
  const params: FilterParams = { search, exclude, platform };
  const where = buildWhereClause(ctx.organization.id, dateFilter, params);

  const metrics = await prisma.adMetric.findMany({
    where,
    select: { date: true, spend: true, impressions: true, clicks: true, conversions: true, revenue: true, addToCart: true, initiateCheckout: true },
    orderBy: { date: "asc" },
  });

  // Group by date
  const grouped: Record<string, { date: string; spend: number; impressions: number; clicks: number; conversions: number; revenue: number; addToCart: number; initiateCheckout: number }> = {};

  for (const m of metrics) {
    const dateKey = m.date.toISOString().split("T")[0];
    if (!grouped[dateKey]) {
      grouped[dateKey] = { date: dateKey, spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, addToCart: 0, initiateCheckout: 0 };
    }
    grouped[dateKey].spend += Number(m.spend);
    grouped[dateKey].impressions += m.impressions;
    grouped[dateKey].clicks += m.clicks;
    grouped[dateKey].conversions += m.conversions;
    grouped[dateKey].revenue += Number(m.revenue);
    grouped[dateKey].addToCart += m.addToCart;
    grouped[dateKey].initiateCheckout += m.initiateCheckout;
  }

  return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getCreativePerformance(params?: FilterParams) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return [];

  const days = params?.days || 30;
  const { since, until } = getDateRange(days, params?.from, params?.to);
  const dateFilter = until ? { gte: since, lte: until } : { gte: since };

  const where = buildWhereClause(ctx.organization.id, dateFilter, params);

  // Ensure we only get rows with adId for creative performance
  where.adId = { not: null };

  const metrics = await prisma.adMetric.findMany({
    where,
    select: {
      adId: true, adName: true, campaignName: true, adSetName: true,
      platform: true, thumbnailUrl: true, videoUrl: true, impressions: true, reach: true,
      clicks: true, spend: true, conversions: true, revenue: true,
      addToCart: true, initiateCheckout: true,
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
    videoUrl: string | null;
    impressions: number;
    reach: number;
    clicks: number;
    spend: number;
    conversions: number;
    revenue: number;
    addToCart: number;
    initiateCheckout: number;
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
        videoUrl: m.videoUrl,
        impressions: 0,
        reach: 0,
        clicks: 0,
        spend: 0,
        conversions: 0,
        revenue: 0,
        addToCart: 0,
        initiateCheckout: 0,
      };
    }
    byAd[key].impressions += m.impressions;
    byAd[key].reach += m.reach;
    byAd[key].clicks += m.clicks;
    byAd[key].spend += Number(m.spend);
    byAd[key].conversions += m.conversions;
    byAd[key].revenue += Number(m.revenue);
    byAd[key].addToCart += m.addToCart;
    byAd[key].initiateCheckout += m.initiateCheckout;

    // Keep the latest non-null thumbnail and video URL
    if (m.thumbnailUrl && !byAd[key].thumbnailUrl) {
      byAd[key].thumbnailUrl = m.thumbnailUrl;
    }
    if (m.videoUrl && !byAd[key].videoUrl) {
      byAd[key].videoUrl = m.videoUrl;
    }
  }

  // Sort by spend desc and compute derived metrics
  return Object.values(byAd)
    .map((c) => ({
      ...c,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      roas: c.spend > 0 ? c.revenue / c.spend : 0,
      cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
      cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0,
    }))
    .sort((a, b) => b.spend - a.spend);
}
