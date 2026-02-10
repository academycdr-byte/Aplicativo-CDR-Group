import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

const GA_ADMIN_API = "https://analyticsadmin.googleapis.com/v1beta";
const GA_DATA_API = "https://analyticsdata.googleapis.com/v1beta";

// ============ OAUTH HELPERS ============

export function getGoogleAnalyticsAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const redirectUri = `${process.env.AUTH_URL}/api/integrations/google-analytics/callback`;
  const scopes = "https://www.googleapis.com/auth/analytics.readonly";

  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${state}`;
}

export async function exchangeGoogleAnalyticsToken(code: string) {
  const redirectUri = `${process.env.AUTH_URL}/api/integrations/google-analytics/callback`;

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
    const errorBody = await response.text();
    console.error("[GA OAuth] Token exchange failed:", response.status, errorBody);
    throw new Error(`Failed to exchange Google Analytics token: ${response.status}`);
  }

  return response.json();
}

async function refreshGoogleAnalyticsToken(integrationId: string): Promise<string> {
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
    throw new Error("Failed to refresh Google Analytics token");
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

// ============ GA4 ADMIN API ============

interface GA4PropertyInfo {
  id: string;
  name: string;
  fullName: string;
}

export async function listGA4Properties(accessToken: string): Promise<GA4PropertyInfo[]> {
  const response = await fetch(
    `${GA_ADMIN_API}/accountSummaries?access_token=${accessToken}&pageSize=200`
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[GA Admin] Failed to list properties:", response.status, errorBody);
    throw new Error(`Failed to list GA4 properties: ${response.status}`);
  }

  const data = await response.json();
  const properties: GA4PropertyInfo[] = [];

  if (data.accountSummaries) {
    for (const account of data.accountSummaries) {
      if (account.propertySummaries) {
        for (const prop of account.propertySummaries) {
          const propertyId = prop.property?.replace("properties/", "") || "";
          properties.push({
            id: propertyId,
            name: prop.displayName || propertyId,
            fullName: prop.property || "",
          });
        }
      }
    }
  }

  return properties;
}

// ============ GA4 DATA API ============

interface GA4ReportRow {
  metricValues?: { value: string }[];
  dimensionValues?: { value: string }[];
}

interface GA4ReportResponse {
  rows?: GA4ReportRow[];
  rowCount?: number;
}

async function runGA4Report(
  accessToken: string,
  propertyId: string,
  startDate: string,
  endDate: string,
  metrics: string[],
  dimensions?: string[],
  limit?: number,
): Promise<GA4ReportResponse> {
  const payload: Record<string, unknown> = {
    dateRanges: [{ startDate, endDate }],
    metrics: metrics.map((m) => ({ name: m })),
  };

  if (dimensions) {
    payload.dimensions = dimensions.map((d) => ({ name: d }));
  }

  if (limit) {
    payload.limit = limit;
  }

  const response = await fetch(
    `${GA_DATA_API}/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GA4 Data API error: ${response.status} - ${errorText.slice(0, 200)}`);
  }

  return response.json();
}

/**
 * Convert GA4 date format YYYYMMDD to YYYY-MM-DD
 */
function parseGA4Date(dateStr: string): string {
  if (dateStr.length === 8 && !dateStr.includes("-")) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  return dateStr;
}

// ============ SYNC FUNCTION ============

export async function syncGoogleAnalyticsMetrics(organizationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "GOOGLE_ANALYTICS" } },
  });

  if (!integration || integration.status !== "CONNECTED" || !integration.accessToken) {
    return { error: "Google Analytics not connected" };
  }

  await prisma.integration.update({
    where: { id: integration.id },
    data: { syncStatus: "SYNCING" },
  });

  const syncLog = await prisma.syncLog.create({
    data: { organizationId, platform: "GOOGLE_ANALYTICS", status: "SYNCING" },
  });

  try {
    let accessToken = decrypt(integration.accessToken);

    // Refresh token if expired
    if (integration.tokenExpiresAt && integration.tokenExpiresAt < new Date()) {
      accessToken = await refreshGoogleAnalyticsToken(integration.id);
    }

    const propertyId = integration.externalAccountId || "";
    if (!propertyId) {
      throw new Error("No GA4 property selected");
    }

    const since = "30daysAgo";
    const until = "today";

    // Fetch all 8 reports in parallel
    const [dailyReport, trafficReport, pagesReport, devicesReport, geoReport, browserReport, genderReport, ageReport] =
      await Promise.all([
        // 1. Daily aggregate metrics
        runGA4Report(accessToken, propertyId, since, until, [
          "sessions",
          "activeUsers",
          "newUsers",
          "totalUsers",
          "screenPageViews",
          "bounceRate",
          "averageSessionDuration",
          "engagementRate",
          "conversions",
          "eventCount",
        ], ["date"]),
        // 2. Traffic sources
        runGA4Report(accessToken, propertyId, since, until,
          ["sessions", "activeUsers"],
          ["date", "sessionSource", "sessionMedium"],
          5000,
        ),
        // 3. Top pages
        runGA4Report(accessToken, propertyId, since, until,
          ["screenPageViews", "activeUsers"],
          ["date", "pagePath", "pageTitle"],
          5000,
        ),
        // 4. Device categories
        runGA4Report(accessToken, propertyId, since, until,
          ["sessions", "activeUsers"],
          ["date", "deviceCategory"],
        ),
        // 5. Geography
        runGA4Report(accessToken, propertyId, since, until,
          ["sessions", "activeUsers"],
          ["date", "country"],
          5000,
        ),
        // 6. Browsers
        runGA4Report(accessToken, propertyId, since, until,
          ["sessions"],
          ["date", "browser"],
          5000,
        ),
        // 7. Gender
        runGA4Report(accessToken, propertyId, since, until,
          ["sessions", "activeUsers"],
          ["date", "userGender"],
        ),
        // 8. Age
        runGA4Report(accessToken, propertyId, since, until,
          ["sessions", "activeUsers"],
          ["date", "userAgeBracket"],
        ),
      ]);

    // Build lookup maps for breakdowns by date
    type BreakdownEntry = Record<string, Record<string, number>>;

    function buildBreakdown(
      rows: GA4ReportRow[] | undefined,
      dateIndex: number,
      keyIndices: number[],
      metricNames: string[],
      separator?: string,
    ): Record<string, BreakdownEntry> {
      const byDate: Record<string, BreakdownEntry> = {};
      if (!rows) return byDate;

      for (const row of rows) {
        const dims = row.dimensionValues || [];
        const mets = row.metricValues || [];
        const dateStr = parseGA4Date(dims[dateIndex]?.value || "");
        const keyParts = keyIndices.map((i) => dims[i]?.value || "(not set)");
        const key = keyParts.join(separator || " / ");

        if (!byDate[dateStr]) byDate[dateStr] = {};
        const metricsObj: Record<string, number> = {};
        metricNames.forEach((name, i) => {
          metricsObj[name] = parseFloat(mets[i]?.value || "0");
        });
        byDate[dateStr][key] = metricsObj;
      }

      return byDate;
    }

    const trafficByDate = buildBreakdown(trafficReport.rows, 0, [1, 2], ["sessions", "activeUsers"]);
    const pagesByDate = buildBreakdown(pagesReport.rows, 0, [1], ["screenPageViews", "activeUsers"]);
    const devicesByDate = buildBreakdown(devicesReport.rows, 0, [1], ["sessions", "activeUsers"]);
    const geoByDate = buildBreakdown(geoReport.rows, 0, [1], ["sessions", "activeUsers"]);
    const browsersByDate = buildBreakdown(browserReport.rows, 0, [1], ["sessions"]);
    const genderByDate = buildBreakdown(genderReport.rows, 0, [1], ["sessions", "activeUsers"]);
    const ageByDate = buildBreakdown(ageReport.rows, 0, [1], ["sessions", "activeUsers"]);

    let synced = 0;

    if (dailyReport.rows) {
      for (const row of dailyReport.rows) {
        const dims = row.dimensionValues || [];
        const mets = row.metricValues || [];
        const rawDate = dims[0]?.value || "";
        const dateStr = parseGA4Date(rawDate);

        if (!dateStr || dateStr.length !== 10) continue;

        const [year, month, day] = dateStr.split("-").map(Number);
        const dateObj = new Date(Date.UTC(year, month - 1, day));

        const sessions = parseInt(mets[0]?.value || "0");
        const activeUsers = parseInt(mets[1]?.value || "0");
        const newUsers = parseInt(mets[2]?.value || "0");
        const totalUsers = parseInt(mets[3]?.value || "0");
        const screenPageViews = parseInt(mets[4]?.value || "0");
        const bounceRate = parseFloat(mets[5]?.value || "0");
        const avgSessionDuration = parseFloat(mets[6]?.value || "0");
        const engagementRate = parseFloat(mets[7]?.value || "0");
        const conversions = parseInt(mets[8]?.value || "0");
        const eventCount = parseInt(mets[9]?.value || "0");

        const trafficSources = trafficByDate[dateStr] || {};
        const topPages = pagesByDate[dateStr] || {};
        const devices = devicesByDate[dateStr] || {};
        const geography = geoByDate[dateStr] || {};
        const browsers = browsersByDate[dateStr] || {};
        const gender = genderByDate[dateStr] || {};
        const age = ageByDate[dateStr] || {};

        await prisma.analyticsMetric.upsert({
          where: {
            organizationId_propertyId_date: {
              organizationId,
              propertyId,
              date: dateObj,
            },
          },
          create: {
            organizationId,
            propertyId,
            date: dateObj,
            sessions,
            activeUsers,
            newUsers,
            totalUsers,
            screenPageViews,
            bounceRate,
            averageSessionDuration: avgSessionDuration,
            engagementRate,
            conversions,
            eventCount,
            trafficSources,
            topPages,
            devices,
            geography,
            browsers,
            gender,
            age,
          },
          update: {
            sessions,
            activeUsers,
            newUsers,
            totalUsers,
            screenPageViews,
            bounceRate,
            averageSessionDuration: avgSessionDuration,
            engagementRate,
            conversions,
            eventCount,
            trafficSources,
            topPages,
            devices,
            geography,
            browsers,
            gender,
            age,
          },
        });
        synced++;
      }
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
