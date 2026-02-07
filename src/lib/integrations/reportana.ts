import { prisma } from "@/lib/prisma";

/**
 * Busca dados agregados dos eventos da Reportana (carrinhos abandonados e recuperados).
 * Os dados vem do webhook POST /api/webhooks/reportana.
 */
export async function fetchReportanaData(organizationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "REPORTANA" } },
  });

  if (!integration || integration.status !== "CONNECTED") {
    return { error: "Reportana not connected" };
  }

  return { success: true, reports: [] };
}

/**
 * Busca metricas de carrinhos abandonados e recuperados.
 */
export async function fetchReportanaMetrics(organizationId: string, days: number = 30, from?: string, to?: string) {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "REPORTANA" } },
  });

  if (!integration || integration.status !== "CONNECTED") {
    return { error: "Reportana not connected" };
  }

  let dateFilter: { gte: Date; lte?: Date };
  if (from && to) {
    dateFilter = { gte: new Date(from), lte: new Date(to) };
  } else {
    const since = new Date();
    if (days === 0) {
      since.setHours(0, 0, 0, 0);
    } else {
      since.setDate(since.getDate() - days);
    }
    dateFilter = { gte: since };
  }

  const [abandonedAgg, recoveredAgg, abandonedCount, recoveredCount, recentAbandoned, recentRecovered] =
    await Promise.all([
      prisma.reportanaEvent.aggregate({
        where: { organizationId, eventType: "abandoned_checkout", eventDate: dateFilter },
        _sum: { totalPrice: true },
      }),
      prisma.reportanaEvent.aggregate({
        where: { organizationId, eventType: "checkout_recovered", eventDate: dateFilter },
        _sum: { totalPrice: true },
      }),
      prisma.reportanaEvent.count({
        where: { organizationId, eventType: "abandoned_checkout", eventDate: dateFilter },
      }),
      prisma.reportanaEvent.count({
        where: { organizationId, eventType: "checkout_recovered", eventDate: dateFilter },
      }),
      prisma.reportanaEvent.findMany({
        where: { organizationId, eventType: "abandoned_checkout", eventDate: dateFilter },
        orderBy: { eventDate: "desc" },
        take: 10,
      }),
      prisma.reportanaEvent.findMany({
        where: { organizationId, eventType: "checkout_recovered", eventDate: dateFilter },
        orderBy: { eventDate: "desc" },
        take: 10,
      }),
    ]);

  const abandonedTotal = Number(abandonedAgg._sum.totalPrice || 0);
  const recoveredTotal = Number(recoveredAgg._sum.totalPrice || 0);
  const recoveryRate = abandonedTotal > 0 ? (recoveredTotal / abandonedTotal) * 100 : 0;

  return {
    success: true,
    metrics: {
      abandonedTotal,
      abandonedCount,
      recoveredTotal,
      recoveredCount,
      recoveryRate: Math.round(recoveryRate * 10) / 10,
    },
    recentAbandoned: recentAbandoned.map((e) => ({
      id: e.id,
      referenceId: e.referenceId,
      customerName: e.customerName,
      customerEmail: e.customerEmail,
      totalPrice: Number(e.totalPrice),
      currency: e.currency,
      eventDate: e.eventDate,
    })),
    recentRecovered: recentRecovered.map((e) => ({
      id: e.id,
      referenceId: e.referenceId,
      customerName: e.customerName,
      customerEmail: e.customerEmail,
      totalPrice: Number(e.totalPrice),
      currency: e.currency,
      eventDate: e.eventDate,
    })),
  };
}

/**
 * Sync function - para Reportana os dados vem via webhook, entao
 * esta funcao apenas valida a conexao e atualiza o status.
 */
export async function syncReportanaMetrics(organizationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "REPORTANA" } },
  });

  if (!integration || integration.status !== "CONNECTED") {
    return { error: "Reportana not connected" };
  }

  // Count events received via webhook
  const eventCount = await prisma.reportanaEvent.count({
    where: { organizationId },
  });

  await prisma.integration.update({
    where: { id: integration.id },
    data: { syncStatus: "SUCCESS", lastSyncAt: new Date() },
  });

  return { success: true, synced: eventCount };
}
