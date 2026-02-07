import { syncShopifyOrders } from "./shopify";
import { syncCartpandaOrders } from "./cartpanda";
import { syncYampiOrders } from "./yampi";
import { syncNuvemshopOrders } from "./nuvemshop";
import { syncFacebookAdsMetrics } from "./facebook-ads";
import { syncGoogleAdsMetrics } from "./google-ads";
import { syncReportanaMetrics } from "./reportana";

type SyncResult = {
  platform: string;
  success: boolean;
  synced?: number;
  error?: string;
};

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

export async function syncAllPlatforms(organizationId: string): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  const syncTasks = [
    { platform: "SHOPIFY", fn: () => syncShopifyOrders(organizationId) },
    { platform: "CARTPANDA", fn: () => syncCartpandaOrders(organizationId) },
    { platform: "YAMPI", fn: () => syncYampiOrders(organizationId) },
    { platform: "NUVEMSHOP", fn: () => syncNuvemshopOrders(organizationId) },
    { platform: "FACEBOOK_ADS", fn: () => syncFacebookAdsMetrics(organizationId) },
    { platform: "GOOGLE_ADS", fn: () => syncGoogleAdsMetrics(organizationId) },
    { platform: "REPORTANA", fn: () => syncReportanaMetrics(organizationId) },
  ];

  const settled = await Promise.allSettled(
    syncTasks.map((t) => withRetry(t.fn))
  );

  for (let i = 0; i < syncTasks.length; i++) {
    const task = syncTasks[i];
    const result = settled[i];

    if (result.status === "fulfilled") {
      const value = result.value;
      if ("error" in value && value.error) {
        if (!value.error.includes("not connected")) {
          results.push({ platform: task.platform, success: false, error: value.error });
        }
      } else if ("success" in value) {
        results.push({
          platform: task.platform,
          success: true,
          synced: "synced" in value ? (value.synced as number) : 0,
        });
      }
    } else {
      results.push({
        platform: task.platform,
        success: false,
        error: result.reason?.message || "Unknown error",
      });
    }
  }

  return results;
}
