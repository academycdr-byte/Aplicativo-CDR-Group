import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncAllPlatforms } from "@/lib/integrations/sync";

// GET /api/cron/sync
// This endpoint is called by Vercel Cron to sync all organizations
// Configure in vercel.json: { "crons": [{ "path": "/api/cron/sync", "schedule": "*/15 * * * *" }] }
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this automatically, or use custom secret)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all organizations that have at least one connected integration
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
      results.push({
        organizationId: org.id,
        name: org.name,
        synced: orgResults,
      });
    }

    return NextResponse.json({
      success: true,
      organizations: results.length,
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
