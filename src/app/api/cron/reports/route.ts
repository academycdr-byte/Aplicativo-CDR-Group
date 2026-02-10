import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendZApiText } from "@/lib/zapi";
import { buildReportMessage } from "@/lib/report-message";
import {
  getBrazilToday,
  toBrasiliaStartOfDay,
  toBrasiliaEndOfDay,
  getDateRange,
} from "@/lib/date-utils";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Find all active schedules that are due
    const dueSchedules = await prisma.reportSchedule.findMany({
      where: {
        isActive: true,
        OR: [
          { nextRun: { lte: now } },
          { nextRun: null },
        ],
      },
      include: {
        client: {
          include: {
            organization: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    const results = [];

    for (const schedule of dueSchedules) {
      try {
        const client = schedule.client;
        if (!client || client.status !== "ACTIVE") continue;

        const config = schedule.config as any;
        const orgId = client.organizationId;

        // Calculate date range using Brazil timezone
        let from: Date;
        let to: Date;

        switch (config?.period || "last7") {
          case "last7": {
            const range = getDateRange(7);
            from = range.since;
            to = range.until;
            break;
          }
          case "last14": {
            const range = getDateRange(14);
            from = range.since;
            to = range.until;
            break;
          }
          case "last30": {
            const range = getDateRange(30);
            from = range.since;
            to = range.until;
            break;
          }
          case "weekStart": {
            const todayStr = getBrazilToday();
            const todayParts = todayStr.split("-").map(Number);
            const todayDate = new Date(Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2]));
            const dayOfWeek = todayDate.getUTCDay();
            const weekStartDate = new Date(todayDate);
            weekStartDate.setUTCDate(weekStartDate.getUTCDate() - dayOfWeek);
            const weekStartStr = weekStartDate.toISOString().split("T")[0];
            from = toBrasiliaStartOfDay(weekStartStr);
            to = toBrasiliaEndOfDay(todayStr);
            break;
          }
          case "monthStart": {
            const todayStr = getBrazilToday();
            const monthStartStr = todayStr.slice(0, 8) + "01";
            from = toBrasiliaStartOfDay(monthStartStr);
            to = toBrasiliaEndOfDay(todayStr);
            break;
          }
          default: {
            const range = getDateRange(7);
            from = range.since;
            to = range.until;
          }
        }

        const dateFilter = { gte: from, lte: to };

        // Fetch metrics for this org
        const [adMetrics, storeFunnelAgg, totalOrders, paidOrders] = await Promise.all([
          prisma.adMetric.aggregate({
            where: { organizationId: orgId, date: dateFilter },
            _sum: {
              spend: true,
              revenue: true,
              clicks: true,
              addToCart: true,
              initiateCheckout: true,
            },
          }),
          prisma.storeFunnel.aggregate({
            where: { organizationId: orgId, date: dateFilter, sessions: { gt: 0 } },
            _sum: { sessions: true, addToCart: true, checkoutsInitiated: true, ordersGenerated: true },
          }).catch(() => ({ _sum: { sessions: 0, addToCart: 0, checkoutsInitiated: 0, ordersGenerated: 0 } })),
          prisma.order.count({ where: { organizationId: orgId, orderDate: dateFilter } }),
          prisma.order.count({ where: { organizationId: orgId, orderDate: dateFilter, status: "paid" } }),
        ]);

        const spend = Number(adMetrics._sum.spend) || 0;
        const revenue = Number(adMetrics._sum.revenue) || 0;
        let sessions = Number(storeFunnelAgg._sum.sessions || 0);
        let funnelAddToCart = Number(storeFunnelAgg._sum.addToCart || 0);
        let funnelCheckout = Number(storeFunnelAgg._sum.checkoutsInitiated || 0);

        if (sessions === 0) {
          sessions = Number(adMetrics._sum.clicks || 0);
          if (funnelAddToCart === 0) funnelAddToCart = Number(adMetrics._sum.addToCart || 0);
          if (funnelCheckout === 0) funnelCheckout = Number(adMetrics._sum.initiateCheckout || 0);
        }

        const roas = spend > 0 ? revenue / spend : 0;
        const cpa = paidOrders > 0 ? spend / paidOrders : 0;
        const ticketMedio = paidOrders > 0 ? revenue / paidOrders : 0;

        const metricsData = {
          faturamento: revenue,
          investimento: spend,
          roas,
          cpa,
          ticketMedio,
        };

        const funnelData = {
          sessions,
          addToCart: funnelAddToCart,
          checkout: funnelCheckout,
          pedidosGerados: totalOrders,
          pedidosPagos: paidOrders,
          taxaPagamento: totalOrders > 0 ? (paidOrders / totalOrders) * 100 : 0,
        };

        // Build message
        const message = buildReportMessage(
          client.name,
          { from, to },
          metricsData,
          {
            selectedMetrics: config?.metrics || ["faturamento", "investimento", "roas"],
            comparePeriods: config?.comparePeriods || false,
            rankingCreatives: config?.rankingCreatives || false,
            customHeader: config?.customHeader,
          },
          funnelData,
          { faturamento: 0, faturamentoPercent: 0, roas: 0, pedidosGerados: 0, pedidosPagos: 0 },
          []
        );

        // Send via WhatsApp
        const target = client.groupId || client.phone;
        if (target) {
          await sendZApiText(
            client.groupId || target.replace(/\D/g, "").replace(/^(\d{11})$/, "55$1"),
            message
          );
        }

        // Log success
        await prisma.reportLog.create({
          data: {
            clientId: client.id,
            type: "SCHEDULED",
            status: "SUCCESS",
            metrics: { period: config?.period, selectedMetrics: config?.metrics },
          },
        });

        // Calculate next run (in Brazil timezone: UTC-3)
        const nextRun = calculateNextRun(schedule.frequency, schedule.time, schedule.dayOfWeek, schedule.dayOfMonth);
        await prisma.reportSchedule.update({
          where: { id: schedule.id },
          data: { lastRun: now, nextRun },
        });

        results.push({ scheduleId: schedule.id, clientName: client.name, status: "sent" });
      } catch (err: any) {
        console.error(`Schedule ${schedule.id} failed:`, err);

        await prisma.reportLog.create({
          data: {
            clientId: schedule.clientId,
            type: "SCHEDULED",
            status: "FAILED",
            metrics: {},
            error: err.message,
          },
        }).catch(() => {});

        results.push({ scheduleId: schedule.id, status: "failed", error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error("Cron reports error:", error);
    return NextResponse.json(
      { error: "Reports cron failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

function calculateNextRun(
  frequency: string,
  time: string,
  dayOfWeek: number | null,
  dayOfMonth: number | null
): Date {
  const [hours, minutes] = (time || "09:00").split(":").map(Number);
  // Schedule times are in Brazil timezone (UTC-3)
  // Convert to UTC: add 3 hours
  const utcHours = hours + 3;

  const todayStr = getBrazilToday();
  const todayParts = todayStr.split("-").map(Number);
  const next = new Date(Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2], utcHours, minutes, 0, 0));

  switch (frequency) {
    case "DAILY":
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case "WEEKLY":
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case "BIWEEKLY":
      next.setUTCDate(next.getUTCDate() + 14);
      break;
    case "MONTHLY":
      next.setUTCMonth(next.getUTCMonth() + 1);
      if (dayOfMonth) next.setUTCDate(dayOfMonth);
      break;
    default:
      next.setUTCDate(next.getUTCDate() + 1);
  }

  return next;
}
