import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { toDateKeyBrasilia } from "@/lib/date-utils";
import crypto from "crypto";

const SHOPIFY_API_VERSION = "2025-01";
const SHOPIFY_GRAPHQL_VERSION = "2025-10"; // Required for ShopifyQL sessions dataset
const SHOPIFY_SCOPES = "read_orders,read_products,read_customers,read_reports";

/**
 * Gera a URL de autorizacao OAuth do Shopify (Authorization Code Grant).
 * O usuario e redirecionado para esta URL para autorizar o app.
 */
export function getShopifyAuthUrl(shop: string, redirectUri: string, state: string, clientId?: string): string {
  const id = clientId?.trim() || process.env.SHOPIFY_CLIENT_ID?.trim();
  if (!id) throw new Error("SHOPIFY_CLIENT_ID não configurado");

  const params = new URLSearchParams({
    client_id: id,
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
  code: string,
  credentials?: { clientId: string; clientSecret: string }
): Promise<{ access_token: string; scope: string }> {
  const clientId = credentials?.clientId?.trim() || process.env.SHOPIFY_CLIENT_ID?.trim();
  const clientSecret = credentials?.clientSecret?.trim() || process.env.SHOPIFY_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error("Client ID ou Client Secret não configurado");
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
export function validateShopifyHmac(query: Record<string, string>, secret?: string): boolean {
  const clientSecret = secret?.trim() || process.env.SHOPIFY_CLIENT_SECRET?.trim();
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
        return { valid: false, error: "Access Token inválido." };
      }
      if (response.status === 403) {
        return { valid: false, error: "Token sem permissão. Verifique os escopos." };
      }
      if (response.status === 404) {
        return { valid: false, error: "Loja não encontrada. Verifique o domínio." };
      }
      return { valid: false, error: `Erro Shopify (${response.status})` };
    }

    const data = await response.json();
    return { valid: true, shopName: data.shop?.name };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro de conexão";
    return { valid: false, error: `Erro ao conectar: ${msg}` };
  }
}

/**
 * Registra webhooks na loja Shopify apos conexao OAuth.
 * Sem isso, a Shopify nunca envia webhooks para o app.
 */
export async function registerShopifyWebhooks(
  shop: string,
  accessToken: string
): Promise<void> {
  const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (!baseUrl) {
    console.error("[Shopify Webhooks] AUTH_URL não configurado, pulando registro de webhooks");
    return;
  }

  const webhookAddress = `${baseUrl}/api/webhooks/shopify`;
  const topics = ["orders/create", "orders/updated", "app/uninstalled"];

  // Buscar webhooks ja registrados para evitar duplicatas
  let existingTopics: string[] = [];
  try {
    const listRes = await fetch(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`,
      {
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
      }
    );
    if (listRes.ok) {
      const listData = await listRes.json();
      existingTopics = (listData.webhooks || [])
        .filter((w: { address: string }) => w.address === webhookAddress)
        .map((w: { topic: string }) => w.topic);
    }
  } catch (err) {
    console.warn("[Shopify Webhooks] Erro ao listar webhooks existentes:", err);
  }

  for (const topic of topics) {
    if (existingTopics.includes(topic)) {
      console.log(`[Shopify Webhooks] ${topic} ja registrado para ${shop}`);
      continue;
    }

    try {
      const res = await fetch(
        `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`,
        {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            webhook: {
              topic,
              address: webhookAddress,
              format: "json",
            },
          }),
        }
      );

      if (res.ok) {
        console.log(`[Shopify Webhooks] Registrado ${topic} para ${shop}`);
      } else {
        const errText = await res.text();
        console.error(`[Shopify Webhooks] Falha ao registrar ${topic} (${res.status}):`, errText);
      }
    } catch (err) {
      console.error(`[Shopify Webhooks] Erro ao registrar ${topic}:`, err);
    }
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
    throw new Error("Access token não encontrado. Reconecte a loja Shopify.");
  }

  const accessToken = decrypt(integration.accessToken);
  const shop = integration.externalStoreId;

  let allOrders: Record<string, unknown>[] = [];
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  let url: string | null = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&limit=250&created_at_min=${ninetyDaysAgo.toISOString()}`;
  const MAX_ORDERS = 10000;

  while (url && allOrders.length < MAX_ORDERS) {
    const response: Response = await fetch(url, {
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
            errorMessage: "Token expirado ou inválido. Reconecte a Shopify.",
          },
        });
        throw new Error("Token Shopify expirado. Reconecte a integração.");
      }

      throw new Error(`Shopify API error: ${response.status}`);
    }

    const data = await response.json();
    const orders = data.orders || [];
    allOrders = allOrders.concat(orders);

    // Follow Link header pagination
    const linkHeader: string | null = response.headers.get("Link");
    url = null;
    if (linkHeader) {
      const nextMatch: RegExpMatchArray | null = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      if (nextMatch) {
        url = nextMatch[1];
      }
    }

    console.log(`[Shopify API] Fetched ${orders.length} orders (total: ${allOrders.length})`);
  }

  if (allOrders.length >= MAX_ORDERS) {
    console.warn(`[Shopify API] Hit max order limit (${MAX_ORDERS})`);
  }

  return allOrders;
}

