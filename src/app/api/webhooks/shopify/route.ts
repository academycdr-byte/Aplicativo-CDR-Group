import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const hmac = req.headers.get("x-shopify-hmac-sha256");
    const shop = req.headers.get("x-shopify-shop-domain");
    const topic = req.headers.get("x-shopify-topic");

    if (!hmac || !shop || !topic) {
      return NextResponse.json({ error: "Missing headers" }, { status: 400 });
    }

    // Verify webhook signature
    const secret = process.env.SHOPIFY_CLIENT_SECRET;
    if (!secret) {
      console.error("SHOPIFY_CLIENT_SECRET not configured");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const hash = crypto
      .createHmac("sha256", secret)
      .update(body, "utf8")
      .digest("base64");

    if (hash !== hmac) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const data = JSON.parse(body);

    // Find the integration for this shop
    const integration = await prisma.integration.findFirst({
      where: {
        platform: "SHOPIFY",
        externalStoreId: shop.replace(".myshopify.com", ""),
        status: "CONNECTED",
      },
    });

    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    if (topic === "orders/create" || topic === "orders/updated") {
      await prisma.order.upsert({
        where: {
          organizationId_platform_externalOrderId: {
            organizationId: integration.organizationId,
            platform: "SHOPIFY",
            externalOrderId: String(data.id),
          },
        },
        update: {
          status: mapShopifyStatus(data.financial_status),
          totalAmount: parseFloat(data.total_price || "0"),
          customerName: data.customer
            ? `${data.customer.first_name || ""} ${data.customer.last_name || ""}`.trim()
            : null,
          customerEmail: data.customer?.email || null,
        },
        create: {
          organizationId: integration.organizationId,
          platform: "SHOPIFY",
          externalOrderId: String(data.id),
          status: mapShopifyStatus(data.financial_status),
          customerName: data.customer
            ? `${data.customer.first_name || ""} ${data.customer.last_name || ""}`.trim()
            : null,
          customerEmail: data.customer?.email || null,
          totalAmount: parseFloat(data.total_price || "0"),
          currency: data.currency || "BRL",
          itemCount: data.line_items?.length || 0,
          orderDate: new Date(data.created_at),
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Shopify webhook error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function mapShopifyStatus(status: string): string {
  const map: Record<string, string> = {
    paid: "paid",
    pending: "pending",
    refunded: "refunded",
    voided: "cancelled",
    partially_refunded: "refunded",
    authorized: "pending",
  };
  return map[status] || "pending";
}
