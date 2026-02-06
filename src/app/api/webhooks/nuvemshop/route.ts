import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const storeId = body.store_id?.toString();

    if (!storeId) {
      return NextResponse.json({ error: "Missing store_id" }, { status: 400 });
    }

    // Find the integration for this store
    const integration = await prisma.integration.findFirst({
      where: {
        platform: "NUVEMSHOP",
        externalStoreId: storeId,
        status: "CONNECTED",
      },
    });

    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    const event = body.event;
    const orderData = body;

    if (event === "order/created" || event === "order/updated" || event === "order/paid") {
      await prisma.order.upsert({
        where: {
          organizationId_platform_externalOrderId: {
            organizationId: integration.organizationId,
            platform: "NUVEMSHOP",
            externalOrderId: String(orderData.id),
          },
        },
        update: {
          status: mapNuvemshopStatus(orderData.payment_status),
          totalAmount: parseFloat(orderData.total || "0"),
          customerName: orderData.customer?.name || null,
          customerEmail: orderData.customer?.email || null,
        },
        create: {
          organizationId: integration.organizationId,
          platform: "NUVEMSHOP",
          externalOrderId: String(orderData.id),
          status: mapNuvemshopStatus(orderData.payment_status),
          customerName: orderData.customer?.name || null,
          customerEmail: orderData.customer?.email || null,
          totalAmount: parseFloat(orderData.total || "0"),
          currency: orderData.currency || "BRL",
          itemCount: orderData.products?.length || 0,
          orderDate: new Date(orderData.created_at),
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Nuvemshop webhook error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function mapNuvemshopStatus(status: string): string {
  const map: Record<string, string> = {
    paid: "paid",
    pending: "pending",
    refunded: "refunded",
    voided: "cancelled",
    abandoned: "cancelled",
  };
  return map[status] || "pending";
}
