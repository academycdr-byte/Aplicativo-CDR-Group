"use server";

import { prisma } from "@/lib/prisma";
import { getSessionWithOrg } from "@/lib/session";
import { getDateRange, getPreviousDateRange, buildDateFilter, toDateKeyBrasilia } from "@/lib/date-utils";

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
      where: { organizationId: orgId, orderDate: dateFilter, status: "paid" },
      _sum: { totalAmount: true },
    }),
    prisma.order.aggregate({
      where: { organizationId: orgId, orderDate: prevDateFilter, status: "paid" },
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
      status: "paid",
    },
    select: { orderDate: true, totalAmount: true },
    orderBy: { orderDate: "asc" },
  });

  const grouped: Record<string, number> = {};

  for (const order of orders) {
    const dateKey = toDateKeyBrasilia(order.orderDate);
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
    // Facebook Ads attribution data (for accurate CPA/ROAS)
    fbConversions: number;
    fbRevenue: number;
  }> = {};

  for (const o of orders) {
    const key = toDateKeyBrasilia(o.orderDate);
    if (!grouped[key]) grouped[key] = { date: key, faturamento: 0, investimento: 0, compras: 0, ticketMedio: 0, cpa: 0, roas: 0, fbConversions: 0, fbRevenue: 0 };
    if (o.status === "paid") {
      grouped[key].faturamento += Number(o.totalAmount);
      grouped[key].compras += 1;
    }
  }

  for (const m of adMetrics) {
    const key = toDateKeyBrasilia(m.date);
    if (!grouped[key]) grouped[key] = { date: key, faturamento: 0, investimento: 0, compras: 0, ticketMedio: 0, cpa: 0, roas: 0, fbConversions: 0, fbRevenue: 0 };
    grouped[key].investimento += Number(m.spend);
    grouped[key].fbConversions += m.conversions;
    grouped[key].fbRevenue += Number(m.revenue);
  }

  // Compute derived metrics
  // CPA and ROAS use Facebook Ads attribution data (conversions + revenue from FB)
  for (const d of Object.values(grouped)) {
    d.ticketMedio = d.compras > 0 ? d.faturamento / d.compras : 0;
    d.cpa = d.fbConversions > 0 ? d.investimento / d.fbConversions : 0;
    d.roas = d.investimento > 0 ? d.fbRevenue / d.investimento : 0;
  }

  // Strip internal FB fields before returning
  return Object.values(grouped)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ fbConversions, fbRevenue, ...rest }) => rest);
}

/**
 * E-commerce funnel: Sessoes → Add Carrinho → Chegou ao Checkout → Checkout Concluido
 *
 * When only Shopify is connected (no Cartpanda/Yampi), uses Shopify's session-based
 * funnel data exclusively (FROM sessions ShopifyQL - same as Shopify Analytics).
 * Otherwise falls back to mixed sources.
 */
