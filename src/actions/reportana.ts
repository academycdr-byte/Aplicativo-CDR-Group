"use server";

import { getSessionWithOrg } from "@/lib/session";
import {
  fetchReportanaData as fetchData,
  fetchReportanaMetrics,
} from "@/lib/integrations/reportana";

export async function getReportanaData() {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { error: "Not authenticated" };

  return fetchData(ctx.organization.id);
}

export async function getReportanaMetrics(days: number = 30, from?: string, to?: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { error: "Not authenticated" };

  return fetchReportanaMetrics(ctx.organization.id, days, from, to);
}
