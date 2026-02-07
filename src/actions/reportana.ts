"use server";

import { getSessionWithOrg } from "@/lib/session";
import { fetchReportanaData as fetchData } from "@/lib/integrations/reportana";

export async function getReportanaData() {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { error: "Not authenticated" };

  return fetchData(ctx.organization.id);
}