export async function getFunnelData(days: number = 30, from?: string, to?: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return null;

  const orgId = ctx.organization.id;
  const dateFilter = buildDateFilter(getDateRange(days, from, to));

  // Check which e-commerce platforms are connected
  const ecommerceIntegrations = await prisma.integration.findMany({
    where: {
      organizationId: orgId,
      status: "CONNECTED",
      platform: { in: ["SHOPIFY", "NUVEMSHOP"] },
    },
    select: { platform: true },
  });

  const hasShopify = ecommerceIntegrations.some((i) => i.platform === "SHOPIFY");
  const shopifyOnly = hasShopify && ecommerceIntegrations.length === 1;

  const [
    totalOrders,
    paidOrders,
    shippedOrders,
    deliveredOrders,
    storeFunnelAgg,
  ] = await Promise.all([
    prisma.order.count({ where: { organizationId: orgId, orderDate: dateFilter } }),
    prisma.order.count({ where: { organizationId: orgId, orderDate: dateFilter, status: "paid" } }),
    prisma.order.count({ where: { organizationId: orgId, orderDate: dateFilter, status: { in: ["shipped", "delivered"] } } }),
    prisma.order.count({ where: { organizationId: orgId, orderDate: dateFilter, status: "delivered" } }),
    // StoreFunnel: only aggregate records with sessions > 0 (real ShopifyQL data).
    // Strategy 2 fallback records have sessions=0 and wrong addToCart/checkouts values.
    prisma.storeFunnel.aggregate({
      where: {
        organizationId: orgId,
        date: dateFilter,
        ...(shopifyOnly ? { platform: "SHOPIFY" } : {}),
        sessions: { gt: 0 },
      },
      _sum: { sessions: true, addToCart: true, checkoutsInitiated: true, ordersGenerated: true },
    }).catch(() => ({ _sum: { sessions: 0, addToCart: 0, checkoutsInitiated: 0, ordersGenerated: 0 } })),
  ]);

  const storeSessions = Number(storeFunnelAgg._sum.sessions || 0);
  const storeAddToCart = Number(storeFunnelAgg._sum.addToCart || 0);
  const storeCheckouts = Number(storeFunnelAgg._sum.checkoutsInitiated || 0);
  const storeOrders = Number(storeFunnelAgg._sum.ordersGenerated || 0);

  let sessoes = storeSessions;
  let adicoesCarrinho = storeAddToCart;
  let checkoutsIniciados = storeCheckouts;
  let pedidosGerados = storeOrders > 0 ? storeOrders : totalOrders;

  // If no store funnel data, try Facebook Ads as fallback
  if (sessoes === 0) {
    const adAgg = await prisma.adMetric.aggregate({
      where: { organizationId: orgId, date: dateFilter },
      _sum: { clicks: true, addToCart: true, initiateCheckout: true },
    }).catch(() => ({ _sum: { clicks: 0, addToCart: 0, initiateCheckout: 0 } }));

    sessoes = Number(adAgg._sum.clicks || 0);
    if (adicoesCarrinho === 0) adicoesCarrinho = Number(adAgg._sum.addToCart || 0);
    if (checkoutsIniciados === 0) checkoutsIniciados = Number(adAgg._sum.initiateCheckout || 0) || totalOrders;
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
 * % paid orders and % repurchase rate (Shopify-compatible per-day calculation)
 *
 * Tries StoreFunnel data first (populated from ShopifyQL), falls back to local orders.
 * Fully resilient: never throws, always returns valid data.
 */
export async function getPaidAndRepurchaseRates(days: number = 30, from?: string, to?: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return null;

  const orgId = ctx.organization.id;
  const dateFilter = buildDateFilter(getDateRange(days, from, to));

  // Core paid rate queries (always work - these tables haven't changed)
  const [totalOrders, paidOrders, ordersInPeriod] = await Promise.all([
    prisma.order.count({ where: { organizationId: orgId, orderDate: dateFilter } }),
    prisma.order.count({ where: { organizationId: orgId, orderDate: dateFilter, status: "paid" } }),
    prisma.order.findMany({
      where: { organizationId: orgId, orderDate: dateFilter, customerEmail: { not: null } },
      select: { customerEmail: true, orderDate: true },
    }),
  ]);

  // Try StoreFunnel customer metrics (may fail if migration not yet applied)
  let totalCustomersSum = 0;
  let returningCustomersSum = 0;
  let usedFunnelData = false;

  try {
    const funnelData = await prisma.storeFunnel.findMany({
      where: { organizationId: orgId, date: dateFilter },
      select: { totalCustomers: true, returningCustomers: true },
    });
    const hasFunnelCustomerData = funnelData.some((f) => f.totalCustomers > 0);
    if (hasFunnelCustomerData) {
      for (const f of funnelData) {
        totalCustomersSum += f.totalCustomers;
        returningCustomersSum += f.returningCustomers;
      }
      usedFunnelData = true;
    }
  } catch {
    // StoreFunnel columns don't exist yet - fall through to local calculation
  }

  // Fallback: calculate from local order data
  if (!usedFunnelData) {
    const allHistoricalOrders = await prisma.order.findMany({
      where: { organizationId: orgId, customerEmail: { not: null } },
      select: { customerEmail: true, orderDate: true },
      orderBy: { orderDate: "asc" },
    });

    const firstOrderByCustomer = new Map<string, Date>();
    for (const o of allHistoricalOrders) {
      const email = o.customerEmail!.toLowerCase();
      if (!firstOrderByCustomer.has(email)) {
        firstOrderByCustomer.set(email, o.orderDate);
      }
    }

    const customersByDay = new Map<string, Set<string>>();
    for (const o of ordersInPeriod) {
      const dayKey = toDateKeyBrasilia(o.orderDate);
      const email = o.customerEmail!.toLowerCase();
      if (!customersByDay.has(dayKey)) {
        customersByDay.set(dayKey, new Set());
      }
      customersByDay.get(dayKey)!.add(email);
    }

    for (const [dayKey, emails] of customersByDay) {
      const dayStart = new Date(dayKey);
      for (const email of emails) {
        totalCustomersSum++;
        const firstOrder = firstOrderByCustomer.get(email);
        if (firstOrder && firstOrder < dayStart) {
          returningCustomersSum++;
        }
      }
    }
  }

  const uniqueEmails = new Set(ordersInPeriod.map((o) => o.customerEmail!.toLowerCase()));

  return {
    paidRate: totalOrders > 0 ? (paidOrders / totalOrders) * 100 : 0,
    paidOrders,
    totalOrders,
    repurchaseRate: totalCustomersSum > 0 ? (returningCustomersSum / totalCustomersSum) * 100 : 0,
    repeatCustomers: returningCustomersSum,
    totalCustomersInDays: totalCustomersSum,
    uniqueCustomers: uniqueEmails.size,
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
 * Daily profit calculation synced with Financeiro tab logic.
 * Uses the same financial config (gateway, checkout, tax, fixed costs, chargebacks, CMV).
 * Returns daily profit data for the calendar and a total profit for the period.
 */
export async function getDailyProfit(days: number = 30, from?: string, to?: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { dailyProfits: [], totalProfit: 0 };

  const orgId = ctx.organization.id;
  const dateFilter = buildDateFilter(getDateRange(days, from, to));
  const range = getDateRange(days, from, to);

  // Load financial config
  const config = await prisma.financialConfig.findUnique({
    where: { organizationId: orgId },
  }) || {
    defaultTaxRate: 0, fixedTransactionFee: 0, gatewayRate: 0,
    checkoutRate: 0, taxBase: "revenue", fixedCosts: 0,
    chargebackRate: 0, cmvMethod: "sku", averageCostPerOrder: 0,
  };

  const taxRate = Number(config.defaultTaxRate) / 100;
  const fixedFeePerTx = Number(config.fixedTransactionFee);
  const gwRate = Number(config.gatewayRate) / 100;
  const ckRate = Number(config.checkoutRate) / 100;
  const taxBase = String(config.taxBase || "revenue");
  const monthlyFixedCosts = Number(config.fixedCosts);
  const cbRate = Number(config.chargebackRate) / 100;
  const cmvMethod = String(config.cmvMethod || "sku");

  // Fetch paid orders in period
  const orders = await prisma.order.findMany({
    where: { organizationId: orgId, orderDate: dateFilter, status: { in: ["paid", "partially_refunded"] } },
    select: { orderDate: true, totalAmount: true, rawData: true },
    orderBy: { orderDate: "asc" },
  });

  // Fetch ad spend
  const adMetrics = await prisma.adMetric.findMany({
    where: { organizationId: orgId, date: dateFilter },
    select: { date: true, spend: true },
    orderBy: { date: "asc" },
  });

  // Build cost map for SKU method
  let costMap = new Map<string, number>();
  if (cmvMethod === "sku") {
    const productCosts = await prisma.productCost.findMany({ where: { organizationId: orgId } });
    productCosts.forEach(pc => costMap.set(pc.sku.toLowerCase().trim(), Number(pc.costPrice)));
  }

  // Build supplier payments map for supplier_payments method
  let supplierPaymentsByDay = new Map<string, number>();
  if (cmvMethod === "supplier_payments") {
    const payments = await prisma.supplierPayment.findMany({
      where: { organizationId: orgId, paymentDate: dateFilter },
      select: { paymentDate: true, amount: true },
    });
    for (const p of payments) {
      const key = toDateKeyBrasilia(p.paymentDate);
      supplierPaymentsByDay.set(key, (supplierPaymentsByDay.get(key) || 0) + Number(p.amount));
    }
  }

  // Group orders by day
  const dailyData: Record<string, { revenue: number; orderCount: number; cogs: number; adSpend: number }> = {};

  for (const order of orders) {
    const key = toDateKeyBrasilia(order.orderDate);
    if (!dailyData[key]) dailyData[key] = { revenue: 0, orderCount: 0, cogs: 0, adSpend: 0 };
    const amount = Number(order.totalAmount);
    dailyData[key].revenue += amount;
    dailyData[key].orderCount += 1;

    // SKU-based COGS
    if (cmvMethod === "sku") {
      const data = order.rawData as Record<string, unknown> | null;
      let items: Record<string, unknown>[] = [];
      if (data) {
        if (Array.isArray(data.line_items)) items = data.line_items;
        else if (Array.isArray(data.items)) items = data.items;
        else if (data.products && Array.isArray(data.products)) items = data.products as Record<string, unknown>[];
      }
      for (const item of items) {
        const qty = Number(item.quantity || 1);
        const sku = (item.sku || item.product_id || item.title || "").toString().toLowerCase().trim();
        const cost = costMap.get(sku);
        if (cost !== undefined) dailyData[key].cogs += cost * qty;
      }
    }
  }

  // Add ad spend by day
  for (const m of adMetrics) {
    const key = toDateKeyBrasilia(m.date);
    if (!dailyData[key]) dailyData[key] = { revenue: 0, orderCount: 0, cogs: 0, adSpend: 0 };
    dailyData[key].adSpend += Number(m.spend);
  }

  // Calculate number of days in period for daily fixed cost proration
  const fromDate = range.since;
  const toDate = range.until;
  const totalDaysInPeriod = Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const dailyFixedCost = monthlyFixedCosts / 30; // prorate monthly to daily

  // Compute daily profit
  const dailyProfits: { date: string; profit: number; revenue: number; costs: number }[] = [];
  let totalProfit = 0;

  for (const [date, d] of Object.entries(dailyData)) {
    // CMV based on method
    let cogs = d.cogs; // default for SKU
    if (cmvMethod === "average") {
      cogs = Number(config.averageCostPerOrder) * d.orderCount;
    } else if (cmvMethod === "supplier_payments") {
      cogs = supplierPaymentsByDay.get(date) || 0;
    }

    const ticketMedio = d.orderCount > 0 ? d.revenue / d.orderCount : 0;
    const gatewayFee = d.revenue * gwRate;
    const checkoutFee = d.revenue * ckRate;
    const transactionFees = fixedFeePerTx * d.orderCount;
    const chargebackCost = ticketMedio * cbRate * d.orderCount;

    const grossProfit = d.revenue - cogs - d.adSpend - gatewayFee - checkoutFee - transactionFees - dailyFixedCost - chargebackCost;
    const taxFee = taxBase === "profit"
      ? Math.max(0, grossProfit) * taxRate
      : d.revenue * taxRate;

    const totalCosts = cogs + d.adSpend + gatewayFee + checkoutFee + taxFee + transactionFees + dailyFixedCost + chargebackCost;
    const profit = d.revenue - totalCosts;

    dailyProfits.push({ date, profit, revenue: d.revenue, costs: totalCosts });
    totalProfit += profit;
  }

  dailyProfits.sort((a, b) => a.date.localeCompare(b.date));

  return { dailyProfits, totalProfit };
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
    getDailyProfit(days, from, to),
  ]);

  return {
    dashboard: results[0].status === "fulfilled" ? results[0].value : null,
    metrics: results[1].status === "fulfilled" ? results[1].value : [],
    platforms: results[2].status === "fulfilled" ? results[2].value : [],
    orders: results[3].status === "fulfilled" ? results[3].value : [],
    funnel: results[4].status === "fulfilled" ? results[4].value : null,
    rates: results[5].status === "fulfilled" ? results[5].value : null,
    trends: results[6].status === "fulfilled" ? results[6].value : [],
    profitData: results[7].status === "fulfilled" ? results[7].value : { dailyProfits: [], totalProfit: 0 },
    failedCount: results.filter((r) => r.status === "rejected").length,
  };
}
