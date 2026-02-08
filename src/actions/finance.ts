"use server";

import { prisma as db } from "@/lib/prisma";
import { getSessionWithOrg } from "@/lib/session";
import { revalidatePath } from "next/cache";

// Types
export type FinancialMetrics = {
    revenue: number;
    adSpend: number;
    productCosts: number;
    fees: number;
    netProfit: number;
    margin: number;
    roi: number;
    orderCount: number;
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
};

/**
 * Get financial metrics for a given period.
 * Calculates Revenue, Ad Spend, COGS (Product Costs), Fees, and Net Profit.
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

    // 2. Fetch Financial Config
    const config = await db.financialConfig.findUnique({
        where: { organizationId },
    }) || { defaultTaxRate: 0, fixedTransactionFee: 0 };

    const taxRate = Number(config.defaultTaxRate) / 100;
    const fixedFee = Number(config.fixedTransactionFee);

    // 3. Fetch Orders in Period
    const orders = await db.order.findMany({
        where: {
            organizationId,
            orderDate: { gte: from, lte: to },
            status: { notIn: ["cancelled", "refunded"] }, // Exclude cancelled/refunded
        },
        select: {
            id: true,
            totalAmount: true,
            itemCount: true,
            rawData: true,
            platform: true,
        },
    });

    // 4. Fetch Ad Level Metrics in Period (Spend)
    const adMetrics = await db.adMetric.aggregate({
        where: {
            organizationId,
            date: { gte: from, lte: to },
        },
        _sum: {
            spend: true,
        },
    });

    // 5. Fetch Product Costs
    const productCosts = await db.productCost.findMany({
        where: { organizationId },
    });

    const costMap = new Map<string, number>(); // SKU -> Cost
    productCosts.forEach(pc => {
        costMap.set(pc.sku.toLowerCase().trim(), Number(pc.costPrice));
    });

    // 6. Calculate Metrics
    let revenue = 0;
    let cogs = 0; // Cost of Goods Sold
    let fees = 0;

    for (const order of orders) {
        const amount = Number(order.totalAmount);
        revenue += amount;

        // Calculate Fees (Gateway + Platform)
        // Formula: (Revenue * TaxRate) + FixedFee
        fees += (amount * taxRate) + fixedFee;

        // Calculate COGS
        // We need to parse order items.
        // Platform-specific parsing:
        const data: any = order.rawData || {};
        let items: any[] = [];

        // Attempt to standardize items extraction
        if (Array.isArray(data.line_items)) {
            items = data.line_items; // Shopify, commonly
        } else if (Array.isArray(data.items)) {
            items = data.items; // Some others
        } else if (data.products && Array.isArray(data.products)) {
            items = data.products;
        }

        // Fallback if no items found in rawData -> estimate based on itemCount ?
        // If we can't find items, we can't calculate COGS accurately.
        // For now, if items found, sum costs.

        for (const item of items) {
            const quantity = Number(item.quantity || 1);
            const sku = (item.sku || item.product_id || item.title || "").toString().toLowerCase().trim();

            // Try to find cost
            // 1. Exact SKU match
            let cost = costMap.get(sku);

            // 2. If not found, maybe try fuzzy match or fallback? (skipped for now)
            if (cost !== undefined) {
                cogs += cost * quantity;
            }
        }
    }

    const adSpend = Number(adMetrics._sum.spend || 0);
    const netProfit = revenue - adSpend - cogs - fees;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    const roi = adSpend > 0 ? (netProfit / adSpend) * 100 : 0; // ROI on Ad Spend context? adjusting... usually ROI = (Net / Cost). 

    return {
        revenue,
        adSpend,
        productCosts: cogs,
        fees,
        netProfit,
        margin,
        roi,
        orderCount: orders.length
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
            name: input.name, // update name if provided
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

    // Validate inputs
    if (isNaN(input.defaultTaxRate) || input.defaultTaxRate < 0 || input.defaultTaxRate > 100) {
        throw new Error("Taxa padrao deve ser entre 0 e 100");
    }
    if (isNaN(input.fixedTransactionFee) || input.fixedTransactionFee < 0) {
        throw new Error("Taxa fixa de transacao deve ser >= 0");
    }

    await db.financialConfig.upsert({
        where: { organizationId: orgId },
        create: {
            organizationId: orgId,
            defaultTaxRate: input.defaultTaxRate,
            fixedTransactionFee: input.fixedTransactionFee
        },
        update: {
            defaultTaxRate: input.defaultTaxRate,
            fixedTransactionFee: input.fixedTransactionFee
        }
    });

    revalidatePath("/financeiro");
    return { success: true };
}
