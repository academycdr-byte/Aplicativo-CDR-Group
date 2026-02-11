"use client";

import { useState, useEffect, useCallback } from "react";
import { PeriodSelector, periodToParams, type PeriodValue } from "@/components/period-selector";
import { Card } from "@/components/ui/card";
import {
    DollarSign,
    TrendingUp,
    CreditCard,
    Percent,
    ShoppingCart,
    PieChart,
    Landmark,
    ArrowDownRight,
    Receipt,
    AlertTriangle,
} from "lucide-react";
import { subDays } from "date-fns";
import {
    getFinancialMetrics,
    getProductCosts,
    getFinancialConfig,
    getSupplierPayments,
    type FinancialMetrics,
} from "@/actions/finance";
import { ProductCostTable } from "@/components/finance/product-cost-table";
import { SupplierPaymentTable } from "@/components/finance/supplier-payment-table";
import { FinancialConfigDialog } from "@/components/finance/financial-config-dialog";
import { cn } from "@/lib/utils";

export default function FinancePage() {
    const [period, setPeriod] = useState<PeriodValue>({ type: "preset", days: 30 });
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState<FinancialMetrics>({
        revenue: 0,
        adSpend: 0,
        productCosts: 0,
        gatewayFee: 0,
        checkoutFee: 0,
        taxFee: 0,
        fixedCosts: 0,
        chargebackCost: 0,
        transactionFees: 0,
        netProfit: 0,
        margin: 0,
        roi: 0,
        orderCount: 0,
        ticketMedio: 0,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [costs, setCosts] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [supplierPayments, setSupplierPayments] = useState<any[]>([]);
    const [config, setConfig] = useState({
        defaultTaxRate: 0,
        fixedTransactionFee: 0,
        gatewayRate: 0,
        checkoutRate: 0,
        taxBase: "revenue",
        fixedCosts: 0,
        chargebackRate: 0,
        cmvMethod: "sku",
        averageCostPerOrder: 0,
    });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const { days, from, to } = periodToParams(period);

            let fromDate: Date, toDate: Date;
            if (from && to) {
                fromDate = new Date(from);
                toDate = new Date(to);
            } else {
                toDate = new Date();
                fromDate = subDays(toDate, days);
            }

            const results = await Promise.allSettled([
                getFinancialMetrics({ from: fromDate, to: toDate }),
                getProductCosts(),
                getFinancialConfig(),
                getSupplierPayments(fromDate, toDate),
            ]);

            if (results[0].status === "fulfilled") setMetrics(results[0].value);
            if (results[1].status === "fulfilled") setCosts(results[1].value);
            if (results[2].status === "fulfilled" && results[2].value) {
                const c = results[2].value;
                setConfig({
                    defaultTaxRate: Number(c.defaultTaxRate),
                    fixedTransactionFee: Number(c.fixedTransactionFee),
                    gatewayRate: Number(c.gatewayRate),
                    checkoutRate: Number(c.checkoutRate),
                    taxBase: String(c.taxBase),
                    fixedCosts: Number(c.fixedCosts),
                    chargebackRate: Number(c.chargebackRate),
                    cmvMethod: String(c.cmvMethod || "sku"),
                    averageCostPerOrder: Number(c.averageCostPerOrder),
                });
            }
            if (results[3].status === "fulfilled") setSupplierPayments(results[3].value);
        } catch (error) {
            console.error("Failed to load financial data", error);
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    function fmt(val: number) {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
    }

    const revenue = metrics.revenue || 1;
    const cogsPct = (metrics.productCosts / revenue) * 100;
    const adsPct = (metrics.adSpend / revenue) * 100;
    const gatewayPct = (metrics.gatewayFee / revenue) * 100;
    const checkoutPct = (metrics.checkoutFee / revenue) * 100;
    const taxPct = (metrics.taxFee / revenue) * 100;
    const fixedPct = (metrics.fixedCosts / revenue) * 100;
    const chargebackPct = (metrics.chargebackCost / revenue) * 100;
    const txFeePct = (metrics.transactionFees / revenue) * 100;
    const profitPct = Math.max(0, (metrics.netProfit / revenue) * 100);

    return (
        <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Financeiro</h2>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Gestao de lucro liquido e unit economics.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <FinancialConfigDialog config={config} onSave={loadData} />
                    <PeriodSelector value={period} onChange={setPeriod} />
                </div>
            </div>

            {loading ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <Card key={i} className="border border-border shadow-none rounded-lg p-5">
                                <div className="animate-pulse space-y-3">
                                    <div className="h-3 w-20 bg-muted/40 rounded" />
                                    <div className="h-8 w-28 bg-muted/40 rounded" />
                                </div>
                            </Card>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[1, 2, 3].map((i) => (
                            <Card key={i} className="border border-border shadow-none rounded-lg p-5">
                                <div className="animate-pulse space-y-3">
                                    <div className="h-3 w-20 bg-muted/40 rounded" />
                                    <div className="h-8 w-28 bg-muted/40 rounded" />
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            ) : (
                <>
                    {/* KPI Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                        <FinancialCard
                            title="Receita Bruta"
                            value={fmt(metrics.revenue)}
                            icon={DollarSign}
                            iconClass="bg-primary/10 text-primary"
                            subText={`${metrics.orderCount} pedidos`}
                        />
                        <FinancialCard
                            title="Custos (CMV)"
                            value={fmt(metrics.productCosts)}
                            icon={ShoppingCart}
                            iconClass="bg-amber-500/10 text-amber-500"
                            subText={`${cogsPct.toFixed(2)}% da receita`}
                        />
                        <FinancialCard
                            title="Ads (Trafego)"
                            value={fmt(metrics.adSpend)}
                            icon={TrendingUp}
                            iconClass="bg-red-500/10 text-red-500"
                            subText={`${adsPct.toFixed(2)}% da receita`}
                        />
                        <FinancialCard
                            title="Gateway"
                            value={fmt(metrics.gatewayFee)}
                            icon={CreditCard}
                            iconClass="bg-blue-500/10 text-blue-500"
                            subText={`${gatewayPct.toFixed(2)}% da receita`}
                        />
                        <FinancialCard
                            title="Checkout"
                            value={fmt(metrics.checkoutFee)}
                            icon={Receipt}
                            iconClass="bg-indigo-500/10 text-indigo-500"
                            subText={`${checkoutPct.toFixed(2)}% da receita`}
                        />
                        <FinancialCard
                            title="Impostos"
                            value={fmt(metrics.taxFee)}
                            icon={Landmark}
                            iconClass="bg-purple-500/10 text-purple-500"
                            subText={`${taxPct.toFixed(2)}% da receita`}
                        />
                        <FinancialCard
                            title="Custos Fixos"
                            value={fmt(metrics.fixedCosts)}
                            icon={ArrowDownRight}
                            iconClass="bg-orange-500/10 text-orange-500"
                            subText={`${fixedPct.toFixed(2)}% da receita`}
                        />
                        <FinancialCard
                            title="Chargebacks"
                            value={fmt(metrics.chargebackCost)}
                            icon={AlertTriangle}
                            iconClass="bg-rose-500/10 text-rose-500"
                            subText={`${chargebackPct.toFixed(2)}% da receita`}
                        />
                    </div>

                    {/* Bottom row: Net Profit + Margin */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        <FinancialCard
                            title="Lucro Liquido"
                            value={fmt(metrics.netProfit)}
                            icon={PieChart}
                            className={metrics.netProfit >= 0 ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}
                            iconClass={metrics.netProfit >= 0 ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"}
                            valueClass={metrics.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}
                        />
                        <FinancialCard
                            title="Margem Liquida"
                            value={`${metrics.margin.toFixed(2)}%`}
                            icon={Percent}
                            className={metrics.margin >= 0 ? "" : ""}
                            iconClass={metrics.margin >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}
                            valueClass={metrics.margin >= 0 ? "text-emerald-600" : "text-red-600"}
                        />
                        <FinancialCard
                            title="Ticket Medio"
                            value={fmt(metrics.ticketMedio)}
                            icon={DollarSign}
                            iconClass="bg-sky-500/10 text-sky-500"
                            subText={`Taxa fixa/tx: ${fmt(metrics.transactionFees / Math.max(metrics.orderCount, 1))}`}
                        />
                    </div>

                    {/* Profit Breakdown Bar */}
                    <Card className="border border-border shadow-none rounded-lg p-4 sm:p-6">
                        <h3 className="text-sm font-medium text-muted-foreground mb-3 sm:mb-4">Composicao da Receita</h3>
                        <div className="w-full h-7 sm:h-8 flex rounded-md overflow-hidden bg-secondary">
                            {cogsPct > 0 && (
                                <div style={{ width: `${cogsPct}%` }} className="bg-amber-400 h-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-white">
                                    <span className="truncate px-0.5">CMV</span>
                                </div>
                            )}
                            {adsPct > 0 && (
                                <div style={{ width: `${adsPct}%` }} className="bg-red-400 h-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-white">
                                    <span className="truncate px-0.5">Ads</span>
                                </div>
                            )}
                            {gatewayPct > 0.5 && (
                                <div style={{ width: `${gatewayPct}%` }} className="bg-blue-400 h-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-white">
                                    <span className="truncate px-0.5">GW</span>
                                </div>
                            )}
                            {checkoutPct > 0.5 && (
                                <div style={{ width: `${checkoutPct}%` }} className="bg-indigo-400 h-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-white">
                                    <span className="truncate px-0.5">CK</span>
                                </div>
                            )}
                            {taxPct > 0.5 && (
                                <div style={{ width: `${taxPct}%` }} className="bg-purple-400 h-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-white">
                                    <span className="truncate px-0.5">Tax</span>
                                </div>
                            )}
                            {(fixedPct + chargebackPct + txFeePct) > 0.5 && (
                                <div style={{ width: `${fixedPct + chargebackPct + txFeePct}%` }} className="bg-orange-400 h-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-white">
                                    <span className="truncate px-0.5">+</span>
                                </div>
                            )}
                            {profitPct > 0 && (
                                <div style={{ width: `${profitPct}%` }} className="bg-emerald-500 h-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-white">
                                    <span className="truncate px-0.5">Lucro</span>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3 text-[11px] sm:text-xs text-muted-foreground justify-center">
                            <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-amber-400 rounded-sm" />Produto</div>
                            <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-400 rounded-sm" />Anuncios</div>
                            <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-blue-400 rounded-sm" />Gateway</div>
                            <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-indigo-400 rounded-sm" />Checkout</div>
                            <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-purple-400 rounded-sm" />Impostos</div>
                            <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-orange-400 rounded-sm" />Outros</div>
                            <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-emerald-500 rounded-sm" />Lucro</div>
                        </div>
                    </Card>

                    {/* CMV Management Section - conditional based on cmvMethod */}
                    <Card className="border border-border shadow-none rounded-lg p-4 sm:p-6">
                        {config.cmvMethod === "supplier_payments" ? (
                            <SupplierPaymentTable
                                payments={supplierPayments}
                                onUpdate={loadData}
                            />
                        ) : config.cmvMethod === "average" ? (
                            <div className="space-y-3">
                                <h3 className="text-base sm:text-lg font-medium">Custos (CMV) - Custo Medio</h3>
                                <p className="text-sm text-muted-foreground">
                                    Metodo ativo: <span className="font-medium text-foreground">Custo Medio por Pedido</span>
                                </p>
                                <div className="grid grid-cols-3 gap-3 p-3 sm:p-4 rounded-lg border border-blue-500/20 bg-blue-500/5">
                                    <div className="text-center">
                                        <p className="text-[10px] sm:text-xs text-muted-foreground">Custo/pedido</p>
                                        <p className="text-base sm:text-xl font-bold">{fmt(config.averageCostPerOrder)}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] sm:text-xs text-muted-foreground">Pedidos</p>
                                        <p className="text-base sm:text-xl font-bold">{metrics.orderCount}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] sm:text-xs text-muted-foreground">CMV total</p>
                                        <p className="text-base sm:text-xl font-bold text-amber-600">{fmt(metrics.productCosts)}</p>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Para alterar o valor medio, acesse &quot;Configurar Taxas&quot; acima.
                                </p>
                            </div>
                        ) : (
                            <ProductCostTable costs={costs} />
                        )}
                    </Card>
                </>
            )}
        </div>
    );
}

function FinancialCard({ title, value, icon: Icon, className, iconClass, valueClass, subText }: {
    title: string;
    value: string;
    icon: React.ComponentType<{ className?: string }>;
    className?: string;
    iconClass?: string;
    valueClass?: string;
    subText?: string;
}) {
    return (
        <Card className={cn("border border-border shadow-none rounded-lg p-3 sm:p-5 transition-all hover:border-primary/20", className)}>
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-medium opacity-70 leading-tight">{title}</span>
                <div className={cn("w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0", iconClass)}>
                    <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
                </div>
            </div>
            <div>
                <div className={cn("text-lg sm:text-2xl font-bold tracking-tight", valueClass)}>{value}</div>
                {subText && <p className="text-[10px] sm:text-xs opacity-70 mt-0.5 sm:mt-1">{subText}</p>}
            </div>
        </Card>
    );
}
