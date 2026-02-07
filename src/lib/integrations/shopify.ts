import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

const SHOPIFY_API_VERSION = "2025-01";

export async function fetchShopifyOrders(integrationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration || !integration.accessToken || !integration.externalStoreId) {
    throw new Error("Integration not found or missing credentials");
  }

  const accessToken = decrypt(integration.accessToken);
  const shop = integration.externalStoreId;

  const allOrders: Record<string, unknown>[] = [];
  let pageInfo: string | null = null;

  do {
    const url = pageInfo
      ? `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders.json?limit=250&page_info=${pageInfo}`
      : `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&limit=250`;

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
    allOrders.push(...(data.orders || []));

    // Extrair cursor de paginação do header Link
    pageInfo = getNextPageInfo(response.headers.get("link"));
  } while (pageInfo);

  return allOrders;
}

function getNextPageInfo(linkHeader: string | null): string | null {
  if (!linkHeader) return null;

  const nextMatch = linkHeader.match(/<[^>]*page_info=([^>&]*)[^>]*>;\s*rel="next"/);
  return nextMatch ? nextMatch[1] : null;
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
          status: mapShopifyStatus(order.financial_status as string),
          customerName: order.customer
            ? `${(order.customer as Record<string, string>).first_name || ""} ${(order.customer as Record<string, string>).last_name || ""}`.trim()
            : null,
          customerEmail: (order.customer as Record<string, string>)?.email || null,
          totalAmount: parseFloat((order.total_price as string) || "0"),
          currency: (order.currency as string) || "BRL",
          itemCount: (order.line_items as unknown[])?.length || 0,
          orderDate: new Date(order.created_at as string),
          rawData: order,
        },
        update: {
          status: mapShopifyStatus(order.financial_status as string),
          totalAmount: parseFloat((order.total_price as string) || "0"),
          customerName: order.customer
            ? `${(order.customer as Record<string, string>).first_name || ""} ${(order.customer as Record<string, string>).last_name || ""}`.trim()
            : null,
          customerEmail: (order.customer as Record<string, string>)?.email || null,
          itemCount: (order.line_items as unknown[])?.length || 0,
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

export function getShopifyAuthUrl(shop: string, state: string) {
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const redirectUri = `${process.env.AUTH_URL}/api/integrations/shopify/callback`;
  const scopes = "read_orders,read_products,read_customers";

  return `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
}

export async function exchangeShopifyToken(shop: string, code: string) {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to exchange Shopify token: ${response.status}`);
  }

  return response.json();
}
