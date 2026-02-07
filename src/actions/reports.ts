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
    const { organizationId } = await requireAdmin();

    return prisma.reportClient.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
    });
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

    const client = await prisma.reportClient.update({
        where: { id },
        data,
    });

    revalidatePath("/reports");
    return client;
}

export async function deleteReportClient(id: string) {
    await requireAdmin();

    await prisma.reportClient.delete({ where: { id } });
    revalidatePath("/reports");
}

// ─── WHATSAPP SESSION ──────────────────────────────

export async function getWhatsAppSession() {
    const { organizationId } = await requireAdmin();

    return prisma.whatsAppSession.findUnique({
        where: { organizationId },
    });
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

    await prisma.whatsAppSession.update({
        where: { organizationId },
        data: { status: "DISCONNECTED", qr: null },
    });

    revalidatePath("/reports");
}

// ─── SCHEDULES ─────────────────────────────────────

export async function getReportSchedules() {
    const { organizationId } = await requireAdmin();

    return prisma.reportSchedule.findMany({
        where: {
            client: { organizationId },
        },
        include: { client: true },
        orderBy: { createdAt: "desc" },
    });
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

    const schedule = await prisma.reportSchedule.update({
        where: { id },
        data,
    });

    revalidatePath("/reports");
    return schedule;
}

export async function deleteReportSchedule(id: string) {
    await requireAdmin();

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
    const { organizationId } = await requireAdmin();

    return prisma.reportLog.findMany({
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
}

export async function createReportLog(data: {
    clientId: string;
    type: "MANUAL" | "SCHEDULED";
    status: "SUCCESS" | "FAILED" | "PENDING";
    metrics: any;
    error?: string;
}) {
    await requireAdmin();

    return prisma.reportLog.create({ data });
}

export async function updateReportLog(
    id: string,
    data: { status: string; error?: string }
) {
    await requireAdmin();

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
}

// ─── MESSAGE BUILDER ───────────────────────────────

export function buildReportMessage(
    clientName: string,
    period: { from: Date; to: Date },
    metrics: any,
    options: {
        selectedMetrics: string[];
        comparePeriods: boolean;
        rankingCreatives: boolean;
        customHeader?: string;
    },
    funnel: any,
    comparison: any,
    topCreatives: any[]
): string {
    const formatDate = (d: Date) =>
        d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

    const formatNumber = (v: number) =>
        new Intl.NumberFormat("pt-BR").format(v);

    let message = "";

    // Custom Header
    if (options.customHeader) {
        message += `${options.customHeader}\n\n`;
    }

    // Header
    message += `📊 *Relatório ${clientName}*\n`;
    message += `📅 Período: ${formatDate(period.from)} a ${formatDate(period.to)}\n\n`;

    // Main Metrics
    const metricLabels: Record<string, { emoji: string; label: string; format: (v: number) => string }> = {
        faturamento: { emoji: "💰", label: "Faturamento", format: formatCurrency },
        roas: { emoji: "📊", label: "ROAS", format: (v) => `${v.toFixed(2)}x` },
        investimento: { emoji: "💸", label: "Investimento", format: formatCurrency },
        pedidos: { emoji: "📦", label: "Pedidos", format: formatNumber },
        cpa: { emoji: "🎯", label: "CPA", format: formatCurrency },
        ticketMedio: { emoji: "🛒", label: "Ticket Médio", format: formatCurrency },
    };

    for (const key of options.selectedMetrics) {
        const config = metricLabels[key];
        if (config && metrics[key] !== undefined) {
            message += `${config.emoji} *${config.label}:* ${config.format(metrics[key])}\n`;
        }
    }

    // Funnel
    const funnelMetrics = ["sessions", "addToCart", "checkout"];
    const hasFunnelMetric = options.selectedMetrics.some((m) =>
        ["sessions", "addToCart", "checkout", "taxaConversao"].includes(m)
    );

    if (hasFunnelMetric) {
        message += "\n🔗 *Funil de Vendas:*\n";
        if (options.selectedMetrics.includes("sessions")) {
            message += `👀 Sessões: ${formatNumber(funnel.sessions)}\n`;
        }
        if (options.selectedMetrics.includes("addToCart")) {
            message += `🛒 Carrinho: ${formatNumber(funnel.addToCart)}\n`;
        }
        if (options.selectedMetrics.includes("checkout")) {
            message += `✅ Checkout: ${formatNumber(funnel.checkout)}\n`;
        }
        if (options.selectedMetrics.includes("taxaConversao") && funnel.sessions > 0) {
            const taxa = ((funnel.conversions || metrics.pedidos) / funnel.sessions) * 100;
            message += `📈 Taxa Conversão: ${taxa.toFixed(2)}%\n`;
        }
    }

    // Comparison
    if (options.comparePeriods && comparison) {
        message += "\n📈 *Comparativo vs período anterior:*\n";

        const sign = (v: number) => (v >= 0 ? "+" : "");
        const arrow = (v: number) => (v >= 0 ? "↑" : "↓");

        if (options.selectedMetrics.includes("faturamento")) {
            message += `💰 Faturamento: ${sign(comparison.faturamentoPercent)}${comparison.faturamentoPercent.toFixed(1)}% ${arrow(comparison.faturamentoPercent)}\n`;
        }
        if (options.selectedMetrics.includes("roas")) {
            message += `📊 ROAS: ${sign(comparison.roas)}${comparison.roas.toFixed(2)}x ${arrow(comparison.roas)}\n`;
        }
        if (options.selectedMetrics.includes("pedidos")) {
            message += `📦 Pedidos: ${sign(comparison.pedidos)}${comparison.pedidos} ${arrow(comparison.pedidos)}\n`;
        }
    }

    // Top Creatives
    if (options.rankingCreatives && topCreatives.length > 0) {
        message += "\n🏆 *Top 3 Criativos por ROAS:*\n";
        topCreatives.forEach((c, i) => {
            const name = c.adName || c.adId || "Criativo";
            message += `${i + 1}. ${name.slice(0, 20)} — ROAS ${c.roas.toFixed(1)}x\n`;
        });
    }

    // Footer
    message += "\n_Enviado automaticamente pelo CDR Group_";

    return message;
}
