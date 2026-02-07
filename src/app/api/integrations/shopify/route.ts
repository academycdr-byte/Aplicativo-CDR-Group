import { NextRequest, NextResponse } from "next/server";

// GET /api/integrations/shopify
// Rota legada - Shopify agora usa Client Credentials Grant direto (sem redirect)
export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/integrations", request.url));
}
