"use server";

import { prisma } from "@/lib/prisma";
import { getSessionWithOrg } from "@/lib/session";

export async function getAdMetrics(params?: {
  platform?: string;
  days?: number;
}) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { metrics: [], totals: null };

  const days = params?.days || 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const where: Record<string, unknown> = {
    organizationId: ctx.organization.id,
    date: { gte: since },
  };

  if (params?.platform) {
    where.platform = params.platform;
  }

  const metrics = await prisma.adMetric.findMany({
    where,
    orderBy: { date: "desc" },
  });

  const totals = await prisma.adMetric.aggregate({
    where,
    _sum: {
      impressions: true,
      clicks: true,
      spend: true,
      conversions: true,
      revenue: true,
    },
  });

  return {
    metrics: metrics.map((m) => ({
      id: m.id,
      platform: m.platform,
      campaignId: m.campaignId,
      campaignName: m.campaignName,
      adSetId: m.adSetId,
      adSetName: m.adSetName,
      date: m.date,
      impressions: m.impressions,
      clicks: m.clicks,
      spend: Number(m.spend),
      conversions: m.conversions,
      revenue: Number(m.revenue),
      currency: m.currency,
    })),
    totals: {
      impressions: totals._sum.impressions || 0,
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

  const since = new Date();
  since.setDate(since.getDate() - days);

  const metrics = await prisma.adMetric.findMany({
    where: {
      organizationId: ctx.organization.id,
      date: { gte: since },
    },
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
