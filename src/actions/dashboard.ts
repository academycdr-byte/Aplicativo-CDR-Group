"use server";

import { prisma } from "@/lib/prisma";
import { getSessionWithOrg } from "@/lib/session";
import { getDateRange, getPreviousDateRange, buildDateFilter } from "@/lib/date-utils";

export async function getDashboardData(days: number = 30, from?: string, to?: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return null;

  const orgId = ctx.organization.id;
  const range = getDateRange(days, from, to);
  const dateFilter = buildDateFilter(range);
  const prevRange = getPreviousDateRange(days, from, to);
  const prevDateFilter = buildDateFilter(prevRange);

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
      where: { organizationId: orgId, orderDate: prevDateFilter },
    }),
    prisma.order.aggregate({
      where: { organizationId: orgId, orderDate: dateFilter, status: { in: ["paid", "pending"] } },
      _sum: { totalAmount: true },
    }),
    prisma.order.aggregate({
      where: { organizationId: orgId, orderDate: prevDateFilter, status: { in: ["paid", "pending"] } },
      _sum: { totalAmount: true },
    }),
    prisma.adMetric.aggregate({
      where: { organizationId: orgId, date: dateFilter },
      _sum: { spend: true },
    }),
    prisma.adMetric.aggregate({
      where: { organizationId: orgId, date: prevDateFilter },
      _sum: { spend: true },
    }),
    prisma.adMetric.aggregate({
      where: { organizationId: orgId, date: dateFilter },
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

  const dateFilter = buildDateFilter(getDateRange(days, from, to));

  const orders = await prisma.order.findMany({
    where: {
      organizationId: ctx.organization.id,
      orderDate: dateFilter,
      status: { in: ["paid", "pending"] },
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
  const dateFilter = buildDateFilter(getDateRange(days, from, to));

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
    if (o.status === "paid" || o.status === "pending") {
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
 * Uses the BEST available data for each metric:
 * - StoreFunnel (from Shopify/Nuvemshop sync) is primary
 * - Facebook Ads data fills in any gaps (sessions from clicks, add-to-cart from pixel)
 * - Order count from database is the ultimate fallback for orders
 *
 * NEVER returns zeros when we have data from ANY source.
 */
export async function getFunnelData(days: number = 30, from?: string, to?: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return null;

  const orgId = ctx.organization.id;
  const dateFilter = buildDateFilter(getDateRange(days, from, to));

  const [
    totalOrders,
    paidOrders,
    shippedOrders,
    deliveredOrders,
    storeFunnelAgg,
    adAgg,
  ] = await Promise.all([
    prisma.order.count({ where: { organizationId: orgId, orderDate: dateFilter } }),
    prisma.order.count({ where: { organizationId: orgId, orderDate: dateFilter, status: "paid" } }),
    prisma.order.count({ where: { organizationId: orgId, orderDate: dateFilter, status: { in: ["shipped", "delivered"] } } }),
    prisma.order.count({ where: { organizationId: orgId, orderDate: dateFilter, status: "delivered" } }),
    // Source 1: Store platform funnel (Shopify ShopifyQL / Nuvemshop)
    prisma.storeFunnel.aggregate({
      where: { organizationId: orgId, date: dateFilter },
      _sum: { sessions: true, addToCart: true, checkoutsInitiated: true, ordersGenerated: true },
    }).catch(() => ({ _sum: { sessions: 0, addToCart: 0, checkoutsInitiated: 0, ordersGenerated: 0 } })),
    // Source 2: Facebook Ads aggregated metrics (clicks, addToCart column)
    prisma.adMetric.aggregate({
      where: { organizationId: orgId, date: dateFilter },
      _sum: { clicks: true, addToCart: true, initiateCheckout: true },
    }).catch(() => ({ _sum: { clicks: 0, addToCart: 0, initiateCheckout: 0 } })),
  ]);

  // Store platform data
  const storeSessions = Number(storeFunnelAgg._sum.sessions || 0);
  const storeAddToCart = Number(storeFunnelAgg._sum.addToCart || 0);
  const storeCheckouts = Number(storeFunnelAgg._sum.checkoutsInitiated || 0);
  const storeOrders = Number(storeFunnelAgg._sum.ordersGenerated || 0);

  // Facebook Ads data
  const fbClicks = Number(adAgg._sum.clicks || 0);
  const fbInitiateCheckout = Number(adAgg._sum.initiateCheckout || 0);
  let fbAddToCart = Number(adAgg._sum.addToCart || 0);

  // Lazy-load rawData only if addToCart column has no data (avoids heavy JSON fetch)
  if (fbAddToCart === 0) {
    const adMetricsRaw = await prisma.adMetric.findMany({
      where: { organizationId: orgId, date: dateFilter },
      select: { rawData: true },
    });
    for (const m of adMetricsRaw) {
      if (m.rawData && typeof m.rawData === "object") {
        const raw = m.rawData as Record<string, unknown>;
        const actions = raw.actions as Array<{ action_type: string; value: string }> | undefined;
        if (actions) {
          for (const a of actions) {
            if (a.action_type === "add_to_cart" || a.action_type === "offsite_conversion.fb_pixel_add_to_cart") {
              fbAddToCart += parseInt(a.value || "0");
            }
          }
        }
      }
    }
  }

  // Use BEST available data: store platform first, then Facebook Ads, then DB
  const sessoes = storeSessions > 0 ? storeSessions : fbClicks;
  const adicoesCarrinho = storeAddToCart > 0 ? storeAddToCart : fbAddToCart;
  const checkoutsIniciados = storeCheckouts > 0 ? storeCheckouts : (fbInitiateCheckout > 0 ? fbInitiateCheckout : totalOrders);
  const pedidosGerados = storeOrders > 0 ? storeOrders : totalOrders;

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
 * % paid orders and % repurchase rate (Shopify-compatible per-day calculation)
 *
 * Shopify formula: For each day, count unique customers and returning customers.
 * A "returning customer" on day X = customer who ordered on day X AND has at least
 * one order BEFORE day X (any time in history, not just before the period).
 * Period rate = SUM(returning per day) / SUM(customers per day) * 100
 */
export async function getPaidAndRepurchaseRates(days: number = 30, from?: string, to?: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return null;

  const orgId = ctx.organization.id;
  const dateFilter = buildDateFilter(getDateRange(days, from, to));

  const [totalOrders, paidOrders, ordersInPeriod, allHistoricalOrders] = await Promise.all([
    prisma.order.count({ where: { organizationId: orgId, orderDate: dateFilter } }),
    // Only truly PAID orders (not pending/authorized)
    prisma.order.count({ where: { organizationId: orgId, orderDate: dateFilter, status: "paid" } }),
    // All orders in period with email + date (for per-day grouping)
    prisma.order.findMany({
      where: { organizationId: orgId, orderDate: dateFilter, customerEmail: { not: null } },
      select: { customerEmail: true, orderDate: true },
    }),
    // ALL orders ever (full history) to build first-order map
    prisma.order.findMany({
      where: { organizationId: orgId, customerEmail: { not: null } },
      select: { customerEmail: true, orderDate: true },
      orderBy: { orderDate: "asc" },
    }),
  ]);

  // Build map: email (lowercase) → first order date ever
  const firstOrderByCustomer = new Map<string, Date>();
  for (const o of allHistoricalOrders) {
    const email = o.customerEmail!.toLowerCase();
    if (!firstOrderByCustomer.has(email)) {
      firstOrderByCustomer.set(email, o.orderDate);
    }
  }

  // Group orders by day → unique customers per day
  const customersByDay = new Map<string, Set<string>>();
  for (const o of ordersInPeriod) {
    const dayKey = o.orderDate.toISOString().split("T")[0];
    const email = o.customerEmail!.toLowerCase();
    if (!customersByDay.has(dayKey)) {
      customersByDay.set(dayKey, new Set());
    }
    customersByDay.get(dayKey)!.add(email);
  }

  // Shopify per-day calculation: sum customers and returning customers across all days
  let totalCustomersSum = 0;
  let returningCustomersSum = 0;
  for (const [dayKey, emails] of customersByDay) {
    const dayStart = new Date(dayKey);
    for (const email of emails) {
      totalCustomersSum++;
      const firstOrder = firstOrderByCustomer.get(email);
      // Returning = first-ever order was BEFORE this specific day
      if (firstOrder && firstOrder < dayStart) {
        returningCustomersSum++;
      }
    }
  }

  // Unique customers across the entire period (for display)
  const allPeriodEmails = new Set(ordersInPeriod.map((o) => o.customerEmail!.toLowerCase()));

  return {
    paidRate: totalOrders > 0 ? (paidOrders / totalOrders) * 100 : 0,
    paidOrders,
    totalOrders,
    repurchaseRate: totalCustomersSum > 0 ? (returningCustomersSum / totalCustomersSum) * 100 : 0,
    repeatCustomers: returningCustomersSum,
    totalCustomersInDays: totalCustomersSum,
    uniqueCustomers: allPeriodEmails.size,
  };
}

/**
 * Customer trends by month: new vs returning customers
 */
export async function getCustomerTrends(days: number = 30, from?: string, to?: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return [];

  const orgId = ctx.organization.id;
  const range = getDateRange(days, from, to);
  const dateFilter = buildDateFilter(range);

  // Get orders in period with customer emails
  const orders = await prisma.order.findMany({
    where: { organizationId: orgId, orderDate: dateFilter, customerEmail: { not: null } },
    select: { customerEmail: true, orderDate: true },
    orderBy: { orderDate: "asc" },
  });

  // Get all customer emails that ordered BEFORE the period (returning customers)
  const priorCustomers = await prisma.order.findMany({
    where: { organizationId: orgId, orderDate: { lt: range.since }, customerEmail: { not: null } },
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
    select: {
      id: true,
      externalOrderId: true,
      platform: true,
      status: true,
      customerName: true,
      totalAmount: true,
      currency: true,
      orderDate: true,
    },
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

/**
 * Consolidated dashboard data loader.
 * Makes a SINGLE server action call (1 HTTP round-trip) instead of 7 separate calls.
 * React cache() on getSessionWithOrg ensures auth is checked only once.
 */
export async function loadAllDashboardData(days: number = 30, from?: string, to?: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return null;

  const results = await Promise.allSettled([
    getDashboardData(days, from, to),
    getMetricsAnalysis(days, from, to),
    getOrdersByPlatform(),
    getRecentOrders(5),
    getFunnelData(days, from, to),
    getPaidAndRepurchaseRates(days, from, to),
    getCustomerTrends(days, from, to),
  ]);

  return {
    dashboard: results[0].status === "fulfilled" ? results[0].value : null,
    metrics: results[1].status === "fulfilled" ? results[1].value : [],
    platforms: results[2].status === "fulfilled" ? results[2].value : [],
    orders: results[3].status === "fulfilled" ? results[3].value : [],
    funnel: results[4].status === "fulfilled" ? results[4].value : null,
    rates: results[5].status === "fulfilled" ? results[5].value : null,
    trends: results[6].status === "fulfilled" ? results[6].value : [],
    failedCount: results.filter((r) => r.status === "rejected").length,
  };
}
