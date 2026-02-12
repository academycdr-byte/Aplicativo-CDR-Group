import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { syncFacebookAdsMetrics } from "@/lib/integrations/facebook-ads";

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
        let body: { startPhase?: number; accountIndex?: number; syncLogId?: string; forceFullSync?: boolean } = {};
        try {
            body = await request.json();
        } catch {
            // No body or invalid JSON — use defaults
        }

        // Force full sync: clear any stale cursor and reset sync status
        if (body.forceFullSync) {
            const integration = await prisma.integration.findUnique({
                where: { organizationId_platform: { organizationId: orgId, platform: "FACEBOOK_ADS" } },
                select: { id: true, metadata: true },
            });
            if (integration) {
                const meta = (integration.metadata as Record<string, unknown>) || {};
                const { fbSyncCursor: _, ...rest } = meta;
                await prisma.integration.update({
                    where: { id: integration.id },
                    data: { syncStatus: "IDLE", metadata: rest as Record<string, string | number | boolean | null>, errorMessage: null },
                });
            }
        }

        const result = await syncFacebookAdsMetrics(orgId, {
            startPhase: body.startPhase,
            accountIndex: body.accountIndex,
            syncLogId: body.syncLogId,
            timeBudgetMs: 45000,
        });

        return NextResponse.json({
            success: result.success,
            synced: result.synced,
            error: result.error,
            hasMore: result.hasMore,
            nextPhase: result.nextPhase,
            accountIndex: result.accountIndex,
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
