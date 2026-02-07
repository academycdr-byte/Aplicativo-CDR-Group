import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

const SHOPIFY_API_VERSION = "2024-01";

/**
 * Obtém access token via Client Credentials Grant (Dev Dashboard apps)
 * Token expira em 24h - renovar automaticamente antes de usar
 */
export async function getShopifyAccessToken(shop: string): Promise<{
  access_token: string;
  scope: string;
  expires_in: number;
}> {
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("SHOPIFY_CLIENT_ID ou SHOPIFY_CLIENT_SECRET nao configurados");
  }

  console.log("[Shopify] Requesting token via client_credentials for shop:", shop);

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }).toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[Shopify] Token request failed:", response.status, errorBody);
    throw new Error(`Falha ao obter token Shopify: ${response.status}`);
  }

  const data = await response.json();
  console.log("[Shopify] Token obtained, scopes:", data.scope, "expires_in:", data.expires_in);
  return data;
}

/**
 * Renova o token se expirado (tokens duram 24h)
 */
async function ensureFreshToken(integration: {
  id: string;
  accessToken: string | null;
  externalStoreId: string | null;
  tokenExpiresAt: Date | null;
}): Promise<string> {
  const now = new Date();
  const bufferMs = 60 * 60 * 1000; // 1h de buffer antes de expirar

  // Se o token ainda é válido, retorna ele
  if (
    integration.accessToken &&
    integration.tokenExpiresAt &&
    integration.tokenExpiresAt.getTime() - bufferMs > now.getTime()
  ) {
    return decrypt(integration.accessToken);
  }

  // Token expirado ou inexistente - renovar
  if (!integration.externalStoreId) {
    throw new Error("Dominio da loja nao configurado");
  }

  console.log("[Shopify] Token expired or missing, refreshing for:", integration.externalStoreId);
  const tokenData = await getShopifyAccessToken(integration.externalStoreId);

  const expiresAt = new Date(now.getTime() + tokenData.expires_in * 1000);

  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      accessToken: encrypt(tokenData.access_token),
      tokenExpiresAt: expiresAt,
      scopes: tokenData.scope || "",
    },
  });

  return tokenData.access_token;
}

export async function fetchShopifyOrders(integrationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration || !integration.externalStoreId) {
    throw new Error("Integration not found or missing credentials");
  }

  const accessToken = await ensureFreshToken(integration);
  const shop = integration.externalStoreId;

  const url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&limit=250`;

  const response = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.status}`);
  }

  const data = await response.json();
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

// Mantido para compatibilidade, mas não mais usado no fluxo principal
export function getShopifyAuthUrl(shop: string, state: string) {
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const redirectUri = `${process.env.AUTH_URL}/api/integrations/shopify/callback`;
  const scopes = "read_orders,read_products,read_customers";

  return `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
}

export async function exchangeShopifyToken(shop: string, code: string) {
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[Shopify] Token exchange failed:", response.status, errorBody);
    throw new Error(`Failed to exchange Shopify token: ${response.status} - ${errorBody}`);
  }

  return response.json();
}
