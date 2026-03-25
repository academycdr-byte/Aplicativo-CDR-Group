import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncAllPlatforms } from "@/lib/integrations/sync";
import { classifyCreativesForOrg } from "@/lib/creative-pipeline-engine";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // CRON_SECRET is required in production
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET is not configured. Cron endpoint is disabled.");
    return NextResponse.json(
      { error: "CRON_SECRET not configured. Set this environment variable to enable cron sync." },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // ONE-TIME FIX: Reset stale Facebook Ads cursors that completed with the old buggy code.
    // Old code skipped pages during Phase 2 (big range fetch), marking phases as "complete"
    // when data was actually incomplete. This resets those cursors to Phase 1 so the new
    // day-by-day code re-fetches all 30 days correctly.
    // Safe to run multiple times — only resets cursors at Phase 3+ (already "past" Phase 2).
    const staleIntegrations = await prisma.integration.findMany({
      where: { platform: "FACEBOOK_ADS", status: "CONNECTED" },
      select: { id: true, metadata: true },
    });

    let resetCount = 0;
    for (const integration of staleIntegrations) {
      const meta = (integration.metadata as Record<string, unknown>) || {};
      const cursor = meta.fbSyncCursor as { nextPhase?: number } | undefined;
      // Reset if cursor is at Phase 3+ (meaning Phase 2 "completed" with old buggy code)
      if (cursor && cursor.nextPhase && cursor.nextPhase >= 3) {
        const { fbSyncCursor: _, ...rest } = meta;
        await prisma.integration.update({
          where: { id: integration.id },
          data: {
            metadata: rest as Record<string, string | number | boolean | null>,
            syncStatus: "IDLE",
            errorMessage: null,
          },
        });
        resetCount++;
      }
    }
    if (resetCount > 0) {
      console.log(`[cron] Reset ${resetCount} stale Facebook Ads cursors to Phase 1`);
    }

    const organizations = await prisma.organization.findMany({
      where: {
        integrations: {
          some: { status: "CONNECTED" },
        },
      },
      select: { id: true, name: true },
    });

    const results = [];

    for (const org of organizations) {
      const orgResults = await syncAllPlatforms(org.id);

      // Auto-classify creatives after sync
      let pipelineResult = null;
      try {
        pipelineResult = await classifyCreativesForOrg(org.id);
      } catch (e) {
        console.error(`[cron] Creative pipeline error for ${org.name}:`, e);
      }

      results.push({
        organizationId: org.id,
        name: org.name,
        synced: orgResults,
        creativePipeline: pipelineResult,
      });
    }

    return NextResponse.json({
      success: true,
      organizations: results.length,
      cursorsReset: resetCount,
      results,
    });
  } catch (error) {
    console.error("Cron sync error:", error);
    return NextResponse.json(
      { error: "Sync failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
