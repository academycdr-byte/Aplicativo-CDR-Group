import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { parseOrderDate, toDateKeyBrasilia } from "@/lib/date-utils";

const CARTPANDA_API_BASE = "https://accounts.cartpanda.com/api";

/**
 * Validate Cartpanda API credentials by making a test request.
 * Returns { valid: true } or { valid: false, error: string }.
 */
export async function validateCartpandaCredentials(
  apiKey: string,
  storeId: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${CARTPANDA_API_BASE}/${storeId}/orders?page=1&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      }
    );

    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "Token invalido ou sem permissao. Verifique sua API Key." };
    }

    if (response.status === 404) {
      return { valid: false, error: "Loja nao encontrada. Verifique o Store ID (Nome da Loja)." };
    }

    if (!response.ok) {
      return { valid: false, error: `Erro na API da Cartpanda: ${response.status}` };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Nao foi possivel conectar a Cartpanda: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
    };
  }
}

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

    // Fetch all orders with pagination
    let allOrders: Record<string, unknown>[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `${CARTPANDA_API_BASE}/${storeId}/orders?page=${page}&limit=100`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Cartpanda API error: ${response.status}`);
      }

      const data = await response.json();
      const orders = data.data || data.orders || [];

      if (orders.length === 0) {
        hasMore = false;
        break;
      }

      allOrders = allOrders.concat(orders);
      hasMore = orders.length >= 100 && (data.meta?.last_page ? page < data.meta.last_page : true);
      page++;
    }

    let synced = 0;

    for (const raw of allOrders) {
      const items = (raw.items as Array<Record<string, unknown>>) || [];
      const lineItems = items.map((item) => ({
        product_id: String(item.product_id || item.id || ""),
        variant_id: String(item.variant_id || ""),
        name: String(item.name || item.title || ""),
        quantity: Number(item.quantity || 0),
        price: String(item.price || "0"),
        sku: String(item.sku || ""),
      }));

      const customer = raw.customer as Record<string, unknown> | undefined;

      await prisma.order.upsert({
        where: {
          organizationId_platform_externalOrderId: {
            organizationId,
            platform: "CARTPANDA",
            externalOrderId: String(raw.id),
          },
        },
        create: {
          organizationId,
          platform: "CARTPANDA",
          externalOrderId: String(raw.id),
          status: mapCartpandaStatus(String(raw.status || "")),
          customerName: (customer?.name as string) || null,
          customerEmail: (customer?.email as string) || null,
          totalAmount: parseFloat(String(raw.total || "0")),
          currency: String(raw.currency || "BRL"),
          itemCount: items.length,
          orderDate: parseOrderDate(String(raw.created_at || "")),
          rawData: JSON.parse(JSON.stringify({ ...raw, line_items: lineItems })),
        },
        update: {
          status: mapCartpandaStatus(String(raw.status || "")),
          totalAmount: parseFloat(String(raw.total || "0")),
          customerName: (customer?.name as string) || null,
          customerEmail: (customer?.email as string) || null,
          itemCount: items.length,
          orderDate: parseOrderDate(String(raw.created_at || "")),
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

/**
 * Sync funnel metrics from Cartpanda.
 * Cartpanda does not offer session/cart analytics via API,
 * so we derive funnel data from order counts per day.
 */
export async function syncCartpandaFunnel(organizationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "CARTPANDA" } },
  });

  if (!integration || integration.status !== "CONNECTED") {
    return { error: "Cartpanda not connected" };
  }

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const orders = await prisma.order.findMany({
      where: {
        organizationId,
        platform: "CARTPANDA",
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
            platform: "CARTPANDA",
            date: new Date(dateKey),
          },
        },
        create: {
          organizationId,
          platform: "CARTPANDA",
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
    console.error("[Cartpanda Funnel] Error:", errorMsg);
    return { error: errorMsg };
  }
}
