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

  const response = await fetch(
    `https://graph.facebook.com/${FB_GRAPH_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&fb_exchange_token=${currentToken}`
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

    // Fetch insights for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since = thirtyDaysAgo.toISOString().split("T")[0];
    const until = new Date().toISOString().split("T")[0];

    const insightsUrl = `https://graph.facebook.com/${FB_GRAPH_VERSION}/act_${adAccountId}/insights?fields=campaign_id,campaign_name,adset_id,adset_name,impressions,clicks,spend,actions,action_values&level=adset&time_range={"since":"${since}","until":"${until}"}&time_increment=1&access_token=${accessToken}`;

    const response = await fetch(insightsUrl);

    if (!response.ok) {
      throw new Error(`Facebook API error: ${response.status}`);
    }

    const data = await response.json();
    const insights = data.data || [];
    let synced = 0;

    for (const insight of insights) {
      const conversions = insight.actions
        ?.find((a: { action_type: string }) => a.action_type === "offsite_conversion.fb_pixel_purchase")
        ?.value || 0;
      const revenue = insight.action_values
        ?.find((a: { action_type: string }) => a.action_type === "offsite_conversion.fb_pixel_purchase")
        ?.value || 0;

      await prisma.adMetric.upsert({
        where: {
          organizationId_platform_campaignId_date: {
            organizationId,
            platform: "FACEBOOK_ADS",
            campaignId: insight.campaign_id || "unknown",
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
          date: new Date(insight.date_start),
          impressions: parseInt(insight.impressions || "0"),
          clicks: parseInt(insight.clicks || "0"),
          spend: parseFloat(insight.spend || "0"),
          conversions: parseInt(conversions),
          revenue: parseFloat(revenue),
          currency: "BRL",
          rawData: insight,
        },
        update: {
          campaignName: insight.campaign_name,
          adSetName: insight.adset_name,
          impressions: parseInt(insight.impressions || "0"),
          clicks: parseInt(insight.clicks || "0"),
          spend: parseFloat(insight.spend || "0"),
          conversions: parseInt(conversions),
          revenue: parseFloat(revenue),
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

  const scopes = "ads_read,ads_management,read_insights";

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
