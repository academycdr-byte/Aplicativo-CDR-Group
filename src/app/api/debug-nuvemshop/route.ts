import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { syncNuvemshopOrders, syncNuvemshopFunnel } from "@/lib/integrations/nuvemshop";

export const maxDuration = 60;

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
    const steps: Record<string, unknown> = {};

    // STEP 1: Integration record
    const integration = await prisma.integration.findUnique({
        where: { organizationId_platform: { organizationId: orgId, platform: "NUVEMSHOP" } },
    });

    steps.integration = integration
        ? {
            id: integration.id,
            status: integration.status,
            syncStatus: integration.syncStatus,
            lastSyncAt: integration.lastSyncAt,
            errorMessage: integration.errorMessage,
            externalStoreId: integration.externalStoreId,
            hasAccessToken: !!integration.accessToken,
        }
        : "NOT FOUND";

    if (!integration || !integration.accessToken) {
        return NextResponse.json({ steps, error: "No integration or token" });
    }

    // STEP 2: Decrypt token
    let accessToken: string;
    try {
        accessToken = decrypt(integration.accessToken);
        steps.tokenDecrypt = "OK";
    } catch (err) {
        steps.tokenDecrypt = `FAILED: ${err instanceof Error ? err.message : "unknown"}`;
        return NextResponse.json({ steps });
    }

    const storeId = integration.externalStoreId || "";

    // STEP 3: Fetch ALL orders from Nuvemshop API (same as sync)
    let allApiOrders: Record<string, unknown>[] = [];
    let page = 1;
    let hasMore = true;
    let apiError: string | null = null;

    while (hasMore) {
        try {
            const url = `https://api.nuvemshop.com.br/v1/${storeId}/orders?per_page=200&page=${page}`;
            const res = await fetch(url, {
                headers: {
                    Authentication: `bearer ${accessToken}`,
                    "User-Agent": "CDR Group Hub (cdrgroup.com)",
                    "Content-Type": "application/json",
                },
            });

            if (!res.ok) {
                const body = await res.text();
                apiError = `HTTP ${res.status}: ${body}`;
                break;
            }

            const orders = await res.json();
            if (!Array.isArray(orders) || orders.length === 0) {
                hasMore = false;
                break;
            }

            allApiOrders = allApiOrders.concat(orders);
            hasMore = orders.length === 200;
            page++;
        } catch (err) {
            apiError = err instanceof Error ? err.message : "unknown";
            break;
        }
    }

    steps.apiResult = {
        totalFromApi: allApiOrders.length,
        pagesRead: page,
        error: apiError,
        orders: allApiOrders.map((o) => ({
            id: o.id,
            number: o.number,
            status: o.status,
            payment_status: o.payment_status,
            shipping_status: o.shipping_status,
            total: o.total,
            currency: o.currency,
            created_at: o.created_at,
            customer: (o.customer as Record<string, unknown>)?.name || null,
            productsCount: Array.isArray(o.products) ? (o.products as unknown[]).length : 0,
        })),
    };

    // STEP 4: Run the FULL sync
    let syncResult: unknown;
    let funnelResult: unknown;
    try {
        const [ordersRes, funnelRes] = await Promise.allSettled([
            syncNuvemshopOrders(orgId),
            syncNuvemshopFunnel(orgId),
        ]);
        syncResult = ordersRes.status === "fulfilled" ? ordersRes.value : { error: String(ordersRes.reason) };
        funnelResult = funnelRes.status === "fulfilled" ? funnelRes.value : { error: String(funnelRes.reason) };
    } catch (err) {
        syncResult = { error: err instanceof Error ? err.message : "unknown" };
        funnelResult = { error: "skipped" };
    }

    steps.syncResult = syncResult;
    steps.funnelResult = funnelResult;

    // STEP 5: DB state after sync
    const [orderCount, orderSample, syncLogs] = await Promise.all([
        prisma.order.count({ where: { organizationId: orgId, platform: "NUVEMSHOP" } }),
        prisma.order.findMany({
            where: { organizationId: orgId, platform: "NUVEMSHOP" },
            select: {
                externalOrderId: true,
                status: true,
                totalAmount: true,
                customerName: true,
                orderDate: true,
                itemCount: true,
            },
            orderBy: { orderDate: "desc" },
            take: 20,
        }),
        prisma.syncLog.findMany({
            where: { organizationId: orgId, platform: "NUVEMSHOP" },
            orderBy: { startedAt: "desc" },
            take: 5,
        }),
    ]);

    steps.dbAfterSync = {
        totalOrders: orderCount,
        orders: orderSample.map((o) => ({
            ...o,
            totalAmount: Number(o.totalAmount),
        })),
        recentSyncLogs: syncLogs.map((l) => ({
            status: l.status,
            recordsSynced: l.recordsSynced,
            errorMessage: l.errorMessage,
            startedAt: l.startedAt,
            completedAt: l.completedAt,
        })),
    };

    return NextResponse.json(steps);
}
