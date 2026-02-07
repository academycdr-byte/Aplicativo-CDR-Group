import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/integrations/shopify/check-config
// Endpoint de diagnostico para validar configuracao Shopify
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

  const clientId = (process.env.SHOPIFY_CLIENT_ID || "").trim();
  const clientSecret = (process.env.SHOPIFY_CLIENT_SECRET || "").trim();

  return NextResponse.json({
    valid: !!clientId && !!clientSecret,
    config: {
      clientIdSet: !!clientId,
      clientIdPreview: clientId ? `${clientId.substring(0, 8)}...${clientId.substring(clientId.length - 4)}` : null,
      clientSecretSet: !!clientSecret,
      grantType: "client_credentials",
    },
  });
}
