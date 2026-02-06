import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

export async function syncYampiOrders(organizationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "YAMPI" } },
  });

  if (!integration || integration.status !== "CONNECTED" || !integration.apiKey) {
    return { error: "Yampi not connected" };
  }

  await prisma.integration.update({
    where: { id: integration.id },
    data: { syncStatus: "SYNCING" },
  });

  const syncLog = await prisma.syncLog.create({
    data: { organizationId, platform: "YAMPI", status: "SYNCING" },
  });

  try {
    const token = decrypt(integration.apiKey);
    const secretKey = integration.apiSecret ? decrypt(integration.apiSecret) : "";
    const alias = integration.externalStoreId || "";

    const response = await fetch(
      `https://api.dooki.com.br/v2/${alias}/orders?limit=100&sort=created_at:desc`,
      {
        headers: {
          "User-Token": token,
          "User-Secret-Key": secretKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Yampi API error: ${response.status}`);
    }

    const data = await response.json();
    const orders = data.data || [];
    let synced = 0;

    for (const order of orders) {
      await prisma.order.upsert({
        where: {
          organizationId_platform_externalOrderId: {
            organizationId,
            platform: "YAMPI",
            externalOrderId: String(order.id),
          },
        },
        create: {
          organizationId,
          platform: "YAMPI",
          externalOrderId: String(order.id),
          status: mapYampiStatus(order.status?.data?.name || order.status),
          customerName: order.customer?.data?.name || null,
          customerEmail: order.customer?.data?.email || null,
          totalAmount: parseFloat(order.value_total || "0"),
          currency: "BRL",
          itemCount: order.items?.data?.length || 0,
          orderDate: new Date(order.created_at?.date || order.created_at),
          rawData: order,
        },
        update: {
          status: mapYampiStatus(order.status?.data?.name || order.status),
          totalAmount: parseFloat(order.value_total || "0"),
          customerName: order.customer?.data?.name || null,
          customerEmail: order.customer?.data?.email || null,
          itemCount: order.items?.data?.length || 0,
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

function mapYampiStatus(status: string): string {
  const map: Record<string, string> = {
    pago: "paid",
    pendente: "pending",
    cancelado: "cancelled",
    reembolsado: "refunded",
    enviado: "shipped",
    entregue: "delivered",
    aprovado: "paid",
    paid: "paid",
    pending: "pending",
    cancelled: "cancelled",
  };
  return map[status?.toLowerCase()] || status;
}
