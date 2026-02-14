"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  CheckCircle,
  Repeat,
  BarChart,
  Target,
  ShoppingCart,
  MousePointerClick,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
} from "recharts";
import { toast } from "sonner";
import { loadAllDashboardData } from "@/actions/dashboard";
import { getExchangeRates } from "@/actions/currency";
import { syncAll, syncRecent } from "@/actions/sync";
import { PeriodSelector, periodToParams, type PeriodValue } from "@/components/period-selector";
import { EstimatedProfitCalendar } from "@/components/estimated-profit-calendar";
import { FunnelVisual, type FunnelStep, type FunnelRate } from "@/components/funnel-visual";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type DashboardStats = {
  totalOrders: number;
  ordersChange: string;
  revenue: number;
  revenueChange: string;
  adSpend: number;
  adSpendChange: string;
  roas: number;
};

type MetricPoint = {
  date: string;
  faturamento: number;
  investimento: number;
  compras: number;
  ticketMedio: number;
  cpa: number;
  roas: number;
};

type FunnelData = {
  impressoes: number;
  alcance: number;
  cliques: number;
  adicoesCarrinho: number;
  checkoutsIniciados: number;
  compras: number;
};

type RatesData = {
  paidRate: number;
  paidOrders: number;
  totalOrders: number;
  repurchaseRate: number;
  repeatCustomers: number;
  totalCustomersInDays: number;
  uniqueCustomers: number;
};

type RecentOrder = {
  id: string;
  externalOrderId: string;
  platform: string;
  status: string;
  customerName: string | null;
  totalAmount: number;
  currency: string;
  orderDate: Date;
};

const metricToggles = [
  { key: "faturamento", label: "Faturamento", color: "#10b981", type: "area" },
  { key: "investimento", label: "Investimento", color: "#f43f5e", type: "area" },
  { key: "compras", label: "Compras", color: "#8b5cf6", type: "line" },
  { key: "ticketMedio", label: "Ticket", color: "#f59e0b", type: "line" },
  { key: "cpa", label: "CPA", color: "#06b6d4", type: "line" },
  { key: "roas", label: "ROAS", color: "#3b82f6", type: "line" },
] as const;

type Currency = "BRL" | "USD" | "EUR" | "GBP";

