import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

export async function syncCartpandaOrders(organizationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "CARTPANDA" } },
  });

  if (!integration || integration.status !== "CONNECTED" || !integration.apiKey) {
    return { error: "Cartpanda not connected" };
  }

  await prisma.integration.update({
    where: { id: integration.id },
    data: { syncStatus: "SYNCING" },
  });

  const syncLog = await prisma.syncLog.create({
    data: { organizationId, platform: "CARTPANDA", status: "SYNCING" },
  });

  try {
    const apiKey = decrypt(integration.apiKey);
    const storeId = integration.externalStoreId || "";

    const response = await fetch(`https://api.cartpanda.com/v1/stores/${storeId}/orders`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Cartpanda API error: ${response.status}`);
    }

    const data = await response.json();
    const orders = data.data || data.orders || [];
    let synced = 0;

    for (const order of orders) {
      await prisma.order.upsert({
        where: {
          organizationId_platform_externalOrderId: {
            organizationId,
            platform: "CARTPANDA",
            externalOrderId: String(order.id),
          },
        },
        create: {
          organizationId,
          platform: "CARTPANDA",
          externalOrderId: String(order.id),
          status: mapCartpandaStatus(order.status),
          customerName: order.customer?.name || null,
          customerEmail: order.customer?.email || null,
          totalAmount: parseFloat(order.total || "0"),
          currency: order.currency || "BRL",
          itemCount: order.items?.length || 0,
          orderDate: new Date(order.created_at),
          rawData: order,
        },
        update: {
          status: mapCartpandaStatus(order.status),
          totalAmount: parseFloat(order.total || "0"),
          customerName: order.customer?.name || null,
          customerEmail: order.customer?.email || null,
          itemCount: order.items?.length || 0,
          rawData: order,
        },
      });
      synced++;
    }

    await prisma.integration.update({
      where: { id: integration.id },
      data: { syncStatus: "SUCCESS", lastSyncAt: new Date() },
    });

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: { status: "SUCCESS", recordsSynced: synced, completedAt: new Date() },
    });

    return { success: true, synced };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";

    await prisma.integration.update({
      where: { id: integration.id },
      data: { syncStatus: "FAILED", errorMessage: errorMsg },
    });

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: { status: "FAILED", errorMessage: errorMsg, completedAt: new Date() },
    });

    return { error: errorMsg };
  }
}

function mapCartpandaStatus(status: string): string {
  const map: Record<string, string> = {
    paid: "paid",
    pending: "pending",
    cancelled: "cancelled",
    refunded: "refunded",
    shipped: "shipped",
    delivered: "delivered",
  };
  return map[status?.toLowerCase()] || status;
}
