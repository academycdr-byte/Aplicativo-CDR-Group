import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { syncFacebookAdsMetrics } from "@/lib/integrations/facebook-ads";

export const maxDuration = 60;

// Diagnostic endpoint to check integration state
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not auth" }, { status: 401 });
    const membership = await prisma.membership.findFirst({ where: { userId: session.user.id } });
    if (!membership) return NextResponse.json({ error: "No org" }, { status: 400 });

    const integration = await prisma.integration.findFirst({
        where: { organizationId: membership.organizationId, platform: "FACEBOOK_ADS" },
        select: { status: true, syncStatus: true, externalAccountId: true, metadata: true, errorMessage: true },
    });

    if (!integration) return NextResponse.json({ error: "No FB integration" });

    const meta = (integration.metadata as Record<string, unknown>) || {};
    const selAccounts = (meta as { selectedAccounts?: { id: string; name: string }[] }).selectedAccounts;
    const adAccounts = (meta as { adAccounts?: { id: string; name: string }[] }).adAccounts;
    const cursor = (meta as { fbSyncCursor?: unknown }).fbSyncCursor;

    // Count thumbnails
    const [totalAds, withThumbnails] = await Promise.all([
        prisma.adMetric.count({ where: { organizationId: membership.organizationId, platform: "FACEBOOK_ADS", adId: { not: null } } }),
        prisma.adMetric.count({ where: { organizationId: membership.organizationId, platform: "FACEBOOK_ADS", adId: { not: null }, thumbnailUrl: { not: null } } }),
    ]);

    // Per-account, per-date spend breakdown (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const spendByAccountDate = await prisma.adMetric.groupBy({
        by: ["accountId", "date"],
        where: {
            organizationId: membership.organizationId,
            platform: "FACEBOOK_ADS",
            date: { gte: new Date(sevenDaysAgo.toISOString().split("T")[0] + "T00:00:00Z") },
        },
        _sum: { spend: true },
        _count: { adId: true },
        orderBy: [{ date: "desc" }, { accountId: "asc" }],
    });

    const spendBreakdown = spendByAccountDate.map(row => ({
        accountId: row.accountId,
        date: row.date.toISOString().split("T")[0],
        spend: Number(row._sum.spend || 0),
        adCount: row._count.adId,
    }));

    return NextResponse.json({
        totalAds,
        withThumbnails,
        withoutThumbnails: totalAds - withThumbnails,
        status: integration.status,
        syncStatus: integration.syncStatus,
        externalAccountId: integration.externalAccountId || "(empty)",
        selectedAccountsCount: selAccounts?.length ?? "NOT SET",
        selectedAccountIds: selAccounts?.map(a => a.id) ?? null,
        adAccountsCount: adAccounts?.length ?? "NOT SET",
        adAccountIds: adAccounts?.map(a => a.id) ?? null,
        hasCursor: !!cursor,
        cursor: cursor || null,
        errorMessage: integration.errorMessage,
        spendBreakdown,
    });
}

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
        let body: { startPhase?: number; accountIndex?: number; startDay?: number; syncLogId?: string; forceFullSync?: boolean } = {};
        try {
            body = await request.json();
        } catch {
            // No body or invalid JSON — use defaults
        }

        // Force full sync: clear any stale cursor, reset sync status, and clear old thumbnails
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
                // Clear old/expired thumbnail URLs so Phase 0b re-fetches them
                await prisma.adMetric.updateMany({
                    where: { organizationId: orgId, platform: "FACEBOOK_ADS", thumbnailUrl: { not: null } },
                    data: { thumbnailUrl: null, videoUrl: null },
                });
            }
        }

        const result = await syncFacebookAdsMetrics(orgId, {
            // When forcing full sync, explicitly start from phase 1 to avoid reading stale cursor
            startPhase: body.forceFullSync ? 1 : body.startPhase,
            accountIndex: body.forceFullSync ? undefined : body.accountIndex,
            startDay: body.forceFullSync ? undefined : body.startDay,
            syncLogId: body.forceFullSync ? undefined : body.syncLogId,
            timeBudgetMs: 50_000,
        });

        return NextResponse.json({
            success: result.success,
            synced: result.synced,
            error: result.error,
            hasMore: result.hasMore,
            nextPhase: result.nextPhase,
            accountIndex: result.accountIndex,
            startDay: result.startDay,
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
