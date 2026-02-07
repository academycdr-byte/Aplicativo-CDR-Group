import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

export async function syncNuvemshopOrders(organizationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "NUVEMSHOP" } },
  });

  if (!integration || integration.status !== "CONNECTED" || !integration.accessToken) {
    return { error: "Nuvemshop not connected" };
  }

  await prisma.integration.update({
    where: { id: integration.id },
    data: { syncStatus: "SYNCING" },
  });

  const syncLog = await prisma.syncLog.create({
    data: { organizationId, platform: "NUVEMSHOP", status: "SYNCING" },
  });

  try {
    const accessToken = decrypt(integration.accessToken);
    const storeId = integration.externalStoreId || "";

    const response = await fetch(
      `https://api.nuvemshop.com.br/v1/${storeId}/orders?per_page=200`,
      {
        headers: {
          Authentication: `bearer ${accessToken}`,
          "User-Agent": "CDR Group Hub (cdrgroup.com)",
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Nuvemshop API error: ${response.status}`);
    }

    const orders = await response.json();
    let synced = 0;

    for (const order of orders) {
      await prisma.order.upsert({
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
          status: mapNuvemshopStatus(order.payment_status),
          customerName: order.customer?.name || null,
          customerEmail: order.customer?.email || null,
          totalAmount: parseFloat(order.total || "0"),
          currency: order.currency || "BRL",
          itemCount: order.products?.length || 0,
          orderDate: new Date(order.created_at),
          rawData: order,
        },
        update: {
          status: mapNuvemshopStatus(order.payment_status),
          totalAmount: parseFloat(order.total || "0"),
          customerName: order.customer?.name || null,
          customerEmail: order.customer?.email || null,
          itemCount: order.products?.length || 0,
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

function mapNuvemshopStatus(status: string): string {
  const map: Record<string, string> = {
    paid: "paid",
    pending: "pending",
    refunded: "refunded",
    voided: "cancelled",
    authorized: "pending",
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

    // 2. Get orders by date from our database
    const orders = await prisma.order.findMany({
      where: {
        organizationId,
        platform: "NUVEMSHOP",
        orderDate: { gte: thirtyDaysAgo },
      },
      select: { orderDate: true },
    });

    const ordersByDate: Record<string, number> = {};
    for (const o of orders) {
      const key = o.orderDate.toISOString().split("T")[0];
      ordersByDate[key] = (ordersByDate[key] || 0) + 1;
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
        },
        update: {
          checkoutsInitiated: abandoned + dayOrders,
          ordersGenerated: dayOrders,
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
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `https://api.nuvemshop.com.br/v1/${storeId}/checkouts?created_at_min=${sinceISO}&per_page=200&page=${page}`;

      const response = await fetch(url, {
        headers: {
          Authentication: `bearer ${accessToken}`,
          "User-Agent": "CDR Group Hub (cdrgroup.com)",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.warn("[Nuvemshop] Abandoned checkouts fetch failed:", response.status);
        break;
      }

      const checkouts = await response.json();

      if (!Array.isArray(checkouts) || checkouts.length === 0) {
        hasMore = false;
        break;
      }

      for (const checkout of checkouts) {
        const dateKey = new Date(checkout.created_at).toISOString().split("T")[0];
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
