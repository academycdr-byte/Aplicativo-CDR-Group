import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";
import { toBrasiliaDateStr, toBrasiliaStartOfDay } from "@/lib/date-utils";

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
 * Busca thumbnails dos criativos dos anúncios.
 */
async function fetchAdThumbnails(
  adIds: string[],
  accessToken: string
): Promise<Record<string, string>> {
  const thumbnails: Record<string, string> = {};
  if (adIds.length === 0) return thumbnails;

  // Batch fetch (max 50 per request)
  // Request image_url (full res) + thumbnail_url with 720px width for hi-res thumbnails
  const batches = [];
  for (let i = 0; i < adIds.length; i += 50) {
    batches.push(adIds.slice(i, i + 50));
  }

  for (const batch of batches) {
    const ids = batch.join(",");
    try {
      const response = await fetch(
        `https://graph.facebook.com/${FB_GRAPH_VERSION}/?ids=${ids}&fields=creative{thumbnail_url,image_url}&thumbnail_width=720&access_token=${accessToken}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.error) {
          console.error("[fetchAdThumbnails] API error:", JSON.stringify(data.error));
        } else {
          for (const [adId, adData] of Object.entries(data)) {
            const creative = (adData as { creative?: { thumbnail_url?: string; image_url?: string } })?.creative;
            const url = creative?.image_url || creative?.thumbnail_url;
            if (url) {
              thumbnails[adId] = url;
            }
          }
        }
      } else {
        console.error("[fetchAdThumbnails] HTTP error:", response.status, await response.text().catch(() => ""));
      }
    } catch {
      // Continue without thumbnails if fetch fails
    }
  }

  return thumbnails;
}

/**
 * Busca URLs de vídeos dos criativos dos anúncios.
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
          const typedAdData = adData as { creative?: { video_id?: string; object_story_spec?: { video_data?: { video_id?: string } } } };
          const creative = typedAdData?.creative;
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

/** Single insight record from Facebook Ads API */
interface FbInsightRecord {
  date_start: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  spend?: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
  [key: string]: unknown;
}

/** Facebook API paginated response shape */
interface FbPaginatedInsightsResponse {
  data?: FbInsightRecord[];
  error?: { message: string; type: string; code: number };
  paging?: { next?: string };
}

/**
 * Fetch all paginated insights from a single API URL.
 */
async function fetchAllInsights(url: string): Promise<FbInsightRecord[]> {
  const results: FbInsightRecord[] = [];
  const response = await fetch(url);

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[Facebook Ads] Insights fetch failed:", response.status, errorBody);
    return results;
  }

  const data: FbPaginatedInsightsResponse = await response.json();
  if (data.error) {
    console.error("[Facebook Ads] API error:", JSON.stringify(data.error));
    return results;
  }

  if (data.data) results.push(...data.data);

  let nextUrl = data.paging?.next;
  while (nextUrl) {
    const nextResponse = await fetch(nextUrl);
    if (!nextResponse.ok) break;
    const nextData: FbPaginatedInsightsResponse = await nextResponse.json();
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
  insights: FbInsightRecord[],
  organizationId: string,
  thumbnails: Record<string, string>,
  videoUrls: Record<string, string>,
  accountId?: string,
): Promise<number> {
  if (insights.length === 0) return 0;

  let synced = 0;

  // Batch upserts using Promise.all in groups of 50 for speed
  const batchSize = 50;
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

        const purchases = findAction(["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"]);
        const purchaseValue = findActionValue(["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"]);
        const addToCartAction = findAction(["omni_add_to_cart", "add_to_cart", "offsite_conversion.fb_pixel_add_to_cart"]);
        const initiateCheckoutAction = findAction(["omni_initiate_checkout", "initiate_checkout", "offsite_conversion.fb_pixel_initiate_checkout"]);

        const conversions = parseInt(purchases?.value || "0");
        const revenue = parseFloat(purchaseValue?.value || "0");
        const addToCart = parseInt(addToCartAction?.value || "0");
        const initiateCheckout = parseInt(initiateCheckoutAction?.value || "0");

        const adId = insight.ad_id || "unknown";

        return prisma.adMetric.upsert({
          where: {
            organizationId_platform_accountId_campaignId_adId_date: {
              organizationId,
              platform: "FACEBOOK_ADS",
              accountId: accountId || "unknown",
              campaignId: insight.campaign_id || "unknown",
              adId,
              date: toBrasiliaStartOfDay(insight.date_start),
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
            thumbnailUrl: thumbnails[adId] || null,
            videoUrl: videoUrls[adId] || null,
            accountId: accountId || "unknown",
            // IMPORTANTE: Converter para Inicio do Dia em Brasilia (03:00 UTC)
            // Se usar new Date(date_start), fica 00:00 UTC, que eh "Ontem" as 21:00 no Brasil
            // O dashboard busca gte: 03:00 UTC (Inicio do dia BR), entao 00:00 UTC ficaria de fora
            date: toBrasiliaStartOfDay(insight.date_start),
            impressions: parseInt(insight.impressions || "0"),
            reach: parseInt(insight.reach || "0"),
            clicks: parseInt(insight.clicks || "0"),
            spend: parseFloat(insight.spend || "0"),
            conversions,
            addToCart,
            initiateCheckout,
            revenue,
            currency: "BRL",
            rawData: insight as unknown as Prisma.InputJsonValue,
          },
          update: {
            campaignName: insight.campaign_name,
            adSetName: insight.adset_name,
            adName: insight.ad_name,
            thumbnailUrl: thumbnails[adId] || null,
            videoUrl: videoUrls[adId] || null,
            accountId: accountId || "unknown",
            impressions: parseInt(insight.impressions || "0"),
            reach: parseInt(insight.reach || "0"),
            clicks: parseInt(insight.clicks || "0"),
            spend: parseFloat(insight.spend || "0"),
            conversions,
            addToCart,
            initiateCheckout,
            revenue,
            rawData: insight as unknown as Prisma.InputJsonValue,
          },
        });
      })
    );
    synced += batch.length;
  }

  return synced;
}

interface FbSyncOptions {
  startPhase?: number;
  accountIndex?: number;
  syncLogId?: string;
  timeBudgetMs?: number;
  freshnessOnly?: boolean;
}

interface FbSyncResult {
  success?: boolean;
  error?: string;
  synced: number;
  hasMore: boolean;
  nextPhase?: number;
  accountIndex?: number;
  syncLogId?: string;
}

export async function syncFacebookAdsMetrics(
  organizationId: string,
  options: FbSyncOptions = {}
): Promise<FbSyncResult> {
  const { timeBudgetMs = 50_000 } = options;

  const integration = await prisma.integration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "FACEBOOK_ADS" } },
  });

  if (!integration || integration.status !== "CONNECTED" || !integration.accessToken) {
    return { error: "Facebook Ads not connected", synced: 0, hasMore: false };
  }

  // Determine starting phase: explicit option > saved cursor > phase 1
  let currentPhase = options.startPhase || 1;
  let startAccountIndex = options.accountIndex;
  const meta = (integration.metadata as Record<string, unknown>) || {};

  if (!options.startPhase && !options.syncLogId) {
    const cursor = meta.fbSyncCursor as { nextPhase?: number; accountIndex?: number; syncLogId?: string } | undefined;
    if (cursor?.nextPhase) {
      currentPhase = cursor.nextPhase;
      startAccountIndex = cursor.accountIndex;
      options.syncLogId = cursor.syncLogId;
    }
  }

  const isFirstCall = !options.syncLogId;
  let logId = options.syncLogId || "";

  if (isFirstCall) {
    await prisma.integration.update({
      where: { id: integration.id },
      data: { syncStatus: "SYNCING", errorMessage: null },
    });
    const syncLog = await prisma.syncLog.create({
      data: { organizationId, platform: "FACEBOOK_ADS", status: "SYNCING" },
    });
    logId = syncLog.id;
  }

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
    const latestMeta = (integration.metadata as Record<string, unknown>) || {};
    const selAccounts = (latestMeta as { selectedAccounts?: { id: string; name: string }[] }).selectedAccounts || [];
    const accountIds: string[] = (selAccounts.length > 0
      ? selAccounts.map((a) => a.id.replace("act_", ""))
      : integration.externalAccountId ? [integration.externalAccountId] : []
    ).filter((id) => id && id.trim() !== "");

    if (accountIds.length === 0) {
      throw new Error("No ad account selected. Please go to Integrations and select your ad accounts.");
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
    let totalSynced = 0;
    const noMedia: Record<string, string> = {};
    const accountErrors: string[] = [];

    const daysAgo = (n: number) => {
      const d = new Date(today);
      d.setDate(today.getDate() - n);
      return toBrasiliaDateStr(d);
    };

    const hasTimeLeft = () => Date.now() - startTime < timeBudgetMs;

    const buildUrl = (adAccountId: string, since: string, until: string) =>
      `https://graph.facebook.com/${FB_GRAPH_VERSION}/act_${adAccountId}/insights?fields=${fields}&level=ad&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&time_increment=1&limit=500&action_attribution_windows=${encodeURIComponent(JSON.stringify(["7d_click", "1d_view"]))}&access_token=${accessToken}`;

    // Helper: save phase cursor and return hasMore
    const saveCursorAndReturn = async (nextPhase: number, accountIdx?: number): Promise<FbSyncResult> => {
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          metadata: { ...latestMeta, fbSyncCursor: { nextPhase, accountIndex: accountIdx, syncLogId: logId } } as unknown as Record<string, string | number | boolean | null>,
        },
      });
      if (logId) {
        await prisma.syncLog.update({
          where: { id: logId },
          data: { recordsSynced: totalSynced },
        }).catch(() => { });
      }
      return {
        success: true,
        synced: totalSynced,
        hasMore: true,
        nextPhase,
        accountIndex: accountIdx,
        syncLogId: logId,
      };
    };

    // ===== PHASE-BASED SYNC WITH PAGE-BY-PAGE PROCESSING =====

    // Helper: fetch insights page by page, saving each page immediately
    // Returns number of records synced. Checks time budget between pages.
    // Retries failed pages up to 2 times with exponential backoff to handle
    // transient Meta API errors (rate limits, 500s, timeouts).
    const fetchAndSavePageByPage = async (
      url: string,
      adAccountId: string,
    ): Promise<{ synced: number; timedOut: boolean; tokenExpired?: boolean }> => {
      let synced = 0;
      let pageUrl: string | null = url;

      while (pageUrl) {
        let response: Response | null = null;
        let lastError = "";
        let isTokenError = false;

        // Retry up to 3 attempts (1 original + 2 retries) with backoff
        for (let attempt = 0; attempt < 3; attempt++) {
          if (attempt > 0) {
            // Don't retry token/auth errors — they won't self-heal
            if (isTokenError) break;
            // Exponential backoff: 1s, 2s
            const delay = attempt * 1000;
            await new Promise(r => setTimeout(r, delay));
            if (!hasTimeLeft()) return { synced, timedOut: true };
          }

          try {
            response = await fetch(pageUrl);
            if (response.ok) break; // Success — exit retry loop

            lastError = `HTTP ${response.status}`;
            const errorBody = await response.text().catch(() => "");

            // Detect token/auth errors (Meta returns 400 with OAuthException code 190)
            if (response.status === 401 || response.status === 400) {
              try {
                const errJson = JSON.parse(errorBody);
                if (errJson?.error?.code === 190 || errJson?.error?.type === "OAuthException") {
                  isTokenError = true;
                  lastError = `Token expired or invalid (code ${errJson?.error?.code}): ${errJson?.error?.message || "OAuthException"}`;
                  console.error(`[Facebook Ads] TOKEN EXPIRED: ${lastError}`);
                  break; // Don't retry auth errors
                }
              } catch { /* not JSON, continue with normal retry */ }
            }

            console.warn(`[Facebook Ads] Page fetch attempt ${attempt + 1}/3 failed: ${response.status} ${errorBody.substring(0, 200)}`);
            response = null; // Mark as failed for retry
          } catch (err) {
            lastError = err instanceof Error ? err.message : "Network error";
            console.warn(`[Facebook Ads] Page fetch attempt ${attempt + 1}/3 error: ${lastError}`);
            response = null;
          }
        }

        // Token expired — abort immediately, don't treat as resumable timeout
        if (isTokenError) {
          console.error(`[Facebook Ads] Aborting sync: token expired. User must reconnect Facebook Ads.`);
          return { synced, timedOut: false, tokenExpired: true };
        }

        // All retries exhausted
        if (!response || !response.ok) {
          console.error(`[Facebook Ads] Insights page failed after 3 attempts (${lastError}), returning timedOut to resume later`);
          return { synced, timedOut: true }; // Signal to resume, not silently skip
        }

        const data: FbPaginatedInsightsResponse = await response.json();
        if (data.error) {
          // Check for token error in response body too
          if (data.error.code === 190 || data.error.type === "OAuthException") {
            console.error(`[Facebook Ads] TOKEN EXPIRED in response body: ${JSON.stringify(data.error)}`);
            return { synced, timedOut: false, tokenExpired: true };
          }
          console.error("[Facebook Ads] API error:", JSON.stringify(data.error));
          return { synced, timedOut: true }; // Signal to resume, not silently skip
        }

        if (data.data && data.data.length > 0) {
          synced += await saveInsightsToDB(data.data, organizationId, noMedia, noMedia, adAccountId);
        }

        pageUrl = data.paging?.next || null;

        // Check time budget between pages (most critical check)
        if (pageUrl && !hasTimeLeft()) {
          return { synced, timedOut: true };
        }
      }

      return { synced, timedOut: false };
    };

    // PHASE 0: MANDATORY FRESHNESS (Today only — fast)
    // Only fetch today for speed. Phase 1 re-syncs last 7 days (including yesterday).
    // This keeps Phase 0 lightweight so Phase 1 can run within the time budget.
    if (currentPhase <= 1) {
      console.log(`[Facebook Ads] Phase 0: Fetching today's data for freshness`);

      let tokenExpiredDetected = false;
      const freshnessPromises = accountIds.map(async (accountId) => {
        if (!hasTimeLeft() || tokenExpiredDetected) return;
        try {
          const result = await fetchAndSavePageByPage(
            buildUrl(accountId, daysAgo(0), daysAgo(0)),
            accountId,
          );
          if (result.tokenExpired) { tokenExpiredDetected = true; return; }
          totalSynced += result.synced;
        } catch (err) {
          console.warn(`[Facebook Ads] Phase 0 freshness fetch failed for ${accountId}:`, err);
        }
      });

      await Promise.all(freshnessPromises);

      // If token expired in Phase 0, abort immediately with clear error
      if (tokenExpiredDetected) {
        const errMsg = "Token do Facebook expirado. Reconecte o Facebook Ads em Integrações.";
        await prisma.integration.update({
          where: { id: integration.id },
          data: { syncStatus: "FAILED", errorMessage: errMsg },
        });
        if (logId) {
          await prisma.syncLog.update({
            where: { id: logId },
            data: { status: "FAILED", errorMessage: errMsg, completedAt: new Date() },
          }).catch(() => { });
        }
        return { error: errMsg, synced: 0, hasMore: false };
      }

      // Phase 0b: Fetch thumbnails for ads with missing thumbnails (quick batch)
      if (hasTimeLeft()) {
        try {
          const missingThumbnails = await prisma.adMetric.findMany({
            where: { organizationId, platform: "FACEBOOK_ADS", thumbnailUrl: null, adId: { not: null } },
            select: { adId: true },
            distinct: ["adId"],
            take: 50,
          });
          const adIdsToFetch = missingThumbnails.map((m) => m.adId).filter(Boolean) as string[];
          console.log(`[Facebook Ads] Phase 0b: ${adIdsToFetch.length} ads need thumbnails`);
          if (adIdsToFetch.length > 0 && hasTimeLeft()) {
            const thumbnails = await fetchAdThumbnails(adIdsToFetch, accessToken);
            console.log(`[Facebook Ads] Phase 0b: Got ${Object.keys(thumbnails).length} thumbnails from API`);
            const updateIds = adIdsToFetch.filter((id) => thumbnails[id]);
            if (updateIds.length > 0) {
              await Promise.all(
                updateIds.slice(0, 30).map((adId) =>
                  prisma.adMetric.updateMany({
                    where: { organizationId, platform: "FACEBOOK_ADS", adId },
                    data: { thumbnailUrl: thumbnails[adId] },
                  })
                )
              );
            }
          }
        } catch {
          // Non-fatal: thumbnails will be fetched in Phase 4
        }
      }
    }



    // If requesting freshness only, stop here
    if (options.freshnessOnly) {
      return { success: true, synced: totalSynced, hasMore: false };
    }

    // Helper: abort sync with token expired error
    const abortTokenExpired = async (): Promise<FbSyncResult> => {
      const errMsg = "Token do Facebook expirado. Reconecte o Facebook Ads em Integrações.";
      await prisma.integration.update({
        where: { id: integration.id },
        data: { syncStatus: "FAILED", errorMessage: errMsg },
      });
      if (logId) {
        await prisma.syncLog.update({
          where: { id: logId },
          data: { status: "FAILED", errorMessage: errMsg, completedAt: new Date() },
        }).catch(() => { });
      }
      return { error: errMsg, synced: totalSynced, hasMore: false };
    };

    // PHASE 1: Last 7 days for ALL accounts (highest priority history)
    // Fetch DAY-BY-DAY instead of 7-day range to ensure each day completes
    // independently. Meta API returns results in non-deterministic order within
    // a multi-day range, so incomplete pagination causes random days to be missing.
    if (currentPhase <= 1) {
      const startIdx = (currentPhase === 1 && startAccountIndex !== undefined) ? startAccountIndex : 0;
      for (let ai = startIdx; ai < accountIds.length; ai++) {
        if (!hasTimeLeft()) return saveCursorAndReturn(1, ai);
        // Fetch each day separately: yesterday (1) back to 7 days ago
        for (let d = 1; d <= 7; d++) {
          if (!hasTimeLeft()) return saveCursorAndReturn(1, ai);
          try {
            const dayStr = daysAgo(d);
            const result = await fetchAndSavePageByPage(
              buildUrl(accountIds[ai], dayStr, dayStr),
              accountIds[ai],
            );
            if (result.tokenExpired) return abortTokenExpired();
            totalSynced += result.synced;
            if (result.timedOut) return saveCursorAndReturn(1, ai);
          } catch (err) {
            accountErrors.push(`Phase1 act_${accountIds[ai]} day-${d}: ${err instanceof Error ? err.message : "Unknown"}`);
          }
        }
      }
      startAccountIndex = undefined;
      if (!hasTimeLeft()) return saveCursorAndReturn(2);
    }

    // PHASE 2: Days 8-30 for ALL accounts
    if (currentPhase <= 2) {
      const startIdx = (currentPhase === 2 && startAccountIndex !== undefined) ? startAccountIndex : 0;
      for (let ai = startIdx; ai < accountIds.length; ai++) {
        if (!hasTimeLeft()) return saveCursorAndReturn(2, ai);
        try {
          const result = await fetchAndSavePageByPage(
            buildUrl(accountIds[ai], daysAgo(30), daysAgo(7)),
            accountIds[ai],
          );
          if (result.tokenExpired) return abortTokenExpired();
          totalSynced += result.synced;
          if (result.timedOut) return saveCursorAndReturn(2, ai);
        } catch (err) {
          accountErrors.push(`Phase2 act_${accountIds[ai]}: ${err instanceof Error ? err.message : "Unknown"}`);
        }
      }
      startAccountIndex = undefined;
      if (!hasTimeLeft()) return saveCursorAndReturn(3);
    }

    // PHASE 3: Days 31-90 for ALL accounts
    if (currentPhase <= 3) {
      const startIdx = (currentPhase === 3 && startAccountIndex !== undefined) ? startAccountIndex : 0;
      for (let ai = startIdx; ai < accountIds.length; ai++) {
        if (!hasTimeLeft()) return saveCursorAndReturn(3, ai);
        try {
          const result = await fetchAndSavePageByPage(
            buildUrl(accountIds[ai], daysAgo(90), daysAgo(30)),
            accountIds[ai],
          );
          if (result.tokenExpired) return abortTokenExpired();
          totalSynced += result.synced;
          if (result.timedOut) return saveCursorAndReturn(3, ai);
        } catch (err) {
          accountErrors.push(`Phase3 act_${accountIds[ai]}: ${err instanceof Error ? err.message : "Unknown"}`);
        }
      }
      startAccountIndex = undefined;
      if (!hasTimeLeft()) return saveCursorAndReturn(4);
    }

    // PHASE 4: Fetch thumbnails/videos for ALL accounts
    if (currentPhase <= 4) {
      const startIdx = (currentPhase === 4 && startAccountIndex !== undefined) ? startAccountIndex : 0;
      for (let ai = startIdx; ai < accountIds.length; ai++) {
        if (!hasTimeLeft()) return saveCursorAndReturn(4, ai);
        try {
          const recentMetrics = await prisma.adMetric.findMany({
            where: { organizationId, platform: "FACEBOOK_ADS", accountId: accountIds[ai], thumbnailUrl: null, adId: { not: null } },
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
              if (!hasTimeLeft()) return saveCursorAndReturn(5);
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
      startAccountIndex = undefined;
      if (!hasTimeLeft()) return saveCursorAndReturn(5);
    }

    // PHASE 5: Older data 91-365 days for ALL accounts
    if (currentPhase <= 5) {
      const startIdx = (currentPhase === 5 && startAccountIndex !== undefined) ? startAccountIndex : 0;
      for (let ai = startIdx; ai < accountIds.length; ai++) {
        if (!hasTimeLeft()) return saveCursorAndReturn(5, ai);
        const olderChunks: { since: string; until: string }[] = [];
        for (let offset = 90; offset < 365; offset += 90) {
          olderChunks.push({
            since: daysAgo(Math.min(offset + 90, 365)),
            until: daysAgo(offset),
          });
        }

        for (const chunk of olderChunks) {
          if (!hasTimeLeft()) return saveCursorAndReturn(5, ai);
          try {
            const result = await fetchAndSavePageByPage(
              buildUrl(accountIds[ai], chunk.since, chunk.until),
              accountIds[ai],
            );
            totalSynced += result.synced;
            if (result.timedOut) return saveCursorAndReturn(5, ai);
          } catch {
            // Non-fatal for older data
          }
        }
      }
    }

    // ALL PHASES DONE — clear cursor, mark SUCCESS
    const { fbSyncCursor: _, ...restMeta } = latestMeta;
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        syncStatus: "SUCCESS",
        lastSyncAt: new Date(),
        metadata: restMeta as Record<string, string | number | boolean | null>,
        errorMessage: accountErrors.length > 0 ? `Partial errors: ${accountErrors.join("; ")}` : null,
      },
    });

    if (logId) {
      await prisma.syncLog.update({
        where: { id: logId },
        data: { status: "SUCCESS", recordsSynced: totalSynced, completedAt: new Date() },
      }).catch(() => { });
    }

    return { success: true, synced: totalSynced, hasMore: false, syncLogId: logId };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";

    await prisma.integration.update({
      where: { id: integration.id },
      data: { syncStatus: "FAILED", errorMessage: errorMsg },
    }).catch(() => { });

    if (logId) {
      await prisma.syncLog.update({
        where: { id: logId },
        data: { status: "FAILED", errorMessage: errorMsg, completedAt: new Date() },
      }).catch(() => { });
    }

    return { error: errorMsg, synced: 0, hasMore: false };
  }
}

