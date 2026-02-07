"use server";

import { prisma } from "@/lib/prisma";
import { getSessionWithOrg } from "@/lib/session";

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

export async function getDashboardData(days: number = 30, from?: string, to?: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return null;

  const orgId = ctx.organization.id;
  const { since, until } = getDateRange(days, from, to);

  const compareDays = days === 0 ? 1 : days;
  const prevSince = new Date();
  prevSince.setDate(prevSince.getDate() - compareDays * 2);

  const dateFilter = until ? { gte: since, lte: until } : { gte: since };
  const adDateFilter = until ? { gte: since, lte: until } : { gte: since };

  const [
    totalOrders,
    prevTotalOrders,
    revenue,
    prevRevenue,
    adSpend,
    prevAdSpend,
    adRevenue,
  ] = await Promise.all([
    prisma.order.count({
      where: { organizationId: orgId, orderDate: dateFilter },
    }),
    prisma.order.count({
      where: { organizationId: orgId, orderDate: { gte: prevSince, lt: since } },
    }),
    prisma.order.aggregate({
      where: { organizationId: orgId, orderDate: dateFilter, status: "paid" },
      _sum: { totalAmount: true },
    }),
    prisma.order.aggregate({
      where: { organizationId: orgId, orderDate: { gte: prevSince, lt: since }, status: "paid" },
      _sum: { totalAmount: true },
    }),
    prisma.adMetric.aggregate({
      where: { organizationId: orgId, date: adDateFilter },
      _sum: { spend: true },
    }),
    prisma.adMetric.aggregate({
      where: { organizationId: orgId, date: { gte: prevSince, lt: since } },
      _sum: { spend: true },
    }),
    prisma.adMetric.aggregate({
      where: { organizationId: orgId, date: adDateFilter },
      _sum: { revenue: true },
    }),
  ]);

  const currentRevenue = Number(revenue._sum.totalAmount || 0);
  const previousRevenue = Number(prevRevenue._sum.totalAmount || 0);
  const currentAdSpend = Number(adSpend._sum.spend || 0);
  const previousAdSpend = Number(prevAdSpend._sum.spend || 0);
  const currentAdRevenue = Number(adRevenue._sum.revenue || 0);

  function calcChange(current: number, previous: number): string {
    if (previous === 0) return current > 0 ? "+100%" : "0%";
    const change = ((current - previous) / previous) * 100;
    return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
  }

  return {
    totalOrders,
    ordersChange: calcChange(totalOrders, prevTotalOrders),
    revenue: currentRevenue,
    revenueChange: calcChange(currentRevenue, previousRevenue),
    adSpend: currentAdSpend,
    adSpendChange: calcChange(currentAdSpend, previousAdSpend),
    roas: currentAdSpend > 0 ? currentAdRevenue / currentAdSpend : 0,
  };
}

export async function getRevenueByDay(days: number = 30, from?: string, to?: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return [];

  const { since, until } = getDateRange(days, from, to);
  const dateFilter = until ? { gte: since, lte: until } : { gte: since };

  const orders = await prisma.order.findMany({
    where: {
      organizationId: ctx.organization.id,
      orderDate: dateFilter,
      status: "paid",
    },
    select: { orderDate: true, totalAmount: true },
    orderBy: { orderDate: "asc" },
  });

  const grouped: Record<string, number> = {};

  for (const order of orders) {
    const dateKey = order.orderDate.toISOString().split("T")[0];
    grouped[dateKey] = (grouped[dateKey] || 0) + Number(order.totalAmount);
  }

  return Object.entries(grouped)
    .map(([date, value]) => ({ date, revenue: value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getOrdersByPlatform() {
  const ctx = await getSessionWithOrg();
  if (!ctx) return [];

  const result = await prisma.order.groupBy({
    by: ["platform"],
    where: { organizationId: ctx.organization.id },
    _count: { id: true },
    _sum: { totalAmount: true },
  });

  const platformNames: Record<string, string> = {
    SHOPIFY: "Shopify",
    CARTPANDA: "Cartpanda",
    YAMPI: "Yampi",
    NUVEMSHOP: "Nuvemshop",
  };

  return result.map((r) => ({
    platform: platformNames[r.platform] || r.platform,
    orders: r._count.id,
    revenue: Number(r._sum.totalAmount || 0),
  }));
}

export async function getRecentOrders(limit: number = 5) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return [];

  const orders = await prisma.order.findMany({
    where: { organizationId: ctx.organization.id },
    orderBy: { orderDate: "desc" },
    take: limit,
  });

  return orders.map((o) => ({
    id: o.id,
    externalOrderId: o.externalOrderId,
    platform: o.platform,
    status: o.status,
    customerName: o.customerName,
    totalAmount: Number(o.totalAmount),
    currency: o.currency,
    orderDate: o.orderDate,
  }));
}
