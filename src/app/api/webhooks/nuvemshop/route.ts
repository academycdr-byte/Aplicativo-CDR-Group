import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();

    // Verificação HMAC obrigatória
    const secret = process.env.NUVEMSHOP_CLIENT_SECRET;
    if (!secret) {
      console.error("NUVEMSHOP_CLIENT_SECRET não configurado");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    const signature = req.headers.get("x-linkedstore-hmac-sha256");
    if (!signature) {
      return NextResponse.json({ error: "Missing signature header" }, { status: 401 });
    }

    const hash = crypto
      .createHmac("sha256", secret)
      .update(body, "utf8")
      .digest("base64");

    const hashBuffer = Buffer.from(hash, "base64");
    const sigBuffer = Buffer.from(signature, "base64");

    if (hashBuffer.length !== sigBuffer.length || !crypto.timingSafeEqual(hashBuffer, sigBuffer)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const data = JSON.parse(body);
    const storeId = data.store_id?.toString();

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

    const event = data.event;

    if (event === "order/created" || event === "order/updated" || event === "order/paid") {
      const totalAmount = parseFloat(data.total || "0");
      const orderDate = data.created_at ? new Date(data.created_at) : new Date();

      await prisma.order.upsert({
        where: {
          organizationId_platform_externalOrderId: {
            organizationId: integration.organizationId,
            platform: "NUVEMSHOP",
            externalOrderId: String(data.id),
          },
        },
        update: {
          status: mapNuvemshopStatus(data.payment_status),
          totalAmount: isNaN(totalAmount) ? 0 : totalAmount,
          customerName: data.customer?.name || null,
          customerEmail: data.customer?.email || null,
        },
        create: {
          organizationId: integration.organizationId,
          platform: "NUVEMSHOP",
          externalOrderId: String(data.id),
          status: mapNuvemshopStatus(data.payment_status),
          customerName: data.customer?.name || null,
          customerEmail: data.customer?.email || null,
          totalAmount: isNaN(totalAmount) ? 0 : totalAmount,
          currency: data.currency || "BRL",
          itemCount: data.products?.length || 0,
          orderDate,
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
