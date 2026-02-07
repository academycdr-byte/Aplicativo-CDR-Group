import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

export async function fetchReportanaData(organizationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "REPORTANA" } },
  });

  if (!integration || integration.status !== "CONNECTED" || !integration.apiKey) {
    return { error: "Reportana not connected" };
  }

  try {
    const apiKey = decrypt(integration.apiKey);

    const response = await fetch("https://api.reportana.com/v1/reports", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Reportana API error: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, reports: data.data || data.reports || [] };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    return { error: errorMsg };
  }
}

export async function fetchReportanaMetrics(organizationId: string, period: string = "30d") {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "REPORTANA" } },
  });

  if (!integration || integration.status !== "CONNECTED" || !integration.apiKey) {
    return { error: "Reportana not connected" };
  }

  try {
    const apiKey = decrypt(integration.apiKey);

    const response = await fetch(`https://api.reportana.com/v1/metrics?period=${period}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Reportana API error: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, metrics: data };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    return { error: errorMsg };
  }
}

export async function syncReportanaMetrics(organizationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "REPORTANA" } },
  });

  if (!integration || integration.status !== "CONNECTED" || !integration.apiKey) {
    return { error: "Reportana not connected" };
  }

  await prisma.integration.update({
    where: { id: integration.id },
    data: { syncStatus: "SYNCING" },
  });

  const syncLog = await prisma.syncLog.create({
    data: { organizationId, platform: "REPORTANA", status: "SYNCING" },
  });

  try {
    const apiKey = decrypt(integration.apiKey);

    // Fetch ad metrics from Reportana for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since = thirtyDaysAgo.toISOString().split("T")[0];
    const until = new Date().toISOString().split("T")[0];

    const response = await fetch(
      `https://api.reportana.com/v1/metrics?start_date=${since}&end_date=${until}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Reportana API error: ${response.status}`);
    }

    const data = await response.json();
    const metrics = data.data || data.metrics || [];
    let synced = 0;

    for (const metric of metrics) {
      const campaignId = metric.campaign_id || metric.id || "unknown";
      const metricDate = metric.date ? new Date(metric.date) : new Date();

      await prisma.adMetric.upsert({
        where: {
          organizationId_platform_campaignId_date: {
            organizationId,
            platform: "REPORTANA",
            campaignId: String(campaignId),
            date: metricDate,
          },
        },
        create: {
          organizationId,
          platform: "REPORTANA",
          campaignId: String(campaignId),
          campaignName: metric.campaign_name || metric.name || null,
          adSetId: metric.ad_set_id || null,
          adSetName: metric.ad_set_name || null,
          date: metricDate,
          impressions: parseInt(metric.impressions || "0"),
          clicks: parseInt(metric.clicks || "0"),
          spend: parseFloat(metric.spend || metric.cost || "0"),
          conversions: parseInt(metric.conversions || metric.purchases || "0"),
          revenue: parseFloat(metric.revenue || metric.value || "0"),
          currency: "BRL",
          rawData: metric,
        },
        update: {
          campaignName: metric.campaign_name || metric.name || null,
          adSetName: metric.ad_set_name || null,
          impressions: parseInt(metric.impressions || "0"),
          clicks: parseInt(metric.clicks || "0"),
          spend: parseFloat(metric.spend || metric.cost || "0"),
          conversions: parseInt(metric.conversions || metric.purchases || "0"),
          revenue: parseFloat(metric.revenue || metric.value || "0"),
          rawData: metric,
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
