"use server";

import { prisma } from "@/lib/prisma";
import { getSessionWithOrg } from "@/lib/session";
import { getDateRange, getPreviousDateRange, buildDateFilter, toDateKeyBrasilia } from "@/lib/date-utils";
import { Prisma } from "@prisma/client";
import { getMetricsAnalysis, getOrdersByPlatform } from "@/actions/dashboard";

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
  dateFilter: { gte: Date; lte: Date },
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
  const currentDateFilter = buildDateFilter(currentRange);

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

  const dateFilter = buildDateFilter(getDateRange(days, from, to));

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
    const dateKey = toDateKeyBrasilia(m.date);
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
  const dateFilter = buildDateFilter(getDateRange(days, params?.from, params?.to));

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

/**
 * Consolidated ads page data loader (1 HTTP round-trip instead of 3).
 */
export async function loadAllAdsData(
  params: FilterParams & { days: number; from?: string; to?: string },
  searchQuery?: string,
  excludedTerms?: string[],
) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return null;

  const { days, from, to } = params;
  const results = await Promise.allSettled([
    getAdMetrics(params),
    getAdMetricsByDay(days, from, to, searchQuery, excludedTerms, params.platform),
    getCreativePerformance(params),
  ]);

  return {
    metrics: results[0].status === "fulfilled" ? results[0].value : { metrics: [], totals: null, previousTotals: null },
    dailyData: results[1].status === "fulfilled" ? results[1].value : [],
    creatives: results[2].status === "fulfilled" ? results[2].value : [],
    failedCount: results.filter((r) => r.status === "rejected").length,
  };
}

/**
 * Consolidated analytics page data loader (1 HTTP round-trip instead of 4).
 */
export async function loadAllAnalyticsData(days: number, from?: string, to?: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return null;

  const adParams = { days, from, to };
  const results = await Promise.allSettled([
    getAdMetrics(adParams),
    getMetricsAnalysis(days, from, to),
    getCreativePerformance(adParams),
    getOrdersByPlatform(),
    loadGoogleAnalyticsData(ctx.organization.id, days, from, to),
  ]);

  return {
    adMetrics: results[0].status === "fulfilled" ? results[0].value : { metrics: [], totals: null, previousTotals: null },
    dailyData: results[1].status === "fulfilled" ? results[1].value : [],
    creatives: results[2].status === "fulfilled" ? results[2].value : [],
    platformData: results[3].status === "fulfilled" ? results[3].value : [],
    gaData: results[4].status === "fulfilled" ? results[4].value : null,
    failedCount: results.filter((r) => r.status === "rejected").length,
  };
}

/**
 * Load Google Analytics data for the analytics page.
 */
