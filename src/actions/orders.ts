"use server";

import { prisma } from "@/lib/prisma";
import { getSessionWithOrg } from "@/lib/session";

export async function getOrders(params?: {
  platform?: string;
  page?: number;
  limit?: number;
}) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { orders: [], total: 0 };

  const page = params?.page || 1;
  const limit = params?.limit || 25;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    organizationId: ctx.organization.id,
  };

  if (params?.platform) {
    where.platform = params.platform;
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { orderDate: "desc" },
      skip,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders: orders.map((o) => ({
      id: o.id,
      externalOrderId: o.externalOrderId,
      platform: o.platform,
      status: o.status,
      customerName: o.customerName,
      customerEmail: o.customerEmail,
      totalAmount: Number(o.totalAmount),
      currency: o.currency,
      itemCount: o.itemCount,
      orderDate: o.orderDate,
    })),
    total,
  };
}

export async function getOrderStats() {
  const ctx = await getSessionWithOrg();
  if (!ctx) return null;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalOrders, totalRevenue, recentOrders] = await Promise.all([
    prisma.order.count({
      where: { organizationId: ctx.organization.id },
    }),
    prisma.order.aggregate({
      where: { organizationId: ctx.organization.id },
      _sum: { totalAmount: true },
    }),
    prisma.order.count({
      where: {
        organizationId: ctx.organization.id,
        orderDate: { gte: thirtyDaysAgo },
      },
    }),
  ]);

  return {
    totalOrders,
    totalRevenue: Number(totalRevenue._sum.totalAmount || 0),
    recentOrders,
  };
}
