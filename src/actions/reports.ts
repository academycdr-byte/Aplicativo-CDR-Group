"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import {
    getBrazilToday,
    toBrasiliaStartOfDay,
    toBrasiliaEndOfDay,
    getDateRange,
    buildDateFilter,
} from "@/lib/date-utils";

// Check if user is admin
async function requireAdmin() {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Não autenticado");

    const membership = await prisma.membership.findFirst({
        where: { userId: session.user.id },
    });

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
        throw new Error("Acesso negado: apenas administradores");
    }

    return { userId: session.user.id, organizationId: membership.organizationId };
}

// ─── ACCESS CHECK ─────────────────────────────────

export async function checkReportsAccess(): Promise<{ allowed: boolean; role?: string }> {
    const session = await auth();
    if (!session?.user?.id) return { allowed: false };

    const membership = await prisma.membership.findFirst({
        where: { userId: session.user.id },
    });

    if (!membership) return { allowed: false };

    const isAdmin = ["OWNER", "ADMIN"].includes(membership.role);
    return { allowed: isAdmin, role: membership.role };
}

// ─── CLIENTS ───────────────────────────────────────

export async function getReportClients() {
    try {
        const { organizationId } = await requireAdmin();

        // @ts-ignore - Prisma types may not be generated yet
        return await prisma.reportClient.findMany({
            where: { organizationId },
            orderBy: { createdAt: "desc" },
        });
    } catch (error: unknown) {
        // If table doesn't exist yet, return empty array
        const err = error as { code?: string; message?: string };
        if (err.code === 'P2021' || err.message?.includes('does not exist')) {
            return [];
        }
        // Re-throw auth errors
        if (err.message?.includes('Não autenticado') || err.message?.includes('Acesso negado')) {
            throw error;
        }
        console.error("getReportClients error:", error);
        return [];
    }
}

export async function createReportClient(data: {
    name: string;
    responsible: string;
    phone: string;
    plan: "FORMULA_BASE" | "FORMULA_AVANCADA" | "FORMULA_TOTAL" | "PERSONALIZADO";
    status: "ACTIVE" | "PAUSED" | "CANCELLED";
    startDate: Date;
    groupName?: string;
    groupId?: string;
    notes?: string;
}) {
    const { organizationId } = await requireAdmin();

    // @ts-ignore - Prisma types may not be generated yet
    const client = await prisma.reportClient.create({
        data: {
            ...data,
            organizationId,
        },
    });

    revalidatePath("/reports");
    return client;
}

export async function updateReportClient(
    id: string,
    data: Partial<{
        name: string;
        responsible: string;
        phone: string;
        plan: "FORMULA_BASE" | "FORMULA_AVANCADA" | "FORMULA_TOTAL" | "PERSONALIZADO";
        status: "ACTIVE" | "PAUSED" | "CANCELLED";
        startDate: Date;
        groupName: string;
        groupId: string;
        notes: string;
    }>
) {
    await requireAdmin();

    // @ts-ignore - Prisma types may not be generated yet
    const client = await prisma.reportClient.update({
        where: { id },
        data,
    });

    revalidatePath("/reports");
    return client;
}

export async function deleteReportClient(id: string) {
    await requireAdmin();

    // @ts-ignore - Prisma types may not be generated yet
    await prisma.reportClient.delete({ where: { id } });
    revalidatePath("/reports");
}

// ─── WHATSAPP SESSION ──────────────────────────────

export async function getWhatsAppSession() {
    try {
        const { organizationId } = await requireAdmin();

        // @ts-ignore - Prisma types may not be generated yet
        return await prisma.whatsAppSession.findUnique({
            where: { organizationId },
        });
    } catch (error: unknown) {
        const err = error as { code?: string; message?: string };
        if (err.code === 'P2021' || err.message?.includes('does not exist')) {
            return null;
        }
        if (err.message?.includes('Não autenticado') || err.message?.includes('Acesso negado')) {
            throw error;
        }
        console.error("getWhatsAppSession error:", error);
        return null;
    }
}

export async function saveWhatsAppSession(data: {
    sessionId: string;
    creds: string;
    status: string;
    qr?: string;
    me?: string;
    pushName?: string;
}) {
    const { organizationId } = await requireAdmin();

    // @ts-ignore - Prisma types may not be generated yet
    return prisma.whatsAppSession.upsert({
        where: { organizationId },
        create: {
            organizationId,
            ...data,
        },
        update: data,
    });
}

export async function disconnectWhatsApp() {
    const { organizationId } = await requireAdmin();

    // @ts-ignore - Prisma types may not be generated yet
    await prisma.whatsAppSession.update({
        where: { organizationId },
        data: { status: "DISCONNECTED", qr: null },
    });

    revalidatePath("/reports");
}

// ─── SCHEDULES ─────────────────────────────────────