// --- Shopify Sync with time budget, cursor, and parallel upserts ---

interface ShopifySyncOptions {
  nextUrl?: string;
  syncLogId?: string;
  timeBudgetMs?: number;
}

interface ShopifySyncResult {
  success?: boolean;
  error?: string;
  synced: number;
  hasMore: boolean;
  nextUrl?: string;
  syncLogId?: string;
}

function buildShopifyOrderUpsertArgs(organizationId: string, order: Record<string, unknown>) {
  const customer = order.customer as Record<string, unknown> | undefined;
  const customerName = customer
    ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || null
    : null;
  const lineItems = order.line_items as unknown[] | undefined;
  return {
    where: {
      organizationId_platform_externalOrderId: {
        organizationId,
        platform: "SHOPIFY" as const,
        externalOrderId: String(order.id),
      },
    },
    create: {
      organizationId,
      platform: "SHOPIFY" as const,
      externalOrderId: String(order.id),
      status: mapShopifyStatus(String(order.financial_status || "")),
      customerName,
      customerEmail: (customer?.email as string) || null,
      totalAmount: parseFloat(String(order.current_total_price || order.total_price || "0")),
      currency: (order.currency as string) || "BRL",
      itemCount: lineItems?.length || 0,
      orderDate: parseShopifyLocalDate(String(order.created_at)),
      rawData: order as Prisma.InputJsonValue,
    },
    update: {
      status: mapShopifyStatus(String(order.financial_status || "")),
      totalAmount: parseFloat(String(order.current_total_price || order.total_price || "0")),
      customerName,
      customerEmail: (customer?.email as string) || null,
      itemCount: lineItems?.length || 0,
      orderDate: parseShopifyLocalDate(String(order.created_at)),
      rawData: order as Prisma.InputJsonValue,
    },
  };
}

async function upsertShopifyOrdersParallel(
  organizationId: string,
  orders: Record<string, unknown>[],
  concurrency = 5
): Promise<number> {
  let saved = 0;
  for (let i = 0; i < orders.length; i += concurrency) {
    const batch = orders.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map((order) =>
        prisma.order.upsert(buildShopifyOrderUpsertArgs(organizationId, order))
      )
    );
    saved += results.filter((r) => r.status === "fulfilled").length;
  }
  return saved;
}

