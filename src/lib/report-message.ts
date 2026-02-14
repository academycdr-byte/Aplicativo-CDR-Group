// Report message builder utility

interface ReportMetrics {
    faturamento: number;
    investimento: number;
    roas: number;
    cpa: number;
    ticketMedio: number;
    [key: string]: number;
}

interface ReportFunnel {
    sessions: number;
    addToCart: number;
    checkout: number;
    pedidosGerados: number;
    pedidosPagos: number;
    taxaPagamento: number;
}

interface ReportComparison {
    faturamento: number;
    faturamentoPercent: number;
    roas: number;
    pedidosGerados: number;
    pedidosPagos: number;
}

interface ReportCreative {
    adId: string | null;
    adName: string | null;
    spend: number;
    revenue: number;
    roas: number;
}

export function buildReportMessage(
    clientName: string,
    period: { from: Date; to: Date },
    metrics: ReportMetrics,
    options: {
        selectedMetrics: string[];
        comparePeriods: boolean;
        rankingCreatives: boolean;
        customHeader?: string;
    },
    funnel: ReportFunnel,
    comparison: ReportComparison,
    topCreatives: ReportCreative[]
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

    // Main Metrics (order: faturamento, investimento, roas, cpa, ticketMedio)
    const metricLabels: Record<string, { emoji: string; label: string; format: (v: number) => string }> = {
        faturamento: { emoji: "💰", label: "Faturamento", format: formatCurrency },
        investimento: { emoji: "💸", label: "Investimento", format: formatCurrency },
        roas: { emoji: "📊", label: "ROAS", format: (v) => `${v.toFixed(2)}x` },
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
    const funnelKeys = ["sessions", "addToCart", "checkout", "pedidosGerados", "pedidosPagos", "taxaPagamento", "taxaConversao"];
    const hasFunnelMetric = options.selectedMetrics.some((m) => funnelKeys.includes(m));

    if (hasFunnelMetric) {
        message += "\n🔗 *Funil de Vendas:*\n";
        if (options.selectedMetrics.includes("sessions")) {
            message += `👀 Sessões: ${formatNumber(funnel.sessions)}\n`;
        }
        if (options.selectedMetrics.includes("addToCart")) {
            message += `🛒 Carrinho: ${formatNumber(funnel.addToCart)}\n`;
        }
        if (options.selectedMetrics.includes("checkout")) {
            message += `✅ Acessos Checkout: ${formatNumber(funnel.checkout)}\n`;
        }
        if (options.selectedMetrics.includes("pedidosGerados")) {
            message += `📦 Pedidos Gerados: ${formatNumber(funnel.pedidosGerados)}\n`;
        }
        if (options.selectedMetrics.includes("pedidosPagos")) {
            message += `💚 Pedidos Pagos: ${formatNumber(funnel.pedidosPagos)}\n`;
        }
        if (options.selectedMetrics.includes("taxaPagamento")) {
            const taxa = funnel.taxaPagamento || 0;
            message += `✅ % Pagamento Aprovado: ${taxa.toFixed(1)}%\n`;
        }
        if (options.selectedMetrics.includes("taxaConversao")) {
            const sessions = funnel.sessions || 0;
            const pedidos = funnel.pedidosPagos || funnel.pedidosGerados || 0;
            if (sessions > 0) {
                const taxa = (pedidos / sessions) * 100;
                message += `📈 Taxa Conversão: ${taxa.toFixed(2)}%\n`;
            }
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
        if (options.selectedMetrics.includes("pedidosGerados")) {
            message += `📦 Pedidos Gerados: ${sign(comparison.pedidosGerados)}${comparison.pedidosGerados} ${arrow(comparison.pedidosGerados)}\n`;
        }
        if (options.selectedMetrics.includes("pedidosPagos")) {
            message += `💚 Pedidos Pagos: ${sign(comparison.pedidosPagos)}${comparison.pedidosPagos} ${arrow(comparison.pedidosPagos)}\n`;
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
    message += "\n_Enviado automaticamente pela CDR Group_";

    return message;
}
