import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { validateShopifyConfig } from "@/lib/integrations/shopify";

// GET /api/integrations/shopify/check-config
// Endpoint de diagnostico para validar configuracao Shopify
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  // Verificar se usuario e admin
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso restrito a admins" }, { status: 403 });
  }

  const configCheck = validateShopifyConfig();
  const clientId = (process.env.SHOPIFY_CLIENT_ID || "").trim();
  const authUrl = (process.env.AUTH_URL || "").trim();

  return NextResponse.json({
    valid: configCheck.valid,
    error: configCheck.error || null,
    config: {
      clientIdSet: !!clientId,
      clientIdPreview: clientId ? `${clientId.substring(0, 8)}...${clientId.substring(clientId.length - 4)}` : null,
      clientSecretSet: !!(process.env.SHOPIFY_CLIENT_SECRET || "").trim(),
      authUrl: authUrl || null,
      redirectUri: authUrl ? `${authUrl}/api/integrations/shopify/callback` : null,
    },
    instructions: !configCheck.valid ? [
      "1. Acesse https://partners.shopify.com e faca login",
      "2. Va em Apps > Criar app (ou encontre o app existente)",
      "3. Em 'Configuracao do app', configure:",
      `   - URL do app: ${authUrl || "https://SEU-DOMINIO"}`,
      `   - URLs de redirecionamento permitidas: ${authUrl ? `${authUrl}/api/integrations/shopify/callback` : "https://SEU-DOMINIO/api/integrations/shopify/callback"}`,
      "4. Copie a 'API Key' e 'API Secret Key' do app",
      "5. No Vercel, atualize as variaveis de ambiente:",
      "   - SHOPIFY_CLIENT_ID = sua API Key",
      "   - SHOPIFY_CLIENT_SECRET = sua API Secret Key",
      "6. Faca redeploy do projeto no Vercel",
    ] : [
      "Configuracao OK. Se o OAuth ainda falhar, verifique:",
      "- Se o app existe no Shopify Partners (pode ter sido deletado)",
      "- Se a URL de redirecionamento esta correta no app Shopify",
      "- Se o app esta instalado na loja antes de tentar conectar",
    ],
  });
}