export async function syncShopifyOrders(
  organizationId: string,
  options: ShopifySyncOptions = {}
): Promise<ShopifySyncResult> {
  const { timeBudgetMs = 50000 } = options;
  const startTime = Date.now();

  const integration = await prisma.integration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "SHOPIFY" } },
  });

  if (!integration || integration.status !== "CONNECTED") {
    return { error: "Shopify not connected", synced: 0, hasMore: false };
  }

  if (!integration.accessToken) {
    return { error: "Access token not found", synced: 0, hasMore: false };
  }

  const accessToken = decrypt(integration.accessToken);
  const shop = integration.externalStoreId || "";

  // Determine starting URL: explicit option > saved cursor > fresh start
  let currentUrl: string | null = options.nextUrl || null;
  const meta = (integration.metadata as Record<string, unknown>) || {};

  if (!currentUrl && !options.syncLogId) {
    const cursor = meta.syncCursor as { nextUrl?: string; syncLogId?: string } | undefined;
    if (cursor?.nextUrl) {
      currentUrl = cursor.nextUrl;
      options.syncLogId = cursor.syncLogId;
      console.log("[Shopify Sync] Resuming from saved cursor");
    }
  }

  if (!currentUrl) {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    currentUrl = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&limit=250&created_at_min=${ninetyDaysAgo.toISOString()}`;
  }

  // First call: set SYNCING + create SyncLog
  const isFirstCall = !options.syncLogId;
  let logId = options.syncLogId || "";

  if (isFirstCall) {
    await prisma.integration.update({
      where: { id: integration.id },
      data: { syncStatus: "SYNCING", errorMessage: null },
    });
    const syncLog = await prisma.syncLog.create({
      data: { organizationId, platform: "SHOPIFY", status: "SYNCING" },
    });
    logId = syncLog.id;
  }

  let totalSyncedThisCall = 0;

  // FRESHNESS CHECK: Always fetch last 2 days of orders first
  // This ensures "Today" on dashboard is updated even if we are backfilling 90 days of history
  try {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const freshnessUrl = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&limit=50&created_at_min=${twoDaysAgo.toISOString()}`;

    console.log("[Shopify Sync] Performing freshness check (last 2 days)...");
    const fRes = await fetch(freshnessUrl, {
      headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000), // Short timeout for freshness
    });
    if (fRes.ok) {
      const fData = await fRes.json();
      if (fData.orders?.length > 0) {
        const saved = await upsertShopifyOrdersParallel(organizationId, fData.orders);
        console.log(`[Shopify Sync] Freshness check saved ${saved} orders`);
      }
    }
  } catch (err) {
    console.warn("[Shopify Sync] Freshness check failed (non-fatal):", err);
  }

  try {
    while (currentUrl) {
      // Check time budget BEFORE fetching next page
      if (Date.now() - startTime > timeBudgetMs) {
        console.log(`[Shopify Sync] Time budget reached (${timeBudgetMs}ms), saving cursor`);
        await prisma.integration.update({
          where: { id: integration.id },
          data: {
            metadata: { ...meta, syncCursor: { nextUrl: currentUrl, syncLogId: logId } } as unknown as Record<string, string | number | boolean | null>,
          },
        });
        if (logId) {
          await prisma.syncLog.update({
            where: { id: logId },
            data: { recordsSynced: totalSyncedThisCall },
          }).catch(() => { });
        }
        return {
          success: true,
          synced: totalSyncedThisCall,
          hasMore: true,
          nextUrl: currentUrl,
          syncLogId: logId,
        };
      }

      // Fetch one page from Shopify API
      const response: Response = await fetch(currentUrl, {
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("[Shopify API] Orders fetch failed:", response.status, errorBody);

        if (response.status === 401) {
          await prisma.integration.update({
            where: { id: integration.id },
            data: { status: "DISCONNECTED", errorMessage: "Token expirado ou inválido. Reconecte a Shopify." },
          });
          throw new Error("Token Shopify expirado. Reconecte a integração.");
        }

        if (response.status === 429) {
          // Rate limited — save cursor and return for retry
          console.warn("[Shopify Sync] Rate limited (429), saving cursor for retry");
          await prisma.integration.update({
            where: { id: integration.id },
            data: {
              metadata: { ...meta, syncCursor: { nextUrl: currentUrl, syncLogId: logId } } as unknown as Record<string, string | number | boolean | null>,
            },
          });
          return {
            success: true,
            synced: totalSyncedThisCall,
            hasMore: true,
            nextUrl: currentUrl,
            syncLogId: logId,
          };
        }

        throw new Error(`Shopify API error: ${response.status}`);
      }

      const data = await response.json();
      const orders = data.orders || [];

      // Parallel upserts (5 concurrent)
      if (orders.length > 0) {
        const saved = await upsertShopifyOrdersParallel(organizationId, orders);
        totalSyncedThisCall += saved;
      }

      console.log(`[Shopify Sync] Page done: ${orders.length} fetched, ${totalSyncedThisCall} total saved`);

      // Follow Link header for next page
      const linkHeader: string | null = response.headers.get("Link");
      currentUrl = null;
      if (linkHeader) {
        const nextMatch: RegExpMatchArray | null = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        if (nextMatch) {
          currentUrl = nextMatch[1];
        }
      }
    }

    // All pages done — clear cursor, mark SUCCESS
    const { syncCursor: _, ...restMeta } = meta;
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        syncStatus: "SUCCESS",
        lastSyncAt: new Date(),
        metadata: restMeta as Record<string, string | number | boolean | null>,
        errorMessage: null,
      },
    });

    if (logId) {
      await prisma.syncLog.update({
        where: { id: logId },
        data: { status: "SUCCESS", recordsSynced: totalSyncedThisCall, completedAt: new Date() },
      }).catch(() => { });
    }

    return { success: true, synced: totalSyncedThisCall, hasMore: false, syncLogId: logId };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";

    // Save cursor on error if partial progress was made
    if (totalSyncedThisCall > 0 && currentUrl) {
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          syncStatus: "FAILED",
          errorMessage: errorMsg,
          metadata: { ...meta, syncCursor: { nextUrl: currentUrl, syncLogId: logId } } as unknown as Record<string, string | number | boolean | null>,
        },
      }).catch(() => { });
    } else {
      await prisma.integration.update({
        where: { id: integration.id },
        data: { syncStatus: "FAILED", errorMessage: errorMsg },
      }).catch(() => { });
    }

    if (logId) {
      await prisma.syncLog.update({
        where: { id: logId },
        data: { status: "FAILED", errorMessage: errorMsg, completedAt: new Date() },
      }).catch(() => { });
    }

    return { error: errorMsg, synced: totalSyncedThisCall, hasMore: false };
  }
}

