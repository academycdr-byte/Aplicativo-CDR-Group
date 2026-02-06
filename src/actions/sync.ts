"use server";

import { getSessionWithOrg } from "@/lib/session";
import { syncAllPlatforms } from "@/lib/integrations/sync";
import { syncShopifyOrders } from "@/lib/integrations/shopify";
import { syncCartpandaOrders } from "@/lib/integrations/cartpanda";
import { syncYampiOrders } from "@/lib/integrations/yampi";
import { syncNuvemshopOrders } from "@/lib/integrations/nuvemshop";
import { syncFacebookAdsMetrics } from "@/lib/integrations/facebook-ads";
import { syncGoogleAdsMetrics } from "@/lib/integrations/google-ads";

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
    default:
      return { error: `Unknown platform: ${platform}` };
  }
}
