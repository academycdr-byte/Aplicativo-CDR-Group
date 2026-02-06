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