export function mapShopifyStatus(status: string): string {
  const map: Record<string, string> = {
    paid: "paid",
    partially_paid: "paid",
    pending: "pending",
    refunded: "refunded",
    voided: "cancelled",
    partially_refunded: "partially_refunded",
    authorized: "pending",
  };
  return map[status] || status;
}

/**
 * Parse a Shopify timestamp preserving the correct UTC instant.
 * Shopify sends dates with timezone offset like "2026-02-08T22:00:00-03:00".
 * We store the exact UTC instant so queries using Brasilia-aware date ranges
 * (from date-utils.ts) correctly match orders to their Brasilia calendar day.
 */
export function parseShopifyLocalDate(createdAt: string): Date {
  return new Date(createdAt);
}

/**
 * Sync funnel metrics from Shopify.
 * Uses a multi-strategy approach to ALWAYS get data:
 *
 * Strategy 1: ShopifyQL `FROM sessions` dataset (exact Shopify Analytics funnel data)
 *   - Requires API 2025-10 + read_reports scope + Level 2 data access
 *   - Returns: sessions, sessions_with_cart_additions, sessions_that_reached_checkout, etc.
 *
 * Strategy 2: ShopifyQL `FROM sales` + REST abandoned checkouts API (fallback)
 *   - `FROM sales` gives session count from sales data
 *   - Abandoned checkouts API gives partial checkout data
 *   - Combined with order count gives a usable approximation
 *
 * NEVER returns empty - always writes the best available data to StoreFunnel.
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

    // Get orders by date from our database (with customer emails for repurchase rate)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const [orders, allHistoricalOrders] = await Promise.all([
      prisma.order.findMany({
        where: {
          organizationId,
          platform: "SHOPIFY",
          orderDate: { gte: ninetyDaysAgo },
        },
        select: { orderDate: true, customerEmail: true },
      }),
      // All historical orders for first-order date map
      prisma.order.findMany({
        where: { organizationId, platform: "SHOPIFY", customerEmail: { not: null } },
        select: { customerEmail: true, orderDate: true },
        orderBy: { orderDate: "asc" },
      }),
    ]);

    const ordersByDate: Record<string, number> = {};
    for (const o of orders) {
      const key = toDateKeyBrasilia(o.orderDate);
      ordersByDate[key] = (ordersByDate[key] || 0) + 1;
    }

    // Fetch customer metrics from Shopify ShopifyQL (exact data, same as Shopify Analytics)
    // Falls back to local calculation if ShopifyQL fails
    let customerMetricsByDay: Record<string, { total: number; returning: number }> = {};

    const shopifyCustomerMetrics = await fetchShopifyCustomerMetrics(shop, accessToken);
    if (Object.keys(shopifyCustomerMetrics).length > 0) {
      customerMetricsByDay = shopifyCustomerMetrics;
      console.log("[Shopify Funnel] Using ShopifyQL customer metrics (exact Shopify data)");
    } else {
      // Fallback: calculate from local order data
      console.warn("[Shopify Funnel] ShopifyQL customer metrics unavailable, using local calculation");
      const firstOrderByCustomer = new Map<string, Date>();
      for (const o of allHistoricalOrders) {
        const email = o.customerEmail!.toLowerCase();
        if (!firstOrderByCustomer.has(email)) {
          firstOrderByCustomer.set(email, o.orderDate);
        }
      }

      const customersByDay = new Map<string, Set<string>>();
      for (const o of orders) {
        if (!o.customerEmail) continue;
        const dayKey = toDateKeyBrasilia(o.orderDate);
        const email = o.customerEmail.toLowerCase();
        if (!customersByDay.has(dayKey)) {
          customersByDay.set(dayKey, new Set());
        }
        customersByDay.get(dayKey)!.add(email);
      }

      for (const [dayKey, emails] of customersByDay) {
        const dayStart = new Date(dayKey);
        let total = 0;
        let returning = 0;
        for (const email of emails) {
          total++;
          const firstOrder = firstOrderByCustomer.get(email);
          if (firstOrder && firstOrder < dayStart) {
            returning++;
          }
        }
        customerMetricsByDay[dayKey] = { total, returning };
      }
    }

    // Check if customer metric columns exist (migration may not be applied yet)
    let hasCustomerColumns = true;
    try {
      await prisma.storeFunnel.findFirst({
        where: { organizationId },
        select: { totalCustomers: true, returningCustomers: true },
      });
    } catch {
      hasCustomerColumns = false;
      console.warn("[Shopify Funnel] Customer columns not yet available, skipping customer metrics");
    }

    // Strategy 1: Try ShopifyQL FROM sessions (exact analytics data)
    const sessionsFunnel = await fetchShopifySessionsFunnel(shop, accessToken);

    if (sessionsFunnel && Object.keys(sessionsFunnel).length > 0) {
      console.log("[Shopify Funnel] Strategy 1 SUCCESS: FROM sessions dataset");
      let synced = 0;
      for (const [dateKey, metrics] of Object.entries(sessionsFunnel)) {
        const dayOrders = metrics.ordersCompleted > 0
          ? metrics.ordersCompleted
          : (ordersByDate[dateKey] || 0);

        const custMetrics = customerMetricsByDay[dateKey] || { total: 0, returning: 0 };
        const customerFields = hasCustomerColumns
          ? { totalCustomers: custMetrics.total, returningCustomers: custMetrics.returning }
          : {};
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
            ...customerFields,
          },
          update: {
            sessions: metrics.sessions,
            addToCart: metrics.addToCart,
            checkoutsInitiated: metrics.checkoutsStarted,
            ordersGenerated: dayOrders,
            ...customerFields,
          },
        });
        synced++;
      }
      return { success: true, synced };
    }

    // Strategy 2: Fallback - FROM sales (sessions) + abandoned checkouts REST API
    console.warn("[Shopify Funnel] Strategy 1 failed, using Strategy 2 (sales + abandoned checkouts)");

    const salesSessions = await fetchSalesSessionData(shop, accessToken);
    const abandonedByDate = await fetchAbandonedCheckoutsByDate(shop, accessToken, ninetyDaysAgo);
    const hasSalesSessionData = Object.keys(salesSessions).length > 0;

    // Merge all dates
    const allDates = new Set([
      ...Object.keys(salesSessions),
      ...Object.keys(abandonedByDate),
      ...Object.keys(ordersByDate),
    ]);

    let synced = 0;
    for (const dateKey of allDates) {
      const sessions = salesSessions[dateKey] || 0;
      const dayOrders = ordersByDate[dateKey] || 0;

      const custMetrics = customerMetricsByDay[dateKey] || { total: 0, returning: 0 };
      const customerFields = hasCustomerColumns
        ? { totalCustomers: custMetrics.total, returningCustomers: custMetrics.returning }
        : {};

      // Strategy 2 only updates ordersGenerated and sessions (if available).
      // NEVER overwrite addToCart or checkoutsInitiated - those fields are only
      // accurate from Strategy 1 (ShopifyQL FROM sessions). Strategy 2 doesn't
      // have real cart/checkout session data.
      const updateData: Record<string, number> = {
        ordersGenerated: dayOrders,
        ...(hasCustomerColumns ? { totalCustomers: custMetrics.total, returningCustomers: custMetrics.returning } : {}),
      };
      if (hasSalesSessionData && sessions > 0) {
        updateData.sessions = sessions;
      }

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
          sessions,
          addToCart: 0,
          checkoutsInitiated: 0,
          ordersGenerated: dayOrders,
          ...customerFields,
        },
        update: updateData,
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
 * Execute a ShopifyQL query via GraphQL Admin API.
 * Tries multiple API versions for compatibility.
 */