export function getFacebookAuthUrl(state: string) {
  const clientId = process.env.FACEBOOK_APP_ID?.trim();
  if (!clientId) throw new Error("FACEBOOK_APP_ID não configurado");

  const scopes = "ads_read,ads_management,business_management,pages_read_engagement,pages_show_list";

  return `https://www.facebook.com/${FB_GRAPH_VERSION}/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(FB_REDIRECT_URI)}&scope=${scopes}&state=${state}`;
}

export async function exchangeFacebookToken(code: string) {
  const clientId = process.env.FACEBOOK_APP_ID?.trim();
  const clientSecret = process.env.FACEBOOK_APP_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error("FACEBOOK_APP_ID ou FACEBOOK_APP_SECRET não configurado");
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

/**
 * Exchange a short-lived token for a long-lived one (60 days).
 * If the token is already long-lived, the API returns it unchanged.
 */
export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<string> {
  const clientId = process.env.FACEBOOK_APP_ID?.trim();
  const clientSecret = process.env.FACEBOOK_APP_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error("FACEBOOK_APP_ID ou FACEBOOK_APP_SECRET não configurado");
  }

  const response = await fetch(
    `https://graph.facebook.com/${FB_GRAPH_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${shortLivedToken}`
  );

  if (!response.ok) {
    // If exchange fails, return the original token (might already be long-lived)
    console.warn("[Facebook Ads] Long-lived token exchange failed, using original token");
    return shortLivedToken;
  }

  const data = await response.json();
  return data.access_token || shortLivedToken;
}

/**
 * Validate a Facebook token by making a simple API call.
 * Returns the token's expiration info.
 */
export async function validateFacebookToken(token: string): Promise<{ valid: boolean; expiresAt?: Date; error?: string }> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/${FB_GRAPH_VERSION}/me?fields=id,name&access_token=${token}`
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { valid: false, error: err?.error?.message || `HTTP ${response.status}` };
    }

    // Check token debug info for expiration
    const clientId = process.env.FACEBOOK_APP_ID?.trim();
    const clientSecret = process.env.FACEBOOK_APP_SECRET?.trim();
    let expiresAt: Date | undefined;

    if (clientId && clientSecret) {
      const debugResp = await fetch(
        `https://graph.facebook.com/${FB_GRAPH_VERSION}/debug_token?input_token=${token}&access_token=${clientId}|${clientSecret}`
      );
      if (debugResp.ok) {
        const debugData = await debugResp.json();
        if (debugData.data?.expires_at) {
          expiresAt = new Date(debugData.data.expires_at * 1000);
        }
      }
    }

    return { valid: true, expiresAt };
  } catch {
    return { valid: false, error: "Erro de rede ao validar token" };
  }
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
