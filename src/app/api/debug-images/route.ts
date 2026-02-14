import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

/**
 * TEMPORARY diagnostic endpoint to debug Nuvemshop product images.
 * DELETE after debugging is complete.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");

    // Simple guard
    if (secret !== "debug-nuvem-2026") {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    try {
        // 1. Find a Nuvemshop integration
        const integration = await prisma.integration.findFirst({
            where: { platform: "NUVEMSHOP", status: "CONNECTED" },
        });

        if (!integration) {
            return NextResponse.json({ error: "No Nuvemshop integration found" });
        }

        const accessToken = decrypt(integration.accessToken!);
        const storeId = integration.externalStoreId;

        // 2. Get a few orders with rawData to check image field
        const orders = await prisma.order.findMany({
            where: {
                organizationId: integration.organizationId,
                platform: "NUVEMSHOP",
                status: { in: ["paid", "authorized", "delivered", "shipped"] },
            },
            select: { rawData: true, externalOrderId: true },
            take: 3,
            orderBy: { orderDate: "desc" },
        });

        const orderDebug = orders.map((o) => {
            const raw = o.rawData as Record<string, unknown>;
            const products = raw?.products;
            const lineItems = raw?.line_items;
            return {
                orderId: o.externalOrderId,
                hasProducts: Array.isArray(products),
                productsCount: Array.isArray(products) ? products.length : 0,
                hasLineItems: Array.isArray(lineItems),
                // Show first product's image data
                firstProductImage: Array.isArray(products) && products[0]
                    ? (products[0] as Record<string, unknown>).image
                    : "NO_PRODUCTS",
                firstProductName: Array.isArray(products) && products[0]
                    ? (products[0] as Record<string, unknown>).name
                    : "NO_PRODUCTS",
                firstProductId: Array.isArray(products) && products[0]
                    ? (products[0] as Record<string, unknown>).product_id
                    : "NO_PRODUCTS",
                // Also check line_items for comparison
                firstLineItemKeys: Array.isArray(lineItems) && lineItems[0]
                    ? Object.keys(lineItems[0] as Record<string, unknown>)
                    : [],
            };
        });

        // 3. Try fetching products from Nuvemshop Products API
        let productsApiResult: unknown = null;
        try {
            const url = `https://api.nuvemshop.com.br/v1/${storeId}/products?per_page=3`;
            const response = await fetch(url, {
                headers: {
                    Authentication: `bearer ${accessToken}`,
                    "User-Agent": "CDR Group Hub (cdrgroup.com)",
                    "Content-Type": "application/json",
                },
                signal: AbortSignal.timeout(10000),
            });

            if (!response.ok) {
                productsApiResult = {
                    error: `HTTP ${response.status} ${response.statusText}`,
                    body: await response.text().catch(() => ""),
                };
            } else {
                const data = await response.json();
                if (Array.isArray(data)) {
                    productsApiResult = data.slice(0, 2).map((p: Record<string, unknown>) => ({
                        id: p.id,
                        name: p.name,
                        hasImages: !!p.images,
                        imagesCount: Array.isArray(p.images) ? p.images.length : 0,
                        firstImage: Array.isArray(p.images) && p.images[0]
                            ? p.images[0]
                            : "NO_IMAGES",
                        variants: Array.isArray(p.variants) ? p.variants.length : 0,
                    }));
                } else {
                    productsApiResult = { error: "Response is not an array", type: typeof data };
                }
            }
        } catch (err) {
            productsApiResult = { error: String(err) };
        }

        // 4. Check if any product IDs from orders match products API
        const orderProductIds = new Set<string>();
        for (const o of orders) {
            const raw = o.rawData as Record<string, unknown>;
            const products = raw?.products;
            if (Array.isArray(products)) {
                for (const p of products) {
                    const pid = (p as Record<string, unknown>).product_id;
                    if (pid) orderProductIds.add(String(pid));
                }
            }
        }

        return NextResponse.json({
            integration: {
                id: integration.id,
                storeId: integration.externalStoreId,
                platform: integration.platform,
                status: integration.status,
            },
            orderDebug,
            orderProductIds: Array.from(orderProductIds),
            productsApiResult,
        }, { status: 200 });
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
