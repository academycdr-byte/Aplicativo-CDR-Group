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

/**
 * Analise de Metricas: combined daily order + ad data for multi-metric chart
 */
export async function getMetricsAnalysis(days: number = 30, from?: string, to?: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return [];

  const orgId = ctx.organization.id;
  const { since, until } = getDateRange(days, from, to);
  const dateFilter = until ? { gte: since, lte: until } : { gte: since };

  const [orders, adMetrics] = await Promise.all([
    prisma.order.findMany({
      where: { organizationId: orgId, orderDate: dateFilter },
      select: { orderDate: true, totalAmount: true, status: true },
      orderBy: { orderDate: "asc" },
    }),
    prisma.adMetric.findMany({
      where: { organizationId: orgId, date: dateFilter },
      select: { date: true, spend: true, conversions: true, revenue: true },
      orderBy: { date: "asc" },
    }),
  ]);

  const grouped: Record<string, {
    date: string;
    faturamento: number;
    investimento: number;
    compras: number;
    ticketMedio: number;
    cpa: number;
    roas: number;
  }> = {};

  for (const o of orders) {
    const key = o.orderDate.toISOString().split("T")[0];
    if (!grouped[key]) grouped[key] = { date: key, faturamento: 0, investimento: 0, compras: 0, ticketMedio: 0, cpa: 0, roas: 0 };
    if (o.status === "paid") {
      grouped[key].faturamento += Number(o.totalAmount);
      grouped[key].compras += 1;
    }
  }

  for (const m of adMetrics) {
    const key = m.date.toISOString().split("T")[0];
    if (!grouped[key]) grouped[key] = { date: key, faturamento: 0, investimento: 0, compras: 0, ticketMedio: 0, cpa: 0, roas: 0 };
    grouped[key].investimento += Number(m.spend);
  }

  // Compute derived metrics
  for (const d of Object.values(grouped)) {
    d.ticketMedio = d.compras > 0 ? d.faturamento / d.compras : 0;
    d.cpa = d.compras > 0 ? d.investimento / d.compras : 0;
    d.roas = d.investimento > 0 ? d.faturamento / d.investimento : 0;
  }

  return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * E-commerce funnel: Sessoes → Adicoes ao Carrinho → Checkouts Iniciados → Pedidos Gerados
 *
 * Data sources (in priority order):
 * 1. StoreFunnel (synced from Shopify/Nuvemshop) — sessions dataset or sales + REST fallback
 * 2. Facebook Ads pixel data (rawData) — last resort for add-to-cart when store has no data
 * 3. Ad clicks — last resort for sessions when store has no session data
 *
 * The sync process always writes SOMETHING to StoreFunnel, but some metrics may be 0
 * when the Shopify `sessions` dataset is inaccessible. In that case, we supplement
 * with Facebook Ads data so the funnel never shows all zeros.
 */
export async function getFunnelData(days: number = 30, from?: string, to?: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return null;

  const orgId = ctx.organization.id;
  const { since, until } = getDateRange(days, from, to);
  const dateFilter = until ? { gte: since, lte: until } : { gte: since };

  const [
    totalOrders,
    paidOrders,
    shippedOrders,
    deliveredOrders,
    storeFunnelAgg,
    adMetrics,
  ] = await Promise.all([
    prisma.order.count({ where: { organizationId: orgId, orderDate: dateFilter } }),
    prisma.order.count({ where: { organizationId: orgId, orderDate: dateFilter, status: "paid" } }),
    prisma.order.count({ where: { organizationId: orgId, orderDate: dateFilter, status: { in: ["shipped", "delivered"] } } }),
    prisma.order.count({ where: { organizationId: orgId, orderDate: dateFilter, status: "delivered" } }),
    // Primary: store platform funnel data
    prisma.storeFunnel.aggregate({
      where: { organizationId: orgId, date: dateFilter },
      _sum: { sessions: true, addToCart: true, checkoutsInitiated: true, ordersGenerated: true },
    }).catch(() => ({ _sum: { sessions: 0, addToCart: 0, checkoutsInitiated: 0, ordersGenerated: 0 } })),
    // Fallback: Facebook Ads data for when store metrics are incomplete
    prisma.adMetric.findMany({
      where: { organizationId: orgId, date: dateFilter },
      select: { rawData: true, clicks: true, addToCart: true },
    }),
  ]);

  // Store platform data (primary source)
  let sessoes = storeFunnelAgg._sum.sessions || 0;
  let adicoesCarrinho = storeFunnelAgg._sum.addToCart || 0;
  const checkoutsIniciados = storeFunnelAgg._sum.checkoutsInitiated || 0;
  const pedidosGerados = storeFunnelAgg._sum.ordersGenerated || totalOrders;

  // Fallback: if store sessions or add-to-cart are 0, supplement with Facebook Ads data
  if (sessoes === 0 || adicoesCarrinho === 0) {
    let fbClicks = 0;
    let fbAddToCart = 0;

    for (const m of adMetrics) {
      fbClicks += m.clicks || 0;
      fbAddToCart += m.addToCart || 0;

      // Also try parsing rawData for add_to_cart actions
      if (fbAddToCart === 0 && m.rawData && typeof m.rawData === "object") {
        const raw = m.rawData as Record<string, unknown>;
        const actions = raw.actions as Array<{ action_type: string; value: string }> | undefined;
        if (actions) {
          const atc = actions.find((a) =>
            a.action_type === "add_to_cart" || a.action_type === "offsite_conversion.fb_pixel_add_to_cart"
          );
          if (atc) fbAddToCart += parseInt(atc.value || "0");
        }
      }
    }

    if (sessoes === 0 && fbClicks > 0) sessoes = fbClicks;
    if (adicoesCarrinho === 0 && fbAddToCart > 0) adicoesCarrinho = fbAddToCart;
  }

  return {
    sessoes,
    adicoesCarrinho,
    checkoutsIniciados,
    pedidosGerados,
    pedidosPagos: paidOrders,
    pedidosEnviados: shippedOrders,
    pedidosEntregues: deliveredOrders,
  };
}

/**
 * % paid orders and % repurchase rate
 */
export async function getPaidAndRepurchaseRates(days: number = 30, from?: string, to?: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return null;

  const orgId = ctx.organization.id;
  const { since, until } = getDateRange(days, from, to);
  const dateFilter = until ? { gte: since, lte: until } : { gte: since };

  const [totalOrders, paidOrders, allCustomers] = await Promise.all([
    prisma.order.count({ where: { organizationId: orgId, orderDate: dateFilter } }),
    prisma.order.count({ where: { organizationId: orgId, orderDate: dateFilter, status: "paid" } }),
    prisma.order.findMany({
      where: { organizationId: orgId, orderDate: dateFilter, customerEmail: { not: null } },
      select: { customerEmail: true },
    }),
  ]);

  // Count unique customers and those with more than 1 order
  const emailCounts: Record<string, number> = {};
  for (const o of allCustomers) {
    if (o.customerEmail) {
      emailCounts[o.customerEmail] = (emailCounts[o.customerEmail] || 0) + 1;
    }
  }

  const uniqueCustomers = Object.keys(emailCounts).length;
  const repeatCustomers = Object.values(emailCounts).filter((c) => c > 1).length;

  return {
    paidRate: totalOrders > 0 ? (paidOrders / totalOrders) * 100 : 0,
    paidOrders,
    totalOrders,
    repurchaseRate: uniqueCustomers > 0 ? (repeatCustomers / uniqueCustomers) * 100 : 0,
    repeatCustomers,
    uniqueCustomers,
  };
}

/**
 * Customer trends by month: new vs returning customers
 */
export async function getCustomerTrends(days: number = 30, from?: string, to?: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return [];

  const orgId = ctx.organization.id;
  const { since, until } = getDateRange(days, from, to);
  const dateFilter = until ? { gte: since, lte: until } : { gte: since };

  // Get orders in period with customer emails
  const orders = await prisma.order.findMany({
    where: { organizationId: orgId, orderDate: dateFilter, customerEmail: { not: null } },
    select: { customerEmail: true, orderDate: true },
    orderBy: { orderDate: "asc" },
  });

  // Get all customer emails that ordered BEFORE the period (returning customers)
  const priorCustomers = await prisma.order.findMany({
    where: { organizationId: orgId, orderDate: { lt: since }, customerEmail: { not: null } },
    select: { customerEmail: true },
    distinct: ["customerEmail"],
  });

  const priorSet = new Set(priorCustomers.map((o) => o.customerEmail!));

  // Group by month
  const monthly: Record<string, { month: string; novos: number; recorrentes: number; seenNew: Set<string>; seenRec: Set<string> }> = {};

  for (const o of orders) {
    if (!o.customerEmail) continue;
    const d = o.orderDate;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    if (!monthly[key]) {
      monthly[key] = { month: key, novos: 0, recorrentes: 0, seenNew: new Set(), seenRec: new Set() };
    }

    const entry = monthly[key];
    const isReturning = priorSet.has(o.customerEmail);

    if (isReturning) {
      if (!entry.seenRec.has(o.customerEmail)) {
        entry.recorrentes += 1;
        entry.seenRec.add(o.customerEmail);
      }
    } else {
      if (!entry.seenNew.has(o.customerEmail)) {
        entry.novos += 1;
        entry.seenNew.add(o.customerEmail);
        // Once seen as new, also add to prior set for subsequent months
        priorSet.add(o.customerEmail);
      }
    }
  }

  return Object.values(monthly)
    .map(({ month, novos, recorrentes }) => ({
      month,
      novos,
      recorrentes,
      taxaRecorrencia: (novos + recorrentes) > 0 ? (recorrentes / (novos + recorrentes)) * 100 : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
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