export async function getReportSchedules() {
    try {
        const { organizationId } = await requireAdmin();

        // @ts-ignore - Prisma types may not be generated yet
        return await prisma.reportSchedule.findMany({
            where: {
                client: { organizationId },
            },
            include: { client: true },
            orderBy: { createdAt: "desc" },
        });
    } catch (error: unknown) {
        const err = error as { code?: string; message?: string };
        if (err.code === 'P2021' || err.message?.includes('does not exist')) {
            return [];
        }
        if (err.message?.includes('Não autenticado') || err.message?.includes('Acesso negado')) {
            throw error;
        }
        console.error("getReportSchedules error:", error);
        return [];
    }
}

export async function createReportSchedule(data: {
    clientId: string;
    frequency: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
    time: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    config: {
        period: string;
        metrics: string[];
        comparePeriods: boolean;
        rankingCreatives: boolean;
        customHeader?: string;
    };
}) {
    await requireAdmin();

    // @ts-ignore - Prisma types may not be generated yet
    const schedule = await prisma.reportSchedule.create({
        data: {
            ...data,
            config: data.config as Prisma.InputJsonValue,
        },
    });

    revalidatePath("/reports");
    return schedule;
}

export async function updateReportSchedule(
    id: string,
    data: Partial<{
        frequency: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
        time: string;
        dayOfWeek: number;
        dayOfMonth: number;
        config: Prisma.InputJsonValue;
        isActive: boolean;
    }>
) {
    await requireAdmin();

    // @ts-ignore - Prisma types may not be generated yet
    const schedule = await prisma.reportSchedule.update({
        where: { id },
        data,
    });

    revalidatePath("/reports");
    return schedule;
}

export async function deleteReportSchedule(id: string) {
    await requireAdmin();

    // @ts-ignore - Prisma types may not be generated yet
    await prisma.reportSchedule.delete({ where: { id } });
    revalidatePath("/reports");
}

// ─── LOGS ──────────────────────────────────────────

export async function getReportLogs(filters?: {
    clientId?: string;
    status?: string;
    from?: Date;
    to?: Date;
}) {
    try {
        const { organizationId } = await requireAdmin();

        // @ts-ignore - Prisma types may not be generated yet
        return await prisma.reportLog.findMany({
            where: {
                client: { organizationId },
                ...(filters?.clientId && { clientId: filters.clientId }),
                ...(filters?.status && { status: filters.status }),
                ...(filters?.from && { sentAt: { gte: filters.from } }),
                ...(filters?.to && { sentAt: { lte: filters.to } }),
            },
            include: { client: true },
            orderBy: { sentAt: "desc" },
            take: 200,
        });
    } catch (error: unknown) {
        const err = error as { code?: string; message?: string };
        if (err.code === 'P2021' || err.message?.includes('does not exist')) {
            return [];
        }
        if (err.message?.includes('Não autenticado') || err.message?.includes('Acesso negado')) {
            throw error;
        }
        console.error("getReportLogs error:", error);
        return [];
    }
}

export async function createReportLog(data: {
    clientId: string;
    type: "MANUAL" | "SCHEDULED";
    status: "SUCCESS" | "FAILED" | "PENDING";
    metrics: Prisma.InputJsonValue;
    error?: string;
}) {
    await requireAdmin();

    // @ts-ignore - Prisma types may not be generated yet
    return prisma.reportLog.create({ data });
}

export async function updateReportLog(
    id: string,
    data: { status: string; error?: string }
) {
    await requireAdmin();

    // @ts-ignore - Prisma types may not be generated yet
    return prisma.reportLog.update({
        where: { id },
        data,
    });
}

// ─── METRICS FETCHER ───────────────────────────────

