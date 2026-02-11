import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";
import { parseOrderDate, toDateKeyBrasilia } from "@/lib/date-utils";

// ─── TYPES ────────────────────────────────────────

interface SyncOptions {
  startPage?: number;
  syncLogId?: string;
  timeBudgetMs?: number;
}

export interface SyncResult {
  success: boolean;
  error?: string;
  synced: number;
  hasMore: boolean;
  nextPage?: number;
  syncLogId?: string;
}

interface SyncCursor {
  nextPage: number;
  syncLogId: string;
}

// ─── CURSOR HELPERS ───────────────────────────────

async function saveSyncCursor(integrationId: string, cursor: SyncCursor) {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
    select: { metadata: true },
  });
  const existing = (integration?.metadata as Record<string, string | number | boolean | null | object>) || {};
  const merged = { ...existing, syncCursor: { nextPage: cursor.nextPage, syncLogId: cursor.syncLogId } };
  await prisma.integration.update({
    where: { id: integrationId },
    data: { metadata: merged },
  });
}

async function clearSyncCursor(integrationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
    select: { metadata: true },
  });
  const existing = (integration?.metadata as Record<string, string | number | boolean | null | object>) || {};
  const { syncCursor: _, ...rest } = existing;
  await prisma.integration.update({
    where: { id: integrationId },
    data: { metadata: Object.keys(rest).length > 0 ? rest : Prisma.JsonNull },
  });
}

// ─── ORDER UPSERT BUILDER ─────────────────────────

function buildOrderUpsert(organizationId: string, order: Record<string, unknown>) {
  const customer = order.customer as Record<string, unknown> | null;
  const products = order.products as Array<Record<string, unknown>> | undefined;
  const lineItems = (products || []).map((p) => ({
    product_id: String(p.product_id ?? ""),
    variant_id: String(p.variant_id ?? ""),
    name: String(p.name ?? ""),
    quantity: Number(p.quantity ?? 0),
    price: String(p.price ?? "0"),
    sku: String(p.sku ?? ""),
  }));

  return prisma.order.upsert({
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
      status: mapNuvemshopStatus(String(order.payment_status || "")),
      customerName: (customer?.name as string) || null,
      customerEmail: (customer?.email as string) || null,
      totalAmount: parseFloat(String(order.total || "0")),
      currency: (order.currency as string) || "BRL",
      itemCount: products?.length || 0,
      orderDate: parseOrderDate(String(order.created_at)),
      rawData: { ...order, line_items: lineItems },
    },
    update: {
      status: mapNuvemshopStatus(String(order.payment_status || "")),
      totalAmount: parseFloat(String(order.total || "0")),
      customerName: (customer?.name as string) || null,
      customerEmail: (customer?.email as string) || null,
      itemCount: products?.length || 0,
      orderDate: parseOrderDate(String(order.created_at)),
      rawData: { ...order, line_items: lineItems },
    },
  });
}

// ─── MAIN SYNC FUNCTION ──────────────────────────