async function loadGoogleAnalyticsData(organizationId: string, days: number, from?: string, to?: string) {
  const { since, until } = getDateRange(days, from, to);

  const metrics = await prisma.analyticsMetric.findMany({
    where: {
      organizationId,
      date: { gte: since, lte: until },
    },
    orderBy: { date: "asc" },
  });

  if (metrics.length === 0) return null;

  // Calculate totals
  let totalSessions = 0;
  let totalActiveUsers = 0;
  let totalNewUsers = 0;
  let totalPageViews = 0;
  let totalConversions = 0;
  let bounceRateSum = 0;
  let engagementRateSum = 0;
  let avgDurationSum = 0;

  for (const m of metrics) {
    totalSessions += m.sessions;
    totalActiveUsers += m.activeUsers;
    totalNewUsers += m.newUsers;
    totalPageViews += m.screenPageViews;
    totalConversions += m.conversions;
    bounceRateSum += Number(m.bounceRate);
    engagementRateSum += Number(m.engagementRate);
    avgDurationSum += Number(m.averageSessionDuration);
  }

  const count = metrics.length;

  // Aggregate traffic sources across all days
  const trafficAgg: Record<string, { sessions: number; activeUsers: number }> = {};
  const devicesAgg: Record<string, { sessions: number; activeUsers: number }> = {};
  const geoAgg: Record<string, { sessions: number; activeUsers: number }> = {};
  const pagesAgg: Record<string, { screenPageViews: number; activeUsers: number }> = {};
  const genderAgg: Record<string, { sessions: number; activeUsers: number }> = {};
  const ageAgg: Record<string, { sessions: number; activeUsers: number }> = {};

  for (const m of metrics) {
    const traffic = m.trafficSources as Record<string, { sessions: number; activeUsers: number }> | null;
    if (traffic) {
      for (const [key, val] of Object.entries(traffic)) {
        if (!trafficAgg[key]) trafficAgg[key] = { sessions: 0, activeUsers: 0 };
        trafficAgg[key].sessions += val.sessions || 0;
        trafficAgg[key].activeUsers += val.activeUsers || 0;
      }
    }

    const devices = m.devices as Record<string, { sessions: number; activeUsers: number }> | null;
    if (devices) {
      for (const [key, val] of Object.entries(devices)) {
        if (!devicesAgg[key]) devicesAgg[key] = { sessions: 0, activeUsers: 0 };
        devicesAgg[key].sessions += val.sessions || 0;
        devicesAgg[key].activeUsers += val.activeUsers || 0;
      }
    }

    const geo = m.geography as Record<string, { sessions: number; activeUsers: number }> | null;
    if (geo) {
      for (const [key, val] of Object.entries(geo)) {
        if (!geoAgg[key]) geoAgg[key] = { sessions: 0, activeUsers: 0 };
        geoAgg[key].sessions += val.sessions || 0;
        geoAgg[key].activeUsers += val.activeUsers || 0;
      }
    }

    const pages = m.topPages as Record<string, { screenPageViews: number; activeUsers: number }> | null;
    if (pages) {
      for (const [key, val] of Object.entries(pages)) {
        if (!pagesAgg[key]) pagesAgg[key] = { screenPageViews: 0, activeUsers: 0 };
        pagesAgg[key].screenPageViews += val.screenPageViews || 0;
        pagesAgg[key].activeUsers += val.activeUsers || 0;
      }
    }

    const genderData = (m as Record<string, unknown>).gender as Record<string, { sessions: number; activeUsers: number }> | null;
    if (genderData) {
      for (const [key, val] of Object.entries(genderData)) {
        if (!genderAgg[key]) genderAgg[key] = { sessions: 0, activeUsers: 0 };
        genderAgg[key].sessions += val.sessions || 0;
        genderAgg[key].activeUsers += val.activeUsers || 0;
      }
    }

    const ageData = (m as Record<string, unknown>).age as Record<string, { sessions: number; activeUsers: number }> | null;
    if (ageData) {
      for (const [key, val] of Object.entries(ageData)) {
        if (!ageAgg[key]) ageAgg[key] = { sessions: 0, activeUsers: 0 };
        ageAgg[key].sessions += val.sessions || 0;
        ageAgg[key].activeUsers += val.activeUsers || 0;
      }
    }
  }

  return {
    totals: {
      sessions: totalSessions,
      activeUsers: totalActiveUsers,
      newUsers: totalNewUsers,
      screenPageViews: totalPageViews,
      conversions: totalConversions,
      bounceRate: count > 0 ? bounceRateSum / count : 0,
      engagementRate: count > 0 ? engagementRateSum / count : 0,
      avgSessionDuration: count > 0 ? avgDurationSum / count : 0,
    },
    dailyData: metrics.map((m) => ({
      date: m.date.toISOString().split("T")[0],
      sessions: m.sessions,
      activeUsers: m.activeUsers,
      screenPageViews: m.screenPageViews,
      newUsers: m.newUsers,
    })),
    trafficSources: Object.entries(trafficAgg)
      .map(([source, val]) => ({ source, ...val }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10),
    devices: Object.entries(devicesAgg)
      .map(([device, val]) => ({ device, ...val }))
      .sort((a, b) => b.sessions - a.sessions),
    geography: Object.entries(geoAgg)
      .map(([country, val]) => ({ country, ...val }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10),
    topPages: Object.entries(pagesAgg)
      .map(([path, val]) => ({ path, ...val }))
      .sort((a, b) => b.screenPageViews - a.screenPageViews)
      .slice(0, 10),
    gender: Object.entries(genderAgg)
      .map(([label, val]) => ({ label, ...val }))
      .sort((a, b) => b.sessions - a.sessions),
    age: Object.entries(ageAgg)
      .map(([label, val]) => ({ label, ...val }))
      .sort((a, b) => b.sessions - a.sessions),
  };
}
