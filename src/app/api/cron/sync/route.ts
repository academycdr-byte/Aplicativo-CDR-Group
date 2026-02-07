import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncAllPlatforms } from "@/lib/integrations/sync";

// GET /api/cron/sync
// This endpoint is called by Vercel Cron to sync all organizations
// Configure in vercel.json: { "crons": [{ "path": "/api/cron/sync", "schedule": "*/15 * * * *" }] }
export async function GET(request: NextRequest) {
  // Verificação obrigatória do CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET não configurado nas variáveis de ambiente");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
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
      try {
        const orgResults = await syncAllPlatforms(org.id);
        results.push({
          organizationId: org.id,
          name: org.name,
          synced: orgResults,
        });
      } catch (orgError) {
        console.error(`Erro ao sincronizar org ${org.id}:`, orgError);
        results.push({
          organizationId: org.id,
          name: org.name,
          error: "Falha na sincronização",
        });
      }
    }

    return NextResponse.json({
      success: true,
      organizations: results.length,
      results,
    });
  } catch (error) {
    console.error("Cron sync error:", error);
    return NextResponse.json(
      { error: "Sync failed" },
      { status: 500 }
    );
  }
}
