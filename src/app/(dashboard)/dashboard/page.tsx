"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  Repeat,
  Users,
  BarChart,
  Target,
  Search,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart as RechartsBarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
} from "recharts";
import { toast } from "sonner";
import {
  getDashboardData,
  getMetricsAnalysis,
  getOrdersByPlatform,
  getRecentOrders,
  getFunnelData,
  getPaidAndRepurchaseRates,
  getCustomerTrends,
} from "@/actions/dashboard";
import { syncAll } from "@/actions/sync";
import { PeriodSelector, periodToParams, type PeriodValue } from "@/components/period-selector";
import { EstimatedProfitCalendar } from "@/components/estimated-profit-calendar";
import { FunnelVisual } from "@/components/funnel-visual";
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
  sessoes: number;
  adicoesCarrinho: number;
  checkoutsIniciados: number;
  pedidosGerados: number;
  pedidosPagos: number;
  pedidosEnviados: number;
  pedidosEntregues: number;
};

type RatesData = {
  paidRate: number;
  paidOrders: number;
  totalOrders: number;
  repurchaseRate: number;
  repeatCustomers: number;
  uniqueCustomers: number;
};

type CustomerTrend = {
  month: string;
  novos: number;
  recorrentes: number;
  taxaRecorrencia: number;
};

