import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncAllPlatforms } from "@/lib/integrations/sync";

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
