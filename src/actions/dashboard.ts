"use server";

import { prisma } from "@/lib/prisma";
import { getSessionWithOrg } from "@/lib/session";
import { getDateRange, getPreviousDateRange, buildDateFilter, buildDateOnlyFilter, toDateKeyBrasilia, toDateKeyDateOnly } from "@/lib/date-utils";
import { unstable_cache } from "next/cache";

export async function getDashboardData(days: number = 30, from?: string, to?: string, orgId?: string) {
  if (!orgId) {
    const ctx = await getSessionWithOrg();
    if (!ctx) return null;
    orgId = ctx.organization.id;
  }

  const range = getDateRange(days, from, to);
  const prevRange = getPreviousDateRange(days, from, to);
  const dateOnlyFilter = buildDateOnlyFilter(range);
  const prevDateOnlyFilter = buildDateOnlyFilter(prevRange);

  // Consolidate 9 Prisma queries into 2 raw SQL queries (1 for orders, 1 for ads)
  type OrderKPIs = {
    paid_count: bigint; paid_revenue: number;
    prev_paid_count: bigint; prev_paid_revenue: number;
    generated_revenue: number; prev_generated_revenue: number;
  };
  type AdKPIs = {
    spend: number; prev_spend: number; revenue: number;
  };

  const [orderKPIs, adKPIs] = await Promise.all([
    prisma.$queryRaw<OrderKPIs[]>`
      SELECT
        COUNT(*) FILTER (WHERE "orderDate" >= ${range.since} AND "orderDate" <= ${range.until} AND status IN ('paid','partially_refunded')) as paid_count,
        COALESCE(SUM("totalAmount") FILTER (WHERE "orderDate" >= ${range.since} AND "orderDate" <= ${range.until} AND status IN ('paid','partially_refunded')), 0) as paid_revenue,
        COUNT(*) FILTER (WHERE "orderDate" >= ${prevRange.since} AND "orderDate" <= ${prevRange.until} AND status IN ('paid','partially_refunded')) as prev_paid_count,
        COALESCE(SUM("totalAmount") FILTER (WHERE "orderDate" >= ${prevRange.since} AND "orderDate" <= ${prevRange.until} AND status IN ('paid','partially_refunded')), 0) as prev_paid_revenue,
        COALESCE(SUM("totalAmount") FILTER (WHERE "orderDate" >= ${range.since} AND "orderDate" <= ${range.until} AND status NOT IN ('refunded','cancelled')), 0) as generated_revenue,
        COALESCE(SUM("totalAmount") FILTER (WHERE "orderDate" >= ${prevRange.since} AND "orderDate" <= ${prevRange.until} AND status NOT IN ('refunded','cancelled')), 0) as prev_generated_revenue
      FROM orders
      WHERE "organizationId" = ${orgId}
        AND "orderDate" >= ${prevRange.since}
        AND "orderDate" <= ${range.until}
    `,
    prisma.$queryRaw<AdKPIs[]>`
      SELECT
        COALESCE(SUM(spend) FILTER (WHERE date >= ${dateOnlyFilter.gte} AND date <= ${dateOnlyFilter.lte}), 0) as spend,
        COALESCE(SUM(spend) FILTER (WHERE date >= ${prevDateOnlyFilter.gte} AND date <= ${prevDateOnlyFilter.lte}), 0) as prev_spend,
        COALESCE(SUM(revenue) FILTER (WHERE date >= ${dateOnlyFilter.gte} AND date <= ${dateOnlyFilter.lte}), 0) as revenue
      FROM ad_metrics
      WHERE "organizationId" = ${orgId}
        AND date >= ${prevDateOnlyFilter.gte}
        AND date <= ${dateOnlyFilter.lte}
    `,
  ]);

  const o = orderKPIs[0];
  const a = adKPIs[0];

  const totalOrders = Number(o?.paid_count || 0);
  const prevTotalOrders = Number(o?.prev_paid_count || 0);
  const currentRevenue = Number(o?.paid_revenue || 0);
  const previousRevenue = Number(o?.prev_paid_revenue || 0);
  const currentGeneratedRevenue = Number(o?.generated_revenue || 0);
  const previousGeneratedRevenue = Number(o?.prev_generated_revenue || 0);
  const currentAdSpend = Number(a?.spend || 0);
  const previousAdSpend = Number(a?.prev_spend || 0);
  const currentAdRevenue = Number(a?.revenue || 0);

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
    generatedRevenue: currentGeneratedRevenue,
    generatedRevenueChange: calcChange(currentGeneratedRevenue, previousGeneratedRevenue),
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
      status: { in: ["paid", "partially_refunded"] },
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
export async function getMetricsAnalysis(days: number = 30, from?: string, to?: string, orgId?: string) {
  if (!orgId) {
    const ctx = await getSessionWithOrg();
    if (!ctx) return [];
    orgId = ctx.organization.id;
  }

  const range = getDateRange(days, from, to);
  const dateFilter = buildDateFilter(range);
  const dateOnlyFilter = buildDateOnlyFilter(range);

  // Use raw SQL to aggregate orders by day IN the database (instead of fetching all rows)
  type OrderDayAgg = { day: string; total_amount: number; order_count: bigint };
  const [ordersByDay, adMetrics] = await Promise.all([
    prisma.$queryRaw<OrderDayAgg[]>`
      SELECT
        TO_CHAR("orderDate" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') as day,
        COALESCE(SUM("totalAmount"), 0) as total_amount,
        COUNT(*) as order_count
      FROM orders
      WHERE "organizationId" = ${orgId}
        AND "orderDate" >= ${range.since}
        AND "orderDate" <= ${range.until}
        AND status IN ('paid', 'partially_refunded')
      GROUP BY day
      ORDER BY day ASC
    `,
    prisma.adMetric.groupBy({
      by: ["date"],
      where: { organizationId: orgId, date: dateOnlyFilter },
      _sum: { spend: true, conversions: true, revenue: true },
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
    fbConversions: number;
    fbRevenue: number;
  }> = {};

  for (const o of ordersByDay) {
    const key = o.day;
    grouped[key] = { date: key, faturamento: Number(o.total_amount), investimento: 0, compras: Number(o.order_count), ticketMedio: 0, cpa: 0, roas: 0, fbConversions: 0, fbRevenue: 0 };
  }

  for (const m of adMetrics) {
    const key = toDateKeyDateOnly(m.date);
    if (!grouped[key]) grouped[key] = { date: key, faturamento: 0, investimento: 0, compras: 0, ticketMedio: 0, cpa: 0, roas: 0, fbConversions: 0, fbRevenue: 0 };
    grouped[key].investimento += Number(m._sum?.spend || 0);
    grouped[key].fbConversions += Number(m._sum?.conversions || 0);
    grouped[key].fbRevenue += Number(m._sum?.revenue || 0);
  }

  // Compute derived metrics
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
 * E-commerce funnel: Cliques → Add Carrinho → Checkout Iniciado → Compras
 *
 * All funnel data comes exclusively from Facebook Ads metrics,
 * regardless of the connected e-commerce platform (Shopify, Nuvemshop, etc.).
 */
export async function getFunnelData(days: number = 30, from?: string, to?: string, orgId?: string) {
  if (!orgId) {
    const ctx = await getSessionWithOrg();
    if (!ctx) return null;
    orgId = ctx.organization.id;
  }
  const range = getDateRange(days, from, to);
  const dateOnlyFilter = buildDateOnlyFilter(range);

  const adAgg = await prisma.adMetric.aggregate({
    where: { organizationId: orgId, date: dateOnlyFilter },
    _sum: { clicks: true, addToCart: true, initiateCheckout: true, conversions: true, impressions: true, reach: true },
  }).catch(() => null);

  if (!adAgg) return null;

  const cliques = Number(adAgg._sum.clicks || 0);
  const adicoesCarrinho = Number(adAgg._sum.addToCart || 0);
  const checkoutsIniciados = Number(adAgg._sum.initiateCheckout || 0);
  const compras = Number(adAgg._sum.conversions || 0);
  const impressoes = Number(adAgg._sum.impressions || 0);
  const alcance = Number(adAgg._sum.reach || 0);

  return {
    impressoes,
    alcance,
    cliques,
    adicoesCarrinho,
    checkoutsIniciados,
    compras,
  };
}

/**
 * % paid orders and % repurchase rate (Shopify-compatible per-day calculation)
 *
 * Tries StoreFunnel data first (populated from ShopifyQL), falls back to local orders.
 * Fully resilient: never throws, always returns valid data.
 */
export async function getPaidAndRepurchaseRates(days: number = 30, from?: string, to?: string, orgId?: string) {
  if (!orgId) {
    const ctx = await getSessionWithOrg();
    if (!ctx) return null;
    orgId = ctx.organization.id;
  }

  const range = getDateRange(days, from, to);
  const dateFilter = buildDateFilter(range);
  const dateOnlyFilter = buildDateOnlyFilter(range);

  // Run core queries + storeFunnel in PARALLEL
  type CountResult = { cnt: bigint };
  const [orderCounts, funnelData] = await Promise.all([
    // Single raw SQL query instead of 3 separate Prisma queries
    prisma.$queryRaw<{ total_orders: bigint; paid_orders: bigint; unique_emails: bigint }[]>`
      SELECT
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE status = 'paid') as paid_orders,
        COUNT(DISTINCT LOWER("customerEmail")) FILTER (WHERE "customerEmail" IS NOT NULL) as unique_emails
      FROM orders
      WHERE "organizationId" = ${orgId}
        AND "orderDate" >= ${range.since}
        AND "orderDate" <= ${range.until}
    `,
    prisma.storeFunnel.findMany({
      where: { organizationId: orgId, platform: "SHOPIFY", date: dateOnlyFilter },
      select: { totalCustomers: true, returningCustomers: true },
    }).catch(() => [] as { totalCustomers: number; returningCustomers: number }[]),
  ]);

  const totalOrders = Number(orderCounts[0]?.total_orders || 0);
  const paidOrders = Number(orderCounts[0]?.paid_orders || 0);
  const uniqueEmailCount = Number(orderCounts[0]?.unique_emails || 0);

  let totalCustomersSum = 0;
  let returningCustomersSum = 0;

  // Try StoreFunnel data first (accurate ShopifyQL data)
  const hasFunnelCustomerData = funnelData.length > 0 && funnelData.some((f: { totalCustomers: number }) => f.totalCustomers > 0);
  if (hasFunnelCustomerData) {
    for (const f of funnelData) {
      totalCustomersSum += f.totalCustomers;
      returningCustomersSum += f.returningCustomers;
    }
  } else {
    // Fallback: count returning customers via SQL (much faster than fetching all emails)
    totalCustomersSum = uniqueEmailCount;

    if (uniqueEmailCount > 0) {
      const repeaters = await prisma.$queryRaw<CountResult[]>`
        SELECT COUNT(*) as cnt FROM (
          SELECT LOWER("customerEmail") as email
          FROM orders
          WHERE "organizationId" = ${orgId}
            AND "customerEmail" IS NOT NULL
            AND LOWER("customerEmail") IN (
              SELECT DISTINCT LOWER("customerEmail")
              FROM orders
              WHERE "organizationId" = ${orgId}
                AND "orderDate" >= ${range.since}
                AND "orderDate" <= ${range.until}
                AND "customerEmail" IS NOT NULL
            )
          GROUP BY LOWER("customerEmail")
          HAVING COUNT(*) > 1
        ) as repeaters
      `;
      returningCustomersSum = Number(repeaters[0]?.cnt || 0);
    }
  }

  return {
    paidRate: totalOrders > 0 ? (paidOrders / totalOrders) * 100 : 0,
    paidOrders,
    totalOrders,
    repurchaseRate: totalCustomersSum > 0 ? (returningCustomersSum / totalCustomersSum) * 100 : 0,
    repeatCustomers: returningCustomersSum,
    totalCustomersInDays: totalCustomersSum,
    uniqueCustomers: uniqueEmailCount,
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
export async function getDailyProfit(days: number = 30, from?: string, to?: string, orgId?: string) {
  if (!orgId) {
    const ctx = await getSessionWithOrg();
    if (!ctx) return { dailyProfits: [], totalProfit: 0 };
    orgId = ctx.organization.id;
  }
  const range = getDateRange(days, from, to);
  const dateFilter = buildDateFilter(range);
  const dateOnlyFilter = buildDateOnlyFilter(range);

  // Fetch config FIRST to decide CMV method (determines whether we need rawData)
  const configResult = await prisma.financialConfig.findUnique({ where: { organizationId: orgId } });

  const config = configResult || {
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

  const needsRawData = cmvMethod === "sku";

  // Run remaining queries in parallel — only fetch rawData when SKU method is active
  type OrderDayAgg = { day: string; total_amount: number; order_count: bigint };
  const [ordersByDayAgg, ordersWithRawData, adMetrics, financialEntries, allProductCosts, allSupplierPayments] = await Promise.all([
    // Aggregated order data (always needed — fast)
    !needsRawData ? prisma.$queryRaw<OrderDayAgg[]>`
      SELECT
        TO_CHAR("orderDate" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') as day,
        COALESCE(SUM("totalAmount"), 0) as total_amount,
        COUNT(*) as order_count
      FROM orders
      WHERE "organizationId" = ${orgId}
        AND "orderDate" >= ${range.since}
        AND "orderDate" <= ${range.until}
        AND status IN ('paid', 'partially_refunded')
      GROUP BY day
      ORDER BY day ASC
    ` : Promise.resolve([] as OrderDayAgg[]),
    // Individual orders with rawData (only when SKU-based CMV)
    needsRawData ? prisma.order.findMany({
      where: { organizationId: orgId, orderDate: dateFilter, status: { in: ["paid", "partially_refunded"] } },
      select: { orderDate: true, totalAmount: true, rawData: true },
      orderBy: { orderDate: "asc" },
    }) : Promise.resolve([]),
    prisma.adMetric.groupBy({
      by: ["date"],
      where: { organizationId: orgId, date: dateOnlyFilter },
      _sum: { spend: true },
      orderBy: { date: "asc" },
    }),
    prisma.financialEntry.findMany({
      where: { organizationId: orgId, entryDate: dateFilter },
      select: { entryDate: true, type: true, amount: true },
    }),
    needsRawData ? prisma.productCost.findMany({ where: { organizationId: orgId } }) : Promise.resolve([]),
    cmvMethod === "supplier_payments" ? prisma.supplierPayment.findMany({
      where: { organizationId: orgId, paymentDate: dateFilter },
      select: { paymentDate: true, amount: true },
    }) : Promise.resolve([]),
  ]);

  // Build cost map from pre-fetched data (no extra round-trip)
  const costMap = new Map<string, number>();
  if (cmvMethod === "sku") {
    allProductCosts.forEach(pc => costMap.set(pc.sku.toLowerCase().trim(), Number(pc.costPrice)));
  }

  // Build supplier payments map from pre-fetched data (no extra round-trip)
  const supplierPaymentsByDay = new Map<string, number>();
  if (cmvMethod === "supplier_payments") {
    for (const p of allSupplierPayments) {
      const key = toDateKeyBrasilia(p.paymentDate);
      supplierPaymentsByDay.set(key, (supplierPaymentsByDay.get(key) || 0) + Number(p.amount));
    }
  }

  // Group manual entries by day
  const manualCostsByDay = new Map<string, number>();
  const manualIncomeByDay = new Map<string, number>();
  for (const entry of financialEntries) {
    const key = toDateKeyBrasilia(entry.entryDate);
    if (entry.type === "cost") {
      manualCostsByDay.set(key, (manualCostsByDay.get(key) || 0) + Number(entry.amount));
    } else {
      manualIncomeByDay.set(key, (manualIncomeByDay.get(key) || 0) + Number(entry.amount));
    }
  }

  // Group orders by day
  const dailyData: Record<string, { revenue: number; orderCount: number; cogs: number; adSpend: number }> = {};

  if (needsRawData) {
    // SKU method: need individual orders with rawData for line item matching
    for (const order of ordersWithRawData) {
      const key = toDateKeyBrasilia(order.orderDate);
      if (!dailyData[key]) dailyData[key] = { revenue: 0, orderCount: 0, cogs: 0, adSpend: 0 };
      const amount = Number(order.totalAmount);
      dailyData[key].revenue += amount;
      dailyData[key].orderCount += 1;

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
  } else {
    // Non-SKU methods: use pre-aggregated data (much faster — no rawData transfer)
    for (const o of ordersByDayAgg) {
      dailyData[o.day] = { revenue: Number(o.total_amount), orderCount: Number(o.order_count), cogs: 0, adSpend: 0 };
    }
  }

  // Add ad spend by day (from groupBy results)
  for (const m of adMetrics) {
    const key = toDateKeyDateOnly(m.date);
    if (!dailyData[key]) dailyData[key] = { revenue: 0, orderCount: 0, cogs: 0, adSpend: 0 };
    dailyData[key].adSpend += Number(m._sum?.spend || 0);
  }

  // Ensure days with only manual entries also appear in dailyData
  for (const key of [...manualCostsByDay.keys(), ...manualIncomeByDay.keys()]) {
    if (!dailyData[key]) dailyData[key] = { revenue: 0, orderCount: 0, cogs: 0, adSpend: 0 };
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

    // Manual financial entries for this day
    const dayManualCosts = manualCostsByDay.get(date) || 0;
    const dayManualIncome = manualIncomeByDay.get(date) || 0;

    const ticketMedio = d.orderCount > 0 ? d.revenue / d.orderCount : 0;
    const gatewayFee = d.revenue * gwRate;
    const checkoutFee = d.revenue * ckRate;
    const transactionFees = fixedFeePerTx * d.orderCount;
    const chargebackCost = ticketMedio * cbRate * d.orderCount;

    const grossProfit = d.revenue + dayManualIncome - cogs - d.adSpend - gatewayFee - checkoutFee - transactionFees - dailyFixedCost - chargebackCost - dayManualCosts;
    const taxFee = taxBase === "profit"
      ? Math.max(0, grossProfit) * taxRate
      : d.revenue * taxRate;

    const totalCosts = cogs + d.adSpend + gatewayFee + checkoutFee + taxFee + transactionFees + dailyFixedCost + chargebackCost + dayManualCosts;
    const profit = d.revenue + dayManualIncome - totalCosts;

    dailyProfits.push({ date, profit, revenue: d.revenue + dayManualIncome, costs: totalCosts });
    totalProfit += profit;
  }

  dailyProfits.sort((a, b) => a.date.localeCompare(b.date));

  return { dailyProfits, totalProfit };
}

/**
 * Internal fetcher — runs the 5 parallel queries.
 * Separated so it can be wrapped with unstable_cache.
 */
async function _fetchDashboardData(orgId: string, days: number, from?: string, to?: string) {
  const results = await Promise.allSettled([
    getDashboardData(days, from, to, orgId),
    getMetricsAnalysis(days, from, to, orgId),
    getFunnelData(days, from, to, orgId),
    getPaidAndRepurchaseRates(days, from, to, orgId),
    getDailyProfit(days, from, to, orgId),
  ]);

  // Log rejected queries for debugging
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      const names = ["dashboard", "metrics", "funnel", "rates", "profit"];
      console.error(`[loadAllDashboardData] ${names[i]} failed:`, r.reason);
    }
  });

  return {
    dashboard: results[0].status === "fulfilled" ? results[0].value : null,
    metrics: results[1].status === "fulfilled" ? results[1].value : [],
    funnel: results[2].status === "fulfilled" ? results[2].value : null,
    rates: results[3].status === "fulfilled" ? results[3].value : null,
    profitData: results[4].status === "fulfilled" ? results[4].value : { dailyProfits: [], totalProfit: 0 },
    failedCount: results.filter((r) => r.status === "rejected").length,
  };
}

/**
 * Consolidated dashboard data loader with server-side caching.
 * Cache: 15s revalidation — instant response on period switch within window.
 * Auth is checked once, orgId is passed directly to avoid redundant session lookups.
 */
export async function loadAllDashboardData(days: number = 30, from?: string, to?: string) {
  let ctx;
  try {
    ctx = await getSessionWithOrg();
  } catch (error) {
    console.error("[loadAllDashboardData] Session error:", error);
    return null;
  }
  if (!ctx) return null;

  const orgId = ctx.organization.id;
  const cacheKey = `dashboard-${orgId}-${days}-${from || "x"}-${to || "x"}`;

  const cachedFetch = unstable_cache(
    () => _fetchDashboardData(orgId, days, from, to),
    [cacheKey],
    { revalidate: 15 }
  );

  return cachedFetch();
}