async function executeShopifyQLQuery(
  shop: string,
  accessToken: string,
  query: string,
  apiVersion: string = SHOPIFY_GRAPHQL_VERSION
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
    `https://${shop}/admin/api/${apiVersion}/graphql.json`,
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
    console.warn(`[Shopify ShopifyQL] API ${apiVersion} request failed: ${response.status}`);
    return null;
  }

  const data = await response.json();
  const queryResult = data?.data?.shopifyqlQuery;

  if (queryResult?.parseErrors?.length > 0) {
    console.warn("[Shopify ShopifyQL] Parse errors:", JSON.stringify(queryResult.parseErrors));
    return null;
  }

  const table = queryResult?.tableData;
  if (!table?.columns || !table?.rows || table.rows.length === 0) {
    console.warn("[Shopify ShopifyQL] No table data returned");
    return null;
  }

  return table;
}

/**
 * Strategy 1: Fetch full conversion funnel from ShopifyQL `sessions` dataset.
 * This is the exact same data shown in Shopify Admin > Analytics > Conversion rate breakdown.
 * Tries API version 2025-10 first (required for sessions dataset), then 2025-01.
 */
async function fetchShopifySessionsFunnel(
  shop: string,
  accessToken: string
): Promise<Record<string, DailyFunnelMetrics> | null> {
  const queries = [
    // Full funnel data (matches Shopify Analytics exactly)
    `FROM sessions SHOW sessions, sessions_with_cart_additions, sessions_that_reached_checkout, sessions_that_completed_checkout, conversion_rate WHERE human_or_bot_session IN ('human', 'bot') TIMESERIES day SINCE -90d UNTIL today ORDER BY day ASC LIMIT 1000`,
    // Without WHERE filter as fallback
    `FROM sessions SHOW sessions, sessions_with_cart_additions, sessions_that_reached_checkout, sessions_that_completed_checkout TIMESERIES day SINCE -90d UNTIL today ORDER BY day ASC`,
    // Sessions only fallback
    `FROM sessions SHOW sessions TIMESERIES day SINCE -90d UNTIL today ORDER BY day ASC`,
  ];

  const versions = [SHOPIFY_GRAPHQL_VERSION, SHOPIFY_API_VERSION];

  for (const version of versions) {
    for (const query of queries) {
      try {
        console.log(`[Shopify Funnel] Trying FROM sessions with API ${version}...`);
        const table = await executeShopifyQLQuery(shop, accessToken, query, version);
        if (!table) continue;

        const result = parseSessionsFunnelTable(table);
        if (Object.keys(result).length > 0) {
          console.log(`[Shopify Funnel] FROM sessions succeeded with API ${version}: ${Object.keys(result).length} days`);
          return result;
        }
      } catch (error) {
        console.warn(`[Shopify Funnel] FROM sessions query failed (API ${version}):`, error);
      }
    }
  }

  console.warn("[Shopify Funnel] All FROM sessions queries failed");
  return null;
}