export async function syncNuvemshopOrders(
  organizationId: string,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const {
    startPage: optStartPage,
    syncLogId: optSyncLogId,
    timeBudgetMs = 50000,
  } = options;

  const startTime = Date.now();
  const PER_PAGE = 50;

  // 1. Load integration
  const integration = await prisma.integration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "NUVEMSHOP" } },
  });

  if (!integration || integration.status !== "CONNECTED" || !integration.accessToken) {
    return { success: false, error: "Nuvemshop not connected", synced: 0, hasMore: false };
  }

  // 2. Concurrency guard
  if (integration.syncStatus === "SYNCING" && !optSyncLogId) {
    const timeSinceUpdate = Date.now() - integration.updatedAt.getTime();
    if (timeSinceUpdate < 2 * 60 * 1000) {
      return { success: false, error: "Sync already in progress", synced: 0, hasMore: false };
    }
  }

  // 3. Auto-resume from saved cursor (if no explicit params)
  let currentPage = optStartPage || 1;
  let logId = optSyncLogId || "";

  if (!optStartPage && !optSyncLogId) {
    const savedCursor = (integration.metadata as Record<string, unknown>)?.syncCursor as SyncCursor | undefined;
    if (savedCursor?.nextPage && savedCursor?.syncLogId) {
      currentPage = savedCursor.nextPage;
      logId = savedCursor.syncLogId;
    }
  }

  // 4. First call of a sync session: set SYNCING + create SyncLog
  const isFirstCall = currentPage === 1 && !logId;
  if (isFirstCall) {
    await prisma.integration.update({
      where: { id: integration.id },
      data: { syncStatus: "SYNCING", errorMessage: null },
    });
    const log = await prisma.syncLog.create({
      data: { organizationId, platform: "NUVEMSHOP", status: "SYNCING", recordsSynced: 0 },
    });
    logId = log.id;
  } else if (logId) {
    // Continuation call: touch updatedAt to keep concurrency guard happy
    await prisma.integration.update({
      where: { id: integration.id },
      data: { syncStatus: "SYNCING" },
    });
  }

  try {
    const accessToken = decrypt(integration.accessToken);
    const storeId = integration.externalStoreId || "";

    // Incremental sync: only fetch new orders since last sync
    let sinceParam = "";
    if (integration.lastSyncAt) {
      const since = new Date(integration.lastSyncAt.getTime() - 60 * 60 * 1000);
      sinceParam = `&created_at_min=${since.toISOString()}`;
    }

    let totalSyncedThisCall = 0;
    let hasMore = true;

    while (hasMore) {
      // 5. Time budget check BEFORE fetching next page
      const elapsed = Date.now() - startTime;
      if (elapsed > timeBudgetMs) {
        // Save cursor for continuation
        if (logId) {
          await saveSyncCursor(integration.id, { nextPage: currentPage, syncLogId: logId });
          await prisma.syncLog.update({
            where: { id: logId },
            data: { recordsSynced: { increment: totalSyncedThisCall } },
          }).catch(() => {});
        }
        return {
          success: true,
          synced: totalSyncedThisCall,
          hasMore: true,
          nextPage: currentPage,
          syncLogId: logId || undefined,
        };
      }

      // 6. Fetch one page from Nuvemshop API
      const url = `https://api.nuvemshop.com.br/v1/${storeId}/orders?per_page=${PER_PAGE}&page=${currentPage}${sinceParam}`;
      const response = await fetch(url, {
        headers: {
          Authentication: `bearer ${accessToken}`,
          "User-Agent": "CDR Group Hub (cdrgroup.com)",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Nuvemshop API error: ${response.status}`);
      }

      const orders = await response.json();
      if (!Array.isArray(orders) || orders.length === 0) {
        hasMore = false;
        break;
      }

      // 7. Save this page to DB IMMEDIATELY
      const operations = orders.map((order: Record<string, unknown>) =>
        buildOrderUpsert(organizationId, order)
      );
      await prisma.$transaction(operations);
      totalSyncedThisCall += orders.length;

      // Less than PER_PAGE means last page
      if (orders.length < PER_PAGE) {
        hasMore = false;
      } else {
        currentPage++;
      }
    }

    // 8. ALL PAGES COMPLETE — mark success
    await clearSyncCursor(integration.id).catch(() => {});

    await prisma.integration.update({
      where: { id: integration.id },
      data: { syncStatus: "SUCCESS", lastSyncAt: new Date(), errorMessage: null },
    });

    if (logId) {
      await prisma.syncLog.update({
        where: { id: logId },
        data: { status: "SUCCESS", recordsSynced: { increment: totalSyncedThisCall }, completedAt: new Date() },
      }).catch(() => {});
    }

    return { success: true, synced: totalSyncedThisCall, hasMore: false, syncLogId: logId || undefined };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";

    await clearSyncCursor(integration.id).catch(() => {});

    await prisma.integration.update({
      where: { id: integration.id },
      data: { syncStatus: "FAILED", errorMessage: errorMsg },
    }).catch(() => {});

    if (logId) {
      await prisma.syncLog.update({
        where: { id: logId },
        data: { status: "FAILED", errorMessage: errorMsg, completedAt: new Date() },
      }).catch(() => {});
    }

    return { success: false, error: errorMsg, synced: 0, hasMore: false };
  }
}

function mapNuvemshopStatus(status: string): string {
  const map: Record<string, string> = {
    paid: "paid",
    pending: "pending",
    authorized: "authorized",
    partially_paid: "partially_paid",
    partially_refunded: "partially_refunded",
    refunded: "refunded",
    voided: "cancelled",
    abandoned: "cancelled",
  };
  return map[status] || status;
}

/**
 * Sync funnel metrics from Nuvemshop using the abandoned checkout API.
 * Nuvemshop does not provide sessions or add-to-cart analytics via API.
 */
export async function syncNuvemshopFunnel(organizationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "NUVEMSHOP" } },
  });

  if (!integration || integration.status !== "CONNECTED" || !integration.accessToken) {
    return { error: "Nuvemshop not connected" };
  }

  try {
    const accessToken = decrypt(integration.accessToken);
    const storeId = integration.externalStoreId || "";

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 1. Fetch abandoned checkouts
    const abandonedByDate = await fetchNuvemshopAbandonedCheckouts(
      storeId,
      accessToken,
      thirtyDaysAgo
    );

    // 2. Get orders by date from our database (with emails for customer metrics)
    const [orders, allHistoricalOrders] = await Promise.all([
      prisma.order.findMany({
        where: {
          organizationId,
          platform: "NUVEMSHOP",
          orderDate: { gte: thirtyDaysAgo },
        },
        select: { orderDate: true, customerEmail: true },
      }),
      prisma.order.findMany({
        where: { organizationId, platform: "NUVEMSHOP", customerEmail: { not: null } },
        select: { customerEmail: true, orderDate: true },
        orderBy: { orderDate: "asc" },
      }),
    ]);

    const ordersByDate: Record<string, number> = {};
    for (const o of orders) {
      const key = toDateKeyBrasilia(o.orderDate);
      ordersByDate[key] = (ordersByDate[key] || 0) + 1;
    }

    // Build first-order-date map and per-day customer metrics
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

    const customerMetricsByDay: Record<string, { total: number; returning: number }> = {};
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

    // Check if customer metric columns exist (migration may not be applied yet)
    let hasCustomerColumns = true;
    try {
      await prisma.storeFunnel.findFirst({
        where: { organizationId },
        select: { totalCustomers: true, returningCustomers: true },
      });
    } catch {
      hasCustomerColumns = false;
    }

    // 3. Merge and upsert into StoreFunnel
    const allDates = new Set([
      ...Object.keys(abandonedByDate),
      ...Object.keys(ordersByDate),
    ]);

    let synced = 0;
    for (const dateKey of allDates) {
      const abandoned = abandonedByDate[dateKey] || 0;
      const dayOrders = ordersByDate[dateKey] || 0;
      const custMetrics = customerMetricsByDay[dateKey] || { total: 0, returning: 0 };
      const customerFields = hasCustomerColumns
        ? { totalCustomers: custMetrics.total, returningCustomers: custMetrics.returning }
        : {};

      await prisma.storeFunnel.upsert({
        where: {
          organizationId_platform_date: {
            organizationId,
            platform: "NUVEMSHOP",
            date: new Date(dateKey),
          },
        },
        create: {
          organizationId,
          platform: "NUVEMSHOP",
          date: new Date(dateKey),
          sessions: 0,
          addToCart: 0,
          checkoutsInitiated: abandoned + dayOrders,
          ordersGenerated: dayOrders,
          ...customerFields,
        },
        update: {
          checkoutsInitiated: abandoned + dayOrders,
          ordersGenerated: dayOrders,
          ...customerFields,
        },
      });
      synced++;
    }

    return { success: true, synced };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[Nuvemshop Funnel] Error:", errorMsg);
    return { error: errorMsg };
  }
}

async function fetchNuvemshopAbandonedCheckouts(
  storeId: string,
  accessToken: string,
  since: Date
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};

  try {
    const sinceISO = since.toISOString();
    // Limit to 2 pages max to avoid timeout
    const MAX_PAGES = 2;
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= MAX_PAGES) {
      const url = `https://api.nuvemshop.com.br/v1/${storeId}/checkouts?created_at_min=${sinceISO}&per_page=200&page=${page}`;

      const response = await fetch(url, {
        headers: {
          Authentication: `bearer ${accessToken}`,
          "User-Agent": "CDR Group Hub (cdrgroup.com)",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        break;
      }

      const checkouts = await response.json();

      if (!Array.isArray(checkouts) || checkouts.length === 0) {
        hasMore = false;
        break;
      }

      for (const checkout of checkouts) {
        const dateKey = toDateKeyBrasilia(new Date(checkout.created_at));
        result[dateKey] = (result[dateKey] || 0) + 1;
      }

      hasMore = checkouts.length === 200;
      page++;
    }
  } catch (error) {
    console.warn("[Nuvemshop] Abandoned checkouts failed:", error);
  }

  return result;
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

/**
 * Fetch products from Nuvemshop.
 * Supports filtering by category (collection).
 */
export async function fetchNuvemshopProducts(
  integrationId: string,
  collectionId?: string // This corresponds to 'category_id' in Nuvemshop
): Promise<any[]> {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration || !integration.accessToken || !integration.externalStoreId) {
    throw new Error("Nuvemshop integration not found or invalid");
  }

  const accessToken = decrypt(integration.accessToken);
  const storeId = integration.externalStoreId;

  let url = `https://api.nuvemshop.com.br/v1/${storeId}/products?per_page=50&published=true`;

  if (collectionId && collectionId !== 'all') {
    url += `&category_id=${collectionId}`;
  }

  // Nuvemshop allows sorting by 'total_sold_amount', 'created_at', etc.
  // For "Best Sellers", 'total_sold_amount' (desc) is ideal if available, 
  // but often 'sort_by=popular' or manual sorting is needed.
  // The API doc isn't explicit on "best seller" sort param for public API, 
  // checking standard params: sort_by=sell_count_desc?
  // We'll stick to default for now and sort if needed.

  const response = await fetch(url, {
    headers: {
      Authentication: `bearer ${accessToken}`,
      "User-Agent": "CDR Group Hub (cdrgroup.com)",
      "Content-Type": "application/json",
    },
    next: { revalidate: 300 }
  });

  if (!response.ok) {
    console.error("[Nuvemshop API] Products fetch failed:", response.status);
    throw new Error(`Failed to fetch products from Nuvemshop: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Fetch categories (collections) from Nuvemshop
 */
export async function fetchNuvemshopCollections(integrationId: string): Promise<any[]> {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration || !integration.accessToken || !integration.externalStoreId) {
    throw new Error("Nuvemshop integration not found or invalid");
  }

  const accessToken = decrypt(integration.accessToken);
  const storeId = integration.externalStoreId;

  const response = await fetch(`https://api.nuvemshop.com.br/v1/${storeId}/categories?per_page=100`, {
    headers: {
      Authentication: `bearer ${accessToken}`,
      "User-Agent": "CDR Group Hub (cdrgroup.com)",
      "Content-Type": "application/json",
    },
    next: { revalidate: 3600 }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch categories from Nuvemshop: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}
