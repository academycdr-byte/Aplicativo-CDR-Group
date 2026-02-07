import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import crypto from "crypto";

const SHOPIFY_API_VERSION = "2025-01";
const SHOPIFY_GRAPHQL_VERSION = "2025-10"; // Required for ShopifyQL sessions dataset
const SHOPIFY_SCOPES = "read_orders,read_products,read_customers,read_reports";

/**
 * Gera a URL de autorizacao OAuth do Shopify (Authorization Code Grant).
 * O usuario e redirecionado para esta URL para autorizar o app.
 */
export function getShopifyAuthUrl(shop: string, redirectUri: string, state: string): string {
  const clientId = process.env.SHOPIFY_CLIENT_ID?.trim();
  if (!clientId) throw new Error("SHOPIFY_CLIENT_ID nao configurado");

  const params = new URLSearchParams({
    client_id: clientId,
    scope: SHOPIFY_SCOPES,
    redirect_uri: redirectUri,
    state,
  });

  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

/**
 * Troca o authorization code por um access token.
 * IMPORTANTE: Usa application/x-www-form-urlencoded (NAO JSON).
 * Tokens do Dev Dashboard expiram em 24h.
 */
export async function exchangeShopifyCode(
  shop: string,
  code: string
): Promise<{ access_token: string; scope: string }> {
  const clientId = process.env.SHOPIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error("SHOPIFY_CLIENT_ID ou SHOPIFY_CLIENT_SECRET nao configurado");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
  });

  console.log("[Shopify OAuth] Exchanging code for token on shop:", shop);

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const responseText = await response.text();

  if (!response.ok) {
    console.error("[Shopify OAuth] Token exchange failed:", response.status, responseText);
    throw new Error(`Shopify token exchange falhou (${response.status}): ${responseText}`);
  }

  const data = JSON.parse(responseText);
  console.log("[Shopify OAuth] Token obtained! Scopes:", data.scope);
  return { access_token: data.access_token, scope: data.scope };
}

/**
 * Gera um nonce aleatório para o state parameter do OAuth.
 */
export function generateOAuthState(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Valida o HMAC da query string do callback Shopify.
 */
export function validateShopifyHmac(query: Record<string, string>): boolean {
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET?.trim();
  if (!clientSecret) return false;

  const hmac = query.hmac;
  if (!hmac) return false;

  // Construir a mensagem sem o hmac
  const entries = Object.entries(query)
    .filter(([key]) => key !== "hmac")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const computed = crypto
    .createHmac("sha256", clientSecret)
    .update(entries)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hmac));
}

/**
 * Valida um Access Token fazendo uma chamada de teste a API da Shopify.
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
        return { valid: false, error: "Access Token invalido." };
      }
      if (response.status === 403) {
        return { valid: false, error: "Token sem permissao. Verifique os escopos." };
      }
      if (response.status === 404) {
        return { valid: false, error: "Loja nao encontrada. Verifique o dominio." };
      }
      return { valid: false, error: `Erro Shopify (${response.status})` };
    }

    const data = await response.json();
    return { valid: true, shopName: data.shop?.name };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro de conexao";
    return { valid: false, error: `Erro ao conectar: ${msg}` };
  }
}

/**
 * Busca pedidos da Shopify usando o access token armazenado.
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
          errorMessage: "Token expirado ou invalido. Reconecte a Shopify.",
        },
      });
      throw new Error("Token Shopify expirado. Reconecte a integracao.");
    }

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

/**
 * Sync funnel metrics from Shopify using ShopifyQL `sessions` dataset.
 * This queries the same data shown in Shopify Admin → Analytics → Conversion funnel:
 *   - sessions: total online store sessions
 *   - sessions_with_cart_additions: sessions that added to cart
 *   - sessions_that_reached_checkout: sessions that started checkout
 *   - sessions_that_completed_checkout: sessions that completed purchase
 * Requires read_reports scope.
 */
export async function syncShopifyFunnel(organizationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "SHOPIFY" } },
  });

  if (!integration || integration.status !== "CONNECTED" || !integration.accessToken) {
    return { error: "Shopify not connected" };
  }

  try {
    const accessToken = decrypt(integration.accessToken);
    const shop = integration.externalStoreId || "";

    // Fetch funnel data from ShopifyQL sessions dataset
    const funnelData = await fetchShopifyFunnelData(shop, accessToken);

    if (!funnelData || Object.keys(funnelData).length === 0) {
      console.warn("[Shopify Funnel] No data from ShopifyQL sessions dataset");
      return { error: "No funnel data available from Shopify analytics" };
    }

    // Get orders by date from our database as additional reference
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const orders = await prisma.order.findMany({
      where: {
        organizationId,
        platform: "SHOPIFY",
        orderDate: { gte: thirtyDaysAgo },
      },
      select: { orderDate: true },
    });

    const ordersByDate: Record<string, number> = {};
    for (const o of orders) {
      const key = o.orderDate.toISOString().split("T")[0];
      ordersByDate[key] = (ordersByDate[key] || 0) + 1;
    }

    // Upsert all funnel data into StoreFunnel
    let synced = 0;
    for (const [dateKey, metrics] of Object.entries(funnelData)) {
      // Use ShopifyQL ordersCompleted, or our DB order count if ShopifyQL didn't return it
      const dayOrders = metrics.ordersCompleted > 0
        ? metrics.ordersCompleted
        : (ordersByDate[dateKey] || 0);

      await prisma.storeFunnel.upsert({
        where: {
          organizationId_platform_date: {
            organizationId,
            platform: "SHOPIFY",
            date: new Date(dateKey),
          },
        },
        create: {
          organizationId,
          platform: "SHOPIFY",
          date: new Date(dateKey),
          sessions: metrics.sessions,
          addToCart: metrics.addToCart,
          checkoutsInitiated: metrics.checkoutsStarted,
          ordersGenerated: dayOrders,
        },
        update: {
          sessions: metrics.sessions,
          addToCart: metrics.addToCart,
          checkoutsInitiated: metrics.checkoutsStarted,
          ordersGenerated: dayOrders,
        },
      });
      synced++;
    }

    return { success: true, synced };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[Shopify Funnel] Error:", errorMsg);
    return { error: errorMsg };
  }
}