/**
 * Parse ShopifyQL `sessions` table data into daily funnel metrics.
 */
function parseSessionsFunnelTable(
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
    console.warn("[Shopify Funnel] Missing required columns. Found:", table.columns.map((c) => c.name));
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

/**
 * Strategy 2 helper: Fetch session counts from ShopifyQL `sales` dataset.
 * This is less accurate than `sessions` dataset but always works.
 * Uses API version 2025-01 which is widely supported.
 */
async function fetchSalesSessionData(
  shop: string,
  accessToken: string
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};

  const queries = [
    `FROM sales SHOW sessions GROUP BY day SINCE -90d UNTIL today ORDER BY day ASC`,
    `FROM sales SHOW sessions GROUP BY day SINCE -90d`,
  ];

  for (const query of queries) {
    try {
      const table = await executeShopifyQLQuery(shop, accessToken, query, SHOPIFY_API_VERSION);
      if (!table) continue;

      const dayIdx = table.columns.findIndex((c) =>
        c.name === "day" || c.name === "date" || c.dataType === "date"
      );
      const sessionsIdx = table.columns.findIndex((c) => c.name === "sessions");

      if (dayIdx === -1 || sessionsIdx === -1) continue;

      for (const row of table.rows) {
        const dateKey = String(row[dayIdx]).split("T")[0];
        const sessions = parseInt(String(row[sessionsIdx])) || 0;
        if (dateKey && dateKey !== "undefined" && sessions > 0) {
          result[dateKey] = sessions;
        }
      }

      if (Object.keys(result).length > 0) {
        console.log(`[Shopify Funnel] FROM sales sessions: ${Object.keys(result).length} days`);
        return result;
      }
    } catch (error) {
      console.warn("[Shopify Funnel] FROM sales query failed:", error);
    }
  }

  return result;
}

