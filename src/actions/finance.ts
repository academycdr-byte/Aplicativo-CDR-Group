"use server";

import { prisma as db } from "@/lib/prisma";
import { getSessionWithOrg } from "@/lib/session";
import { revalidatePath } from "next/cache";

// Types
export type FinancialMetrics = {
    revenue: number;
    adSpend: number;
    productCosts: number;
    gatewayFee: number;
    checkoutFee: number;
    taxFee: number;
    fixedCosts: number;
    chargebackCost: number;
    transactionFees: number;
    netProfit: number;
    margin: number;
    roi: number;
    orderCount: number;
    ticketMedio: number;
};

export type ProductCostInput = {
    sku: string;
    name?: string;
    costPrice: number;
    imageUrl?: string;
};

export type FinancialConfigInput = {
    defaultTaxRate: number;
    fixedTransactionFee: number;
    gatewayRate: number;
    checkoutRate: number;
    taxBase: string;
    fixedCosts: number;
    chargebackRate: number;
};

/**
 * Get financial metrics for a given period.
 * Calculation:
 *   Receita Bruta
 *   - COGS (Custos de Produto)
 *   - Investimento em Ads
 *   - Gateway Fee (Receita * gatewayRate%)
 *   - Checkout Fee (Receita * checkoutRate%)
 *   - Imposto (depende de taxBase: "revenue" = Receita * taxRate%, "profit" = LucroBruto * taxRate%)
 *   - Custos Fixos (valor absoluto)
 *   - Chargebacks (ticketMedio * chargebackRate%)
 *   - Transaction Fee (fixedFee * orderCount)
 *   = Lucro Líquido
 */
export async function getFinancialMetrics({
    from,
    to,
}: {
    from: Date;
    to: Date;
}) {
    const ctx = await getSessionWithOrg();
    if (!ctx) throw new Error("Nao autenticado");
    const organizationId = ctx.organization.id;

    // Fetch Financial Config
    const config = await db.financialConfig.findUnique({
        where: { organizationId },
    }) || {
        defaultTaxRate: 0,
        fixedTransactionFee: 0,
        gatewayRate: 0,
        checkoutRate: 0,
        taxBase: "revenue",
        fixedCosts: 0,
        chargebackRate: 0,
    };

    const taxRate = Number(config.defaultTaxRate) / 100;
    const fixedFeePerTx = Number(config.fixedTransactionFee);
    const gatewayRate = Number(config.gatewayRate) / 100;
    const checkoutRate = Number(config.checkoutRate) / 100;
    const taxBase = String(config.taxBase || "revenue");
    const fixedCosts = Number(config.fixedCosts);
    const chargebackRate = Number(config.chargebackRate) / 100;

    // Fetch Orders in Period
    const orders = await db.order.findMany({
        where: {
            organizationId,
            orderDate: { gte: from, lte: to },
            status: { notIn: ["cancelled", "refunded"] },
        },
        select: {
            id: true,
            totalAmount: true,
            itemCount: true,
            rawData: true,
            platform: true,
        },
    });

    // Fetch Ad Spend in Period
    const adMetrics = await db.adMetric.aggregate({
        where: {
            organizationId,
            date: { gte: from, lte: to },
        },
        _sum: { spend: true },
    });

    // Fetch Product Costs
    const productCosts = await db.productCost.findMany({
        where: { organizationId },
    });

    const costMap = new Map<string, number>();
    productCosts.forEach(pc => {
        costMap.set(pc.sku.toLowerCase().trim(), Number(pc.costPrice));
    });

    // Calculate Metrics
    let revenue = 0;
    let cogs = 0;

    for (const order of orders) {
        const amount = Number(order.totalAmount);
        revenue += amount;

        // Calculate COGS from line items
        const data = order.rawData as Record<string, unknown> | null;
        let items: Record<string, unknown>[] = [];

        if (data) {
            if (Array.isArray(data.line_items)) {
                items = data.line_items;
            } else if (Array.isArray(data.items)) {
                items = data.items;
            } else if (data.products && Array.isArray(data.products)) {
                items = data.products as Record<string, unknown>[];
            }
        }

        for (const item of items) {
            const quantity = Number(item.quantity || 1);
            const sku = (item.sku || item.product_id || item.title || "").toString().toLowerCase().trim();
            const cost = costMap.get(sku);
            if (cost !== undefined) {
                cogs += cost * quantity;
            }
        }
    }

    const adSpend = Number(adMetrics._sum.spend || 0);
    const orderCount = orders.length;
    const ticketMedio = orderCount > 0 ? revenue / orderCount : 0;

    // Fee calculations
    const gatewayFee = revenue * gatewayRate;
    const checkoutFee = revenue * checkoutRate;
    const transactionFees = fixedFeePerTx * orderCount;
    const chargebackCost = ticketMedio * chargebackRate;

    // Tax depends on taxBase
    const grossProfit = revenue - cogs - adSpend - gatewayFee - checkoutFee - transactionFees - fixedCosts - chargebackCost;
    const taxFee = taxBase === "profit"
        ? Math.max(0, grossProfit) * taxRate
        : revenue * taxRate;

    const netProfit = revenue - cogs - adSpend - gatewayFee - checkoutFee - taxFee - transactionFees - fixedCosts - chargebackCost;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    const roi = adSpend > 0 ? (netProfit / adSpend) * 100 : 0;

    return {
        revenue,
        adSpend,
        productCosts: cogs,
        gatewayFee,
        checkoutFee,
        taxFee,
        fixedCosts,
        chargebackCost,
        transactionFees,
        netProfit,
        margin,
        roi,
        orderCount,
        ticketMedio,
    };
}

