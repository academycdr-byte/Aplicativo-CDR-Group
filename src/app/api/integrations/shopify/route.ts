import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getShopifyAuthUrl, validateShopifyConfig } from "@/lib/integrations/shopify";
import crypto from "crypto";

// GET /api/integrations/shopify?shop=mystore.myshopify.com
// Initiates Shopify OAuth flow
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Validar configuracao antes de iniciar OAuth
  const configCheck = validateShopifyConfig();
  if (!configCheck.valid) {
    console.error("[Shopify OAuth] Config validation failed:", configCheck.error);
    return NextResponse.redirect(
      new URL(`/integrations?error=shopify_oauth_failed&detail=${encodeURIComponent(configCheck.error || "Configuracao Shopify invalida")}`, request.url)
    );
  }

  const shop = request.nextUrl.searchParams.get("shop");
  if (!shop) {
    return NextResponse.redirect(
      new URL("/integrations?error=shopify_oauth_failed&detail=Dominio+da+loja+nao+informado", request.url)
    );
  }

  // Validar formato do dominio
  if (!shop.includes(".myshopify.com")) {
    return NextResponse.redirect(
      new URL(`/integrations?error=shopify_oauth_failed&detail=${encodeURIComponent("Dominio invalido. Use o formato: minha-loja.myshopify.com")}`, request.url)
    );
  }

  // Get user's organization
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    return NextResponse.redirect(
      new URL("/integrations?error=shopify_oauth_failed&detail=Nenhuma+organizacao+encontrada", request.url)
    );
  }

  // Generate state with org ID for the callback
  const state = `${membership.organizationId}:${crypto.randomBytes(16).toString("hex")}`;

  const authUrl = getShopifyAuthUrl(shop, state);
  console.log("[Shopify OAuth] Redirecting to Shopify for authorization. Shop:", shop);
  return NextResponse.redirect(authUrl);
}
