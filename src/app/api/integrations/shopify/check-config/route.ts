import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/integrations/shopify/check-config
// Endpoint de diagnostico para verificar status da integracao Shopify
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso restrito a admins" }, { status: 403 });
  }

  const integration = await prisma.integration.findFirst({
    where: {
      organization: { memberships: { some: { userId: session.user.id } } },
      platform: "SHOPIFY",
    },
  });

  return NextResponse.json({
    connected: integration?.status === "CONNECTED",
    authMethod: "custom_app_token",
    integration: integration
      ? {
          status: integration.status,
          hasToken: !!integration.accessToken,
          storeDomain: integration.externalStoreId,
          lastSync: integration.lastSyncAt,
          syncStatus: integration.syncStatus,
          error: integration.errorMessage,
        }
      : null,
  });
}
