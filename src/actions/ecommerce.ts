
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { fetchShopifyProducts, fetchShopifyCollections, type ShopifyProduct, type ShopifyCollection } from "@/lib/integrations/shopify";
import { fetchNuvemshopProducts, fetchNuvemshopCollections, type NuvemshopProduct, type NuvemshopCollection } from "@/lib/integrations/nuvemshop";
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
        let productsDetails: (ShopifyProduct | NuvemshopProduct)[] = [];

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
            // Nuvemshop: fetch ALL products from the Products API (includes images)
            // Then filter to only the ones we need. This is the proven path that
            // works for collections — now used for the default view too.
            try {
                const allNuvemProducts = await fetchNuvemshopProducts(
                    integration.id,
                    (collectionId && collectionId !== "all") ? collectionId : undefined
                );
                // Filter to only the products we need
                const topIdSet = new Set(topProductIds);
                productsDetails = allNuvemProducts.filter(
                    (p) => topIdSet.has(String(p.id))
                );
            } catch (err) {
                console.error("[BestSellers] Nuvemshop products fetch failed:", err);
                productsDetails = [];
            }
        }

        // 6. Join details with sales count
        const result: Product[] = [];

        for (const [id, qty] of sortedProducts) {
            const details = productsDetails.find((p) => String(p.id) === id);
            const rawInfo = productInfoFromOrders.get(id);

            // Skip only if we have neither API details nor rawData info
            if (!details && !rawInfo) continue;

            if (integration.platform === "SHOPIFY") {
                if (!details) continue;
                const shopifyDetails = details as ShopifyProduct;
                const imageUrl = shopifyDetails.image?.src || shopifyDetails.images?.[0]?.src || "";
                const price = shopifyDetails.variants?.[0]?.price || "0.00";
                const rev = revenueMap.get(id) || 0;

                result.push({
                    id: String(shopifyDetails.id),
                    title: shopifyDetails.title,
                    price: parseFloat(price),
                    currency: "BRL",
                    imageUrl: imageUrl || "",
                    collection: "all",
                    vendor: shopifyDetails.vendor || "",
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
                    const nuvemDetails = details as NuvemshopProduct;
                    // Try first image object, then the full images array as fallback
                    imageUrl = extractNuvemshopImage(nuvemDetails.images?.[0]);
                    if (!imageUrl && nuvemDetails.images) {
                        imageUrl = extractNuvemshopImage(nuvemDetails.images);
                    }
                    title = extractI18nName(nuvemDetails.name);
                    price = nuvemDetails.variants?.[0]?.price || "0.00";
                    vendor = nuvemDetails.brand || "";
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

/** Extract image URL from a Nuvemshop image field (object, string, or array), filtering placeholders */
function extractNuvemshopImage(imageField: unknown): string {
    let src = "";

    if (typeof imageField === "string") {
        src = imageField;
    } else if (Array.isArray(imageField)) {
        // Handle case where images array is passed directly
        const first = imageField[0];
        if (first) {
            if (typeof first === "string") {
                src = first;
            } else if (typeof first === "object" && first !== null) {
                src = (first as Record<string, unknown>).src
                    ? String((first as Record<string, unknown>).src)
                    : (first as Record<string, unknown>).url
                        ? String((first as Record<string, unknown>).url)
                        : "";
            }
        }
    } else if (imageField && typeof imageField === "object") {
        const obj = imageField as Record<string, unknown>;
        // Try src first, then url as fallback
        src = obj.src ? String(obj.src) : obj.url ? String(obj.url) : "";
    }

    // Filter out the Nuvemshop no-photo placeholder
    if (src && src.includes(NUVEMSHOP_NO_PHOTO)) return "";
    // Nuvemshop API sometimes returns http:// URLs - upgrade to https://
    if (src && src.startsWith("http://")) {
        src = src.replace("http://", "https://");
    }
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
        if (integration.platform === "SHOPIFY") {
            const shopifyCollections: ShopifyCollection[] = await fetchShopifyCollections(integration.id);

            return shopifyCollections.map((c) => ({
                id: String(c.id),
                title: c.title
            }));

        } else if (integration.platform === "NUVEMSHOP") {
            const nuvemCollections: NuvemshopCollection[] = await fetchNuvemshopCollections(integration.id);

            return nuvemCollections.map((c) => {
                const name = c.name;
                const title = typeof name === "string"
                    ? name
                    : (name?.pt || name?.es || Object.values(name || {})[0] || "Sem nome");
                return { id: String(c.id), title };
            });
        }

        return [];
    } catch (error) {
        console.error("Error in getCollectionsAction:", error);
        return [];
    }
}