type PlatformData = { platform: string; orders: number; revenue: number };
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
  { key: "faturamento", label: "Faturamento", color: "var(--chart-1)", type: "bar" },
  { key: "investimento", label: "Investimento", color: "var(--chart-5)", type: "bar" },
  { key: "compras", label: "Compras", color: "var(--chart-2)", type: "bar" },
  { key: "ticketMedio", label: "Ticket", color: "var(--chart-3)", type: "line" },
  { key: "cpa", label: "CPA", color: "var(--chart-4)", type: "line" },
  { key: "roas", label: "ROAS", color: "var(--chart-1)", type: "line" },
] as const;

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [metricsData, setMetricsData] = useState<MetricPoint[]>([]);
  const [platformData, setPlatformData] = useState<PlatformData[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [rates, setRates] = useState<RatesData | null>(null);
  const [customerTrends, setCustomerTrends] = useState<CustomerTrend[]>([]);
  const [period, setPeriod] = useState<PeriodValue>({ type: "preset", days: 30 });
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeMetrics, setActiveMetrics] = useState<Set<string>>(new Set(["faturamento", "investimento"]));

  const loadData = useCallback(async () => {
    setLoading(true);
    const { days, from, to } = periodToParams(period);
    const [s, m, p, o, f, r, ct] = await Promise.all([
      getDashboardData(days, from, to),
      getMetricsAnalysis(days, from, to),
      getOrdersByPlatform(),
      getRecentOrders(5),
      getFunnelData(days, from, to),
      getPaidAndRepurchaseRates(days, from, to),
      getCustomerTrends(days, from, to),
    ]);
    if (s) setStats(s);
    setMetricsData(m);
    setPlatformData(p);
    setRecentOrders(o);
    setFunnel(f);
    setRates(r);
    setCustomerTrends(ct);
    setLoading(false);
  }, [period]);

  useEffect(() => {
    loadData();
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

  function fmt(amount: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
  }

  function fmtShort(v: number) {
    if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
    return `R$ ${v.toFixed(0)}`;
  }

  function fmtNum(v: number) {
    return new Intl.NumberFormat("pt-BR").format(v);
  }

  const calcProfit = (s: DashboardStats | null) => {
    if (!s) return 0;
    return s.revenue - s.adSpend;
  };

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
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Visão Geral</h2>
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
          value={fmt(stats?.revenue || 0)}
          change={stats?.revenueChange || "0%"}
          icon={TrendingUp}
          trend="up"
        />
        <KPICard
          label="INVESTIMENTO"
          value={fmt(stats?.adSpend || 0)}
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
        <Card className="xl:col-span-2 shadow-card hover-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="space-y-1">
              <CardTitle>Performance</CardTitle>
              <CardDescription>Análise detalhada do período</CardDescription>
            </div>

            {/* Filters/Toggles */}
            <div className="flex flex-wrap gap-1.5">
              {metricToggles.map((m) => (
                <button
                  key={m.key}
                  onClick={() => toggleMetric(m.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] uppercase tracking-wide font-semibold border transition-all duration-200",
                    activeMetrics.has(m.key)
                      ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                      : "bg-transparent text-muted-foreground border-transparent hover:bg-secondary"
                  )}
                >
                  <div className={cn("w-1.5 h-1.5 rounded-full", activeMetrics.has(m.key) ? "bg-primary" : "bg-muted-foreground/30")} />
                  {m.label}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="px-2 sm:px-6 pb-6 min-h-[350px]">
            {metricsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={340}>
                <ComposedChart data={metricsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradientPrimary" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.3} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={12}
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
                    cursor={{ stroke: "var(--primary)", strokeWidth: 1, strokeDasharray: "4 4", opacity: 0.5 }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = new Date(label + "T00:00:00");
                      return (
                        <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-floating p-4 min-w-[200px]">
                          <p className="font-semibold text-sm mb-3 text-foreground">{d.toLocaleDateString("pt-BR", { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                          <div className="space-y-2">
                            {payload.map((p) => (
                              <div key={p.dataKey} className="flex items-center justify-between gap-6 text-sm">
                                <span className="text-muted-foreground capitalize flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                                  {metricToggles.find((m) => m.key === p.dataKey)?.label}
                                </span>
                                <span className="font-semibold tabular-nums text-foreground">
                                  {p.dataKey === "roas" ? `${Number(p.value).toFixed(2)}x`
                                    : p.dataKey === "compras" ? fmtNum(Number(p.value))
                                      : fmt(Number(p.value))}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }}
                  />
                  {activeMetrics.has("faturamento") && (
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="faturamento"
                      stroke="var(--chart-1)"
                      fill="url(#gradientPrimary)"
                      strokeWidth={2}
                    />
                  )}
                  {activeMetrics.has("investimento") && <Bar yAxisId="left" dataKey="investimento" fill="var(--destructive)" radius={[4, 4, 0, 0]} barSize={24} fillOpacity={0.8} />}
                  {activeMetrics.has("compras") && <Bar yAxisId="left" dataKey="compras" fill="var(--chart-2)" radius={[4, 4, 0, 0]} barSize={24} fillOpacity={0.8} />}

                  {activeMetrics.has("ticketMedio") && <Line yAxisId="right" type="monotone" dataKey="ticketMedio" stroke="var(--chart-3)" strokeWidth={2} dot={false} />}
                  {activeMetrics.has("cpa") && <Line yAxisId="right" type="monotone" dataKey="cpa" stroke="var(--chart-4)" strokeWidth={2} dot={false} />}
                  {activeMetrics.has("roas") && <Line yAxisId="right" type="monotone" dataKey="roas" stroke="var(--primary)" strokeWidth={2} dot={false} />}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2">
                <BarChart className="w-8 h-8 opacity-20" />
                <p className="text-sm">Sem dados para exibir no momento</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profit Calendar */}
        <Card className="shadow-card hover-card">
          <CardHeader>
            <CardTitle>Lucro Estimado</CardTitle>
            <CardDescription>{getMonthLabel()}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-4 pt-0">
              <EstimatedProfitCalendar
                data={metricsData}
                totalProfit={calcProfit(stats)}
                currentMonthLabel={getMonthLabel()}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row: Funnel + Rates */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Funnel Visual */}
        <Card className="shadow-card hover-card overflow-hidden">
          <CardHeader className="border-b border-border/40 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle>Funil de Conversão</CardTitle>
                <CardDescription>Jornada do cliente</CardDescription>
              </div>
              <Badge variant="secondary" className="font-mono">E-COMMERCE</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {funnel && funnel.sessoes > 0 ? (
              <FunnelVisual data={{
                sessoes: funnel.sessoes,
                adicoesCarrinho: funnel.adicoesCarrinho,
                checkoutsIniciados: funnel.checkoutsIniciados,
                pedidosGerados: funnel.pedidosGerados
              }} />
            ) : (
              <div className="py-12 text-center text-muted-foreground text-sm">Sem dados do funil</div>
            )}
          </CardContent>
        </Card>

        {/* Rates Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <RateCard
            title="Taxa de Pagamento"
            value={`${(rates?.paidRate || 0).toFixed(1)}%`}
            subtext={`${rates?.paidOrders || 0} pagos`}
            progress={rates?.paidRate || 0}
            colorClass="bg-primary"
            icon={CheckCircle}
          />

          <RateCard
            title="Taxa de Recompra"
            value={`${(rates?.repurchaseRate || 0).toFixed(1)}%`}
            subtext={`${rates?.repeatCustomers || 0} recorrentes`}
            progress={rates?.repurchaseRate || 0}
            colorClass="bg-purple-500"
            icon={Repeat}
          />

          <Card className="sm:col-span-2 shadow-card hover-card p-6 flex items-center justify-between bg-gradient-to-br from-card to-secondary/20">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Total de Clientes Únicos</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold tracking-tight text-foreground">{fmtNum(rates?.uniqueCustomers || 0)}</p>
                <span className="text-xs text-muted-foreground">no período</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Users className="w-6 h-6" />
            </div>
          </Card>
        </div>
      </div>

      {/* Platform & Trends */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Customer Trends */}
        <Card className="shadow-card hover-card">
          <CardHeader>
            <CardTitle>Tendências de Clientes</CardTitle>
            <CardDescription>Novos vs Recorrentes</CardDescription>
          </CardHeader>
          <CardContent className="px-2 pb-6">
            <div className="h-[300px] w-full">
              {customerTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={customerTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.3} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickMargin={10} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'var(--muted)', opacity: 0.1 }}
                      contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', boxShadow: 'var(--shadow-lg)' }}
                    />
                    <Bar dataKey="novos" name="Novos" fill="var(--primary)" stackId="a" radius={[0, 0, 0, 0] as any} barSize={24} />
                    <Bar dataKey="recorrentes" name="Recorrentes" fill="var(--muted-foreground)" opacity={0.3} stackId="a" radius={[4, 4, 0, 0] as any} barSize={24} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-xs">Sem dados</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Platform Breakdown */}
        <Card className="shadow-card hover-card">
          <CardHeader>
            <CardTitle>Pedidos por Plataforma</CardTitle>
            <CardDescription>Origem das vendas</CardDescription>
          </CardHeader>
          <CardContent className="px-2 pb-6">
            <div className="h-[300px] w-full">
              {platformData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={platformData} layout="vertical" barSize={32} barCategoryGap={10} margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid horizontal={false} stroke="var(--border)" opacity={0.3} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="platform" type="category" tick={{ fontSize: 12, fill: "var(--foreground)", fontWeight: 500 }} width={100} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'var(--muted)', opacity: 0.1 }}
                      contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', boxShadow: 'var(--shadow-lg)' }}
                    />
                    <Bar dataKey="orders" name="Pedidos" fill="var(--chart-2)" radius={[0, 6, 6, 0] as any} background={{ fill: 'var(--muted)', opacity: 0.1, radius: [0, 6, 6, 0] as any }} />
                  </RechartsBarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-xs">Sem dados</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

// Subcomponents

function KPICard({ label, value, change, icon: Icon, trend }: {
  label: string; value: string; change: string; icon: LucideIcon; trend: "up" | "down" | "neutral";
}) {
  const isPositive = change && change.startsWith("+") || trend === "up";
  const isNegative = change && change.startsWith("-") || trend === "down";

  return (
    <Card className="shadow-card hover-card group relative overflow-hidden">
      <div className="absolute right-0 top-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
        <Icon className="w-16 h-16" />
      </div>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Icon className="w-5 h-5" />
          </div>
          {change && (
            <Badge variant="outline" className={cn(
              "font-mono text-[10px] px-1.5 py-0 h-5 border-transparent bg-secondary/50",
              isPositive && "text-emerald-500 bg-emerald-500/10",
              isNegative && "text-red-500 bg-red-500/10"
            )}>
              {change}
            </Badge>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <h3 className="text-2xl font-bold tracking-tight text-foreground">{value}</h3>
        </div>
      </CardContent>
    </Card>
  );
}

function RateCard({ title, value, subtext, progress, colorClass, icon: Icon }: any) {
  return (
    <Card className="shadow-card hover-card flex flex-col justify-between p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
        <Icon className="w-4 h-4 text-muted-foreground/50" />
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div className="text-2xl font-bold tracking-tight">{value}</div>
        </div>

        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
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
