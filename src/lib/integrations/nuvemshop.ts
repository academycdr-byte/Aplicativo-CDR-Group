import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";
import { parseOrderDate, toDateKeyBrasilia } from "@/lib/date-utils";

export async function syncNuvemshopOrders(organizationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "NUVEMSHOP" } },
  });

  if (!integration || integration.status !== "CONNECTED" || !integration.accessToken) {
    return { error: "Nuvemshop not connected" };
  }

  try {
    const accessToken = decrypt(integration.accessToken);
    const storeId = integration.externalStoreId || "";

    // Incremental sync: only fetch new orders since last sync
    const hasLastSync = !!integration.lastSyncAt;
    let sinceParam = "";
    if (hasLastSync) {
      const since = new Date(integration.lastSyncAt!.getTime() - 60 * 60 * 1000);
      sinceParam = `&created_at_min=${since.toISOString()}`;
    }

    // Fetch ONLY 50 orders per call to fit within Vercel Hobby 10s timeout
    const url = `https://api.nuvemshop.com.br/v1/${storeId}/orders?per_page=50&page=1${sinceParam}`;
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
      // No orders but API works — mark success
      await prisma.integration.update({
        where: { id: integration.id },
        data: { syncStatus: "SUCCESS", lastSyncAt: new Date(), errorMessage: null },
      });
      return { success: true, synced: 0 };
    }

    // Build all upsert operations and run in ONE single transaction
    const operations = orders.map((order: Record<string, unknown>) => {
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
          customerName: customer?.name as string || null,
          customerEmail: customer?.email as string || null,
          totalAmount: parseFloat(String(order.total || "0")),
          currency: (order.currency as string) || "BRL",
          itemCount: products?.length || 0,
          orderDate: parseOrderDate(String(order.created_at)),
          rawData: { ...order, line_items: lineItems },
        },
        update: {
          status: mapNuvemshopStatus(String(order.payment_status || "")),
          totalAmount: parseFloat(String(order.total || "0")),
          customerName: customer?.name as string || null,
          customerEmail: customer?.email as string || null,
          itemCount: products?.length || 0,
          orderDate: parseOrderDate(String(order.created_at)),
          rawData: { ...order, line_items: lineItems },
        },
      });
    });

    // Single transaction: 1 API call to fetch + 1 DB transaction to write
    await prisma.$transaction(operations);

    // Mark success + update lastSyncAt
    await prisma.integration.update({
      where: { id: integration.id },
      data: { syncStatus: "SUCCESS", lastSyncAt: new Date(), errorMessage: null },
    });

    return { success: true, synced: orders.length };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";

    await prisma.integration.update({
      where: { id: integration.id },
      data: { syncStatus: "FAILED", errorMessage: errorMsg },
    }).catch(() => {});

    return { error: errorMsg };
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