type DailyFunnelMetrics = {
  sessions: number;
  addToCart: number;
  checkoutsStarted: number;
  ordersCompleted: number;
};

/**
 * Fetch conversion funnel data from Shopify using ShopifyQL `sessions` dataset.
 * Tries multiple query strategies:
 * 1. Full funnel with all metrics (sessions, cart additions, checkout, completed)
 * 2. Sessions only (if full query fails)
 */
async function fetchShopifyFunnelData(
  shop: string,
  accessToken: string,
  sinceDays: number = 30
): Promise<Record<string, DailyFunnelMetrics> | null> {
  const queries = [
    // Full funnel data from sessions dataset
    `FROM sessions SHOW sessions, sessions_with_cart_additions, sessions_that_reached_checkout, sessions_that_completed_checkout TIMESERIES day SINCE -${sinceDays}d UNTIL today ORDER BY day ASC`,
    // Fallback: sessions only
    `FROM sessions SHOW sessions TIMESERIES day SINCE -${sinceDays}d UNTIL today ORDER BY day ASC`,
  ];

  for (const query of queries) {
    try {
      const table = await executeShopifyQLQuery(shop, accessToken, query);
      if (!table) continue;

      const result = parseShopifyFunnelTable(table);
      if (Object.keys(result).length > 0) {
        console.log(`[Shopify Funnel] Got ${Object.keys(result).length} days of data`);
        return result;
      }
    } catch (error) {
      console.warn("[Shopify Funnel] Query failed:", error);
    }
  }

  return null;
}

/**
 * Execute a ShopifyQL query via GraphQL Admin API.
 * Uses API version 2025-10 which supports the sessions dataset.
 */
async function executeShopifyQLQuery(
  shop: string,
  accessToken: string,
  query: string
): Promise<{ columns: Array<{ name: string; dataType: string }>; rows: Array<unknown[]> } | null> {
  const escapedQuery = query.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const graphqlBody = JSON.stringify({
    query: `{
      shopifyqlQuery(query: "${escapedQuery}") {
        tableData {
          columns { name dataType }
          rows
        }
        parseErrors
      }
    }`,
  });

  const response = await fetch(
    `https://${shop}/admin/api/${SHOPIFY_GRAPHQL_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: graphqlBody,
    }
  );

  if (!response.ok) {
    console.warn(`[Shopify ShopifyQL] Request failed: ${response.status}`);
    return null;
  }

  const data = await response.json();
  const queryResult = data?.data?.shopifyqlQuery;

  if (queryResult?.parseErrors?.length > 0) {
    console.warn("[Shopify ShopifyQL] Parse errors:", queryResult.parseErrors);
    return null;
  }

  const table = queryResult?.tableData;
  if (!table?.columns || !table?.rows || table.rows.length === 0) {
    return null;
  }

  return table;
}

/**
 * Parse ShopifyQL table data into daily funnel metrics.
 * Dynamically finds columns by name to handle different query formats.
 */
function parseShopifyFunnelTable(
  table: { columns: Array<{ name: string; dataType: string }>; rows: Array<unknown[]> }
): Record<string, DailyFunnelMetrics> {
  const result: Record<string, DailyFunnelMetrics> = {};

  const dayIdx = table.columns.findIndex((c) =>
    c.name === "day" || c.name === "date" || c.dataType === "date"
  );
  const sessionsIdx = table.columns.findIndex((c) => c.name === "sessions");
  const cartIdx = table.columns.findIndex((c) => c.name === "sessions_with_cart_additions");
  const checkoutIdx = table.columns.findIndex((c) => c.name === "sessions_that_reached_checkout");
  const completedIdx = table.columns.findIndex((c) => c.name === "sessions_that_completed_checkout");

  if (dayIdx === -1 || sessionsIdx === -1) {
    console.warn("[Shopify Funnel] Missing required columns: day or sessions");
    return result;
  }

  for (const row of table.rows) {
    const dateStr = String(row[dayIdx]).split("T")[0];
    if (!dateStr || dateStr === "undefined" || dateStr === "null") continue;

    result[dateStr] = {
      sessions: parseInt(String(row[sessionsIdx])) || 0,
      addToCart: cartIdx !== -1 ? (parseInt(String(row[cartIdx])) || 0) : 0,
      checkoutsStarted: checkoutIdx !== -1 ? (parseInt(String(row[checkoutIdx])) || 0) : 0,
      ordersCompleted: completedIdx !== -1 ? (parseInt(String(row[completedIdx])) || 0) : 0,
    };
  }

  return result;
}
