import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { exchangeShopifyToken } from "@/lib/integrations/shopify";
import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/rate-limit";

// GET /api/integrations/shopify/callback?code=xxx&shop=xxx&state=xxx
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const rl = checkRateLimit(`oauth-callback:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const code = request.nextUrl.searchParams.get("code");
  const shop = request.nextUrl.searchParams.get("shop");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !shop || !state) {
    return NextResponse.redirect(
      new URL("/integrations?error=missing_params", request.url)
    );
  }

  const organizationId = state.split(":")[0];

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, organizationId },
  });
  if (!membership) {
    return NextResponse.redirect(
      new URL("/integrations?error=unauthorized", request.url)
    );
  }

  try {
    console.log("[Shopify Callback] Starting token exchange for shop:", shop, "state:", state);
    const tokenData = await exchangeShopifyToken(shop, code);
    console.log("[Shopify Callback] Token received, saving integration for org:", organizationId);

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
    console.error("[Shopify Callback] OAuth error:", error instanceof Error ? error.message : error);
    console.error("[Shopify Callback] Full error:", error);
    return NextResponse.redirect(
      new URL("/integrations?error=shopify_oauth_failed", request.url)
    );
  }
}
