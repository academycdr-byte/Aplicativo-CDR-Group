"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { syncAll, syncRecent, getLastSyncTime } from "@/actions/sync";
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
  generatedRevenue: number;
  generatedRevenueChange: string;
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
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [rates, setRates] = useState<RatesData | null>(null);
  const [period, setPeriod] = useState<PeriodValue>({ type: "preset", days: 30 });
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeMetrics, setActiveMetrics] = useState<Set<string>>(new Set(["faturamento", "investimento"]));
  const [profitData, setProfitData] = useState<{ dailyProfits: { date: string; profit: number; revenue: number; costs: number }[]; totalProfit: number }>({ dailyProfits: [], totalProfit: 0 });

  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [currency, setCurrency] = useState<Currency>("BRL");
  const [exchangeRates, setExchangeRates] = useState<Record<string, number> | null>(null);

  // Track if we've loaded data at least once (to distinguish skeleton vs overlay)
  const hasDataRef = React.useRef(false);

  // Client-side cache: period key → dashboard data (show instantly on period switch-back)
  const cacheRef = React.useRef(new Map<string, NonNullable<Awaited<ReturnType<typeof loadAllDashboardData>>>>());

  useEffect(() => {
    getExchangeRates().then((r) => setExchangeRates(r));
    getLastSyncTime().then((r) => setLastSyncAt(r.lastSyncAt));
  }, []);

  // Apply data from server or cache to all state slices
  const applyData = useCallback((data: NonNullable<Awaited<ReturnType<typeof loadAllDashboardData>>>) => {
    if (data.dashboard) setStats(data.dashboard);
    setMetricsData(data.metrics);
    setFunnel(data.funnel);
    setRates(data.rates);
    if (data.profitData) setProfitData(data.profitData);
  }, []);

  // Generate cache key from period
  const getCacheKey = useCallback((p: PeriodValue): string => {
    if (p.type === "preset") return `p-${p.days}`;
    return `c-${p.from.getTime()}-${p.to.getTime()}`;
  }, []);

  const loadData = useCallback(async (silent = false) => {
    const isFirstLoad = !hasDataRef.current;
    const cacheKey = getCacheKey(period);

    // Check cache: if we have data for this period, show it INSTANTLY
    const cached = cacheRef.current.get(cacheKey);
    if (cached && !isFirstLoad) {
      applyData(cached);
      // Still refresh in background but don't show any loading state
      silent = true;
    }

    if (!silent) {
      if (isFirstLoad) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
    }

    const { days, from, to } = periodToParams(period);

    try {
      const data = await loadAllDashboardData(days, from, to);
      if (!data) {
        if (!silent) { setLoading(false); setRefreshing(false); }
        return;
      }

      // Cache the fresh result
      cacheRef.current.set(cacheKey, data);
      // Limit cache to 10 entries to avoid memory bloat
      if (cacheRef.current.size > 10) {
        const firstKey = cacheRef.current.keys().next().value;
        if (firstKey) cacheRef.current.delete(firstKey);
      }

      applyData(data);
      hasDataRef.current = true;

      if (!silent && data.failedCount > 0) {
        toast.error(`Erro ao carregar ${data.failedCount} seção(ões) do dashboard`);
      }
    } catch (error) {
      console.error("[Dashboard] loadData failed:", error);
      if (!silent) {
        toast.error("Erro ao carregar dados do dashboard. Tente atualizar a página.");
      }
    }

    if (!silent) { setLoading(false); setRefreshing(false); }
  }, [period, applyData, getCacheKey]);

  // Keep a ref to the latest loadData so auto-sync always uses current period
  const loadDataRef = useRef(loadData);
  useEffect(() => { loadDataRef.current = loadData; }, [loadData]);

  // Load data on period change (fast - no sync, just DB queries)
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen for BackgroundSync completion events
  useEffect(() => {
    const handleSyncComplete = () => {
      loadDataRef.current(true);
      getLastSyncTime().then((r) => setLastSyncAt(r.lastSyncAt));
    };
    window.addEventListener("sync-complete", handleSyncComplete);
    return () => window.removeEventListener("sync-complete", handleSyncComplete);
  }, []);

  // Auto-sync: only on MOUNT + interval (NOT on period change)
  useEffect(() => {
    let cancelled = false;

    const isYesterday = period.type === "preset" && period.days === -1;
    if (isYesterday) return () => { cancelled = true; };

    // Adaptive interval based on period
    let intervalMs: number;
    if (period.type === "preset" && period.days === 0) {
      intervalMs = 3 * 60 * 1000; // Hoje: 3 min
    } else if (period.type === "preset" && period.days === 7) {
      intervalMs = 5 * 60 * 1000; // 7d: 5 min
    } else if (period.type === "preset" && period.days === 30) {
      intervalMs = 10 * 60 * 1000; // 30d: 10 min
    } else {
      intervalMs = 15 * 60 * 1000; // 90d / Custom: 15 min
    }

    // Initial sync on mount only (background, doesn't block data display)
    syncRecent().then(() => {
      if (cancelled) return;
      loadDataRef.current(true);
      getLastSyncTime().then((r) => { if (!cancelled) setLastSyncAt(r.lastSyncAt); });
    });

    // Auto-refresh at adaptive interval
    const intervalId = setInterval(() => {
      syncRecent().then(() => {
        if (cancelled) return;
        loadDataRef.current(true);
        getLastSyncTime().then((r) => { if (!cancelled) setLastSyncAt(r.lastSyncAt); });
      });
    }, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      await syncAll();
      await loadData();
      const syncTime = await getLastSyncTime();
      setLastSyncAt(syncTime.lastSyncAt);
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
    <div className="animate-in fade-in duration-500 relative">
      {refreshing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-3 bg-card/95 backdrop-blur-xl border border-border/60 rounded-2xl px-5 py-3 shadow-2xl animate-in fade-in zoom-in-95 duration-300 pointer-events-auto">
            <div className="w-5 h-5 border-[2.5px] border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-foreground font-medium">Atualizando métricas...</span>
          </div>
        </div>
      )}
      <div className={cn("space-y-8 transition-opacity duration-300", refreshing && "opacity-50")}>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-[30px] font-bold tracking-[-0.02em] text-foreground">Visão Geral</h2>
          <p className="text-muted-foreground mt-1 text-[14px]">
            Performance das suas campanhas em tempo real.
          </p>
        </div>
        <PeriodSelector
          value={period}
          onChange={setPeriod}
          onRefresh={handleSync}
          refreshing={syncing}
          lastSyncAt={lastSyncAt}
        />
      </div>

      {/* KPI Cards — Row 1: 3 cards, Row 2: 2 cards (50/50) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="lg:col-span-2">
          <KPICard
            label="FATURAMENTO"
            value={fmtRevenue(stats?.generatedRevenue || 0)}
            change={stats?.generatedRevenueChange || "0%"}
            icon={BarChart}
            trend="up"
            tag="Gerado"
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
        </div>
        <div className="lg:col-span-2">
          <KPICard
            label="FATURAMENTO"
            value={fmtRevenue(stats?.revenue || 0)}
            change={stats?.revenueChange || "0%"}
            icon={TrendingUp}
            trend="up"
            tag="Pagos"
          />
        </div>
        <div className="lg:col-span-2">
          <KPICard
            label="INVESTIMENTO"
            value={fmtStandard(stats?.adSpend || 0)}
            change={stats?.adSpendChange || "0%"}
            icon={DollarSign}
            trend="down"
          />
        </div>
        <div className="lg:col-span-3">
          <KPICard
            label="PEDIDOS"
            value={String(stats?.totalOrders || 0)}
            change={stats?.ordersChange || "0%"}
            icon={ShoppingBag}
            trend="up"
            tag="Pagos"
          />
        </div>
        <div className="lg:col-span-3">
          <KPICard
            label="ROAS"
            value={`${(stats?.roas || 0).toFixed(2)}x`}
            change="0%"
            icon={Target}
            trend="neutral"
          />
        </div>
      </div>

      {/* Main Chart + Calendar Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Performance Chart */}
        <Card className="xl:col-span-2 border-border rounded-[20px] shadow-none">
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

          <CardContent className="px-2 sm:px-6 pb-2 sm:pb-4">
            {metricsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320} className="sm:!h-[400px]" aria-label="Gráfico de performance das campanhas ao longo do tempo">
                <ComposedChart data={convertedMetrics} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
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
                  <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} opacity={0.2} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 13, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={12}
                    interval="preserveStartEnd"
                    tickFormatter={(v) => {
                      const parts = String(v).split("-");
                      return `${parts[2]}/${parts[1]}`;
                    }}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 13, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => fmtShort(v)}
                    width={65}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 13, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "4 4", opacity: 0.3 }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      // Use T12:00 (noon) to avoid timezone-related off-by-one
                      const d = new Date(label + "T12:00:00");
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
              <div className="h-[320px] sm:h-[400px] flex flex-col items-center justify-center text-muted-foreground space-y-2">
                <BarChart className="w-8 h-8 opacity-20" />
                <p className="text-sm">Sem dados para exibir no momento</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profit Calendar */}
        <Card className="border-border rounded-[20px] shadow-none">
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
        <Card className="border-border rounded-[20px] shadow-none overflow-hidden">
          <CardHeader className="border-b border-border rounded-[20px] shadow-none bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle>Funil de Conversão</CardTitle>
                <CardDescription>Baseado nos eventos rastreados pelo Meta Ads</CardDescription>
              </div>
              <Badge variant="secondary" className="text-[11px] font-semibold tracking-wide">META ADS</Badge>
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
            subtext={`${rates?.paidOrders || 0} Pedidos Pagos de ${rates?.totalOrders || 0} Pedidos Gerados`}
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

      </div>{/* end opacity wrapper */}
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

