import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

export async function syncNuvemshopOrders(organizationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "NUVEMSHOP" } },
  });

  if (!integration || integration.status !== "CONNECTED" || !integration.accessToken) {
    return { error: "Nuvemshop not connected" };
  }

  await prisma.integration.update({
    where: { id: integration.id },
    data: { syncStatus: "SYNCING" },
  });

  const syncLog = await prisma.syncLog.create({
    data: { organizationId, platform: "NUVEMSHOP", status: "SYNCING" },
  });

  try {
    const accessToken = decrypt(integration.accessToken);
    const storeId = integration.externalStoreId || "";

    const response = await fetch(
      `https://api.nuvemshop.com.br/v1/${storeId}/orders?per_page=200`,
      {
        headers: {
          Authentication: `bearer ${accessToken}`,
          "User-Agent": "CDR Group Hub (cdrgroup.com)",
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Nuvemshop API error: ${response.status}`);
    }

    const orders = await response.json();
    let synced = 0;

    for (const order of orders) {
      await prisma.order.upsert({
        where: {
          organizationId_platform_externalOrderId: {
            organizationId,
            platform: "NUVEMSHOP",
            externalOrderId: String(order.id),
          },
        },
        create: {
          organizationId,
          platform: "NUVEMSHOP",
          externalOrderId: String(order.id),
          status: mapNuvemshopStatus(order.payment_status),
          customerName: order.customer?.name || null,
          customerEmail: order.customer?.email || null,
          totalAmount: parseFloat(order.total || "0"),
          currency: order.currency || "BRL",
          itemCount: order.products?.length || 0,
          orderDate: new Date(order.created_at),
          rawData: order,
        },
        update: {
          status: mapNuvemshopStatus(order.payment_status),
          totalAmount: parseFloat(order.total || "0"),
          customerName: order.customer?.name || null,
          customerEmail: order.customer?.email || null,
          itemCount: order.products?.length || 0,
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

function mapNuvemshopStatus(status: string): string {
  const map: Record<string, string> = {
    paid: "paid",
    pending: "pending",
    refunded: "refunded",
    voided: "cancelled",
    authorized: "pending",
  };
  return map[status] || status;
}

export function getNuvemshopAuthUrl(state: string) {
  const clientId = process.env.NUVEMSHOP_CLIENT_ID;
  const redirectUri = `${process.env.AUTH_URL}/api/integrations/nuvemshop/callback`;

  return `https://www.tiendanube.com/apps/${clientId}/authorize?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
}

export async function exchangeNuvemshopToken(code: string) {
  const response = await fetch("https://www.tiendanube.com/apps/authorize/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.NUVEMSHOP_CLIENT_ID,
      client_secret: process.env.NUVEMSHOP_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to exchange Nuvemshop token: ${response.status}`);
  }

  return response.json();
}
