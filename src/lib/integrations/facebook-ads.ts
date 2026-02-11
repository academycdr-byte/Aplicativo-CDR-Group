import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";
import { toBrasiliaDateStr } from "@/lib/date-utils";

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

/**
 * Busca URLs de videos dos criativos dos anuncios.
 * Retorna um mapa de adId -> videoUrl
 */
async function fetchAdVideoUrls(
  adIds: string[],
  accessToken: string
): Promise<Record<string, string>> {
  const videoUrls: Record<string, string> = {};
  if (adIds.length === 0) return videoUrls;

  // Batch fetch (reduced to 25 to avoid timeouts)
  const batches = [];
  for (let i = 0; i < adIds.length; i += 25) {
    batches.push(adIds.slice(i, i + 25));
  }

  for (const batch of batches) {
    const ids = batch.join(",");
    try {
      // Fetch creative with video_id - explicit nested fields
      const response = await fetch(
        `https://graph.facebook.com/${FB_GRAPH_VERSION}/?ids=${ids}&fields=creative{video_id,object_story_spec{video_data{video_id}}}&access_token=${accessToken}`
      );

      if (response.ok) {
        const data = await response.json();
        const videoIds: string[] = [];
        const adToVideoMap: Record<string, string> = {};

        for (const [adId, adData] of Object.entries(data)) {
          const creative = (adData as any)?.creative;
          if (!creative) continue;

          const videoId = creative.video_id || creative.object_story_spec?.video_data?.video_id;
          if (videoId) {
            videoIds.push(videoId);
            adToVideoMap[adId] = videoId;
          }
        }

        // Fetch video source URLs
        if (videoIds.length > 0) {
          const uniqueVideoIds = [...new Set(videoIds)];
          // Breaking down video fetch into smaller chunks too if needed, but usually IDs are fewer
          const videoResponse = await fetch(
            `https://graph.facebook.com/${FB_GRAPH_VERSION}/?ids=${uniqueVideoIds.join(",")}&fields=source&access_token=${accessToken}`
          );

          if (videoResponse.ok) {
            const videoData = await videoResponse.json();
            for (const [adId, videoId] of Object.entries(adToVideoMap)) {
              const video = videoData[videoId];
              if (video && video.source) {
                videoUrls[adId] = video.source;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error fetching video URLs for batch:", error);
      // Continue without video URLs if fetch fails
    }
  }

  return videoUrls;
}

/**
 * Fetch all paginated insights from a single API URL.
 */
async function fetchAllInsights(url: string): Promise<any[]> {
  const results: any[] = [];
  const response = await fetch(url);

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[Facebook Ads] Insights fetch failed:", response.status, errorBody);
    return results;
  }

  const data = await response.json();
  if (data.error) {
    console.error("[Facebook Ads] API error:", JSON.stringify(data.error));
    return results;
  }

  if (data.data) results.push(...data.data);

  let nextUrl = data.paging?.next;
  while (nextUrl) {
    const nextResponse = await fetch(nextUrl);
    if (!nextResponse.ok) break;
    const nextData = await nextResponse.json();
    if (nextData.error) break;
    if (nextData.data) results.push(...nextData.data);
    nextUrl = nextData.paging?.next;
  }

  return results;
}

/**
 * Process and save insights to database. Returns number of records saved.
 */
async function saveInsightsToDB(
  insights: any[],
  organizationId: string,
  thumbnails: Record<string, string>,
  videoUrls: Record<string, string>,
  accountId?: string,
): Promise<number> {
  if (insights.length === 0) return 0;

  let synced = 0;

  // Batch upserts using Promise.all in groups of 20 for speed
  const batchSize = 20;
  for (let i = 0; i < insights.length; i += batchSize) {
    const batch = insights.slice(i, i + batchSize);
    await Promise.all(
      batch.map((insight) => {
        const actions = insight.actions || [];
        const actionValues = insight.action_values || [];

        const findAction = (types: string[]) =>
          actions.find((a: { action_type: string }) => types.includes(a.action_type));
        const findActionValue = (types: string[]) =>
          actionValues.find((a: { action_type: string }) => types.includes(a.action_type));

        const purchases = findAction(["purchase", "offsite_conversion.fb_pixel_purchase"]);
        const purchaseValue = findActionValue(["purchase", "offsite_conversion.fb_pixel_purchase"]);
        const addToCartAction = findAction(["add_to_cart", "offsite_conversion.fb_pixel_add_to_cart"]);
        const initiateCheckoutAction = findAction(["initiate_checkout", "offsite_conversion.fb_pixel_initiate_checkout"]);

        const conversions = parseInt(purchases?.value || "0");
        const revenue = parseFloat(purchaseValue?.value || "0");
        const addToCart = parseInt(addToCartAction?.value || "0");
        const initiateCheckout = parseInt(initiateCheckoutAction?.value || "0");

        return prisma.adMetric.upsert({
          where: {
            organizationId_platform_accountId_campaignId_adId_date: {
              organizationId,
              platform: "FACEBOOK_ADS",
              accountId: accountId || "unknown",
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
            videoUrl: videoUrls[insight.ad_id] || null,
            accountId: accountId || "unknown",
            date: new Date(insight.date_start),
            impressions: parseInt(insight.impressions || "0"),
            reach: parseInt(insight.reach || "0"),
            clicks: parseInt(insight.clicks || "0"),
            spend: parseFloat(insight.spend || "0"),
            conversions,
            addToCart,
            initiateCheckout,
            revenue,
            currency: "BRL",
            rawData: insight,
          },
          update: {
            campaignName: insight.campaign_name,
            adSetName: insight.adset_name,
            adName: insight.ad_name,
            thumbnailUrl: thumbnails[insight.ad_id] || null,
            videoUrl: videoUrls[insight.ad_id] || null,
            accountId: accountId || "unknown",
            impressions: parseInt(insight.impressions || "0"),
            reach: parseInt(insight.reach || "0"),
            clicks: parseInt(insight.clicks || "0"),
            spend: parseFloat(insight.spend || "0"),
            conversions,
            addToCart,
            initiateCheckout,
            revenue,
            rawData: insight,
          },
        });
      })
    );
    synced += batch.length;
  }

  return synced;
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

    // Support multiple accounts from metadata
    const metadata = integration.metadata as { selectedAccounts?: { id: string; name: string }[] } | null;
    const selectedAccounts = metadata?.selectedAccounts || [];
    const accountIds: string[] = selectedAccounts.length > 0
      ? selectedAccounts.map((a) => a.id.replace("act_", ""))
      : integration.externalAccountId ? [integration.externalAccountId] : [];

    if (accountIds.length === 0) {
      throw new Error("No ad account selected");
    }

    const fields = [
      "date_start",
      "campaign_id", "campaign_name",
      "adset_id", "adset_name",
      "ad_id", "ad_name",
      "impressions", "reach", "clicks", "spend",
      "actions", "action_values",
      "cost_per_action_type",
    ].join(",");

    const today = new Date();
    const startTime = Date.now();
    const TIME_BUDGET_MS = 50_000; // 50s safe margin within 60s Vercel limit
    let totalSynced = 0;
    const noMedia: Record<string, string> = {};
    const accountErrors: string[] = [];

    const daysAgo = (n: number) => {
      const d = new Date(today);
      d.setDate(today.getDate() - n);
      return toBrasiliaDateStr(d);
    };

    const hasTimeLeft = () => Date.now() - startTime < TIME_BUDGET_MS;

    const buildUrl = (adAccountId: string, since: string, until: string) =>
      `https://graph.facebook.com/${FB_GRAPH_VERSION}/act_${adAccountId}/insights?fields=${fields}&level=ad&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&time_increment=1&limit=500&access_token=${accessToken}`;

    // ===== BREADTH-FIRST SYNC: Recent data for ALL accounts first =====

    // PHASE 1: Last 7 days for ALL accounts (highest priority)
    for (const adAccountId of accountIds) {
      if (!hasTimeLeft()) break;
      try {
        const insights = await fetchAllInsights(buildUrl(adAccountId, daysAgo(7), daysAgo(0)));
        totalSynced += await saveInsightsToDB(insights, organizationId, noMedia, noMedia, adAccountId);
      } catch (err) {
        accountErrors.push(`Phase1 act_${adAccountId}: ${err instanceof Error ? err.message : "Unknown"}`);
      }
    }

    // PHASE 2: Days 8-30 for ALL accounts
    for (const adAccountId of accountIds) {
      if (!hasTimeLeft()) break;
      try {
        const insights = await fetchAllInsights(buildUrl(adAccountId, daysAgo(30), daysAgo(7)));
        totalSynced += await saveInsightsToDB(insights, organizationId, noMedia, noMedia, adAccountId);
      } catch (err) {
        accountErrors.push(`Phase2 act_${adAccountId}: ${err instanceof Error ? err.message : "Unknown"}`);
      }
    }

    // PHASE 3: Days 31-90 for ALL accounts
    for (const adAccountId of accountIds) {
      if (!hasTimeLeft()) break;
      try {
        const insights = await fetchAllInsights(buildUrl(adAccountId, daysAgo(90), daysAgo(30)));
        totalSynced += await saveInsightsToDB(insights, organizationId, noMedia, noMedia, adAccountId);
      } catch (err) {
        accountErrors.push(`Phase3 act_${adAccountId}: ${err instanceof Error ? err.message : "Unknown"}`);
      }
    }

    // PHASE 3.5: Fetch thumbnails/videos for ALL accounts (if time allows)
    if (hasTimeLeft()) {
      for (const adAccountId of accountIds) {
        if (!hasTimeLeft()) break;
        try {
          const recentMetrics = await prisma.adMetric.findMany({
            where: { organizationId, platform: "FACEBOOK_ADS", accountId: adAccountId, thumbnailUrl: null, adId: { not: null } },
            select: { adId: true },
            distinct: ["adId"],
            take: 100,
          });
          const adIdsToFetch = recentMetrics.map((m) => m.adId).filter(Boolean) as string[];
          if (adIdsToFetch.length > 0) {
            const [thumbnails, videoUrls] = await Promise.all([
              fetchAdThumbnails(adIdsToFetch, accessToken),
              fetchAdVideoUrls(adIdsToFetch, accessToken),
            ]);
            const updateIds = adIdsToFetch.filter((id) => thumbnails[id] || videoUrls[id]);
            for (let i = 0; i < updateIds.length; i += 30) {
              if (!hasTimeLeft()) break;
              const batch = updateIds.slice(i, i + 30);
              await Promise.all(
                batch.map((adId) =>
                  prisma.adMetric.updateMany({
                    where: { organizationId, platform: "FACEBOOK_ADS", adId },
                    data: {
                      ...(thumbnails[adId] ? { thumbnailUrl: thumbnails[adId] } : {}),
                      ...(videoUrls[adId] ? { videoUrl: videoUrls[adId] } : {}),
                    },
                  })
                )
              );
            }
          }
        } catch {
          // Non-fatal: thumbnails can be fetched on next sync
        }
      }
    }

    // PHASE 4: Older data 91-365 days for ALL accounts (if time allows)
    if (hasTimeLeft()) {
      for (const adAccountId of accountIds) {
        if (!hasTimeLeft()) break;
        const olderChunks: { since: string; until: string }[] = [];
        for (let offset = 90; offset < 365; offset += 90) {
          olderChunks.push({
            since: daysAgo(Math.min(offset + 90, 365)),
            until: daysAgo(offset),
          });
        }

        for (const chunk of olderChunks) {
          if (!hasTimeLeft()) break;
          try {
            const insights = await fetchAllInsights(buildUrl(adAccountId, chunk.since, chunk.until));
            totalSynced += await saveInsightsToDB(insights, organizationId, noMedia, noMedia, adAccountId);
          } catch {
            // Non-fatal for older data
          }
        }
      }
    }

    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        syncStatus: "SUCCESS",
        lastSyncAt: new Date(),
        errorMessage: accountErrors.length > 0 ? `Partial errors: ${accountErrors.join("; ")}` : null,
      },
    });

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: { status: "SUCCESS", recordsSynced: totalSynced, completedAt: new Date() },
    });

    return { success: true, synced: totalSynced };
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

  const scopes = "ads_read,ads_management,business_management";

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

type FbAdAccount = { id: string; name: string; account_status: number };
type FbPaginatedResponse = { data?: FbAdAccount[]; paging?: { next?: string } };

async function fetchAllPages(startUrl: string): Promise<FbAdAccount[]> {
  const results: FbAdAccount[] = [];
  let url: string | null = startUrl;

  while (url) {
    const response: Response = await fetch(url);
    if (!response.ok) break; // Skip on error (e.g. permission denied for a specific BM)

    const data: FbPaginatedResponse = await response.json();
    if (data.data) {
      results.push(...data.data);
    }
    url = data.paging?.next || null;
  }

  return results;
}

export async function getFacebookAdAccounts(accessToken: string) {
  const accountMap = new Map<string, FbAdAccount>();

  // 1. Fetch ad accounts directly on the user profile
  const directAccounts = await fetchAllPages(
    `https://graph.facebook.com/${FB_GRAPH_VERSION}/me/adaccounts?fields=id,name,account_status&limit=100&access_token=${accessToken}`
  );
  for (const acc of directAccounts) {
    accountMap.set(acc.id, acc);
  }

  // 2. Fetch all Business Managers the user has access to
  try {
    const bizResponse: Response = await fetch(
      `https://graph.facebook.com/${FB_GRAPH_VERSION}/me/businesses?fields=id,name&limit=100&access_token=${accessToken}`
    );

    if (bizResponse.ok) {
      const bizData: { data?: { id: string; name: string }[]; paging?: { next?: string } } = await bizResponse.json();
      const businesses = bizData.data || [];

      // 3. For each BM, fetch owned + client ad accounts
      for (const biz of businesses) {
        const owned = await fetchAllPages(
          `https://graph.facebook.com/${FB_GRAPH_VERSION}/${biz.id}/owned_ad_accounts?fields=id,name,account_status&limit=100&access_token=${accessToken}`
        );
        for (const acc of owned) {
          accountMap.set(acc.id, acc);
        }

        const client = await fetchAllPages(
          `https://graph.facebook.com/${FB_GRAPH_VERSION}/${biz.id}/client_ad_accounts?fields=id,name,account_status&limit=100&access_token=${accessToken}`
        );
        for (const acc of client) {
          accountMap.set(acc.id, acc);
        }
      }
    }
  } catch {
    // If business fetching fails, we still have direct accounts
  }

  // Sort by name
  return Array.from(accountMap.values()).sort((a, b) =>
    (a.name || "").localeCompare(b.name || "")
  );
}
