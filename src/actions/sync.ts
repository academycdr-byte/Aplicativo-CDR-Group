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

  const integrations = await prisma.integration.findMany({
    where: { organizationId: ctx.organization.id, status: "CONNECTED" },
    select: { platform: true },
  });

  const activePlatforms = integrations.map((i) => i.platform);

  const results = await syncAllPlatforms(ctx.organization.id, activePlatforms);
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

const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const STUCK_SYNCING_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes (reduced from 5)
const STUCK_WITH_CURSOR_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes for cursor-based syncs

export async function smartSync(): Promise<{ triggered: boolean }> {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { triggered: false };

  const integrations = await prisma.integration.findMany({
    where: { organizationId: ctx.organization.id, status: "CONNECTED" },
    select: { id: true, lastSyncAt: true, syncStatus: true, updatedAt: true, metadata: true, platform: true, status: true },
  });

  if (integrations.length === 0) return { triggered: false };

  const now = Date.now();

  // Recover from stuck SYNCING status (e.g. killed by Vercel timeout)
  // Two thresholds: short for normal syncs, longer for cursor-based (FB Ads multi-call)
  const stuckSyncing = integrations.filter((i) => {
    if (i.syncStatus !== "SYNCING") return false;
    const elapsed = now - i.updatedAt.getTime();
    const meta = i.metadata as Record<string, unknown> | null;
    const hasCursor = !!(meta?.fbSyncCursor || meta?.syncCursor);

    // Cursor-based syncs get a longer grace period, but NOT infinite
    if (hasCursor) return elapsed > STUCK_WITH_CURSOR_THRESHOLD_MS;
    return elapsed > STUCK_SYNCING_THRESHOLD_MS;
  });

  if (stuckSyncing.length > 0) {
    // Clear stuck cursors along with resetting status
    for (const integration of stuckSyncing) {
      const meta = (integration.metadata as Record<string, unknown>) || {};
      const { fbSyncCursor: _fb, syncCursor: _sc, ...cleanMeta } = meta;
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          syncStatus: "FAILED",
          errorMessage: "Sync timed out (recovered by smartSync)",
          metadata: cleanMeta as Record<string, string | number | boolean | null>,
        },
      });
    }
  }

  // Re-check after recovery: if still actively syncing (within threshold), skip
  const activelySyncing = integrations.some((i) => {
    if (i.syncStatus !== "SYNCING") return false;
    // Exclude ones we just recovered
    if (stuckSyncing.some((s) => s.id === i.id)) return false;
    return now - i.updatedAt.getTime() <= STUCK_SYNCING_THRESHOLD_MS;
  });
  if (activelySyncing) return { triggered: false };

  const hasStale = integrations.some(
    (i) => !i.lastSyncAt || now - i.lastSyncAt.getTime() > STALE_THRESHOLD_MS
  );
  if (!hasStale) return { triggered: false };

  const activePlatforms = integrations.map((i) => i.platform);

  syncAllPlatforms(ctx.organization.id, activePlatforms).catch((error) => {
    // eslint-disable-next-line no-undef
    console.error("[smartSync] Background sync failed:", error);
  });

  return { triggered: true };
}

export async function syncRecent() {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { error: "Not authenticated" };

  const orgId = ctx.organization.id;

  // Fetch all connected integrations to sync ALL platforms, not just FB+Shopify
  const integrations = await prisma.integration.findMany({
    where: { organizationId: orgId, status: "CONNECTED" },
    select: { platform: true },
  });

  const connectedPlatforms = new Set(integrations.map((i) => i.platform));
  const TIME_BUDGET = 20000;

  // Build sync tasks dynamically based on connected platforms
  const syncTasks: Promise<unknown>[] = [];

  if (connectedPlatforms.has("FACEBOOK_ADS")) {
    syncTasks.push(syncFacebookAdsMetrics(orgId, { freshnessOnly: true, timeBudgetMs: TIME_BUDGET }));
  }
  if (connectedPlatforms.has("SHOPIFY")) {
    syncTasks.push(syncShopifyOrders(orgId, { timeBudgetMs: TIME_BUDGET }));
  }
  if (connectedPlatforms.has("NUVEMSHOP")) {
    syncTasks.push(syncNuvemshopOrders(orgId));
  }
  if (connectedPlatforms.has("GOOGLE_ADS")) {
    syncTasks.push(syncGoogleAdsMetrics(orgId));
  }
  if (connectedPlatforms.has("GOOGLE_ANALYTICS")) {
    syncTasks.push(syncGoogleAnalyticsMetrics(orgId));
  }
  if (connectedPlatforms.has("CARTPANDA")) {
    syncTasks.push(syncCartpandaOrders(orgId));
  }
  if (connectedPlatforms.has("YAMPI")) {
    syncTasks.push(syncYampiOrders(orgId));
  }
  if (connectedPlatforms.has("REPORTANA")) {
    syncTasks.push(syncReportanaMetrics(orgId));
  }

  if (syncTasks.length === 0) {
    return { success: true, results: [] };
  }

  const results = await Promise.allSettled(syncTasks);

  return {
    success: true,
    results: results.map(r => r.status === "fulfilled" ? r.value : { error: r.reason }),
  };
}
