import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

export async function syncGoogleAdsMetrics(organizationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "GOOGLE_ADS" } },
  });

  if (!integration || integration.status !== "CONNECTED" || !integration.accessToken) {
    return { error: "Google Ads not connected" };
  }

  await prisma.integration.update({
    where: { id: integration.id },
    data: { syncStatus: "SYNCING" },
  });

  const syncLog = await prisma.syncLog.create({
    data: { organizationId, platform: "GOOGLE_ADS", status: "SYNCING" },
  });

  try {
    let accessToken = decrypt(integration.accessToken);

    // Refresh token if expired
    if (integration.tokenExpiresAt && integration.tokenExpiresAt < new Date()) {
      accessToken = await refreshGoogleToken(integration.id);
    }

    const customerId = integration.externalAccountId || "";
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "";

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since = thirtyDaysAgo.toISOString().split("T")[0];
    const until = new Date().toISOString().split("T")[0];

    const query = `
      SELECT
        campaign.id,
        campaign.name,
        ad_group.id,
        ad_group.name,
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM ad_group
      WHERE segments.date BETWEEN '${since}' AND '${until}'
      ORDER BY segments.date DESC
    `;

    const response = await fetch(
      `https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:searchStream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": developerToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      }
    );

    if (!response.ok) {
      throw new Error(`Google Ads API error: ${response.status}`);
    }

    const data = await response.json();
    const results = data[0]?.results || [];
    let synced = 0;

    for (const row of results) {
      await prisma.adMetric.upsert({
        where: {
          organizationId_platform_campaignId_date: {
            organizationId,
            platform: "GOOGLE_ADS",
            campaignId: row.campaign?.id || "unknown",
            date: new Date(row.segments?.date),
          },
        },
        create: {
          organizationId,
          platform: "GOOGLE_ADS",
          campaignId: row.campaign?.id,
          campaignName: row.campaign?.name,
          adSetId: row.adGroup?.id,
          adSetName: row.adGroup?.name,
          date: new Date(row.segments?.date),
          impressions: parseInt(row.metrics?.impressions || "0"),
          clicks: parseInt(row.metrics?.clicks || "0"),
          spend: (parseInt(row.metrics?.costMicros || "0") / 1000000),
          conversions: parseInt(row.metrics?.conversions || "0"),
          revenue: parseFloat(row.metrics?.conversionsValue || "0"),
          currency: "BRL",
          rawData: row,
        },
        update: {
          campaignName: row.campaign?.name,
          adSetName: row.adGroup?.name,
          impressions: parseInt(row.metrics?.impressions || "0"),
          clicks: parseInt(row.metrics?.clicks || "0"),
          spend: (parseInt(row.metrics?.costMicros || "0") / 1000000),
          conversions: parseInt(row.metrics?.conversions || "0"),
          revenue: parseFloat(row.metrics?.conversionsValue || "0"),
          rawData: row,
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

async function refreshGoogleToken(integrationId: string): Promise<string> {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration?.refreshToken) {
    throw new Error("No refresh token available");
  }

  const refreshToken = decrypt(integration.refreshToken);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET || "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh Google token");
  }

  const data = await response.json();
  const newAccessToken = data.access_token;

  await prisma.integration.update({
    where: { id: integrationId },
    data: {
      accessToken: encrypt(newAccessToken),
      tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });

  return newAccessToken;
}

export function getGoogleAuthUrl(state: string) {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const redirectUri = `${process.env.AUTH_URL}/api/integrations/google/callback`;
  const scopes = "https://www.googleapis.com/auth/adwords";

  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${state}`;
}

export async function exchangeGoogleToken(code: string) {
  const redirectUri = `${process.env.AUTH_URL}/api/integrations/google/callback`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET || "",
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to exchange Google token: ${response.status}`);
  }

  return response.json();
}
