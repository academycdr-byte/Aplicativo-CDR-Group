import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

const SHOPIFY_API_VERSION = "2024-01";

/**
 * Gera a URL de autorizacao OAuth do Shopify (Authorization Code Grant)
 * Este e o fluxo correto para apps criados no Dev Dashboard com distribuicao personalizada.
 * O token gerado e PERMANENTE (offline access token) — nao expira.
 */
export function getShopifyAuthUrl(shop: string, state: string) {
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const redirectUri = `${process.env.AUTH_URL}/api/integrations/shopify/callback`;
  const scopes = "read_orders,read_products,read_customers";

  console.log("[Shopify OAuth] Generating auth URL for shop:", shop);
  console.log("[Shopify OAuth] Client ID:", clientId);
  console.log("[Shopify OAuth] Redirect URI:", redirectUri);

  return `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
}

/**
 * Troca o authorization code por um access token permanente.
 * IMPORTANTE: Usa application/x-www-form-urlencoded conforme documentacao Shopify.
 */
export async function exchangeShopifyToken(shop: string, code: string): Promise<{
  access_token: string;
  scope: string;
}> {
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("SHOPIFY_CLIENT_ID ou SHOPIFY_CLIENT_SECRET nao configurados");
  }

  console.log("[Shopify OAuth] Exchanging code for token...");
  console.log("[Shopify OAuth] Shop:", shop);
  console.log("[Shopify OAuth] Code (first 10 chars):", code.substring(0, 10) + "...");

  // Tentar com application/x-www-form-urlencoded primeiro (formato recomendado)
  let response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }).toString(),
  });

  // Se falhar com form-urlencoded, tentar com JSON (fallback)
  if (!response.ok) {
    const errorBody1 = await response.text();
    console.warn("[Shopify OAuth] form-urlencoded failed:", response.status, errorBody1);
    console.log("[Shopify OAuth] Retrying with JSON body...");

    response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });
  }

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[Shopify OAuth] Token exchange FAILED:", response.status, errorBody);
    throw new Error(`Falha ao trocar token Shopify: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  console.log("[Shopify OAuth] Token obtained! Scopes:", data.scope);
  return data;
}

/**
 * Busca pedidos da Shopify usando o access token armazenado.
 * O token do authorization code grant e permanente — nao precisa renovar.
 */
export async function fetchShopifyOrders(integrationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration || !integration.externalStoreId || !integration.accessToken) {
    throw new Error("Integration not found or missing credentials");
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

    // Se o token for invalido (401), marcar integracao como erro
    if (response.status === 401) {
      await prisma.integration.update({
        where: { id: integrationId },
        data: {
          status: "DISCONNECTED",
          errorMessage: "Token invalido. Reconecte a loja Shopify.",
        },
      });
      throw new Error("Token Shopify invalido. Reconecte a integracao.");
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
