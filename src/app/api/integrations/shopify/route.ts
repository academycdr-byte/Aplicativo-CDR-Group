import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { getShopifyAuthUrl, generateOAuthState } from "@/lib/integrations/shopify";
import { cookies } from "next/headers";

// GET /api/integrations/shopify?shop=minha-loja.myshopify.com
// Inicia o fluxo OAuth Authorization Code Grant redirecionando para Shopify
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/integrations?error=unauthorized", request.url));
  }

  const shop = request.nextUrl.searchParams.get("shop")?.trim().toLowerCase();
  if (!shop) {
    return NextResponse.redirect(new URL("/integrations?error=missing_shop", request.url));
  }

  // Normalizar dominio
  let domain = shop;
  if (!domain.includes(".myshopify.com")) {
    domain = `${domain}.myshopify.com`;
  }

  try {
    // Get organization from session
    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.redirect(
        new URL("/integrations?error=shopify_config_error&detail=Organizacao+nao+encontrada", request.url)
      );
    }

    // Look up stored credentials from the PENDING integration
    const integration = await prisma.integration.findUnique({
      where: {
        organizationId_platform: { organizationId, platform: "SHOPIFY" },
      },
    });

    let clientId: string | undefined;
    if (integration?.apiKey) {
      clientId = decrypt(integration.apiKey);
    }

    if (!clientId) {
      return NextResponse.redirect(
        new URL("/integrations?error=shopify_config_error&detail=Client+ID+nao+encontrado.+Preencha+as+credenciais+novamente.", request.url)
      );
    }

    const state = generateOAuthState();
    const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
    if (!baseUrl) throw new Error("AUTH_URL nao configurado");
    const redirectUri = `${baseUrl}/api/integrations/shopify/callback`;

    // Salvar state e shop em cookies para validar no callback
    const cookieStore = await cookies();
    cookieStore.set("shopify_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600, // 10 minutos
      path: "/",
    });
    cookieStore.set("shopify_oauth_shop", domain, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    const authUrl = getShopifyAuthUrl(domain, redirectUri, state, clientId);
    console.log("[Shopify OAuth] Redirecting to:", authUrl);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[Shopify OAuth] Error:", msg);
    return NextResponse.redirect(
      new URL(`/integrations?error=shopify_config_error&detail=${encodeURIComponent(msg)}`, request.url)
    );
  }
}
