import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { parseOrderDate, toDateKeyBrasilia } from "@/lib/date-utils";

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

    // Fetch all orders with pagination
    let allOrders: Record<string, unknown>[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `https://api.dooki.com.br/v2/${alias}/orders?limit=100&page=${page}&sort=created_at:desc`,
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

      if (orders.length === 0) {
        hasMore = false;
        break;
      }

      allOrders = allOrders.concat(orders);
      hasMore = orders.length === 100 && (data.meta?.last_page ? page < data.meta.last_page : true);
      page++;
    }

    let synced = 0;

    for (const order of allOrders) {
      const raw = order as Record<string, unknown>;
      const statusData = raw.status as Record<string, unknown> | undefined;
      const statusName = (statusData?.data as Record<string, unknown>)?.name as string || raw.status as string;
      const customerData = raw.customer as Record<string, unknown> | undefined;
      const customerInfo = (customerData?.data as Record<string, unknown>) || customerData;
      const itemsData = raw.items as Record<string, unknown> | undefined;
      const itemsList = (itemsData?.data as Array<Record<string, unknown>>) || [];

      const lineItems = itemsList.map((item) => ({
        product_id: String(item.product_id || item.id || ""),
        variant_id: String(item.variant_id || item.sku_id || ""),
        name: String(item.name || item.title || ""),
        quantity: Number(item.quantity || 0),
        price: String(item.price || item.unit_price || "0"),
        sku: String(item.sku || ""),
      }));

      const orderDateStr = (raw.created_at as Record<string, unknown>)?.date as string || raw.created_at as string;

      await prisma.order.upsert({
        where: {
          organizationId_platform_externalOrderId: {
            organizationId,
            platform: "YAMPI",
            externalOrderId: String(raw.id),
          },
        },
        create: {
          organizationId,
          platform: "YAMPI",
          externalOrderId: String(raw.id),
          status: mapYampiStatus(statusName),
          customerName: (customerInfo?.name as string) || null,
          customerEmail: (customerInfo?.email as string) || null,
          totalAmount: parseFloat(String(raw.value_total || "0")),
          currency: "BRL",
          itemCount: itemsList.length,
          orderDate: parseOrderDate(orderDateStr),
          rawData: JSON.parse(JSON.stringify({ ...raw, line_items: lineItems })),
        },
        update: {
          status: mapYampiStatus(statusName),
          totalAmount: parseFloat(String(raw.value_total || "0")),
          customerName: (customerInfo?.name as string) || null,
          customerEmail: (customerInfo?.email as string) || null,
          itemCount: itemsList.length,
          orderDate: parseOrderDate(orderDateStr),
          rawData: JSON.parse(JSON.stringify({ ...raw, line_items: lineItems })),
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

/**
 * Sync funnel metrics from Yampi.
 * Yampi does not offer session/cart analytics via API,
 * so we derive funnel data from order counts per day.
 */
export async function syncYampiFunnel(organizationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "YAMPI" } },
  });

  if (!integration || integration.status !== "CONNECTED") {
    return { error: "Yampi not connected" };
  }

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const orders = await prisma.order.findMany({
      where: {
        organizationId,
        platform: "YAMPI",
        orderDate: { gte: thirtyDaysAgo },
      },
      select: { orderDate: true, customerEmail: true },
    });

    const ordersByDate: Record<string, number> = {};
    for (const o of orders) {
      const key = toDateKeyBrasilia(o.orderDate);
      ordersByDate[key] = (ordersByDate[key] || 0) + 1;
    }

    let synced = 0;
    for (const [dateKey, dayOrders] of Object.entries(ordersByDate)) {
      await prisma.storeFunnel.upsert({
        where: {
          organizationId_platform_date: {
            organizationId,
            platform: "YAMPI",
            date: new Date(dateKey),
          },
        },
        create: {
          organizationId,
          platform: "YAMPI",
          date: new Date(dateKey),
          sessions: 0,
          addToCart: 0,
          checkoutsInitiated: 0,
          ordersGenerated: dayOrders,
        },
        update: {
          ordersGenerated: dayOrders,
        },
      });
      synced++;
    }

    return { success: true, synced };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[Yampi Funnel] Error:", errorMsg);
    return { error: errorMsg };
  }
}
