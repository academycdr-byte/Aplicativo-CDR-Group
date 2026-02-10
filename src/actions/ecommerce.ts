
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { fetchShopifyProducts, fetchShopifyCollections } from "@/lib/integrations/shopify";
import { fetchNuvemshopProducts, fetchNuvemshopCollections } from "@/lib/integrations/nuvemshop";
import { type Product, type Collection } from "@/lib/ecommerce-service";
import { toBrasiliaStartOfDay, toBrasiliaEndOfDay, getBrazilToday } from "@/lib/date-utils";

/**
 * Server Action to get best selling products from the connected store.
 */
/**
 * Server Action to get best selling products from the connected store.
 * Aggregates sales data from local Period (from/to) to ensure accurate "Best Sellers" ranking.
 */
export async function getBestSellersAction(
    collectionId?: string,
    from?: Date,
    to?: Date
): Promise<Product[]> {
    const session = await auth();

    if (!session?.user?.id) {
        return [];
    }

    // Find the user's organization
    const membership = await prisma.membership.findFirst({
        where: { userId: session.user.id },
        select: { organizationId: true }
    });

    if (!membership) {
        return [];
    }

    const organizationId = membership.organizationId;

    // Find active integration (Shopify or Nuvemshop)
    const integration = await prisma.integration.findFirst({
        where: {
            organizationId,
            status: "CONNECTED",
            platform: { in: ["SHOPIFY", "NUVEMSHOP"] }
        }
    });

    if (!integration) {
        console.log("No active integration found for organization", organizationId);
        return [];
    }

    try {
        // 1. Validate dates or set defaults (last 30 days in Brasilia)
        const todayStr = getBrazilToday();
        const endDate = to || toBrasiliaEndOfDay(todayStr);
        // Default start: 30 days ago in Brasilia timezone
        const thirtyDaysAgo = new Date(todayStr);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);
        const startDate = from || toBrasiliaStartOfDay(thirtyDaysAgoStr);

        // 2. Fetch orders from database within the period
        const orders = await prisma.order.findMany({
            where: {
                organizationId,
                platform: integration.platform,
                orderDate: {
                    gte: startDate,
                    lte: endDate
                },
                status: { in: ["paid", "partially_refunded", "delivered", "shipped"] } // Only count valid sales
            },
            select: {
                rawData: true
            }
        });

        // 3. Aggregate sales by product (quantity + revenue)
        const salesMap = new Map<string, number>();
        const revenueMap = new Map<string, number>();
        const productIds = new Set<string>();

        for (const order of orders) {
            const raw = order.rawData as Record<string, unknown>;

            if (integration.platform === "SHOPIFY") {
                // Shopify: line_items array
                const lineItems = raw?.line_items;
                if (Array.isArray(lineItems)) {
                    for (const item of lineItems) {
                        const li = item as Record<string, unknown>;
                        if (li.product_id) {
                            const pid = String(li.product_id);
                            const qty = Number(li.quantity) || 0;
                            const itemPrice = parseFloat(String(li.price || "0"));
                            salesMap.set(pid, (salesMap.get(pid) || 0) + qty);
                            revenueMap.set(pid, (revenueMap.get(pid) || 0) + (itemPrice * qty));
                            productIds.add(pid);
                        }
                    }
                }
            } else if (integration.platform === "NUVEMSHOP") {
                // Nuvemshop: products array
                const products = raw?.products;
                if (Array.isArray(products)) {
                    for (const item of products) {
                        const li = item as Record<string, unknown>;
                        if (li.product_id) {
                            const pid = String(li.product_id);
                            const qty = parseInt(String(li.quantity)) || 0;
                            const itemPrice = parseFloat(String(li.price || "0"));
                            salesMap.set(pid, (salesMap.get(pid) || 0) + qty);
                            revenueMap.set(pid, (revenueMap.get(pid) || 0) + (itemPrice * qty));
                            productIds.add(pid);
                        }
                    }
                }
            }
        }

        if (productIds.size === 0) {
            return []; // No sales in this period
        }

        // 4. Sort by sales count and take top 50 (to avoid fetching details for everything)
        // Convert to array [id, qty]
        const sortedProducts = Array.from(salesMap.entries())
            .sort((a, b) => b[1] - a[1]) // Descending
            .slice(0, 50);

        const topProductIds = sortedProducts.map(p => p[0]);

        // 5. Fetch details only for these top products
        let productsDetails: any[] = [];

        if (integration.platform === "SHOPIFY") {
            // Shopify allows fetching by IDs: ids=123,456
            const accessToken = decrypt(integration.accessToken!);
            const shop = integration.externalStoreId;
            const idsParam = topProductIds.join(",");
            const url = `https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION || '2025-01'}/products.json?ids=${idsParam}`;

            const response = await fetch(url, {
                headers: {
                    "X-Shopify-Access-Token": accessToken,
                    "Content-Type": "application/json",
                }
            });

            if (response.ok) {
                const data = await response.json();
                productsDetails = data.products || [];
            }
        } else {
            // Nuvemshop might not support bulk ID fetch easily, or we implement similar logic if needed.
            // For now, if Nuvemshop, likely need another strategy or just fetch all and filter.
            // Fallback: Fetch standard products list (cached) and join.
            // Note: Implementing efficient Nuvemshop fetch is out of scope for this quick fix unless requested.
            // We will try standard fetch and filter.
            productsDetails = await fetchNuvemshopProducts(integration.id);
        }

        // 6. Join details with sales count
        const result: Product[] = [];

        for (const [id, qty] of sortedProducts) {
            const details = productsDetails.find((p: any) => String(p.id) === id);

            // If product details not found (deleted? or Nuvemshop missing), we might skip or show basic info if available
            if (!details) continue;

            if (integration.platform === "SHOPIFY") {
                const imageUrl = details.image?.src || details.images?.[0]?.src || "";
                const price = details.variants?.[0]?.price || "0.00";
                const rev = revenueMap.get(id) || 0;

                result.push({
                    id: String(details.id),
                    title: details.title,
                    price: parseFloat(price),
                    currency: "BRL",
                    imageUrl: imageUrl || "",
                    collection: "all",
                    vendor: details.vendor,
                    totalSold: qty,
                    totalRevenue: rev
                });
            } else {
                // Nuvemshop mapping
                const imageUrl = details.images?.[0]?.src || "";
                const price = details.variants?.[0]?.price || "0.00";
                const rev = revenueMap.get(id) || 0;
                result.push({
                    id: String(details.id),
                    title: details.name?.pt || details.name || "Produto",
                    price: parseFloat(price),
                    currency: "BRL",
                    imageUrl: imageUrl,
                    collection: "all",
                    vendor: details.brand,
                    totalSold: qty,
                    totalRevenue: rev
                });
            }
        }

        return result;

    } catch (error) {
        console.error("Error in getBestSellersAction:", error);
        return [];
    }
}

/**
 * Server Action to get collections
 */
export async function getCollectionsAction(): Promise<Collection[]> {
    const session = await auth();
    if (!session?.user?.id) return [];

    const membership = await prisma.membership.findFirst({
        where: { userId: session.user.id },
        select: { organizationId: true }
    });

    if (!membership) return [];

    const integration = await prisma.integration.findFirst({
        where: {
            organizationId: membership.organizationId,
            status: "CONNECTED",
            platform: { in: ["SHOPIFY", "NUVEMSHOP"] }
        }
    });

    if (!integration) return [];

    try {
        let rawCollections: any[] = [];

        if (integration.platform === "SHOPIFY") {
            rawCollections = await fetchShopifyCollections(integration.id);

            return rawCollections.map((c: any) => ({
                id: String(c.id),
                title: c.title
            }));

        } else if (integration.platform === "NUVEMSHOP") {
            rawCollections = await fetchNuvemshopCollections(integration.id);

            return rawCollections.map((c: any) => ({
                id: String(c.id),
                title: c.name?.pt || c.name?.es || c.name || "Sem nome"
            }));
        }

        return [];
    } catch (error) {
        console.error("Error in getCollectionsAction:", error);
        return [];
    }
}