export async function getMetricsForReport(
    period: string,
    customFrom?: Date,
    customTo?: Date
) {
    const { organizationId } = await requireAdmin();

    // Use Brazil timezone for all date calculations
    let from: Date;
    let to: Date;

    switch (period) {
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
        case "lastMonth": {
            const todayStr = getBrazilToday();
            const todayParts = todayStr.split("-").map(Number);
            const lastMonthDate = new Date(Date.UTC(todayParts[0], todayParts[1] - 2, 1));
            const lastMonthStartStr = lastMonthDate.toISOString().split("T")[0];
            const lastMonthEndDate = new Date(Date.UTC(todayParts[0], todayParts[1] - 1, 0));
            const lastMonthEndStr = lastMonthEndDate.toISOString().split("T")[0];
            from = toBrasiliaStartOfDay(lastMonthStartStr);
            to = toBrasiliaEndOfDay(lastMonthEndStr);
            break;
        }
        case "custom":
            if (!customFrom || !customTo) throw new Error("Datas personalizadas necessárias");
            from = customFrom;
            to = customTo;
            break;
        default: {
            const range = getDateRange(7);
            from = range.since;
            to = range.until;
        }
    }

    try {
        const dateFilter = { gte: from, lte: to };

        // Get Ad Metrics
        const adMetrics = await prisma.adMetric.aggregate({
            where: { organizationId, date: dateFilter },
            _sum: {
                spend: true,
                revenue: true,
                conversions: true,
                clicks: true,
                addToCart: true,
                initiateCheckout: true,
            },
        });

        // Get Store Funnel (only records with sessions > 0 = real ShopifyQL data)
        const storeFunnelAgg = await prisma.storeFunnel.aggregate({
            where: {
                organizationId,
                date: dateFilter,
                sessions: { gt: 0 },
            },
            _sum: {
                sessions: true,
                addToCart: true,
                checkoutsInitiated: true,
                ordersGenerated: true,
            },
        }).catch(() => ({ _sum: { sessions: 0, addToCart: 0, checkoutsInitiated: 0, ordersGenerated: 0 } }));

        // Get Order data (real orders from Order table)
        const [totalOrders, paidOrders] = await Promise.all([
            prisma.order.count({ where: { organizationId, orderDate: dateFilter } }),
            prisma.order.count({ where: { organizationId, orderDate: dateFilter, status: "paid" } }),
        ]);

        // Sessions: StoreFunnel first, fallback to AdMetric clicks
        const storeSessions = Number(storeFunnelAgg._sum.sessions || 0);
        const storeAddToCart = Number(storeFunnelAgg._sum.addToCart || 0);
        const storeCheckouts = Number(storeFunnelAgg._sum.checkoutsInitiated || 0);

        let sessions = storeSessions;
        let funnelAddToCart = storeAddToCart;
        let funnelCheckout = storeCheckouts;

        if (sessions === 0) {
            sessions = Number(adMetrics._sum.clicks || 0);
            if (funnelAddToCart === 0) funnelAddToCart = Number(adMetrics._sum.addToCart || 0);
            if (funnelCheckout === 0) funnelCheckout = Number(adMetrics._sum.initiateCheckout || 0);
        }

        // Calculate derived metrics
        const spend = Number(adMetrics._sum.spend) || 0;
        const revenue = Number(adMetrics._sum.revenue) || 0;
        const roas = spend > 0 ? revenue / spend : 0;
        const cpa = paidOrders > 0 ? spend / paidOrders : 0;
        const ticketMedio = paidOrders > 0 ? revenue / paidOrders : 0;

        // Get previous period for comparison (timezone-aware)
        const periodMs = to.getTime() - from.getTime();
        const prevTo = new Date(from.getTime() - 1);
        const prevFrom = new Date(from.getTime() - periodMs);

        const prevAdMetrics = await prisma.adMetric.aggregate({
            where: {
                organizationId,
                date: { gte: prevFrom, lte: prevTo },
            },
            _sum: {
                spend: true,
                revenue: true,
            },
        });

        const prevSpend = Number(prevAdMetrics._sum.spend) || 0;
        const prevRevenue = Number(prevAdMetrics._sum.revenue) || 0;
        const prevRoas = prevSpend > 0 ? prevRevenue / prevSpend : 0;

        const [prevTotalOrders, prevPaidOrders] = await Promise.all([
            prisma.order.count({ where: { organizationId, orderDate: { gte: prevFrom, lte: prevTo } } }),
            prisma.order.count({ where: { organizationId, orderDate: { gte: prevFrom, lte: prevTo }, status: "paid" } }),
        ]);

        // Get Top Creatives
        const topCreatives = await prisma.adMetric.groupBy({
            by: ["adId", "adName"],
            where: {
                organizationId,
                date: dateFilter,
                adId: { not: null },
            },
            _sum: {
                spend: true,
                revenue: true,
            },
            orderBy: {
                _sum: { revenue: 'desc' },
            },
            take: 10,
        });

        const creativesWithRoas = topCreatives
            .map((c) => ({
                adId: c.adId,
                adName: c.adName,
                spend: Number(c._sum.spend) || 0,
                revenue: Number(c._sum.revenue) || 0,
                roas: (Number(c._sum.spend) || 0) > 0
                    ? (Number(c._sum.revenue) || 0) / (Number(c._sum.spend) || 0)
                    : 0,
            }))
            .filter((c) => c.spend >= 10)
            .sort((a, b) => b.roas - a.roas)
            .slice(0, 3);

        return {
            period: { from, to },
            metrics: {
                faturamento: revenue,
                investimento: spend,
                roas,
                cpa,
                ticketMedio,
            },
            funnel: {
                sessions,
                addToCart: funnelAddToCart,
                checkout: funnelCheckout,
                pedidosGerados: totalOrders,
                pedidosPagos: paidOrders,
                taxaPagamento: totalOrders > 0 ? (paidOrders / totalOrders) * 100 : 0,
            },
            comparison: {
                faturamento: revenue - prevRevenue,
                faturamentoPercent: prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0,
                roas: roas - prevRoas,
                pedidosGerados: totalOrders - prevTotalOrders,
                pedidosPagos: paidOrders - prevPaidOrders,
            },
            topCreatives: creativesWithRoas,
        };
    } catch (error) {
        console.error("getMetricsForReport error:", error);
        return {
            period: { from, to },
            metrics: {
                faturamento: 0,
                investimento: 0,
                roas: 0,
                cpa: 0,
                ticketMedio: 0,
            },
            funnel: {
                sessions: 0,
                addToCart: 0,
                checkout: 0,
                pedidosGerados: 0,
                pedidosPagos: 0,
                taxaPagamento: 0,
            },
            comparison: {
                faturamento: 0,
                faturamentoPercent: 0,
                roas: 0,
                pedidosGerados: 0,
                pedidosPagos: 0,
            },
            topCreatives: [],
        };
    }
}
