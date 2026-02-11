import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { syncNuvemshopOrders } from "@/lib/integrations/nuvemshop";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const membership = await prisma.membership.findFirst({
        where: { userId: session.user.id },
    });

    if (!membership) {
        return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const orgId = membership.organizationId;

    try {
        // Parse continuation params from request body
        let body: { startPage?: number; syncLogId?: string } = {};
        try {
            body = await request.json();
        } catch {
            // No body or invalid JSON — use defaults
        }

        const result = await syncNuvemshopOrders(orgId, {
            startPage: body.startPage,
            syncLogId: body.syncLogId,
            timeBudgetMs: 50000, // 50s budget within 60s maxDuration
        });

        return NextResponse.json({
            success: !result.error,
            orders: { synced: result.synced, error: result.error },
            hasMore: result.hasMore,
            nextPage: result.nextPage,
            syncLogId: result.syncLogId,
        });
    } catch (error: unknown) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            hasMore: false,
        }, { status: 500 });
    }
}
