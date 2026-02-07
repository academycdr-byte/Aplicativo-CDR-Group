import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

const FB_GRAPH_VERSION = "v21.0";
const FB_REDIRECT_URI = "https://aplicativo-cdr-group.vercel.app/api/integrations/facebook/callback";

async function refreshFacebookToken(integrationId: string): Promise<string> {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration?.accessToken) {
    throw new Error("No access token available for refresh");
  }

  const currentToken = decrypt(integration.accessToken);
  const clientId = process.env.FACEBOOK_APP_ID?.trim();
  const clientSecret = process.env.FACEBOOK_APP_SECRET?.trim();

  const response = await fetch(
    `https://graph.facebook.com/${FB_GRAPH_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${currentToken}`
  );

  if (!response.ok) {
    throw new Error("Failed to refresh Facebook token");
  }

  const data = await response.json();
  const newAccessToken = data.access_token;

  await prisma.integration.update({
    where: { id: integrationId },
    data: {
      accessToken: encrypt(newAccessToken),
      tokenExpiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null,
    },
  });

  return newAccessToken;
}

/**
 * Busca thumbnails dos criativos dos anuncios.
 */
async function fetchAdThumbnails(
  adIds: string[],
  accessToken: string
): Promise<Record<string, string>> {
  const thumbnails: Record<string, string> = {};
  if (adIds.length === 0) return thumbnails;

  // Batch fetch (max 50 per request)
  const batches = [];
  for (let i = 0; i < adIds.length; i += 50) {
    batches.push(adIds.slice(i, i + 50));
  }

  for (const batch of batches) {
    const ids = batch.join(",");
    try {
      const response = await fetch(
        `https://graph.facebook.com/${FB_GRAPH_VERSION}/?ids=${ids}&fields=creative{thumbnail_url}&access_token=${accessToken}`
      );
      if (response.ok) {
        const data = await response.json();
        for (const [adId, adData] of Object.entries(data)) {
          const creative = (adData as { creative?: { thumbnail_url?: string } })?.creative;
          if (creative?.thumbnail_url) {
            thumbnails[adId] = creative.thumbnail_url;
          }
        }
      }
    } catch {
      // Continue without thumbnails if fetch fails
    }
  }

  return thumbnails;
}

