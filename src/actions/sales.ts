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

export async function getSalesData(days: number = 30, from?: string, to?: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return null;

  const orgId = ctx.organization.id;
  const { since, until } = getDateRange(days, from, to);
  const dateFilter = until ? { gte: since, lte: until } : { gte: since };

  const [totalRevenue, totalOrders, avgTicket, topProducts] = await Promise.all([
    prisma.order.aggregate({
      where: { organizationId: orgId, orderDate: dateFilter, status: "paid" },
      _sum: { totalAmount: true },
    }),
    prisma.order.count({
      where: { organizationId: orgId, orderDate: dateFilter, status: "paid" },
    }),
    prisma.order.aggregate({
      where: { organizationId: orgId, orderDate: dateFilter, status: "paid" },
      _avg: { totalAmount: true },
    }),
    prisma.order.groupBy({
      by: ["platform"],
      where: { organizationId: orgId, orderDate: dateFilter },
      _count: { id: true },
      _sum: { totalAmount: true },
    }),
  ]);

  const platformNames: Record<string, string> = {
    SHOPIFY: "Shopify",
    CARTPANDA: "Cartpanda",
    YAMPI: "Yampi",
    NUVEMSHOP: "Nuvemshop",
  };

  return {
    totalRevenue: Number(totalRevenue._sum.totalAmount || 0),
    totalOrders,
    avgTicket: Number(avgTicket._avg.totalAmount || 0),
    byPlatform: topProducts.map((p) => ({
      platform: platformNames[p.platform] || p.platform,
      orders: p._count.id,
      revenue: Number(p._sum.totalAmount || 0),
    })),
  };
}

export async function getSalesByDay(days: number = 30, from?: string, to?: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return [];

  const { since, until } = getDateRange(days, from, to);
  const dateFilter = until ? { gte: since, lte: until } : { gte: since };

  const orders = await prisma.order.findMany({
    where: {
      organizationId: ctx.organization.id,
      orderDate: dateFilter,
    },
    select: { orderDate: true, totalAmount: true, status: true },
    orderBy: { orderDate: "asc" },
  });

  const grouped: Record<string, { date: string; revenue: number; orders: number }> = {};

  for (const order of orders) {
    const dateKey = order.orderDate.toISOString().split("T")[0];
    if (!grouped[dateKey]) {
      grouped[dateKey] = { date: dateKey, revenue: 0, orders: 0 };
    }
    grouped[dateKey].orders += 1;
    if (order.status === "paid") {
      grouped[dateKey].revenue += Number(order.totalAmount);
    }
  }

  return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getSalesByStatus() {
  const ctx = await getSessionWithOrg();
  if (!ctx) return [];

  const result = await prisma.order.groupBy({
    by: ["status"],
    where: { organizationId: ctx.organization.id },
    _count: { id: true },
  });

  const statusLabels: Record<string, string> = {
    paid: "Pago",
    pending: "Pendente",
    cancelled: "Cancelado",
    refunded: "Reembolsado",
    shipped: "Enviado",
    delivered: "Entregue",
  };

  return result.map((r) => ({
    status: statusLabels[r.status] || r.status,
    count: r._count.id,
  }));
}
