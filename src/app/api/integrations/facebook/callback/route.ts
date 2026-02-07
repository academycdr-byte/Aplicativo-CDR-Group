import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { exchangeFacebookToken, getFacebookAdAccounts } from "@/lib/integrations/facebook-ads";
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
    const tokenData = await exchangeFacebookToken(code);

    // Fetch all ad accounts the user has access to
    const adAccounts = await getFacebookAdAccounts(tokenData.access_token);

    // Save token and ad accounts list, but set status to PENDING until user selects account
    // If only 1 account, auto-select it
    const hasMultipleAccounts = adAccounts.length > 1;
    const firstAccount = adAccounts[0];

    await prisma.integration.upsert({
      where: {
        organizationId_platform: { organizationId, platform: "FACEBOOK_ADS" },
      },
      create: {
        organizationId,
        platform: "FACEBOOK_ADS",
        status: hasMultipleAccounts ? "PENDING" : "CONNECTED",
        accessToken: encrypt(tokenData.access_token),
        externalAccountId: hasMultipleAccounts ? "" : (firstAccount?.id?.replace("act_", "") || ""),
        tokenExpiresAt: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : null,
        metadata: {
          adAccounts: adAccounts.map((a: { id: string; name: string; account_status: number }) => ({
            id: a.id,
            name: a.name,
            account_status: a.account_status,
          })),
        },
      },
      update: {
        status: hasMultipleAccounts ? "PENDING" : "CONNECTED",
        accessToken: encrypt(tokenData.access_token),
        externalAccountId: hasMultipleAccounts ? "" : (firstAccount?.id?.replace("act_", "") || ""),
        tokenExpiresAt: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : null,
        metadata: {
          adAccounts: adAccounts.map((a: { id: string; name: string; account_status: number }) => ({
            id: a.id,
            name: a.name,
            account_status: a.account_status,
          })),
        },
        errorMessage: null,
      },
    });

    if (hasMultipleAccounts) {
      // Redirect to selection dialog
      return NextResponse.redirect(
        new URL("/integrations?select_account=facebook", request.url)
      );
    }

    // Single account - auto-connect and sync
    return NextResponse.redirect(
      new URL("/integrations?success=facebook", request.url)
    );
  } catch (error) {
    console.error("Facebook OAuth error:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.redirect(
      new URL(`/integrations?error=facebook_oauth_failed&detail=${encodeURIComponent(msg)}`, request.url)
    );
  }
}