const CURRENCIES: Record<Currency, { locale: string; symbol: string; label: string }> = {
  BRL: { locale: "pt-BR", symbol: "R$", label: "Real (BRL)" },
  USD: { locale: "en-US", symbol: "$", label: "Dólar (USD)" },
  EUR: { locale: "de-DE", symbol: "€", label: "Euro (EUR)" },
  GBP: { locale: "en-GB", symbol: "£", label: "Libra (GBP)" },
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [metricsData, setMetricsData] = useState<MetricPoint[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [rates, setRates] = useState<RatesData | null>(null);
  const [period, setPeriod] = useState<PeriodValue>({ type: "preset", days: 30 });
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeMetrics, setActiveMetrics] = useState<Set<string>>(new Set(["faturamento", "investimento"]));
  const [profitData, setProfitData] = useState<{ dailyProfits: { date: string; profit: number; revenue: number; costs: number }[]; totalProfit: number }>({ dailyProfits: [], totalProfit: 0 });

  const [currency, setCurrency] = useState<Currency>("BRL");
  const [exchangeRates, setExchangeRates] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    getExchangeRates().then((r) => setExchangeRates(r));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { days, from, to } = periodToParams(period);

    try {
      const data = await loadAllDashboardData(days, from, to);
      if (!data) {
        setLoading(false);
        return;
      }

      if (data.dashboard) setStats(data.dashboard);
      setMetricsData(data.metrics);
      setRecentOrders(data.orders);
      setFunnel(data.funnel);
      setRates(data.rates);
      if (data.profitData) setProfitData(data.profitData);

      if (data.failedCount > 0) {
        toast.error(`Erro ao carregar ${data.failedCount} seção(ões) do dashboard`);
      }
    } catch {
      toast.error("Erro ao carregar dados do dashboard");
    }

    setLoading(false);
  }, [period]);

  // Auto-sync when "Today" is selected to ensure real-time data
  useEffect(() => {
    if (period.type === "preset" && period.days === 0) {
      console.log("Selecionado Hoje - Iniciando Sincronizacao em Segundo Plano...");
      toast.info("Verificando dados recentes...");

      // Trigger sync without blocking UI
      syncAll().then((res) => {
        if (!res?.error) {
          toast.success("Dados atualizados!");
          // Reload dashboard data to reflect the new sync
          loadData();
        }
      });
    }
  }, [period, loadData]);

  useEffect(() => {
    loadData();

    // Speculative sync on mount to ensure "Today" data is fresh 
    // without user needing to click "Today" or "Sync"
    console.log("Dashboard mounted: triggering background freshness check...");
    syncRecent().then(() => {
      console.log("Background freshness check completed.");
      // Optional: reload data silently if we want to confirm freshness
      // loadData(); 
    });
  }, [loadData]);

  async function handleSync() {
    setSyncing(true);
    try {
      await syncAll();
      await loadData();
      toast.success("Dados sincronizados com sucesso!");
    } catch {
      toast.error("Erro ao sincronizar dados.");
    } finally {
      setSyncing(false);
    }
  }

  function toggleMetric(key: string) {
    setActiveMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function fmtStandard(amount: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
  }

  function getConvertedValue(amount: number) {
    if (currency !== "BRL" && exchangeRates && exchangeRates[currency]) {
      return amount / exchangeRates[currency];
    }
    return amount;
  }

  function fmtRevenue(amount: number) {
    return fmtStandard(getConvertedValue(amount));
  }

  function fmtShort(v: number) {
    const symbol = "R$";

    // No conversion for charts/short format as per request ("only revenue card")
    // If user wants charts converted later, we can add logic here.

    if (v >= 1000000) return `${symbol} ${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${symbol} ${(v / 1000).toFixed(1)}k`;
    return `${symbol} ${v.toFixed(0)}`;
  }

  function fmtNum(v: number) {
    return new Intl.NumberFormat("pt-BR").format(v);
  }

  const convertedMetrics = useMemo(() => {
    return metricsData.map((m) => ({
      ...m,
      faturamento: getConvertedValue(m.faturamento),
      ticketMedio: getConvertedValue(m.ticketMedio),
      roas: m.roas, // Kept raw as per user request
    }));
  }, [metricsData, currency, exchangeRates]);

  const convertedProfitData = useMemo(() => {
    const daily = profitData.dailyProfits.map((d) => {
      const revBRL = getConvertedValue(d.revenue);
      const costBRL = d.costs; // Costs are already in BRL (AdSpend)
      return {
        ...d,
        revenue: revBRL,
        costs: costBRL,
        profit: revBRL - costBRL,
      };
    });

    const total = daily.reduce((acc, curr) => acc + curr.profit, 0);

    return { dailyProfits: daily, totalProfit: total };
  }, [profitData, currency, exchangeRates]);

  const getMonthLabel = () => {
    const date = new Date();
    return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Visão Geral</h2>
          <p className="text-muted-foreground mt-1 text-[15px]">
            Performance das suas campanhas em tempo real.
          </p>
        </div>
        <PeriodSelector
          value={period}
          onChange={setPeriod}
          onRefresh={handleSync}
          refreshing={syncing}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="FATURAMENTO"
          value={fmtRevenue(stats?.revenue || 0)}
          change={stats?.revenueChange || "0%"}
          icon={TrendingUp}
          trend="up"
          action={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full -mr-1">
                  <span className="sr-only">Trocar moeda</span>
                  <span className="text-xs font-bold text-muted-foreground">{CURRENCIES[currency].symbol}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(Object.keys(CURRENCIES) as Currency[]).map((c) => (
                  <DropdownMenuItem key={c} onClick={() => setCurrency(c)}>
                    {CURRENCIES[c].label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />
        <KPICard
          label="INVESTIMENTO"
          value={fmtStandard(stats?.adSpend || 0)}
          change={stats?.adSpendChange || "0%"}
          icon={DollarSign}
          trend="down"
        />
        <KPICard
          label="PEDIDOS"
          value={String(stats?.totalOrders || 0)}
          change={stats?.ordersChange || "0%"}
          icon={ShoppingBag}
          trend="up"
        />
        <KPICard
          label="ROAS"
          value={`${(stats?.roas || 0).toFixed(2)}x`}
          change="0%" // TODO: Add real daily change if available
          icon={Target}
          trend="neutral"
        />
      </div>

      {/* Main Chart + Calendar Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Performance Chart */}
        <Card className="xl:col-span-2 shadow-sm">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0 pb-4">
            <div className="space-y-1">
              <CardTitle>Performance</CardTitle>
              <CardDescription className="hidden sm:block">Análise detalhada do período</CardDescription>
            </div>

            {/* Filters/Toggles */}
            <div className="flex flex-wrap gap-1.5">
              {metricToggles.map((m) => (
                <button
                  key={m.key}
                  onClick={() => toggleMetric(m.key)}
                  aria-pressed={activeMetrics.has(m.key)}
                  aria-label={`Métrica ${m.label}: ${activeMetrics.has(m.key) ? "ativa" : "inativa"}`}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] uppercase tracking-wide font-semibold border transition-all duration-200",
                    activeMetrics.has(m.key)
                      ? "border-white/10 text-foreground"
                      : "bg-transparent text-muted-foreground border-transparent hover:bg-secondary"
                  )}
                  style={activeMetrics.has(m.key) ? { backgroundColor: `${m.color}15` } : undefined}
                >
                  <div
                    className="w-2 h-2 rounded-full transition-all duration-200"
                    style={{ backgroundColor: activeMetrics.has(m.key) ? m.color : "var(--muted-foreground)", opacity: activeMetrics.has(m.key) ? 1 : 0.3 }}
                  />
                  {m.label}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="px-1 sm:px-6 pb-4 sm:pb-6">
            {metricsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280} className="sm:!h-[360px]" aria-label="Gráfico de performance das campanhas ao longo do tempo">
                <ComposedChart data={convertedMetrics} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradFaturamento" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradInvestimento" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.15} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    interval="preserveStartEnd"
                    tickFormatter={(v) => {
                      const d = new Date(v + "T00:00:00");
                      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
                    }}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => fmtShort(v)}
                    width={45}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "4 4", opacity: 0.3 }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = new Date(label + "T00:00:00");
                      return (
                        <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl p-3.5 sm:p-4 min-w-[200px] sm:min-w-[220px]">
                          <p className="font-semibold text-xs sm:text-sm mb-3 text-foreground border-b border-border/30 pb-2">
                            {d.toLocaleDateString("pt-BR", { weekday: 'short', day: 'numeric', month: 'short' })}
                          </p>
                          <div className="space-y-2">
                            {payload.map((p) => {
                              const toggle = metricToggles.find((m) => m.key === p.dataKey);
                              return (
                                <div key={p.dataKey} className="flex items-center justify-between gap-4 sm:gap-6 text-xs sm:text-sm">
                                  <span className="text-muted-foreground flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: toggle?.color }} />
                                    {toggle?.label}
                                  </span>
                                  <span className="font-semibold tabular-nums text-foreground">
                                    {p.dataKey === "roas" ? `${Number(p.value).toFixed(2)}x`
                                      : p.dataKey === "compras" ? fmtNum(Number(p.value))
                                        : fmtStandard(Number(p.value))}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }}
                  />
                  {/* Faturamento — primary area with gradient */}
                  {activeMetrics.has("faturamento") && (
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="faturamento"
                      stroke="#10b981"
                      fill="url(#gradFaturamento)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
                    />
                  )}
                  {/* Investimento — subtle area (no more bars!) */}
                  {activeMetrics.has("investimento") && (
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="investimento"
                      stroke="#f43f5e"
                      fill="url(#gradInvestimento)"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={false}
                      activeDot={{ r: 4, fill: "#f43f5e", stroke: "#fff", strokeWidth: 2 }}
                    />
                  )}
                  {/* Compras — clean line with dots */}
                  {activeMetrics.has("compras") && (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="compras"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#8b5cf6", stroke: "#1a1a2e", strokeWidth: 2 }}
                      activeDot={{ r: 5, fill: "#8b5cf6", stroke: "#fff", strokeWidth: 2 }}
                    />
                  )}
                  {/* Ticket Médio */}
                  {activeMetrics.has("ticketMedio") && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="ticketMedio"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: "#f59e0b", stroke: "#fff", strokeWidth: 2 }}
                    />
                  )}
                  {/* CPA */}
                  {activeMetrics.has("cpa") && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="cpa"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: "#06b6d4", stroke: "#fff", strokeWidth: 2 }}
                    />
                  )}
                  {/* ROAS */}
                  {activeMetrics.has("roas") && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="roas"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] sm:h-[340px] flex flex-col items-center justify-center text-muted-foreground space-y-2">
                <BarChart className="w-8 h-8 opacity-20" />
                <p className="text-sm">Sem dados para exibir no momento</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profit Calendar */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Lucro Estimado</CardTitle>
            <CardDescription>{getMonthLabel()}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-4 pt-0">
              <EstimatedProfitCalendar
                data={convertedProfitData.dailyProfits}
                totalProfit={convertedProfitData.totalProfit}
                currentMonthLabel={getMonthLabel()}
                formatter={fmtStandard}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row: Funnel + Rates */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Funnel Visual */}
        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="border-b border-border/40 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle>Funil de Conversão</CardTitle>
                <CardDescription>Baseado nos eventos rastreados pelo Meta Ads</CardDescription>
              </div>
              <Badge variant="secondary" className="font-mono">META ADS</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {funnel && (funnel.cliques > 0 || funnel.compras > 0) ? (
              <FunnelVisual
                steps={buildFunnelSteps(funnel)}
                rates={buildFunnelRates(funnel)}
              />
            ) : (
              <div className="py-12 text-center text-muted-foreground text-sm">
                Conecte sua conta do Meta Ads para visualizar o funil de conversão
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rates Cards */}
        <div className="grid grid-cols-1 gap-4">
          <RateCard
            title="Taxa de Pagamento"
            value={`${(rates?.paidRate || 0).toFixed(2)}%`}
            subtext={`${rates?.paidOrders || 0} pagos`}
            progress={rates?.paidRate || 0}
            colorClass="bg-primary"
            icon={CheckCircle}
          />

          <RateCard
            title="Taxa de Clientes Recorrentes"
            value={`${(rates?.repurchaseRate || 0).toFixed(2)}%`}
            subtext={`${rates?.repeatCustomers || 0} recorrentes de ${rates?.totalCustomersInDays || 0}`}
            progress={rates?.repurchaseRate || 0}
            colorClass="bg-purple-500"
            icon={Repeat}
          />
        </div>
      </div>

    </div>
  );
}

