import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

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

    // Step 1: Check integration
    const integration = await prisma.integration.findUnique({
        where: { organizationId_platform: { organizationId: orgId, platform: "NUVEMSHOP" } },
    });

    if (!integration) {
        return NextResponse.json({ step: "integration", error: "Integration not found" });
    }

    const integrationInfo = {
        id: integration.id,
        status: integration.status,
        hasAccessToken: !!integration.accessToken,
        tokenLength: integration.accessToken?.length || 0,
        externalStoreId: integration.externalStoreId,
        syncStatus: integration.syncStatus,
        lastSyncAt: integration.lastSyncAt,
        errorMessage: integration.errorMessage,
    };

    // Step 2: Try decrypt
    let accessToken = "";
    try {
        if (integration.accessToken) {
            accessToken = decrypt(integration.accessToken);
        }
    } catch (err: unknown) {
        return NextResponse.json({
            step: "decrypt",
            error: err instanceof Error ? err.message : "Decrypt failed",
            integrationInfo,
        });
    }

    // Step 3: Check sync logs
    const recentLogs = await prisma.syncLog.findMany({
        where: { organizationId: orgId, platform: "NUVEMSHOP" },
        orderBy: { startedAt: "desc" },
        take: 5,
    });

    // Step 4: Try API call
    const storeId = integration.externalStoreId || "";
    let apiResult: Record<string, unknown> = {};
    try {
        const response = await fetch(
            `https://api.nuvemshop.com.br/v1/${storeId}/orders?per_page=5&page=1`,
            {
                headers: {
                    Authentication: `bearer ${accessToken}`,
                    "User-Agent": "CDR Group Hub (cdrgroup.com)",
                    "Content-Type": "application/json",
                },
            }
        );

        apiResult = {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
        };

        if (response.ok) {
            const data = await response.json();
            apiResult.isArray = Array.isArray(data);
            apiResult.count = Array.isArray(data) ? data.length : 0;
            if (Array.isArray(data) && data.length > 0) {
                apiResult.firstOrderId = data[0].id;
                apiResult.firstOrderDate = data[0].created_at;
                apiResult.firstOrderTotal = data[0].total;
                apiResult.firstOrderStatus = data[0].payment_status;
            }
        } else {
            const text = await response.text();
            apiResult.body = text.substring(0, 500);
        }
    } catch (err: unknown) {
        apiResult = { error: err instanceof Error ? err.message : "API call failed" };
    }

    // Step 5: Check orders in DB
    const orderCount = await prisma.order.count({
        where: { organizationId: orgId, platform: "NUVEMSHOP" },
    });

    const totalOrderCount = await prisma.order.count({
        where: { organizationId: orgId },
    });

    return NextResponse.json({
        integrationInfo,
        decryptOk: true,
        tokenPreview: accessToken.substring(0, 8) + "...",
        storeId,
        apiResult,
        nuvemshopOrdersInDb: orderCount,
        totalOrdersInDb: totalOrderCount,
        recentSyncLogs: recentLogs.map((l) => ({
            status: l.status,
            recordsSynced: l.recordsSynced,
            errorMessage: l.errorMessage,
            startedAt: l.startedAt,
            completedAt: l.completedAt,
        })),
    });
}
