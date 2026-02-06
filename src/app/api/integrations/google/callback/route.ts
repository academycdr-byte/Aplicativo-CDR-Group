import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { exchangeGoogleToken } from "@/lib/integrations/google-ads";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/integrations?error=missing_params", request.url)
    );
  }

  const organizationId = state.split(":")[0];

  try {
    const tokenData = await exchangeGoogleToken(code);

    await prisma.integration.upsert({
      where: {
        organizationId_platform: { organizationId, platform: "GOOGLE_ADS" },
      },
      create: {
        organizationId,
        platform: "GOOGLE_ADS",
        status: "CONNECTED",
        accessToken: encrypt(tokenData.access_token),
        refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
        tokenExpiresAt: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : null,
      },
      update: {
        status: "CONNECTED",
        accessToken: encrypt(tokenData.access_token),
        refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : undefined,
        tokenExpiresAt: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : null,
        errorMessage: null,
      },
    });

    return NextResponse.redirect(
      new URL("/integrations?success=google", request.url)
    );
  } catch (error) {
    console.error("Google OAuth error:", error);
    return NextResponse.redirect(
      new URL("/integrations?error=google_oauth_failed", request.url)
    );
  }
}
