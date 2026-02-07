import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

const SHOPIFY_API_VERSION = "2024-01";

/**
 * Valida um Access Token de Custom App da Shopify fazendo uma chamada de teste.
 * Custom Apps geram tokens permanentes (nao expiram), entao nao precisa de refresh.
 */
export async function validateShopifyAccessToken(
  shop: string,
  accessToken: string
): Promise<{ valid: boolean; shopName?: string; error?: string }> {
  try {
    const response = await fetch(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/shop.json`,
      {
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("[Shopify] Token validation failed:", response.status, errorBody);

      if (response.status === 401) {
        return { valid: false, error: "Access Token invalido. Verifique se copiou o token corretamente." };
      }
      if (response.status === 403) {
        return { valid: false, error: "Token sem permissao. Verifique os escopos do Custom App." };
      }
      if (response.status === 404) {
        return { valid: false, error: "Loja nao encontrada. Verifique o dominio informado." };
      }
      return { valid: false, error: `Erro Shopify (${response.status}): ${errorBody}` };
    }

    const data = await response.json();
    console.log("[Shopify] Token validated! Shop:", data.shop?.name);
    return { valid: true, shopName: data.shop?.name };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro de conexao";
    console.error("[Shopify] Token validation error:", msg);
    return { valid: false, error: `Erro ao conectar: ${msg}` };
  }
}

/**
 * Busca pedidos da Shopify usando o access token armazenado.
 * Custom App tokens sao permanentes, nao precisam de refresh.
 */
export async function fetchShopifyOrders(integrationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration || !integration.externalStoreId) {
    throw new Error("Integration not found or missing store domain");
  }

  if (!integration.accessToken) {
    throw new Error("Access token nao encontrado. Reconecte a loja Shopify.");
  }

  const accessToken = decrypt(integration.accessToken);
  const shop = integration.externalStoreId;

  const url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&limit=250`;

  console.log("[Shopify API] Fetching orders from:", shop);

  const response = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[Shopify API] Orders fetch failed:", response.status, errorBody);

    if (response.status === 401) {
      await prisma.integration.update({
        where: { id: integrationId },
        data: {
          status: "DISCONNECTED",
          errorMessage: "Token invalido. Reconecte a loja Shopify com um novo Access Token.",
        },
      });
      throw new Error("Token Shopify invalido. Reconecte a integracao com um novo Access Token.");
    }

    throw new Error(`Shopify API error: ${response.status}`);
  }

  const data = await response.json();
  console.log("[Shopify API] Fetched", (data.orders || []).length, "orders");
  return data.orders || [];
}

export async function syncShopifyOrders(organizationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "SHOPIFY" } },
  });

  if (!integration || integration.status !== "CONNECTED") {
    return { error: "Shopify not connected" };
  }

  await prisma.integration.update({
    where: { id: integration.id },
    data: { syncStatus: "SYNCING" },
  });

  const syncLog = await prisma.syncLog.create({
    data: {
      organizationId,
      platform: "SHOPIFY",
      status: "SYNCING",
    },
  });

  try {
    const orders = await fetchShopifyOrders(integration.id);
    let synced = 0;

    for (const order of orders) {
      await prisma.order.upsert({
        where: {
          organizationId_platform_externalOrderId: {
            organizationId,
            platform: "SHOPIFY",
            externalOrderId: String(order.id),
          },
        },
        create: {
          organizationId,
          platform: "SHOPIFY",
          externalOrderId: String(order.id),
          status: mapShopifyStatus(order.financial_status),
          customerName: order.customer
            ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim()
            : null,
          customerEmail: order.customer?.email || null,
          totalAmount: parseFloat(order.total_price || "0"),
          currency: order.currency || "BRL",
          itemCount: order.line_items?.length || 0,
          orderDate: new Date(order.created_at),
          rawData: order,
        },
        update: {
          status: mapShopifyStatus(order.financial_status),
          totalAmount: parseFloat(order.total_price || "0"),
          customerName: order.customer
            ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim()
            : null,
          customerEmail: order.customer?.email || null,
          itemCount: order.line_items?.length || 0,
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

function mapShopifyStatus(status: string): string {
  const map: Record<string, string> = {
    paid: "paid",
    pending: "pending",
    refunded: "refunded",
    voided: "cancelled",
    partially_refunded: "refunded",
    authorized: "pending",
  };
  return map[status] || status;
}
