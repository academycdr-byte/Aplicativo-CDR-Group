import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { exchangeShopifyToken } from "@/lib/integrations/shopify";

// GET /api/integrations/shopify/callback?code=xxx&shop=xxx&state=xxx
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const shop = request.nextUrl.searchParams.get("shop");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !shop || !state) {
    return NextResponse.redirect(
      new URL("/integrations?error=missing_params", request.url)
    );
  }

  const organizationId = state.split(":")[0];

  try {
    const tokenData = await exchangeShopifyToken(shop, code);

    await prisma.integration.upsert({
      where: {
        organizationId_platform: { organizationId, platform: "SHOPIFY" },
      },
      create: {
        organizationId,
        platform: "SHOPIFY",
        status: "CONNECTED",
        accessToken: encrypt(tokenData.access_token),
        externalStoreId: shop,
        scopes: tokenData.scope || "",
      },
      update: {
        status: "CONNECTED",
        accessToken: encrypt(tokenData.access_token),
        externalStoreId: shop,
        scopes: tokenData.scope || "",
        errorMessage: null,
      },
    });

    return NextResponse.redirect(
      new URL("/integrations?success=shopify", request.url)
    );
  } catch (error) {
    console.error("Shopify OAuth error:", error);
    return NextResponse.redirect(
      new URL("/integrations?error=shopify_oauth_failed", request.url)
    );
  }
}
