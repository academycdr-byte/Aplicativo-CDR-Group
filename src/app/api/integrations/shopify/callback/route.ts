import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { exchangeShopifyToken } from "@/lib/integrations/shopify";
import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/rate-limit";

// GET /api/integrations/shopify/callback?code=xxx&shop=xxx&state=xxx&hmac=xxx
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const allParams = Object.fromEntries(url.searchParams.entries());
  console.log("[Shopify Callback] Received callback with params:", JSON.stringify(allParams));

  const session = await auth();
  if (!session?.user?.id) {
    console.error("[Shopify Callback] No session found, redirecting to login");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  console.log("[Shopify Callback] User authenticated:", session.user.id);

  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const rl = checkRateLimit(`oauth-callback:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const code = url.searchParams.get("code");
  const shop = url.searchParams.get("shop");
  const state = url.searchParams.get("state");

  // Verificar se veio um erro do Shopify
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  if (error) {
    console.error("[Shopify Callback] Shopify returned error:", error, errorDescription);
    return NextResponse.redirect(
      new URL(`/integrations?error=shopify_denied&detail=${encodeURIComponent(errorDescription || error)}`, request.url)
    );
  }

  if (!code || !shop || !state) {
    console.error("[Shopify Callback] Missing params - code:", !!code, "shop:", !!shop, "state:", !!state);
    return NextResponse.redirect(
      new URL("/integrations?error=missing_params", request.url)
    );
  }

  const organizationId = state.split(":")[0];
  console.log("[Shopify Callback] Organization ID from state:", organizationId);

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, organizationId },
  });
  if (!membership) {
    console.error("[Shopify Callback] No membership found for user", session.user.id, "in org", organizationId);
    return NextResponse.redirect(
      new URL("/integrations?error=unauthorized", request.url)
    );
  }

  try {
    console.log("[Shopify Callback] Starting token exchange for shop:", shop);
    const tokenData = await exchangeShopifyToken(shop, code);
    console.log("[Shopify Callback] Token received successfully! Scopes:", tokenData.scope);

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

    console.log("[Shopify Callback] Integration saved successfully for org:", organizationId);

    return NextResponse.redirect(
      new URL("/integrations?success=shopify", request.url)
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Shopify Callback] Token exchange FAILED:", errorMsg);
    console.error("[Shopify Callback] Full error:", err);
    return NextResponse.redirect(
      new URL(`/integrations?error=shopify_oauth_failed&detail=${encodeURIComponent(errorMsg)}`, request.url)
    );
  }
}