// Funnel helpers

function buildFunnelSteps(f: FunnelData): FunnelStep[] {
  return [
    { id: "clicks", label: "Cliques no Link", value: f.cliques, icon: MousePointerClick, color: "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-400", barColor: "bg-blue-500" },
    { id: "cart", label: "Adições ao Carrinho", value: f.adicoesCarrinho, icon: ShoppingCart, color: "bg-violet-50 border-violet-200 text-violet-600 dark:bg-violet-950 dark:border-violet-800 dark:text-violet-400", barColor: "bg-violet-500" },
    { id: "checkout", label: "Checkouts Iniciados", value: f.checkoutsIniciados, icon: CreditCard, color: "bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-400", barColor: "bg-amber-500" },
    { id: "purchases", label: "Compras", value: f.compras, icon: ShoppingBag, color: "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-400", barColor: "bg-emerald-500" },
  ];
}

function buildFunnelRates(f: FunnelData): FunnelRate[] {
  const rates: FunnelRate[] = [];

  if (f.cliques > 0) {
    rates.push({ label: "Clique → Carrinho", value: (f.adicoesCarrinho / f.cliques) * 100, colorClass: "text-violet-600 dark:text-violet-400", bgClass: "bg-violet-50/50 border-violet-200/50 dark:bg-violet-950/50 dark:border-violet-800/50" });
  }
  if (f.adicoesCarrinho > 0) {
    rates.push({ label: "Carrinho → Checkout", value: (f.checkoutsIniciados / f.adicoesCarrinho) * 100, colorClass: "text-amber-600 dark:text-amber-400", bgClass: "bg-amber-50/50 border-amber-200/50 dark:bg-amber-950/50 dark:border-amber-800/50" });
  }
  if (f.cliques > 0) {
    rates.push({ label: "Conversão Total", value: (f.compras / f.cliques) * 100, colorClass: "text-emerald-600 dark:text-emerald-400", bgClass: "bg-emerald-50/50 border-emerald-200/50 dark:bg-emerald-950/50 dark:border-emerald-800/50" });
  }

  return rates;
}