/**
 * Get all product costs for management table
 */
export async function getProductCosts() {
    const ctx = await getSessionWithOrg();
    if (!ctx) return [];

    return db.productCost.findMany({
        where: { organizationId: ctx.organization.id },
        orderBy: { name: 'asc' }
    });
}

/**
 * Update or Create a Product Cost
 */
export async function saveProductCost(input: ProductCostInput) {
    const ctx = await getSessionWithOrg();
    if (!ctx) throw new Error("Nao autenticado");
    const orgId = ctx.organization.id;

    await db.productCost.upsert({
        where: {
            organizationId_sku: {
                organizationId: orgId,
                sku: input.sku
            }
        },
        create: {
            organizationId: orgId,
            sku: input.sku,
            name: input.name,
            costPrice: input.costPrice,
            imageUrl: input.imageUrl
        },
        update: {
            costPrice: input.costPrice,
            name: input.name,
            imageUrl: input.imageUrl
        }
    });

    revalidatePath("/financeiro");
    return { success: true };
}

/**
 * Get current financial config
 */
export async function getFinancialConfig() {
    const ctx = await getSessionWithOrg();
    if (!ctx) return null;

    return db.financialConfig.findUnique({
        where: { organizationId: ctx.organization.id }
    });
}

/**
 * Save financial config
 */
export async function saveFinancialConfig(input: FinancialConfigInput) {
    const ctx = await getSessionWithOrg();
    if (!ctx) throw new Error("Nao autenticado");
    const orgId = ctx.organization.id;

    if (isNaN(input.defaultTaxRate) || input.defaultTaxRate < 0 || input.defaultTaxRate > 100) {
        throw new Error("Taxa de imposto deve ser entre 0 e 100");
    }

    await db.financialConfig.upsert({
        where: { organizationId: orgId },
        create: {
            organizationId: orgId,
            defaultTaxRate: input.defaultTaxRate,
            fixedTransactionFee: input.fixedTransactionFee,
            gatewayRate: input.gatewayRate,
            checkoutRate: input.checkoutRate,
            taxBase: input.taxBase,
            fixedCosts: input.fixedCosts,
            chargebackRate: input.chargebackRate,
        },
        update: {
            defaultTaxRate: input.defaultTaxRate,
            fixedTransactionFee: input.fixedTransactionFee,
            gatewayRate: input.gatewayRate,
            checkoutRate: input.checkoutRate,
            taxBase: input.taxBase,
            fixedCosts: input.fixedCosts,
            chargebackRate: input.chargebackRate,
        }
    });

    revalidatePath("/financeiro");
    return { success: true };
}