function KPICard({ label, value, change, icon: Icon, trend, action, tag }: {
  label: string; value: string; change: string; icon: LucideIcon; trend: "up" | "down" | "neutral"; action?: React.ReactNode; tag?: string;
}) {
  const isPositive = change && (change.startsWith("+") || trend === "up");
  const isNegative = change && (change.startsWith("-") || trend === "down");
  const changeNum = change?.replace(/[^0-9.-]/g, "") || "0";

  return (
    <div
      className="bg-card border border-border rounded-[20px] p-4 sm:p-5 h-full"
      role="status"
      aria-label={`${label}${tag ? ` (${tag})` : ""}: ${value}`}
    >
      {/* Row 1: icon + label + action */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--accent-surface)" }}>
            <Icon className="w-[18px] h-[18px] text-primary" strokeWidth={1.8} />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] font-medium text-muted-foreground uppercase tracking-wide truncate">{label}</span>
            {tag && (
              <span className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wide shrink-0" style={{ background: "var(--success-surface)", color: "var(--success)" }}>
                <CheckCircle className="w-2.5 h-2.5" />
                {tag}
              </span>
            )}
          </div>
        </div>
        {action}
      </div>
      {/* Row 2: KPI Value */}
      <h3 className="text-2xl sm:text-[32px] font-bold leading-none tracking-[-0.02em] text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </h3>
      {/* Row 3: Badge + Comparison */}
      <div className="flex items-center gap-2 mt-2">
        {change && change !== "0%" && changeNum !== "0" && (
          <span
            className="text-[12px] font-semibold px-1.5 py-0.5 rounded shrink-0"
            style={{
              background: isPositive ? "var(--success-surface)" : isNegative ? "var(--danger-surface)" : undefined,
              color: isPositive ? "var(--success)" : isNegative ? "var(--destructive)" : "var(--muted-foreground)",
            }}
          >
            {isPositive ? "↑" : isNegative ? "↓" : ""} {change}
          </span>
        )}
        <span className="text-[12px] text-muted-foreground/60 hidden sm:inline truncate">vs período anterior</span>
      </div>
    </div>
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
    <Card className="border-border rounded-[20px] shadow-none flex flex-col justify-between p-5 sm:p-7" role="status" aria-label={`${title}: ${value}`}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{title}</span>
        <Icon className="w-4 h-4 text-muted-foreground/40" aria-hidden="true" />
      </div>

      <div className="space-y-3">
        <div className="text-2xl sm:text-[36px] font-bold tracking-tight leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>{value}</div>

        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.min(progress, 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${title} progresso`}>
          <div className={`h-full rounded-full transition-all duration-700 ease-out ${colorClass}`} style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">{subtext}</p>
      </div>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <div className="h-7 w-36 bg-muted/30 rounded-lg animate-pulse" />
          <div className="h-4 w-56 bg-muted/20 rounded-md animate-pulse" />
        </div>
        <div className="h-9 w-44 bg-muted/20 rounded-lg animate-pulse" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-[120px] bg-card border border-border/30 rounded-xl animate-pulse p-5">
            <div className="h-3 w-20 bg-muted/30 rounded mb-4" />
            <div className="h-7 w-32 bg-muted/30 rounded mb-2" />
            <div className="h-3 w-24 bg-muted/20 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 h-[420px] bg-card border border-border/30 rounded-xl animate-pulse" />
        <div className="h-[420px] bg-card border border-border/30 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}
