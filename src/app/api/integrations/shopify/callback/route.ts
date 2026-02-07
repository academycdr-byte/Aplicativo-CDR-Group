import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { exchangeShopifyCode, validateShopifyHmac } from "@/lib/integrations/shopify";
import { cookies } from "next/headers";

// GET /api/integrations/shopify/callback?code=xxx&hmac=xxx&shop=xxx&state=xxx
// Callback do OAuth Shopify - troca o code por access token
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/integrations?error=unauthorized", request.url));
  }

  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const shop = params.get("shop");
  const hmac = params.get("hmac");

  if (!code || !state || !shop) {
    return NextResponse.redirect(
      new URL("/integrations?error=missing_params", request.url)
    );
  }

  // Validar state para prevenir CSRF
  const cookieStore = await cookies();
  const savedState = cookieStore.get("shopify_oauth_state")?.value;
  const savedShop = cookieStore.get("shopify_oauth_shop")?.value;

  // Limpar cookies do OAuth
  cookieStore.delete("shopify_oauth_state");
  cookieStore.delete("shopify_oauth_shop");

  if (!savedState || state !== savedState) {
    console.error("[Shopify OAuth] State mismatch:", { state, savedState });
    return NextResponse.redirect(
      new URL("/integrations?error=shopify_oauth_failed&detail=State+invalido", request.url)
    );
  }

  // Validar HMAC se presente
  if (hmac) {
    const queryObj: Record<string, string> = {};
    params.forEach((value, key) => { queryObj[key] = value; });

    if (!validateShopifyHmac(queryObj)) {
      console.error("[Shopify OAuth] HMAC validation failed");
      return NextResponse.redirect(
        new URL("/integrations?error=shopify_oauth_failed&detail=HMAC+invalido", request.url)
      );
    }
  }

  try {
    // Trocar code por access token usando form-urlencoded
    const tokenData = await exchangeShopifyCode(shop, code);

    // Buscar membership do usuario para obter organizationId
    const membership = await prisma.membership.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
    });

    if (!membership) {
      return NextResponse.redirect(
        new URL("/integrations?error=shopify_oauth_failed&detail=Organizacao+nao+encontrada", request.url)
      );
    }

    // Salvar integracao
    await prisma.integration.upsert({
      where: {
        organizationId_platform: {
          organizationId: membership.organizationId,
          platform: "SHOPIFY",
        },
      },
      create: {
        organizationId: membership.organizationId,
        platform: "SHOPIFY",
        status: "CONNECTED",
        accessToken: encrypt(tokenData.access_token),
        externalStoreId: shop,
        scopes: tokenData.scope,
      },
      update: {
        status: "CONNECTED",
        accessToken: encrypt(tokenData.access_token),
        externalStoreId: shop,
        scopes: tokenData.scope,
        errorMessage: null,
      },
    });

    console.log("[Shopify OAuth] Integration saved for shop:", shop);
    return NextResponse.redirect(new URL("/integrations?success=shopify", request.url));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[Shopify OAuth] Callback error:", msg);
    return NextResponse.redirect(
      new URL(`/integrations?error=shopify_oauth_failed&detail=${encodeURIComponent(msg)}`, request.url)
    );
  }
}
