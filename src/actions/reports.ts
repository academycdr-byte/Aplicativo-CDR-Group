"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

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

// ─── CLIENTS ───────────────────────────────────────

export async function getReportClients() {
    try {
        const { organizationId } = await requireAdmin();

        // @ts-ignore - Prisma types may not be generated yet
        return await prisma.reportClient.findMany({
            where: { organizationId },
            orderBy: { createdAt: "desc" },
        });
    } catch (error: any) {
        // If table doesn't exist yet, return empty array
        if (error.code === 'P2021' || error.message?.includes('does not exist')) {
            return [];
        }
        // Re-throw auth errors
        if (error.message?.includes('Não autenticado') || error.message?.includes('Acesso negado')) {
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
    } catch (error: any) {
        if (error.code === 'P2021' || error.message?.includes('does not exist')) {
            return null;
        }
        if (error.message?.includes('Não autenticado') || error.message?.includes('Acesso negado')) {
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
    } catch (error: any) {
        if (error.code === 'P2021' || error.message?.includes('does not exist')) {
            return [];
        }
        if (error.message?.includes('Não autenticado') || error.message?.includes('Acesso negado')) {
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
            config: data.config as any,
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
        config: any;
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
    } catch (error: any) {
        if (error.code === 'P2021' || error.message?.includes('does not exist')) {
            return [];
        }
        if (error.message?.includes('Não autenticado') || error.message?.includes('Acesso negado')) {
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
    metrics: any;
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

    let from: Date;
    let to: Date = new Date();

    switch (period) {
        case "last7":
            from = new Date();
            from.setDate(from.getDate() - 7);
            break;
        case "last14":
            from = new Date();
            from.setDate(from.getDate() - 14);
            break;
        case "last30":
            from = new Date();
            from.setDate(from.getDate() - 30);
            break;
        case "weekStart":
            from = new Date();
            from.setDate(from.getDate() - from.getDay());
            from.setHours(0, 0, 0, 0);
            break;
        case "monthStart":
            from = new Date();
            from.setDate(1);
            from.setHours(0, 0, 0, 0);
            break;
        case "lastMonth":
            from = new Date();
            from.setMonth(from.getMonth() - 1);
            from.setDate(1);
            from.setHours(0, 0, 0, 0);
            to = new Date(from);
            to.setMonth(to.getMonth() + 1);
            to.setDate(0);
            to.setHours(23, 59, 59, 999);
            break;
        case "custom":
            if (!customFrom || !customTo) throw new Error("Datas personalizadas necessárias");
            from = customFrom;
            to = customTo;
            break;
        default:
            from = new Date();
            from.setDate(from.getDate() - 7);
    }

    try {
        // Get Ad Metrics
        const adMetrics = await prisma.adMetric.aggregate({
            where: {
                organizationId,
                date: { gte: from, lte: to },
            },
            _sum: {
                spend: true,
                revenue: true,
                conversions: true,
                addToCart: true,
                initiateCheckout: true,
            },
        });

        // Get Store Funnel
        const funnelData = await prisma.storeFunnel.aggregate({
            where: {
                organizationId,
                date: { gte: from, lte: to },
            },
            _sum: {
                sessions: true,
                addToCart: true,
                checkoutsInitiated: true,
                ordersGenerated: true,
            },
        });

        // Calculate derived metrics
        const spend = Number(adMetrics._sum.spend) || 0;
        const revenue = Number(adMetrics._sum.revenue) || 0;
        const conversions = adMetrics._sum.conversions || 0;
        const roas = spend > 0 ? revenue / spend : 0;
        const cpa = conversions > 0 ? spend / conversions : 0;
        const ticketMedio = conversions > 0 ? revenue / conversions : 0;

        // Get previous period for comparison
        const periodDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
        const prevFrom = new Date(from);
        prevFrom.setDate(prevFrom.getDate() - periodDays);
        const prevTo = new Date(from);
        prevTo.setDate(prevTo.getDate() - 1);

        const prevAdMetrics = await prisma.adMetric.aggregate({
            where: {
                organizationId,
                date: { gte: prevFrom, lte: prevTo },
            },
            _sum: {
                spend: true,
                revenue: true,
                conversions: true,
            },
        });

        const prevSpend = Number(prevAdMetrics._sum.spend) || 0;
        const prevRevenue = Number(prevAdMetrics._sum.revenue) || 0;
        const prevConversions = prevAdMetrics._sum.conversions || 0;
        const prevRoas = prevSpend > 0 ? prevRevenue / prevSpend : 0;

        // Get Top Creatives
        const topCreatives = await prisma.adMetric.groupBy({
            by: ["adId", "adName"],
            where: {
                organizationId,
                date: { gte: from, lte: to },
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
                roas,
                investimento: spend,
                pedidos: conversions,
                cpa,
                ticketMedio,
            },
            funnel: {
                sessions: funnelData._sum.sessions || 0,
                addToCart: funnelData._sum.addToCart || adMetrics._sum.addToCart || 0,
                checkout: funnelData._sum.checkoutsInitiated || adMetrics._sum.initiateCheckout || 0,
                conversions,
            },
            comparison: {
                faturamento: revenue - prevRevenue,
                faturamentoPercent: prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0,
                roas: roas - prevRoas,
                pedidos: conversions - prevConversions,
            },
            topCreatives: creativesWithRoas,
        };
    } catch (error) {
        console.error("getMetricsForReport error:", error);
        // Return empty/default metrics
        return {
            period: { from, to },
            metrics: {
                faturamento: 0,
                roas: 0,
                investimento: 0,
                pedidos: 0,
                cpa: 0,
                ticketMedio: 0,
            },
            funnel: {
                sessions: 0,
                addToCart: 0,
                checkout: 0,
                conversions: 0,
            },
            comparison: {
                faturamento: 0,
                faturamentoPercent: 0,
                roas: 0,
                pedidos: 0,
            },
            topCreatives: [],
        };
    }
}
