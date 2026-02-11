import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";
import { exchangeShopifyCode, validateShopifyHmac, syncShopifyOrders, registerShopifyWebhooks } from "@/lib/integrations/shopify";
import { cookies } from "next/headers";

export const maxDuration = 60;

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

  // Use active organization from JWT session
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return NextResponse.redirect(
      new URL("/integrations?error=shopify_oauth_failed&detail=Organizacao+nao+encontrada", request.url)
    );
  }

  // Look up stored credentials from Integration record
  const integration = await prisma.integration.findUnique({
    where: {
      organizationId_platform: { organizationId, platform: "SHOPIFY" },
    },
  });

  let clientId: string | undefined;
  let clientSecret: string | undefined;

  if (integration?.apiKey) clientId = decrypt(integration.apiKey);
  if (integration?.apiSecret) clientSecret = decrypt(integration.apiSecret);

  // Validar HMAC se presente (using per-store secret or env fallback)
  if (hmac && clientSecret) {
    const queryObj: Record<string, string> = {};
    params.forEach((value, key) => { queryObj[key] = value; });

    if (!validateShopifyHmac(queryObj, clientSecret)) {
      console.error("[Shopify OAuth] HMAC validation failed");
      return NextResponse.redirect(
        new URL("/integrations?error=shopify_oauth_failed&detail=HMAC+invalido", request.url)
      );
    }
  }

  try {
    // Verify user has membership in this org
    const membership = await prisma.membership.findFirst({
      where: { userId: session.user.id, organizationId },
    });

    if (!membership) {
      return NextResponse.redirect(
        new URL("/integrations?error=shopify_oauth_failed&detail=Sem+acesso+a+organizacao", request.url)
      );
    }

    // Trocar code por access token usando credenciais do banco ou env vars
    const credentials = clientId && clientSecret ? { clientId, clientSecret } : undefined;
    const tokenData = await exchangeShopifyCode(shop, code, credentials);

    // Salvar integracao - keep apiKey/apiSecret for future re-auth
    await prisma.integration.upsert({
      where: {
        organizationId_platform: {
          organizationId,
          platform: "SHOPIFY",
        },
      },
      create: {
        organizationId,
        platform: "SHOPIFY",
        status: "CONNECTED",
        accessToken: encrypt(tokenData.access_token),
        apiKey: integration?.apiKey || null,
        apiSecret: integration?.apiSecret || null,
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

    console.log("[Shopify OAuth] Integration saved for shop:", shop, "org:", organizationId);

    // Register webhooks in the background (don't wait for it)
    registerShopifyWebhooks(shop, tokenData.access_token).catch((err) => {
      console.error("[Shopify OAuth] Webhook registration failed:", err);
    });

    // Trigger initial sync in the background (don't wait for it)
    syncShopifyOrders(organizationId).catch((err) => {
      console.error("[Shopify OAuth] Initial sync failed:", err);
    });

    return NextResponse.redirect(new URL("/integrations?success=shopify", request.url));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[Shopify OAuth] Callback error:", msg);
    return NextResponse.redirect(
      new URL(`/integrations?error=shopify_oauth_failed&detail=${encodeURIComponent(msg)}`, request.url)
    );
  }
}
