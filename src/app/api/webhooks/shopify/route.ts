import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const topic = req.headers.get("x-shopify-topic");
    const shop = req.headers.get("x-shopify-shop-domain");
    const hmac = req.headers.get("x-shopify-hmac-sha256");

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
    const domain = shop.replace(".myshopify.com", "");

    // Handle GDPR Mandatory Webhooks (Return 200 OK)
    if (
      topic === "customers/data_request" ||
      topic === "customers/redact" ||
      topic === "shop/redact"
    ) {
      console.log(`[Shopify GDPR] Received ${topic} for shop ${shop}`);
      // In a real app, queue a job to process this request asynchronously
      return NextResponse.json({ ok: true });
    }

    // Handle App Uninstalled
    if (topic === "app/uninstalled") {
      console.log(`[Shopify Webhook] App uninstalled for ${shop}`);

      const integration = await prisma.integration.findFirst({
        where: {
          platform: "SHOPIFY",
          externalStoreId: { contains: domain }, // loose match to be safe
          status: "CONNECTED",
        },
      });

      if (integration) {
        await prisma.integration.update({
          where: { id: integration.id },
          data: {
            status: "DISCONNECTED",
            errorMessage: "App uninstalled by user",
          },
        });
        console.log(`[Shopify Webhook] Integration ${integration.id} marked as disconnected`);
      }
      return NextResponse.json({ ok: true });
    }

    // Handle Orders (Only if app is installed/connected)
    const integration = await prisma.integration.findFirst({
      where: {
        platform: "SHOPIFY",
        externalStoreId: domain,
        status: "CONNECTED",
      },
    });

    if (!integration) {
      // If we receive an order webhook but have no active integration, it might be a race condition or stale hook
      console.warn(`[Shopify Webhook] Received ${topic} but no active integration found for ${shop}`);
      return NextResponse.json({ ok: true }); // Return 200 to ACK
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
