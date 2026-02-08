"use client";

import { useState, useEffect, useCallback } from "react";
import { PeriodSelector, periodToParams, type PeriodValue } from "@/components/period-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    DollarSign,
    TrendingUp,
    CreditCard,
    Percent,
    ShoppingCart,
    PieChart
} from "lucide-react";
import { subDays } from "date-fns";
import {
    getFinancialMetrics,
    getProductCosts,
    getFinancialConfig,
    type FinancialMetrics,
} from "@/actions/finance"; // Server actions
import { ProductCostTable } from "@/components/finance/product-cost-table";
import { FinancialConfigDialog } from "@/components/finance/financial-config-dialog";
import { cn } from "@/lib/utils";

export default function FinancePage() {
    const [period, setPeriod] = useState<PeriodValue>({ type: "preset", days: 30 });
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState<FinancialMetrics>({
        revenue: 0,
        adSpend: 0,
        productCosts: 0,
        fees: 0,
        netProfit: 0,
        margin: 0,
        roi: 0,
        orderCount: 0
    });
    const [costs, setCosts] = useState<any[]>([]);
    const [config, setConfig] = useState({ defaultTaxRate: 0, fixedTransactionFee: 0 });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const { days, from, to } = periodToParams(period);

            // Calculate dates
            let fromDate: Date, toDate: Date;
            if (from && to) {
                fromDate = new Date(from);
                toDate = new Date(to);
            } else {
                toDate = new Date();
                fromDate = subDays(toDate, days);
            }

            // Fetch all data in parallel
            const [metricsData, costsData, configData] = await Promise.all([
                getFinancialMetrics({ from: fromDate, to: toDate }),
                getProductCosts(),
                getFinancialConfig(),
            ]);

            setMetrics(metricsData);
            setCosts(costsData);
            if (configData) {
                setConfig({
                    defaultTaxRate: Number(configData.defaultTaxRate),
                    fixedTransactionFee: Number(configData.fixedTransactionFee)
                });
            }
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

    // Calculate percentages for the breakdown bar
    const revenue = metrics.revenue || 1; // avoid division by zero
    const cogsPct = (metrics.productCosts / revenue) * 100;
    const adsPct = (metrics.adSpend / revenue) * 100;
    const feesPct = (metrics.fees / revenue) * 100;
    const profitPct = (metrics.netProfit / revenue) * 100;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight">Financeiro</h2>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Gestão de lucro líquido e unit economics.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <FinancialConfigDialog config={config} />
                    <PeriodSelector value={period} onChange={setPeriod} />
                </div>
            </div>

            {loading ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                    Carregando dados financeiros...
                </div>
            ) : (
                <>
                    {/* KPI Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                        <FinancialCard
                            title="Receita Bruta"
                            value={fmt(metrics.revenue)}
                            icon={DollarSign}
                            className="text-foreground"
                            iconClass="bg-primary/10 text-primary"
                        />
                        <FinancialCard
                            title="Custos (CMV)"
                            value={fmt(metrics.productCosts)}
                            icon={ShoppingCart}
                            className="text-foreground"
                            iconClass="bg-amber-500/10 text-amber-500"
                            subText={`${cogsPct.toFixed(1)}% da receita`}
                        />
                        <FinancialCard
                            title="Ads (Tráfego)"
                            value={fmt(metrics.adSpend)}
                            icon={TrendingUp}
                            className="text-foreground"
                            iconClass="bg-red-500/10 text-red-500"
                            subText={`${adsPct.toFixed(1)}% da receita`}
                        />
                        <FinancialCard
                            title="Taxas & Impostos"
                            value={fmt(metrics.fees)}
                            icon={CreditCard}
                            className="text-foreground"
                            iconClass="bg-purple-500/10 text-purple-500"
                            subText={`${feesPct.toFixed(1)}% da receita`}
                        />
                        <FinancialCard
                            title="Lucro Líquido"
                            value={fmt(metrics.netProfit)}
                            icon={PieChart}
                            className={metrics.netProfit >= 0 ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5" : "text-red-500 border-red-500/20 bg-red-500/5"}
                            iconClass={metrics.netProfit >= 0 ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"}
                            valueClass={metrics.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}
                        />
                        <FinancialCard
                            title="Margem Líquida"
                            value={`${metrics.margin.toFixed(1)}%`}
                            icon={Percent}
                            className={metrics.margin >= 0 ? "text-emerald-600" : "text-red-600"}
                            iconClass={metrics.margin >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}
                        />
                    </div>

                    {/* Profit Breakdown Bar */}
                    <Card className="border border-border shadow-none rounded-lg p-6">
                        <h3 className="text-sm font-medium text-muted-foreground mb-4">Composição da Receita</h3>
                        <div className="w-full h-8 flex rounded-md overflow-hidden bg-secondary">
                            {metrics.productCosts > 0 && (
                                <div style={{ width: `${cogsPct}%` }} className="bg-amber-400 h-full flex items-center justify-center text-[10px] font-bold text-white relative group">
                                    <span className="truncate px-1">CMV</span>
                                </div>
                            )}
                            {metrics.adSpend > 0 && (
                                <div style={{ width: `${adsPct}%` }} className="bg-red-400 h-full flex items-center justify-center text-[10px] font-bold text-white relative group">
                                    <span className="truncate px-1">Ads</span>
                                </div>
                            )}
                            {metrics.fees > 0 && (
                                <div style={{ width: `${feesPct}%` }} className="bg-purple-400 h-full flex items-center justify-center text-[10px] font-bold text-white relative group">
                                    <span className="truncate px-1">Taxas</span>
                                </div>
                            )}
                            {metrics.netProfit > 0 && (
                                <div style={{ width: `${profitPct}%` }} className="bg-emerald-500 h-full flex items-center justify-center text-[10px] font-bold text-white relative group">
                                    <span className="truncate px-1">Lucro</span>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-4 mt-3 text-xs text-muted-foreground justify-center">
                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-400 rounded-sm"></div>Produto</div>
                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-400 rounded-sm"></div>Anúncios</div>
                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-purple-400 rounded-sm"></div>Taxas</div>
                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>Lucro</div>
                        </div>
                    </Card>

                    {/* Product Cost Management */}
                    <Card className="border border-border shadow-none rounded-lg p-6">
                        <ProductCostTable costs={costs} />
                    </Card>
                </>
            )}
        </div>
    );
}

function FinancialCard({ title, value, icon: Icon, className, iconClass, valueClass, subText }: any) {
    return (
        <Card className={cn("border border-border shadow-none rounded-lg p-5 transition-all hover:border-primary/20", className)}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase tracking-wider font-medium opacity-70">{title}</span>
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", iconClass)}>
                    <Icon className="w-4 h-4" />
                </div>
            </div>
            <div>
                <div className={cn("text-2xl font-bold tracking-tight", valueClass)}>{value}</div>
                {subText && <p className="text-xs opacity-70 mt-1">{subText}</p>}
            </div>
        </Card>
    );
}