/**
 * Fetch returning_customers and customers per day from ShopifyQL `FROM sales`.
 * This matches exactly what Shopify shows in Analytics > Reports > Returning customer rate.
 * Returns per-day data: { "2026-02-02": { total: 8, returning: 3 }, ... }
 */
async function fetchShopifyCustomerMetrics(
  shop: string,
  accessToken: string
): Promise<Record<string, { total: number; returning: number }>> {
  const result: Record<string, { total: number; returning: number }> = {};

  const queries = [
    `FROM sales SHOW returning_customers, customers TIMESERIES day SINCE -90d UNTIL today ORDER BY day ASC LIMIT 1000`,
    `FROM sales SHOW returning_customers, customers GROUP BY day SINCE -90d UNTIL today ORDER BY day ASC`,
  ];

  const versions = [SHOPIFY_GRAPHQL_VERSION, SHOPIFY_API_VERSION];

  for (const version of versions) {
    for (const query of queries) {
      try {
        console.log(`[Shopify Funnel] Fetching customer metrics (API ${version})...`);
        const table = await executeShopifyQLQuery(shop, accessToken, query, version);
        if (!table) continue;

        const dayIdx = table.columns.findIndex((c) =>
          c.name === "day" || c.name === "date" || c.dataType === "date"
        );
        const returningIdx = table.columns.findIndex((c) => c.name === "returning_customers");
        const customersIdx = table.columns.findIndex((c) => c.name === "customers");

        if (dayIdx === -1 || customersIdx === -1) continue;

        for (const row of table.rows) {
          const dateKey = String(row[dayIdx]).split("T")[0];
          const customers = parseInt(String(row[customersIdx])) || 0;
          const returning = returningIdx !== -1 ? (parseInt(String(row[returningIdx])) || 0) : 0;

          if (dateKey && dateKey !== "undefined" && customers > 0) {
            result[dateKey] = { total: customers, returning };
          }
        }

        if (Object.keys(result).length > 0) {
          console.log(`[Shopify Funnel] Customer metrics from ShopifyQL: ${Object.keys(result).length} days`);
          return result;
        }
      } catch (error) {
        console.warn(`[Shopify Funnel] Customer metrics query failed (API ${version}):`, error);
      }
    }
  }

  console.warn("[Shopify Funnel] All customer metrics queries failed, will use local calculation");
  return result;
}

/**
 * Strategy 2 helper: Fetch abandoned checkouts via Shopify REST API.
 * Returns count of abandoned checkouts by date.
 */
