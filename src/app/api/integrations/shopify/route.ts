import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getShopifyAuthUrl } from "@/lib/integrations/shopify";
import crypto from "crypto";

// GET /api/integrations/shopify?shop=mystore.myshopify.com
// Initiates Shopify OAuth flow
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const shop = request.nextUrl.searchParams.get("shop");
  if (!shop) {
    return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
  }

  // Get user's organization
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  // Generate state with org ID for the callback
  const state = `${membership.organizationId}:${crypto.randomBytes(16).toString("hex")}`;

  const authUrl = getShopifyAuthUrl(shop, state);
  return NextResponse.redirect(authUrl);
}
