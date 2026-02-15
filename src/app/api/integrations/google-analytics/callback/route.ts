import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { exchangeGoogleAnalyticsToken, listGA4Properties } from "@/lib/integrations/google-analytics";
import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/rate-limit";

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
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !state) {
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
    const tokenData = await exchangeGoogleAnalyticsToken(code);

    // List GA4 properties the user has access to
    const properties = await listGA4Properties(tokenData.access_token);

    if (properties.length === 0) {
      return NextResponse.redirect(
        new URL("/integrations?error=google_analytics_oauth_failed&detail=Nenhuma+propriedade+GA4+encontrada.+Verifique+se+você+tem+acesso+a+alguma+propriedade+do+Google+Analytics+4.", request.url)
      );
    }

    const hasMultipleProperties = properties.length > 1;
    const firstProperty = properties[0];

    await prisma.integration.upsert({
      where: {
        organizationId_platform: { organizationId, platform: "GOOGLE_ANALYTICS" },
      },
      create: {
        organizationId,
        platform: "GOOGLE_ANALYTICS",
        status: hasMultipleProperties ? "PENDING" : "CONNECTED",
        accessToken: encrypt(tokenData.access_token),
        refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
        externalAccountId: hasMultipleProperties ? "" : firstProperty.id,
        tokenExpiresAt: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : null,
        metadata: { properties: properties.map((p) => ({ id: p.id, name: p.name })) },
      },
      update: {
        status: hasMultipleProperties ? "PENDING" : "CONNECTED",
        accessToken: encrypt(tokenData.access_token),
        refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : undefined,
        externalAccountId: hasMultipleProperties ? "" : firstProperty.id,
        tokenExpiresAt: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : null,
        metadata: { properties: properties.map((p) => ({ id: p.id, name: p.name })) },
        errorMessage: null,
      },
    });

    if (hasMultipleProperties) {
      return NextResponse.redirect(
        new URL("/integrations?select_account=google_analytics", request.url)
      );
    }

    return NextResponse.redirect(
      new URL("/integrations?success=google_analytics", request.url)
    );
  } catch (error) {
    console.error("Google Analytics OAuth error:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.redirect(
      new URL(`/integrations?error=google_analytics_oauth_failed&detail=${encodeURIComponent(msg)}`, request.url)
    );
  }
}
