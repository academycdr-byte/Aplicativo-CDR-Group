// Report message builder utility

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
