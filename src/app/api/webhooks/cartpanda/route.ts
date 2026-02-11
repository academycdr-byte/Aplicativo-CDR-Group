import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseOrderDate } from "@/lib/date-utils";

function mapCartpandaStatus(status: string): string {
  const map: Record<string, string> = {
    paid: "paid",
    approved: "paid",
    pending: "pending",
    cancelled: "cancelled",
    refunded: "refunded",
    shipped: "shipped",
    delivered: "delivered",
  };
  return map[status?.toLowerCase()] || status;
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    // Cartpanda sends event type in the payload
    const event = data.event || data.topic || "";
    const order = data.data || data.order || data;

    if (!order || !order.id) {
      return NextResponse.json({ ok: true });
    }

    // Find the integration by store ID from the payload
    const storeId = String(order.store_id || data.store_id || "");

    const integration = storeId
      ? await prisma.integration.findFirst({
          where: {
            platform: "CARTPANDA",
            externalStoreId: storeId,
            status: "CONNECTED",
          },
        })
      : null;

    if (!integration) {
      console.warn(
        `[Cartpanda Webhook] Received ${event} but no active integration found for store ${storeId}`
      );
      return NextResponse.json({ ok: true });
    }

    // Handle order events: order.created, order.paid, order.updated, order.refunded
    if (
      event.startsWith("order.") ||
      event === "" // If no event field, treat as order update
    ) {
      const items = order.items || [];
      const lineItems = items.map((item: Record<string, unknown>) => ({
        product_id: item.product_id || item.id,
        variant_id: item.variant_id,
        name: item.name || item.title,
        quantity: item.quantity,
        price: item.price,
        sku: item.sku,
      }));

      const customerName = order.customer?.name || null;
      const customerEmail = order.customer?.email || null;
      const amount = parseFloat(order.total || "0");
      const orderDate = parseOrderDate(order.created_at || new Date().toISOString());

      await prisma.order.upsert({
        where: {
          organizationId_platform_externalOrderId: {
            organizationId: integration.organizationId,
            platform: "CARTPANDA",
            externalOrderId: String(order.id),
          },
        },
        update: {
          status: mapCartpandaStatus(order.status),
          totalAmount: amount,
          customerName,
          customerEmail,
          itemCount: items.length,
          orderDate,
          rawData: { ...order, line_items: lineItems },
        },
        create: {
          organizationId: integration.organizationId,
          platform: "CARTPANDA",
          externalOrderId: String(order.id),
          status: mapCartpandaStatus(order.status),
          customerName,
          customerEmail,
          totalAmount: amount,
          currency: order.currency || "BRL",
          itemCount: items.length,
          orderDate,
          rawData: { ...order, line_items: lineItems },
        },
      });

      console.log(
        `[Cartpanda Webhook] ${event || "order.update"} processed for order ${order.id}`
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Cartpanda Webhook] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
