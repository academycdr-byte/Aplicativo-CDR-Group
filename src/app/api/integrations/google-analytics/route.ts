import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getGoogleAnalyticsAuthUrl } from "@/lib/integrations/google-analytics";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  const state = `${membership.organizationId}:${crypto.randomBytes(16).toString("hex")}`;
  const authUrl = getGoogleAnalyticsAuthUrl(state);
  return NextResponse.redirect(authUrl);
}
