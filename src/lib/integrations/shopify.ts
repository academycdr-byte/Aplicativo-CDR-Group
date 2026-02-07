import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

const SHOPIFY_API_VERSION = "2024-01";

/**
 * Conecta a Shopify usando Client Credentials Grant.
 * Este fluxo e para apps do Dev Dashboard instalados em lojas proprias.
 * O token expira em 24h e deve ser renovado automaticamente.
 */
export async function connectShopifyViaClientCredentials(shop: string): Promise<{
  access_token: string;
  scope: string;
  expires_in: number;
}> {
  const clientId = (process.env.SHOPIFY_CLIENT_ID || "").trim();
  const clientSecret = (process.env.SHOPIFY_CLIENT_SECRET || "").trim();

  if (!clientId || !clientSecret) {
    throw new Error("SHOPIFY_CLIENT_ID ou SHOPIFY_CLIENT_SECRET nao configurados no Vercel.");
  }

  console.log("[Shopify] Client Credentials Grant for shop:", shop);

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[Shopify] Client Credentials FAILED:", response.status, errorBody);

    try {
      const parsed = JSON.parse(errorBody);
      const error = parsed.error || "";
      const desc = parsed.error_description || "";

      if (error === "application_cannot_be_found") {
        throw new Error(
          "App nao encontrado. Verifique se o app CDR Group esta instalado nesta loja. "
          + "Use o link de instalacao do Shopify Partners > Distribuicao."
        );
      }
      if (error === "invalid_client") {
        throw new Error("Client Secret invalido. Verifique SHOPIFY_CLIENT_SECRET no Vercel.");
      }
      if (desc.includes("not installed")) {
        throw new Error("O app CDR Group nao esta instalado nesta loja. Instale primeiro via Shopify Partners.");
      }
      throw new Error(`Erro Shopify: ${desc || error || errorBody}`);
    } catch (e) {
      if (e instanceof Error && !e.message.startsWith("Erro Shopify")) throw e;
      throw new Error(`Erro Shopify (${response.status}): ${errorBody}`);
    }
  }

  const data = await response.json();
  console.log("[Shopify] Token obtained! Scopes:", data.scope, "Expires in:", data.expires_in);
  return data;
}

/**
 * Renova o access token da Shopify via Client Credentials.
 * Deve ser chamada antes de qualquer API call se o token expirou.
 */
export async function refreshShopifyTokenIfNeeded(integrationId: string): Promise<string> {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration || !integration.externalStoreId) {
    throw new Error("Integration not found");
  }

  // Verificar se o token precisa ser renovado (mais de 23h desde a ultima atualizacao)
  const tokenAge = Date.now() - new Date(integration.updatedAt).getTime();
  const TOKEN_MAX_AGE = 23 * 60 * 60 * 1000; // 23 horas (margem de seguranca)

  if (integration.accessToken && tokenAge < TOKEN_MAX_AGE) {
    return decrypt(integration.accessToken);
  }

  // Token expirado ou ausente - renovar via Client Credentials
  console.log("[Shopify] Refreshing token for shop:", integration.externalStoreId);

  try {
    const tokenData = await connectShopifyViaClientCredentials(integration.externalStoreId);

    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        accessToken: encrypt(tokenData.access_token),
        scopes: tokenData.scope || "",
        errorMessage: null,
      },
    });

    return tokenData.access_token;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Token refresh failed";
    console.error("[Shopify] Token refresh failed:", msg);

    await prisma.integration.update({
      where: { id: integrationId },
      data: { errorMessage: msg },
    });

    throw error;
  }
}

/**
 * Busca pedidos da Shopify usando o access token armazenado.
 * Renova o token automaticamente se necessario.
 */
export async function fetchShopifyOrders(integrationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration || !integration.externalStoreId) {
    throw new Error("Integration not found or missing store domain");
  }

  // Obter token valido (renova automaticamente se expirado)
  const accessToken = await refreshShopifyTokenIfNeeded(integrationId);
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
      // Token invalido - tentar renovar uma vez
      console.log("[Shopify API] Token expired, forcing refresh...");
      try {
        const newToken = await forceRefreshShopifyToken(integrationId);
        const retryResponse = await fetch(url, {
          headers: {
            "X-Shopify-Access-Token": newToken,
            "Content-Type": "application/json",
          },
        });
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          return retryData.orders || [];
        }
      } catch {
        // Refresh tambem falhou
      }

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

/**
 * Forca a renovacao do token ignorando o cache de tempo.
 */
async function forceRefreshShopifyToken(integrationId: string): Promise<string> {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration || !integration.externalStoreId) {
    throw new Error("Integration not found");
  }

  const tokenData = await connectShopifyViaClientCredentials(integration.externalStoreId);

  await prisma.integration.update({
    where: { id: integrationId },
    data: {
      accessToken: encrypt(tokenData.access_token),
      scopes: tokenData.scope || "",
      errorMessage: null,
    },
  });

  return tokenData.access_token;
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
