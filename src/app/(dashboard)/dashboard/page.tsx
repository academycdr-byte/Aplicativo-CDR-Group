"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  { key: "faturamento", label: "Faturamento", color: "var(--primary)", type: "bar" },
  { key: "investimento", label: "Investimento", color: "var(--destructive)", type: "bar" },
  { key: "compras", label: "Compras", color: "#3b82f6", type: "bar" },
  { key: "ticketMedio", label: "Ticket Médio", color: "#8b5cf6", type: "line" },
  { key: "cpa", label: "CPA", color: "#f59e0b", type: "line" },
  { key: "roas", label: "ROAS", color: "#10b981", type: "line" },
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
    return (
      <div className="space-y-6 pt-2">
        {/* Skeleton Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-6 w-32 bg-muted rounded animate-pulse" />
            <div className="h-4 w-48 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-9 w-64 bg-muted rounded animate-pulse" />
        </div>

        {/* Skeleton KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border border-border shadow-none rounded-lg p-5">
              <div className="animate-pulse space-y-3">
                <div className="flex justify-between">
                  <div className="h-3 w-24 bg-muted rounded" />
                  <div className="w-8 h-8 bg-muted rounded-full" />
                </div>
                <div className="h-7 w-32 bg-muted rounded" />
                <div className="h-3 w-20 bg-muted rounded" />
              </div>
            </Card>
          ))}
        </div>

        {/* Skeleton Charts */}
        <Card className="border border-border shadow-none rounded-lg h-96 p-6">
          <div className="animate-pulse w-full h-full bg-muted/20" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Visão Geral</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Acompanhe o desempenho das suas campanhas.
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
          iconColor="text-emerald-500 bg-emerald-500/10"
        />
        <KPICard
          label="INVESTIMENTO"
          value={fmt(stats?.adSpend || 0)}
          change={stats?.adSpendChange || "0%"}
          icon={DollarSign}
          iconColor="text-red-500 bg-red-500/10"
        />
        <KPICard
          label="PEDIDOS"
          value={String(stats?.totalOrders || 0)}
          change={stats?.ordersChange || "0%"}
          icon={ShoppingBag}
          iconColor="text-blue-500 bg-blue-500/10"
        />
        <KPICard
          label="ROAS"
          value={`${(stats?.roas || 0).toFixed(2)}x`}
          change=""
          icon={BarChart}
          iconColor="text-amber-500 bg-amber-500/10"
        />
      </div>

      {/* Main Chart + Calendar Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Chart - Takes 2/3 */}
        <Card className="lg:col-span-2 border border-border shadow-none rounded-lg flex flex-col">
          <div className="border-b border-border/50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">Performance in Period</h3>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground">
                <BarChart className="w-4 h-4" />
              </Button>
            </div>

            {/* Filters/Toggles */}
            <div className="flex flex-wrap gap-2">
              {metricToggles.map((m) => (
                <button
                  key={m.key}
                  onClick={() => toggleMetric(m.key)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] uppercase tracking-wider font-semibold border transition-all ${activeMetrics.has(m.key)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent text-muted-foreground border-border hover:border-primary/50"
                    }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <CardContent className="p-5 flex-1 min-h-[350px]">
            {metricsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={340}>
                <ComposedChart data={metricsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.4} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
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
                    width={40}
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--primary)", strokeWidth: 1, strokeDasharray: "4 4" }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = new Date(label + "T00:00:00");
                      return (
                        <div className="bg-card border border-border rounded-lg shadow-xl p-3 text-xs min-w-[180px]">
                          <p className="font-semibold mb-2 pb-2 border-b border-border">{d.toLocaleDateString("pt-BR")}</p>
                          {payload.map((p) => (
                            <div key={p.dataKey} className="flex items-center justify-between gap-4 py-1">
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: String(p.color) }} />
                                <span>{metricToggles.find((m) => m.key === p.dataKey)?.label}</span>
                              </div>
                              <span className="font-medium">
                                {p.dataKey === "roas" ? `${Number(p.value).toFixed(2)}x`
                                  : p.dataKey === "compras" ? fmtNum(Number(p.value))
                                    : fmt(Number(p.value))}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  {activeMetrics.has("faturamento") && <Bar yAxisId="left" dataKey="faturamento" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={32} fillOpacity={0.9} />}
                  {activeMetrics.has("investimento") && <Bar yAxisId="left" dataKey="investimento" fill="var(--destructive)" radius={[4, 4, 0, 0]} barSize={32} fillOpacity={0.9} />}
                  {activeMetrics.has("compras") && <Bar yAxisId="left" dataKey="compras" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} fillOpacity={0.9} />}

                  {activeMetrics.has("ticketMedio") && <Line yAxisId="right" type="monotone" dataKey="ticketMedio" stroke="#8b5cf6" strokeWidth={2} dot={false} />}
                  {activeMetrics.has("cpa") && <Line yAxisId="right" type="monotone" dataKey="cpa" stroke="#f59e0b" strokeWidth={2} dot={false} />}
                  {activeMetrics.has("roas") && <Line yAxisId="right" type="monotone" dataKey="roas" stroke="#10b981" strokeWidth={2} dot={false} />}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Conecte uma plataforma para ver os dados graph
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profit Calendar - Takes 1/3 */}
        <Card className="border border-border shadow-none rounded-lg p-5">
          <EstimatedProfitCalendar
            data={metricsData}
            totalProfit={calcProfit(stats)}
            currentMonthLabel={getMonthLabel()}
          />
        </Card>
      </div>

      {/* Row: Funnel (Visual Component) + Rates */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Funnel Visual */}
        <div className="h-full">
          <div className="h-full">
            <div className="grid grid-cols-1 gap-4">
              {/* Simplified Funnel using just one card */}
              <Card className="border border-border shadow-none rounded-lg">
                <CardHeader className="border-b border-border/50 px-5 py-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">Funil de Conversão</CardTitle>
                    <Badge variant="outline" className="text-[10px] uppercase font-medium">E-commerce</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  {funnel && funnel.sessoes > 0 ? (
                    <div className="space-y-4">
                      <FunnelVisual data={{
                        sessoes: funnel.sessoes,
                        adicoesCarrinho: funnel.adicoesCarrinho,
                        checkoutsIniciados: funnel.checkoutsIniciados,
                        pedidosGerados: funnel.pedidosGerados
                      }} />
                    </div>
                  ) : (
                    <div className="py-10 text-center text-muted-foreground text-sm">Sem dados do funil</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Rates Cards */}
        <div className="space-y-4">
          {/* Rate Card 1 */}
          <RateCard
            title="Taxa de Pagamento"
            value={`${(rates?.paidRate || 0).toFixed(1)}%`}
            subtext={`${rates?.paidOrders || 0} pagos de ${rates?.totalOrders || 0} gerados`}
            progress={rates?.paidRate || 0}
            colorClass="bg-primary"
            icon={CheckCircle}
          />

          {/* Rate Card 2 */}
          <RateCard
            title="Taxa de Recompra"
            value={`${(rates?.repurchaseRate || 0).toFixed(1)}%`}
            subtext={`${rates?.repeatCustomers || 0} recompraram de ${rates?.uniqueCustomers || 0} únicos`}
            progress={rates?.repurchaseRate || 0}
            colorClass="bg-purple-500"
            icon={Repeat}
          />

          {/* Rate Card 3 (Simple) */}
          <Card className="border border-border shadow-none rounded-lg p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Clientes Únicos</p>
                <p className="text-2xl font-bold tracking-tight">{fmtNum(rates?.uniqueCustomers || 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">Neste período</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Platform & Trends */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Customer Trends */}
        <Card className="border border-border shadow-none rounded-lg">
          <CardHeader className="border-b border-border/50 px-5 py-4">
            <CardTitle className="text-base font-semibold">Tendências de Clientes</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="h-[300px] w-full">
              {customerTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={customerTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                    <Bar dataKey="novos" fill="var(--primary)" stackId="a" radius={[0, 0, 0, 0]} barSize={20} />
                    <Bar dataKey="recorrentes" fill="var(--muted)" stackId="a" radius={[4, 4, 0, 0]} barSize={20} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-xs">Sem dados</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Platform Breakdown */}
        <Card className="border border-border shadow-none rounded-lg">
          <CardHeader className="border-b border-border/50 px-5 py-4">
            <CardTitle className="text-base font-semibold">Pedidos por Plataforma</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="h-[300px] w-full">
              {platformData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={platformData} layout="vertical" barSize={24} barCategoryGap={10}>
                    <CartesianGrid horizontal={false} stroke="var(--border)" opacity={0.5} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="platform" type="category" tick={{ fontSize: 11, fill: "var(--foreground)" }} width={80} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.2 }} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                    <Bar dataKey="orders" fill="var(--primary)" radius={[0, 4, 4, 0]} background={{ fill: 'var(--muted)', opacity: 0.2, radius: [0, 4, 4, 0] }} />
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

function KPICard({ label, value, change, icon: Icon, iconColor }: {
  label: string; value: string; change: string; icon: LucideIcon; iconColor: string;
}) {
  const isPositive = change && change.startsWith("+");
  const isNegative = change && change.startsWith("-");

  return (
    <Card className="border border-border shadow-none rounded-lg p-5 hover:border-primary/30 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{label}</span>
        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${iconColor}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
        <div className="flex items-center gap-1.5 mt-1">
          {isPositive && <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />}
          {isNegative && <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />}
          <span className={`text-xs font-medium ${isPositive ? 'text-emerald-500' : isNegative ? 'text-red-500' : 'text-muted-foreground'}`}>
            {change}
          </span>
          <span className="text-[10px] text-muted-foreground">vs anterior</span>
        </div>
      </div>
    </Card>
  );
}

function RateCard({ title, value, subtext, progress, colorClass, icon: Icon }: any) {
  return (
    <Card className="border border-border shadow-none rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="text-2xl font-bold tracking-tight mb-3">{value}</div>
      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden mb-2">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{subtext}</p>
    </Card>
  );
}
