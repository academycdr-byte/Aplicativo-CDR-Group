
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
                status: { in: ["paid", "authorized", "partially_paid", "partially_refunded", "delivered", "shipped"] } // Count confirmed sales
            },
            select: {
                rawData: true
            }
        });

        // 3. Aggregate sales by product (quantity + revenue)
        const salesMap = new Map<string, number>();
        const revenueMap = new Map<string, number>();
        const productIds = new Set<string>();
        // Collect product info from order rawData (name, image) as fallback
        const productInfoFromOrders = new Map<string, { name: string; imageUrl: string }>();

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

                            // Collect product info from rawData (first occurrence wins)
                            if (!productInfoFromOrders.has(pid)) {
                                const name = extractI18nName(li.name);
                                const imageUrl = extractNuvemshopImage(li.image);
                                productInfoFromOrders.set(pid, { name, imageUrl });
                            }
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            // Nuvemshop: fetch all products (paginated) and filter
            try {
                productsDetails = await fetchNuvemshopProducts(integration.id);
            } catch {
                // If Products API fails, we still have rawData info
                productsDetails = [];
            }
        }

        // 6. Join details with sales count
        const result: Product[] = [];

        for (const [id, qty] of sortedProducts) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const details = productsDetails.find((p: any) => String(p.id) === id);
            const rawInfo = productInfoFromOrders.get(id);

            // Skip only if we have neither API details nor rawData info
            if (!details && !rawInfo) continue;

            if (integration.platform === "SHOPIFY") {
                if (!details) continue;
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
                // Nuvemshop mapping — use Products API details with rawData fallback
                let imageUrl = "";
                let title = "Produto";
                let price = "0.00";
                let vendor = "";

                if (details) {
                    imageUrl = extractNuvemshopImage(details.images?.[0]);
                    title = extractI18nName(details.name);
                    price = details.variants?.[0]?.price || "0.00";
                    vendor = details.brand || "";
                }

                // Fallback to rawData info when Products API doesn't have this product
                if (!imageUrl && rawInfo?.imageUrl) imageUrl = rawInfo.imageUrl;
                if (title === "Produto" && rawInfo?.name) title = rawInfo.name;

                const rev = revenueMap.get(id) || 0;
                result.push({
                    id,
                    title,
                    price: parseFloat(price),
                    currency: "BRL",
                    imageUrl,
                    collection: "all",
                    vendor,
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

/** Extract a display string from a Nuvemshop multilingual name field */
function extractI18nName(nameField: unknown): string {
    if (typeof nameField === "string") return nameField || "Produto";
    if (nameField && typeof nameField === "object") {
        const obj = nameField as Record<string, string>;
        return obj.pt || obj.es || obj.en || Object.values(obj).find(v => typeof v === "string" && v) || "Produto";
    }
    return "Produto";
}

const NUVEMSHOP_NO_PHOTO = "no-photo";

/** Extract image URL from a Nuvemshop image field (object or string), filtering placeholders */
function extractNuvemshopImage(imageField: unknown): string {
    let src = "";
    if (typeof imageField === "string") {
        src = imageField;
    } else if (imageField && typeof imageField === "object") {
        const obj = imageField as Record<string, unknown>;
        src = obj.src ? String(obj.src) : "";
    }
    // Filter out the Nuvemshop no-photo placeholder
    if (src && src.includes(NUVEMSHOP_NO_PHOTO)) return "";
    return src;
}

/**
 * Server Action to get total revenue from orders (same logic as Dashboard "Faturamento").
 * Uses order.totalAmount with status="paid" to match dashboard exactly.
 */
export async function getOrdersRevenueTotalAction(from?: Date, to?: Date): Promise<number> {
    const session = await auth();
    if (!session?.user?.id) return 0;

    const membership = await prisma.membership.findFirst({
        where: { userId: session.user.id },
        select: { organizationId: true }
    });

    if (!membership) return 0;

    const todayStr = getBrazilToday();
    const endDate = to || toBrasiliaEndOfDay(todayStr);
    const thirtyDaysAgo = new Date(todayStr);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);
    const startDate = from || toBrasiliaStartOfDay(thirtyDaysAgoStr);

    const result = await prisma.order.aggregate({
        where: {
            organizationId: membership.organizationId,
            orderDate: { gte: startDate, lte: endDate },
            status: "paid",
        },
        _sum: { totalAmount: true },
    });

    return Number(result._sum.totalAmount || 0);
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