export async function syncFacebookAdsMetrics(organizationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "FACEBOOK_ADS" } },
  });

  if (!integration || integration.status !== "CONNECTED" || !integration.accessToken) {
    return { error: "Facebook Ads not connected" };
  }

  await prisma.integration.update({
    where: { id: integration.id },
    data: { syncStatus: "SYNCING" },
  });

  const syncLog = await prisma.syncLog.create({
    data: { organizationId, platform: "FACEBOOK_ADS", status: "SYNCING" },
  });

  try {
    let accessToken = decrypt(integration.accessToken);

    // Refresh token if expired or about to expire (within 1 day)
    if (
      integration.tokenExpiresAt &&
      integration.tokenExpiresAt < new Date(Date.now() + 24 * 60 * 60 * 1000)
    ) {
      try {
        accessToken = await refreshFacebookToken(integration.id);
      } catch {
        // Continue with current token if refresh fails
      }
    }

    const adAccountId = integration.externalAccountId || "";

    // Fetch insights at AD level for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since = thirtyDaysAgo.toISOString().split("T")[0];
    const until = new Date().toISOString().split("T")[0];

    const fields = [
      "campaign_id", "campaign_name",
      "adset_id", "adset_name",
      "ad_id", "ad_name",
      "impressions", "reach", "clicks", "spend",
      "actions", "action_values",
      "cost_per_action_type",
    ].join(",");

    const timeRange = JSON.stringify({ since, until });
    const insightsUrl = `https://graph.facebook.com/${FB_GRAPH_VERSION}/act_${adAccountId}/insights?fields=${fields}&level=ad&time_range=${encodeURIComponent(timeRange)}&time_increment=1&limit=500&access_token=${accessToken}`;

    const response = await fetch(insightsUrl);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("[Facebook Ads] Insights fetch failed:", response.status, errorBody);
      throw new Error(`Facebook API error: ${response.status}`);
    }

    const data = await response.json();
    let allInsights = data.data || [];

    // Handle pagination
    let nextUrl = data.paging?.next;
    while (nextUrl) {
      const nextResponse = await fetch(nextUrl);
      if (!nextResponse.ok) break;
      const nextData = await nextResponse.json();
      allInsights = allInsights.concat(nextData.data || []);
      nextUrl = nextData.paging?.next;
    }

    // Fetch creative thumbnails for unique ad IDs
    const uniqueAdIds = [...new Set(allInsights.map((i: { ad_id: string }) => i.ad_id).filter(Boolean))] as string[];
    const thumbnails = await fetchAdThumbnails(uniqueAdIds, accessToken);

    let synced = 0;

    for (const insight of allInsights) {
      const purchases = insight.actions
        ?.find((a: { action_type: string }) =>
          a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase"
        );
      const purchaseValue = insight.action_values
        ?.find((a: { action_type: string }) =>
          a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase"
        );

      const conversions = parseInt(purchases?.value || "0");
      const revenue = parseFloat(purchaseValue?.value || "0");

      await prisma.adMetric.upsert({
        where: {
          organizationId_platform_campaignId_adId_date: {
            organizationId,
            platform: "FACEBOOK_ADS",
            campaignId: insight.campaign_id || "unknown",
            adId: insight.ad_id || "unknown",
            date: new Date(insight.date_start),
          },
        },
        create: {
          organizationId,
          platform: "FACEBOOK_ADS",
          campaignId: insight.campaign_id,
          campaignName: insight.campaign_name,
          adSetId: insight.adset_id,
          adSetName: insight.adset_name,
          adId: insight.ad_id,
          adName: insight.ad_name,
          thumbnailUrl: thumbnails[insight.ad_id] || null,
          date: new Date(insight.date_start),
          impressions: parseInt(insight.impressions || "0"),
          reach: parseInt(insight.reach || "0"),
          clicks: parseInt(insight.clicks || "0"),
          spend: parseFloat(insight.spend || "0"),
          conversions,
          revenue,
          currency: "BRL",
          rawData: insight,
        },
        update: {
          campaignName: insight.campaign_name,
          adSetName: insight.adset_name,
          adName: insight.ad_name,
          thumbnailUrl: thumbnails[insight.ad_id] || null,
          impressions: parseInt(insight.impressions || "0"),
          reach: parseInt(insight.reach || "0"),
          clicks: parseInt(insight.clicks || "0"),
          spend: parseFloat(insight.spend || "0"),
          conversions,
          revenue,
          rawData: insight,
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

export function getFacebookAuthUrl(state: string) {
  const clientId = process.env.FACEBOOK_APP_ID?.trim();
  if (!clientId) throw new Error("FACEBOOK_APP_ID nao configurado");

  const scopes = "ads_read,ads_management,read_insights,business_management";

  return `https://www.facebook.com/${FB_GRAPH_VERSION}/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(FB_REDIRECT_URI)}&scope=${scopes}&state=${state}`;
}

export async function exchangeFacebookToken(code: string) {
  const clientId = process.env.FACEBOOK_APP_ID?.trim();
  const clientSecret = process.env.FACEBOOK_APP_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error("FACEBOOK_APP_ID ou FACEBOOK_APP_SECRET nao configurado");
  }

  const response = await fetch(
    `https://graph.facebook.com/${FB_GRAPH_VERSION}/oauth/access_token?client_id=${clientId}&redirect_uri=${encodeURIComponent(FB_REDIRECT_URI)}&client_secret=${clientSecret}&code=${code}`
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[Facebook OAuth] Token exchange failed:", response.status, errorBody);
    throw new Error(`Failed to exchange Facebook token: ${response.status}`);
  }

  const data = await response.json();

  // Exchange for long-lived token (60 days)
  const longLivedResponse = await fetch(
    `https://graph.facebook.com/${FB_GRAPH_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${data.access_token}`
  );

  if (!longLivedResponse.ok) {
    return data; // Return short-lived if long-lived fails
  }

  return longLivedResponse.json();
}

export async function getFacebookAdAccounts(accessToken: string) {
  const response = await fetch(
    `https://graph.facebook.com/${FB_GRAPH_VERSION}/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch ad accounts: ${response.status}`);
  }

  const data = await response.json();
  return data.data || [];
}
