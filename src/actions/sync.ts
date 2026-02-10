"use server";

import { getSessionWithOrg } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { syncAllPlatforms } from "@/lib/integrations/sync";
import { syncShopifyOrders } from "@/lib/integrations/shopify";
import { syncCartpandaOrders } from "@/lib/integrations/cartpanda";
import { syncYampiOrders } from "@/lib/integrations/yampi";
import { syncNuvemshopOrders } from "@/lib/integrations/nuvemshop";
import { syncFacebookAdsMetrics } from "@/lib/integrations/facebook-ads";
import { syncGoogleAdsMetrics } from "@/lib/integrations/google-ads";
import { syncGoogleAnalyticsMetrics } from "@/lib/integrations/google-analytics";
import { syncReportanaMetrics } from "@/lib/integrations/reportana";

export async function syncAll() {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { error: "Not authenticated" };

  const results = await syncAllPlatforms(ctx.organization.id);
  return { results };
}

export async function syncPlatform(platform: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { error: "Not authenticated" };

  const orgId = ctx.organization.id;

  switch (platform) {
    case "SHOPIFY":
      return syncShopifyOrders(orgId);
    case "CARTPANDA":
      return syncCartpandaOrders(orgId);
    case "YAMPI":
      return syncYampiOrders(orgId);
    case "NUVEMSHOP":
      return syncNuvemshopOrders(orgId);
    case "FACEBOOK_ADS":
      return syncFacebookAdsMetrics(orgId);
    case "GOOGLE_ADS":
      return syncGoogleAdsMetrics(orgId);
    case "GOOGLE_ANALYTICS":
      return syncGoogleAnalyticsMetrics(orgId);
    case "REPORTANA":
      return syncReportanaMetrics(orgId);
    default:
      return { error: `Unknown platform: ${platform}` };
  }
}

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export async function smartSync(): Promise<{ triggered: boolean }> {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { triggered: false };

  const integrations = await prisma.integration.findMany({
    where: { organizationId: ctx.organization.id, status: "CONNECTED" },
    select: { lastSyncAt: true, syncStatus: true },
  });

  if (integrations.length === 0) return { triggered: false };
  if (integrations.some((i) => i.syncStatus === "SYNCING")) return { triggered: false };

  const now = Date.now();
  const hasStale = integrations.some(
    (i) => !i.lastSyncAt || now - i.lastSyncAt.getTime() > STALE_THRESHOLD_MS
  );
  if (!hasStale) return { triggered: false };

  syncAllPlatforms(ctx.organization.id).catch((error) => {
    console.error("[smartSync] Background sync failed:", error);
  });

  return { triggered: true };
}
