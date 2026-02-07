import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { exchangeNuvemshopToken } from "@/lib/integrations/nuvemshop";
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
    const tokenData = await exchangeNuvemshopToken(code);

    await prisma.integration.upsert({
      where: {
        organizationId_platform: { organizationId, platform: "NUVEMSHOP" },
      },
      create: {
        organizationId,
        platform: "NUVEMSHOP",
        status: "CONNECTED",
        accessToken: encrypt(tokenData.access_token),
        externalStoreId: String(tokenData.user_id),
      },
      update: {
        status: "CONNECTED",
        accessToken: encrypt(tokenData.access_token),
        externalStoreId: String(tokenData.user_id),
        errorMessage: null,
      },
    });

    return NextResponse.redirect(
      new URL("/integrations?success=nuvemshop", request.url)
    );
  } catch (error) {
    console.error("Nuvemshop OAuth error:", error);
    return NextResponse.redirect(
      new URL("/integrations?error=nuvemshop_oauth_failed", request.url)
    );
  }
}
