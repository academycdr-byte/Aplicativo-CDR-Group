import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getFacebookAuthUrl } from "@/lib/integrations/facebook-ads";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/integrations?error=unauthorized", request.url));
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    return NextResponse.redirect(
      new URL("/integrations?error=facebook_oauth_failed&detail=Organizacao+nao+encontrada", request.url)
    );
  }

  try {
    const state = `${membership.organizationId}:${crypto.randomBytes(16).toString("hex")}`;
    const authUrl = getFacebookAuthUrl(state);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[Facebook OAuth] Error:", msg);
    return NextResponse.redirect(
      new URL(`/integrations?error=facebook_oauth_failed&detail=${encodeURIComponent(msg)}`, request.url)
    );
  }
}