// Subcomponents

function KPICard({ label, value, change, icon: Icon, trend, action }: {
  label: string; value: string; change: string; icon: LucideIcon; trend: "up" | "down" | "neutral"; action?: React.ReactNode;
}) {
  const isPositive = change && change.startsWith("+") || trend === "up";
  const isNegative = change && change.startsWith("-") || trend === "down";

  return (
    <Card className="shadow-sm group relative overflow-hidden" role="status" aria-label={`${label}: ${value}`}>
      <div className="absolute right-0 top-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity" aria-hidden="true">
        <Icon className="w-12 h-12 sm:w-16 sm:h-16" />
      </div>
      <CardContent className="p-4 sm:p-6 relative z-10">
        <div className="flex items-start justify-between mb-3 sm:mb-4">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2">
            {change && (
              <Badge variant="outline" className={cn(
                "font-mono text-[10px] px-1.5 py-0 h-5 border-transparent bg-secondary/50",
                isPositive && "text-emerald-500 bg-emerald-500/10",
                isNegative && "text-red-500 bg-red-500/10"
              )}>
                {change}
              </Badge>
            )}
            {action}
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{value}</h3>
        </div>
      </CardContent>
    </Card>
  );
}

function RateCard({ title, value, subtext, progress, colorClass, icon: Icon }: {
  title: string;
  value: string;
  subtext: string;
  progress: number;
  colorClass: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="shadow-sm flex flex-col justify-between p-6" role="status" aria-label={`${title}: ${value}`}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
        <Icon className="w-4 h-4 text-muted-foreground/50" aria-hidden="true" />
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div className="text-2xl font-bold tracking-tight">{value}</div>
        </div>

        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.min(progress, 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${title} progresso`}>
          <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
        <p className="text-xs text-muted-foreground font-medium">{subtext}</p>
      </div>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="h-8 w-32 bg-muted/40 rounded-lg animate-pulse" />
        <div className="h-10 w-48 bg-muted/40 rounded-lg animate-pulse" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-muted/40 rounded-2xl animate-pulse" />
        ))}
      </div>
      <div className="h-96 bg-muted/40 rounded-2xl animate-pulse" />
    </div>
  )
}
