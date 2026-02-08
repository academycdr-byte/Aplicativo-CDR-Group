"use server";

import { db } from "@/lib/db";
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
    // 1. Get Organization (assuming single tenant context or passed context)
    // For now, we'll fetch the first organization or handle correctly if auth is passed.
    // In a real app, use auth() to get orgId.
    // We'll mock getting the first organization for simplicity if auth not available in this scope,
    // but ideally you should pass organizationId.
    // Let's assume we can get it from the user session or fixed seed.
    // For this action, we'll use a helper to get current org or pass it.

    // Actually, let's fetch orders and expenses for the *current* user's organization.
    // We will assume the session is handled by the caller or we use a fixed org for now.
    // We'll use the first organization found if no auth (dev mode) or implement auth.

    // TODO: Replace with actual session org ID
    const org = await db.organization.findFirst();
    if (!org) throw new Error("Organization not found");
    const organizationId = org.id;

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
    const org = await db.organization.findFirst();
    if (!org) return [];

    return db.productCost.findMany({
        where: { organizationId: org.id },
        orderBy: { name: 'asc' }
    });
}

/**
 * Update or Create a Product Cost
 */
export async function saveProductCost(input: ProductCostInput) {
    const org = await db.organization.findFirst();
    if (!org) throw new Error("No organization");

    await db.productCost.upsert({
        where: {
            organizationId_sku: {
                organizationId: org.id,
                sku: input.sku
            }
        },
        create: {
            organizationId: org.id,
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
    const org = await db.organization.findFirst();
    if (!org) return null;

    return db.financialConfig.findUnique({
        where: { organizationId: org.id }
    });
}

/**
 * Save financial config
 */
export async function saveFinancialConfig(input: FinancialConfigInput) {
    const org = await db.organization.findFirst();
    if (!org) throw new Error("No organization");

    await db.financialConfig.upsert({
        where: { organizationId: org.id },
        create: {
            organizationId: org.id,
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
