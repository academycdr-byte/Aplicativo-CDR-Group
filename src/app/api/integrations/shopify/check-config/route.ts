import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/integrations/shopify/check-config
// Endpoint de diagnostico para verificar status da integracao Shopify
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: "Organização não encontrada" }, { status: 403 });
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, organizationId },
  });

  if (!membership || (membership.role !== "ADMIN" && membership.role !== "OWNER")) {
    return NextResponse.json({ error: "Acesso restrito a admins" }, { status: 403 });
  }

  const integration = await prisma.integration.findUnique({
    where: {
      organizationId_platform: { organizationId, platform: "SHOPIFY" },
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
