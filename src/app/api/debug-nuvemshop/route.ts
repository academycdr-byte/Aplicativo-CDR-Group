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
    const [dbOrderCount, dbOrders, lastSyncLog] = await Promise.all([
        prisma.order.count({ where: { organizationId: orgId, platform: "NUVEMSHOP" } }),
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
    ]);

    return NextResponse.json({
        integration: {
            storeId,
            status: integration.status,
            syncStatus: integration.syncStatus,
            lastSyncAt: integration.lastSyncAt,
            errorMessage: integration.errorMessage,
        },
        api: {
            totalHint: apiTotalHint,
            error: apiError,
            orders: apiOrders.map((o) => ({
                id: o.id,
                number: o.number,
                status: o.status,
                payment_status: o.payment_status,
                total: o.total,
                created_at: o.created_at,
                customer: (o.customer as Record<string, unknown>)?.name || null,
                productsCount: Array.isArray(o.products) ? (o.products as unknown[]).length : 0,
            })),
        },
        db: {
            totalOrders: dbOrderCount,
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
    });
}
