import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

// POST /api/webhooks/reportana
// Recebe eventos da Reportana (carrinho abandonado, carrinho recuperado)
// Autenticacao via Bearer token (apiKey da integracao Reportana)
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing authorization" }, { status: 401 });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return NextResponse.json({ error: "Empty token" }, { status: 401 });
    }

    // Find the Reportana integration that matches this token
    const integrations = await prisma.integration.findMany({
      where: { platform: "REPORTANA", status: "CONNECTED" },
    });

    let matchedIntegration = null;
    for (const integration of integrations) {
      if (!integration.apiKey) continue;
      try {
        const decryptedKey = decrypt(integration.apiKey);
        if (decryptedKey === token) {
          matchedIntegration = integration;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!matchedIntegration) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await req.json();

    // Validate required fields
    const eventType = body.event_type || body.eventType;
    const referenceId = body.reference_id || body.referenceId;
    const totalPrice = body.total_price ?? body.totalPrice ?? 0;

    if (!eventType || !referenceId) {
      return NextResponse.json(
        { error: "Missing required fields: event_type, reference_id" },
        { status: 400 }
      );
    }

    const validTypes = ["abandoned_checkout", "checkout_recovered"];
    if (!validTypes.includes(eventType)) {
      return NextResponse.json(
        { error: `Invalid event_type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    await prisma.reportanaEvent.upsert({
      where: {
        organizationId_eventType_referenceId: {
          organizationId: matchedIntegration.organizationId,
          eventType,
          referenceId: String(referenceId),
        },
      },
      create: {
        organizationId: matchedIntegration.organizationId,
        eventType,
        referenceId: String(referenceId),
        customerName: body.customer_name || body.customerName || null,
        customerEmail: body.customer_email || body.customerEmail || null,
        customerPhone: body.customer_phone || body.customerPhone || null,
        totalPrice: parseFloat(String(totalPrice)),
        currency: body.currency || "BRL",
        lineItems: body.line_items || body.lineItems || null,
        rawData: body,
        eventDate: body.event_date || body.eventDate
          ? new Date(body.event_date || body.eventDate)
          : new Date(),
      },
      update: {
        customerName: body.customer_name || body.customerName || null,
        customerEmail: body.customer_email || body.customerEmail || null,
        customerPhone: body.customer_phone || body.customerPhone || null,
        totalPrice: parseFloat(String(totalPrice)),
        lineItems: body.line_items || body.lineItems || null,
        rawData: body,
      },
    });

    console.log(
      `[Reportana Webhook] ${eventType} saved for org ${matchedIntegration.organizationId}, ref: ${referenceId}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Reportana Webhook] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
