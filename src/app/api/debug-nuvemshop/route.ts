import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { parseOrderDate } from "@/lib/date-utils";

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

    // Step 1: Check integration
    const integration = await prisma.integration.findUnique({
        where: { organizationId_platform: { organizationId: orgId, platform: "NUVEMSHOP" } },
    });

    if (!integration || !integration.accessToken) {
        return NextResponse.json({ error: "Integration not found or no token" });
    }

    steps.integration = {
        status: integration.status,
        syncStatus: integration.syncStatus,
        storeId: integration.externalStoreId,
    };

    // Step 2: Decrypt token
    let accessToken = "";
    try {
        accessToken = decrypt(integration.accessToken);
        steps.decrypt = "OK";
    } catch (err: unknown) {
        return NextResponse.json({ steps, error: "Decrypt failed: " + (err instanceof Error ? err.message : "unknown") });
    }

    // Step 3: Fetch first page of orders from Nuvemshop
    const storeId = integration.externalStoreId || "";
    let orders: Record<string, unknown>[] = [];
    try {
        const response = await fetch(
            `https://api.nuvemshop.com.br/v1/${storeId}/orders?per_page=10&page=1`,
            {
                headers: {
                    Authentication: `bearer ${accessToken}`,
                    "User-Agent": "CDR Group Hub (cdrgroup.com)",
                    "Content-Type": "application/json",
                },
            }
        );

        steps.apiStatus = response.status;

        if (!response.ok) {
            const text = await response.text();
            return NextResponse.json({ steps, error: `API ${response.status}: ${text.substring(0, 300)}` });
        }

        const data = await response.json();
        orders = Array.isArray(data) ? data : [];
        steps.ordersFromApi = orders.length;
    } catch (err: unknown) {
        return NextResponse.json({ steps, error: "API fetch failed: " + (err instanceof Error ? err.message : "unknown") });
    }

    if (orders.length === 0) {
        return NextResponse.json({ steps, result: "No orders in Nuvemshop store" });
    }

    // Step 4: Try to upsert FIRST order only (to test DB write)
    const raw = orders[0];
    const customer = raw.customer as Record<string, unknown> | null;
    const products = raw.products as Array<Record<string, unknown>> | undefined;

    const orderData = {
        organizationId: orgId,
        platform: "NUVEMSHOP" as const,
        externalOrderId: String(raw.id),
        status: mapStatus(String(raw.payment_status || "")),
        customerName: (customer?.name as string) || null,
        customerEmail: (customer?.email as string) || null,
        totalAmount: parseFloat(String(raw.total || "0")),
        currency: (raw.currency as string) || "BRL",
        itemCount: products?.length || 0,
        orderDate: parseOrderDate(String(raw.created_at)),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rawData: { id: raw.id, total: raw.total, payment_status: raw.payment_status } as any,
    };

    steps.orderToWrite = {
        externalOrderId: orderData.externalOrderId,
        status: orderData.status,
        totalAmount: orderData.totalAmount,
        orderDate: orderData.orderDate,
        customerEmail: orderData.customerEmail,
    };

    try {
        const result = await prisma.order.upsert({
            where: {
                organizationId_platform_externalOrderId: {
                    organizationId: orgId,
                    platform: "NUVEMSHOP",
                    externalOrderId: String(raw.id),
                },
            },
            create: orderData,
            update: {
                status: orderData.status,
                totalAmount: orderData.totalAmount,
                customerName: orderData.customerName,
                customerEmail: orderData.customerEmail,
                itemCount: orderData.itemCount,
                orderDate: orderData.orderDate,
                rawData: orderData.rawData,
            },
        });

        steps.upsertResult = { success: true, orderId: result.id };
    } catch (err: unknown) {
        steps.upsertResult = {
            success: false,
            error: err instanceof Error ? err.message : "Unknown",
            stack: err instanceof Error ? err.stack?.substring(0, 500) : undefined,
        };
        return NextResponse.json({ steps, error: "DB upsert failed" });
    }

    // Step 5: Now try full sync
    try {
        // Reset sync status first
        await prisma.integration.update({
            where: { id: integration.id },
            data: { syncStatus: "IDLE" },
        });

        // Run actual sync (imported dynamically to avoid issues)
        const { syncNuvemshopOrders } = await import("@/lib/integrations/nuvemshop");
        const syncResult = await syncNuvemshopOrders(orgId);
        steps.fullSync = syncResult;
    } catch (err: unknown) {
        steps.fullSync = {
            error: err instanceof Error ? err.message : "Unknown",
            stack: err instanceof Error ? err.stack?.substring(0, 500) : undefined,
        };
    }

    // Step 6: Final count
    const finalCount = await prisma.order.count({
        where: { organizationId: orgId, platform: "NUVEMSHOP" },
    });
    steps.finalOrderCount = finalCount;

    return NextResponse.json({ steps, success: true });
}

function mapStatus(status: string): string {
    const map: Record<string, string> = {
        paid: "paid",
        pending: "pending",
        refunded: "refunded",
        voided: "cancelled",
        authorized: "pending",
    };
    return map[status] || status;
}
