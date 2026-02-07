import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

const SHOPIFY_API_VERSION = "2024-01";

/**
 * Valida se as credenciais Shopify estao configuradas corretamente.
 * Retorna um objeto com status e mensagem de erro se houver problema.
 */
export function validateShopifyConfig(): { valid: boolean; error?: string } {
  const clientId = (process.env.SHOPIFY_CLIENT_ID || "").trim();
  const clientSecret = (process.env.SHOPIFY_CLIENT_SECRET || "").trim();
  const authUrl = (process.env.AUTH_URL || "").trim();

  if (!clientId) {
    return { valid: false, error: "SHOPIFY_CLIENT_ID nao configurado nas variaveis de ambiente" };
  }
  if (!clientSecret) {
    return { valid: false, error: "SHOPIFY_CLIENT_SECRET nao configurado nas variaveis de ambiente" };
  }
  if (!authUrl) {
    return { valid: false, error: "AUTH_URL nao configurado nas variaveis de ambiente" };
  }

  // Validar formato basico do client_id (deve ser hexadecimal, 32 chars para apps Partners)
  if (!/^[a-f0-9]{32}$/i.test(clientId) && !clientId.includes("-")) {
    return { valid: false, error: `SHOPIFY_CLIENT_ID parece ter formato invalido: ${clientId.substring(0, 8)}...` };
  }

  return { valid: true };
}

/**
 * Gera a URL de autorizacao OAuth do Shopify (Authorization Code Grant)
 * Este e o fluxo correto para apps criados no Shopify Partners com distribuicao personalizada.
 * O token gerado e PERMANENTE (offline access token) — nao expira.
 */
export function getShopifyAuthUrl(shop: string, state: string) {
  const clientId = (process.env.SHOPIFY_CLIENT_ID || "").trim();
  const redirectUri = `${(process.env.AUTH_URL || "").trim()}/api/integrations/shopify/callback`;
  const scopes = "read_orders,read_products,read_customers";

  console.log("[Shopify OAuth] Generating auth URL for shop:", shop);
  console.log("[Shopify OAuth] Client ID:", clientId ? `${clientId.substring(0, 8)}...` : "MISSING");
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
  const clientId = (process.env.SHOPIFY_CLIENT_ID || "").trim();
  const clientSecret = (process.env.SHOPIFY_CLIENT_SECRET || "").trim();

  if (!clientId || !clientSecret) {
    throw new Error("SHOPIFY_CLIENT_ID ou SHOPIFY_CLIENT_SECRET nao configurados. Configure nas variaveis de ambiente do Vercel.");
  }

  console.log("[Shopify OAuth] Exchanging code for token...");
  console.log("[Shopify OAuth] Shop:", shop);
  console.log("[Shopify OAuth] Client ID:", clientId ? `${clientId.substring(0, 8)}...` : "MISSING");
  console.log("[Shopify OAuth] Code (first 10 chars):", code.substring(0, 10) + "...");

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
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

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[Shopify OAuth] Token exchange FAILED:", response.status, errorBody);

    // Parsear erro do Shopify para mensagem mais amigavel
    const friendlyError = parseShopifyError(response.status, errorBody, clientId);
    throw new Error(friendlyError);
  }

  const data = await response.json();
  console.log("[Shopify OAuth] Token obtained! Scopes:", data.scope);
  return data;
}

/**
 * Parseia erros da API do Shopify e retorna mensagens actionaveis
 */
function parseShopifyError(status: number, body: string, clientId: string): string {
  try {
    const parsed = JSON.parse(body);
    const error = parsed.error || "";
    const description = parsed.error_description || "";

    if (error === "application_cannot_be_found") {
      return `App Shopify nao encontrado (API Key: ${clientId.substring(0, 8)}...). `
        + `Verifique se: (1) O app existe no Shopify Partners, `
        + `(2) A API Key (SHOPIFY_CLIENT_ID) esta correta no Vercel, `
        + `(3) O app nao foi deletado ou recriado com novas credenciais.`;
    }

    if (error === "invalid_request" && description.includes("authorization code")) {
      return "Codigo de autorizacao expirado ou invalido. Tente conectar novamente.";
    }

    if (error === "invalid_client") {
      return `Client Secret invalido. Verifique se SHOPIFY_CLIENT_SECRET esta correto no Vercel.`;
    }

    return `Erro Shopify (${status}): ${description || error || body}`;
  } catch {
    return `Erro Shopify (${status}): ${body}`;
  }
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