async function fetchAbandonedCheckoutsByDate(
  shop: string,
  accessToken: string,
  since: Date
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};

  try {
    const sinceISO = since.toISOString();
    const url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/checkouts.json?created_at_min=${sinceISO}&limit=250`;

    const response = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.warn("[Shopify] Abandoned checkouts fetch failed:", response.status);
      return result;
    }

    const data = await response.json();
    const checkouts = data.checkouts || [];

    for (const checkout of checkouts) {
      const dateKey = new Date(checkout.created_at).toISOString().split("T")[0];
      result[dateKey] = (result[dateKey] || 0) + 1;
    }

    console.log(`[Shopify Funnel] Abandoned checkouts: ${Object.values(result).reduce((a: number, b: number) => a + b, 0)} total`);
  } catch (error) {
    console.warn("[Shopify] Abandoned checkouts failed:", error);
  }

  return result;
}

/**
 * Fetch products from Shopify.
 * Note: Shopify Order API does not directly give "best sellers".
 * We would typically need to query Analytics API or calculate from Orders.
 * For this implementation, we will fetch products and rely on the client to sort if needed,
 * OR use a collection that contains "best sellers" if available.
 * 
 * Better approach for "Best Sellers": Fetch all products and simple details, 
 * simulating "best selling" by sort order if the API supports it, or just returning recent products.
 * 
 * Shopify Admin API (REST) /admin/api/2025-01/products.json
 */
/** Shopify product shape (fields used in the codebase) */
export interface ShopifyProduct {
  id: number | string;
  title: string;
  vendor?: string;
  brand?: string;
  status?: string;
  image?: { src: string } | null;
  images?: Array<{ src: string }>;
  variants?: Array<{ price: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

/** Shopify collection shape (fields used in the codebase) */
export interface ShopifyCollection {
  id: number | string;
  title: string;
  handle?: string;
  [key: string]: unknown;
}

export async function fetchShopifyProducts(
  integrationId: string,
  collectionId?: string
): Promise<ShopifyProduct[]> {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration || !integration.accessToken || !integration.externalStoreId) {
    throw new Error("Shopify integration not found or invalid");
  }

  const accessToken = decrypt(integration.accessToken);
  const shop = integration.externalStoreId;

  // If collectionId is provided, we fetch products from that collection
  // Otherwise fetch all products
  // REMOVED status=active to fetch ALL products (draft, archived, etc) for debugging
  let url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/products.json?limit=50`;

  if (collectionId && collectionId !== 'all') {
    url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/collections/${collectionId}/products.json?limit=50`;
  }

  console.log(`[Shopify API] Fetching products from: ${url}`);

  const response = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    next: { revalidate: 60 } // Reduced cache time for debugging
  });

  if (!response.ok) {
    console.error("[Shopify API] Products fetch failed:", response.status);
    throw new Error(`Failed to fetch products from Shopify: ${response.status}`);
  }

  const data = await response.json();
  return data.products || [];
}

/**
 * Fetch smart and custom collections from Shopify
 */
export async function fetchShopifyCollections(integrationId: string): Promise<ShopifyCollection[]> {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration || !integration.accessToken || !integration.externalStoreId) {
    throw new Error("Shopify integration not found or invalid");
  }

  const accessToken = decrypt(integration.accessToken);
  const shop = integration.externalStoreId;

  // Fetch both smart (automated) and custom (manual) collections
  const [smartRes, customRes] = await Promise.all([
    fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/smart_collections.json?limit=100`, {
      headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
      next: { revalidate: 3600 }
    }),
    fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/custom_collections.json?limit=100`, {
      headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
      next: { revalidate: 3600 }
    })
  ]);

  let collections: ShopifyCollection[] = [];

  if (smartRes.ok) {
    const data = await smartRes.json();
    collections = [...collections, ...(data.smart_collections || [])];
  }

  if (customRes.ok) {
    const data = await customRes.json();
    collections = [...collections, ...(data.custom_collections || [])];
  }

  return collections;
}

/**
 * Busca o documento (CPF/CNPJ) de pedidos direto na Shopify.
 *
 * Existe porque a API REST usada no sync NÃO devolve esse dado: em loja
 * brasileira o CPF fica em `localizationExtensions`, que só aparece no GraphQL.
 * Sem ele a etiqueta não pode ser emitida.
 *
 * Recebe e devolve IDs numéricos (os mesmos guardados em `Order.externalOrderId`).
 */
export async function fetchShopifyOrderDocuments(
  organizationId: string,
  externalOrderIds: string[]
): Promise<Map<string, string>> {
  const encontrados = new Map<string, string>();
  if (externalOrderIds.length === 0) return encontrados;

  const integration = await prisma.integration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "SHOPIFY" } },
  });

  if (!integration?.accessToken || !integration.externalStoreId) return encontrados;

  const accessToken = decrypt(integration.accessToken);
  const shop = integration.externalStoreId;

  // a Shopify limita o lote de nós por consulta; 20 é folgado e seguro
  const lotes: string[][] = [];
  for (let i = 0; i < externalOrderIds.length; i += 20) {
    lotes.push(externalOrderIds.slice(i, i + 20));
  }

  for (const lote of lotes) {
    const gids = lote.map((id) => `gid://shopify/Order/${id}`);
    const query = `
      query($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Order {
            id
            localizationExtensions(first: 5) {
              nodes { purpose value }
            }
          }
        }
      }`;

    try {
      const resposta = await fetch(
        `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
        {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query, variables: { ids: gids } }),
          cache: "no-store",
        }
      );

      if (!resposta.ok) {
        console.warn("[shopify] falha ao buscar documentos:", resposta.status);
        continue;
      }

      const dados = await resposta.json();
      const nos = dados?.data?.nodes;
      if (!Array.isArray(nos)) continue;

      for (const no of nos) {
        if (!no?.id) continue;
        const numero = String(no.id).split("/").pop() ?? "";
        const extensoes = no.localizationExtensions?.nodes ?? [];
        const doc = extensoes.find(
          (e: { purpose?: string; value?: string }) =>
            e?.value && /tax/i.test(String(e.purpose ?? ""))
        );
        const valor = (doc?.value ?? extensoes[0]?.value ?? "").replace(/\D/g, "");
        if (numero && valor) encontrados.set(numero, valor);
      }
    } catch (e) {
      console.warn("[shopify] erro ao buscar documentos", e);
    }
  }

  return encontrados;
}
