import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

export const maxDuration = 60;

/**
 * Lightweight diagnostic — read-only, no sync, no DB writes.
 * Shows: integration status, API order count + details, DB state.
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const membership = await prisma.membership.findFirst({
        where: { userId: session.user.id },
    });

    if (!membership) {
        return NextResponse.json({ error: "No membership" }, { status: 400 });
    }

    const orgId = membership.organizationId;

    // 1. Integration record
    const integration = await prisma.integration.findUnique({
        where: { organizationId_platform: { organizationId: orgId, platform: "NUVEMSHOP" } },
    });

    if (!integration || !integration.accessToken) {
        return NextResponse.json({
            error: "No integration",
            integration: integration ? {
                status: integration.status,
                syncStatus: integration.syncStatus,
                hasToken: !!integration.accessToken,
            } : null,
        });
    }

    let accessToken: string;
    try {
        accessToken = decrypt(integration.accessToken);
    } catch (err) {
        return NextResponse.json({
            error: "Token decrypt failed",
            detail: err instanceof Error ? err.message : "unknown",
        });
    }

    const storeId = integration.externalStoreId || "";

    // 2. Fetch first page of orders from API (per_page=50, enough to diagnose)
    let apiOrders: Record<string, unknown>[] = [];
    let apiError: string | null = null;
    let apiTotalHint: string | null = null;

    try {
        const res = await fetch(
            `https://api.nuvemshop.com.br/v1/${storeId}/orders?per_page=50&page=1`,
            {
                headers: {
                    Authentication: `bearer ${accessToken}`,
                    "User-Agent": "CDR Group Hub (cdrgroup.com)",
                    "Content-Type": "application/json",
                },
            }
        );

        if (!res.ok) {
            apiError = `HTTP ${res.status}: ${await res.text()}`;
        } else {
            apiOrders = await res.json();
            if (!Array.isArray(apiOrders)) apiOrders = [];
            apiTotalHint = apiOrders.length === 50 ? "50+ (more pages exist)" : `${apiOrders.length} total`;
        }
    } catch (err) {
        apiError = err instanceof Error ? err.message : "unknown";
    }

    // 3. DB state (read-only)
    const [dbOrderCount, dbPaidCount, dbOrders, lastSyncLog, sampleOrderWithRaw] = await Promise.all([
        prisma.order.count({ where: { organizationId: orgId, platform: "NUVEMSHOP" } }),
        prisma.order.count({ where: { organizationId: orgId, platform: "NUVEMSHOP", status: "paid" } }),
        prisma.order.findMany({
            where: { organizationId: orgId, platform: "NUVEMSHOP" },
            select: { externalOrderId: true, status: true, totalAmount: true, orderDate: true, itemCount: true },
            orderBy: { orderDate: "desc" },
            take: 20,
        }),
        prisma.syncLog.findFirst({
            where: { organizationId: orgId, platform: "NUVEMSHOP" },
            orderBy: { startedAt: "desc" },
        }),
        // Fetch one order with rawData to inspect product image structure
        prisma.order.findFirst({
            where: { organizationId: orgId, platform: "NUVEMSHOP", itemCount: { gt: 0 } },
            select: { externalOrderId: true, rawData: true },
            orderBy: { orderDate: "desc" },
        }),
    ]);

    // 4. Extract image info from rawData sample
    let rawDataSample: Record<string, unknown> | null = null;
    if (sampleOrderWithRaw?.rawData) {
        const raw = sampleOrderWithRaw.rawData as Record<string, unknown>;
        const products = raw.products;
        if (Array.isArray(products) && products.length > 0) {
            const firstProduct = products[0] as Record<string, unknown>;
            rawDataSample = {
                orderId: sampleOrderWithRaw.externalOrderId,
                productFields: Object.keys(firstProduct),
                product_id: firstProduct.product_id,
                name: firstProduct.name,
                imageField: firstProduct.image,
                imageType: typeof firstProduct.image,
                // Show all products' image info
                allProductImages: products.slice(0, 5).map((p: unknown) => {
                    const prod = p as Record<string, unknown>;
                    const img = prod.image as Record<string, unknown> | null;
                    return {
                        product_id: prod.product_id,
                        name: prod.name,
                        hasImage: !!img,
                        imageSrc: img?.src || null,
                    };
                }),
            };
        }
    }

    // 5. Fetch first product from Products API to check image structure
    let productsApiSample: Record<string, unknown> | null = null;
    try {
        const res = await fetch(
            `https://api.nuvemshop.com.br/v1/${storeId}/products?per_page=1`,
            {
                headers: {
                    Authentication: `bearer ${accessToken}`,
                    "User-Agent": "CDR Group Hub (cdrgroup.com)",
                    "Content-Type": "application/json",
                },
            }
        );
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                const p = data[0];
                productsApiSample = {
                    id: p.id,
                    name: p.name,
                    hasImages: Array.isArray(p.images) && p.images.length > 0,
                    imagesCount: Array.isArray(p.images) ? p.images.length : 0,
                    firstImageSrc: p.images?.[0]?.src || null,
                    brand: p.brand,
                };
            }
        }
    } catch { /* ignore */ }

    // 6. Count orders by status
    const statusCounts = await prisma.order.groupBy({
        by: ["status"],
        where: { organizationId: orgId, platform: "NUVEMSHOP" },
        _count: { id: true },
    });

    return NextResponse.json({
        integration: {
            storeId,
            status: integration.status,
            syncStatus: integration.syncStatus,
            lastSyncAt: integration.lastSyncAt,
            errorMessage: integration.errorMessage,
            syncCursor: (integration.metadata as Record<string, unknown>)?.syncCursor || null,
        },
        api: {
            totalHint: apiTotalHint,
            error: apiError,
            orders: apiOrders.slice(0, 10).map((o) => ({
                id: o.id,
                number: o.number,
                status: o.status,
                payment_status: o.payment_status,
                total: o.total,
                created_at: o.created_at,
                customer: (o.customer as Record<string, unknown>)?.name || null,
                productsCount: Array.isArray(o.products) ? (o.products as unknown[]).length : 0,
                // Show first product image info from API
                firstProductImage: Array.isArray(o.products) && (o.products as unknown[]).length > 0
                    ? ((o.products as Record<string, unknown>[])[0].image as Record<string, unknown>)?.src || null
                    : null,
            })),
        },
        db: {
            totalOrders: dbOrderCount,
            paidOrders: dbPaidCount,
            statusBreakdown: statusCounts.map(s => ({ status: s.status, count: s._count.id })),
            orders: dbOrders.map((o) => ({
                ...o,
                totalAmount: Number(o.totalAmount),
            })),
            lastSync: lastSyncLog ? {
                status: lastSyncLog.status,
                recordsSynced: lastSyncLog.recordsSynced,
                errorMessage: lastSyncLog.errorMessage,
                startedAt: lastSyncLog.startedAt,
                completedAt: lastSyncLog.completedAt,
            } : null,
        },
        imageDebug: {
            rawDataSample,
            productsApiSample,
        },
    });
}
