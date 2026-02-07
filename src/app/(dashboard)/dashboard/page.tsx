"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  ArrowDown,
  CheckCircle,
  Repeat,
  Users,
  ShoppingCart,
  Package,
  Truck,
  type LucideIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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
  checkouts: number;
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

const platformLabels: Record<string, string> = {
  SHOPIFY: "Shopify",
  CARTPANDA: "Cartpanda",
  YAMPI: "Yampi",
  NUVEMSHOP: "Nuvemshop",
};

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  paid: { label: "Pago", variant: "default" },
  pending: { label: "Pendente", variant: "secondary" },
  cancelled: { label: "Cancelado", variant: "destructive" },
  refunded: { label: "Reembolsado", variant: "outline" },
  shipped: { label: "Enviado", variant: "default" },
  delivered: { label: "Entregue", variant: "default" },
};

// Toggle pill options for the metrics chart
const metricToggles = [
  { key: "faturamento", label: "Faturamento", color: "var(--primary)", type: "bar" },
  { key: "investimento", label: "Investimento", color: "var(--destructive)", type: "bar" },
  { key: "compras", label: "Compras", color: "var(--chart-2)", type: "bar" },
  { key: "ticketMedio", label: "Ticket Medio", color: "var(--chart-4)", type: "line" },
  { key: "cpa", label: "CPA", color: "var(--chart-5)", type: "line" },
  { key: "roas", label: "ROAS", color: "var(--warning)", type: "line" },
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

  function formatDate(date: Date) {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(date));
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Visao Geral</h2>
            <p className="text-muted-foreground text-sm mt-1">Carregando dados...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-5 pb-5">
                <div className="animate-pulse space-y-3">
                  <div className="flex justify-between">
                    <div className="h-4 w-24 bg-muted rounded" />
                    <div className="w-10 h-10 bg-muted rounded-xl" />
                  </div>
                  <div className="h-8 w-32 bg-muted rounded" />
                  <div className="h-3 w-36 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card><CardContent className="pt-6"><div className="animate-pulse h-72 bg-muted rounded" /></CardContent></Card>
      </div>
    );
  }

  // Funnel steps
  const funnelSteps = funnel ? [
    { label: "Checkouts Iniciados", value: funnel.checkouts, icon: ShoppingCart, color: "border-purple-500 bg-purple-500/10" },
    { label: "Pedidos Gerados", value: funnel.pedidosGerados, icon: Package, color: "border-blue-500 bg-blue-500/10" },
    { label: "Pedidos Pagos", value: funnel.pedidosPagos, icon: CheckCircle, color: "border-primary bg-primary/10" },
    { label: "Pedidos Enviados", value: funnel.pedidosEnviados, icon: Truck, color: "border-success bg-success/10" },
  ] : [];

  const conversionRate = funnel && funnel.checkouts > 0
    ? ((funnel.pedidosPagos / funnel.checkouts) * 100).toFixed(2)
    : "0";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Visao Geral</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Acompanhe o desempenho das suas plataformas.
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
        <KPICard icon={ShoppingBag} title="Faturamento" value={fmt(stats?.revenue || 0)} change={stats?.revenueChange || "0%"} iconColor="bg-primary/10 text-primary" />
        <KPICard icon={DollarSign} title="Investimento" value={fmt(stats?.adSpend || 0)} change={stats?.adSpendChange || "0%"} iconColor="bg-destructive/10 text-destructive" />
        <KPICard icon={ShoppingBag} title="Pedidos" value={String(stats?.totalOrders || 0)} change={stats?.ordersChange || "0%"} iconColor="bg-success/10 text-success" />
        <KPICard icon={TrendingUp} title="ROAS" value={`${(stats?.roas || 0).toFixed(2)}x`} change="" iconColor="bg-chart-4/10 text-chart-4" />
      </div>

      {/* Analise de Metricas — multi-metric chart */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base font-semibold">Analise de Metricas</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Metric toggle pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            {metricToggles.map((m) => (
              <button
                key={m.key}
                onClick={() => toggleMetric(m.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  activeMetrics.has(m.key)
                    ? "border-current opacity-100"
                    : "border-border opacity-40 hover:opacity-70"
                }`}
                style={{ color: m.color }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                {m.label}
              </button>
            ))}
          </div>
          {metricsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={metricsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  tickFormatter={(v) => {
                    const d = new Date(v + "T00:00:00");
                    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
                  }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => fmtShort(v)}
                  width={65}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = new Date(label + "T00:00:00");
                    return (
                      <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm">
                        <p className="font-medium mb-2">{d.toLocaleDateString("pt-BR")}</p>
                        {payload.map((p) => (
                          <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: String(p.color) }} />
                              {metricToggles.find((m) => m.key === p.dataKey)?.label}:
                            </span>
                            <span className="font-semibold">
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
                {activeMetrics.has("faturamento") && <Bar yAxisId="left" dataKey="faturamento" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={20} />}
                {activeMetrics.has("investimento") && <Bar yAxisId="left" dataKey="investimento" fill="var(--destructive)" radius={[4, 4, 0, 0]} barSize={20} />}
                {activeMetrics.has("compras") && <Bar yAxisId="left" dataKey="compras" fill="var(--chart-2)" radius={[4, 4, 0, 0]} barSize={20} />}
                {activeMetrics.has("ticketMedio") && <Line yAxisId="right" type="monotone" dataKey="ticketMedio" stroke="var(--chart-4)" strokeWidth={2} dot={false} />}
                {activeMetrics.has("cpa") && <Line yAxisId="right" type="monotone" dataKey="cpa" stroke="var(--chart-5)" strokeWidth={2} dot={false} />}
                {activeMetrics.has("roas") && <Line yAxisId="right" type="monotone" dataKey="roas" stroke="var(--warning)" strokeWidth={2} dot={false} />}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-muted-foreground text-sm">
              Conecte uma plataforma para ver os dados
            </div>
          )}
        </CardContent>
      </Card>

      {/* Funnel + Rates row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Funil de Conversao */}
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base font-semibold">Funil de Conversao</CardTitle>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">{conversionRate}%</p>
              <p className="text-xs text-muted-foreground">Taxa de Conversao</p>
            </div>
          </CardHeader>
          <CardContent>
            {funnel ? (
              <div className="space-y-0">
                {funnelSteps.map((step, i) => {
                  const pctOfTotal = funnelSteps[0].value > 0
                    ? ((step.value / funnelSteps[0].value) * 100)
                    : 0;
                  const barWidth = Math.max(30, 100 - i * 18);
                  const prevValue = i > 0 ? funnelSteps[i - 1].value : 0;
                  const dropPct = prevValue > 0 ? (((prevValue - step.value) / prevValue) * 100).toFixed(1) : null;
                  const convPct = i > 0 && funnelSteps[i - 1].value > 0
                    ? ((step.value / funnelSteps[i - 1].value) * 100).toFixed(1)
                    : null;
                  const Icon = step.icon;

                  return (
                    <div key={step.label}>
                      {/* Drop indicator between steps */}
                      {i > 0 && dropPct && (
                        <div className="flex items-center justify-center py-1.5">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <ArrowDown className="w-3 h-3" />
                            <span>{dropPct}% perda</span>
                          </div>
                        </div>
                      )}
                      {/* Funnel bar */}
                      <div
                        className={`relative rounded-xl border-l-4 px-4 py-3 transition-all ${step.color}`}
                        style={{ width: `${barWidth}%`, marginLeft: `${(100 - barWidth) / 2}%` }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 opacity-70" />
                            <div>
                              <p className="text-sm font-medium">{step.label}</p>
                              <p className="text-[11px] text-muted-foreground">{pctOfTotal.toFixed(1)}% do total</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">{fmtNum(step.value)}</p>
                            {convPct && <p className="text-[11px] text-primary">{convPct}% conversao</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                Sem dados para o funil
              </div>
            )}
          </CardContent>
        </Card>

        {/* Paid % + Repurchase % */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm text-muted-foreground font-medium">Pedidos Pagos</p>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
                  <CheckCircle className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-bold tracking-tight">{(rates?.paidRate || 0).toFixed(1)}%</p>
              <div className="mt-2 w-full bg-muted rounded-full h-2.5">
                <div className="bg-primary h-2.5 rounded-full transition-all" style={{ width: `${Math.min(rates?.paidRate || 0, 100)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {rates?.paidOrders || 0} pagos de {rates?.totalOrders || 0} gerados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm text-muted-foreground font-medium">Taxa de Recompra</p>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-chart-2/10 text-chart-2">
                  <Repeat className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-bold tracking-tight">{(rates?.repurchaseRate || 0).toFixed(1)}%</p>
              <div className="mt-2 w-full bg-muted rounded-full h-2.5">
                <div className="bg-chart-2 h-2.5 rounded-full transition-all" style={{ width: `${Math.min(rates?.repurchaseRate || 0, 100)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {rates?.repeatCustomers || 0} recompraram de {rates?.uniqueCustomers || 0} clientes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm text-muted-foreground font-medium">Clientes Unicos</p>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-chart-4/10 text-chart-4">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-bold tracking-tight">{fmtNum(rates?.uniqueCustomers || 0)}</p>
              <p className="text-xs text-muted-foreground mt-2">no periodo selecionado</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Customer Trends + Platform breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Tendencias de Clientes */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold">Tendencias de Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            {customerTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={customerTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    tickFormatter={(v) => {
                      const [y, m] = v.split("-");
                      const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                      return months[parseInt(m) - 1] || v;
                    }}
                  />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const [y, m] = (label as string).split("-");
                      const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                      return (
                        <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm">
                          <p className="font-medium mb-2">{months[parseInt(m) - 1]} {y}</p>
                          {payload.map((p) => (
                            <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5">
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: String(p.color) }} />
                                {p.dataKey === "novos" ? "Novos Clientes" : p.dataKey === "recorrentes" ? "Clientes Recorrentes" : "Taxa de Recorrencia"}:
                              </span>
                              <span className="font-semibold">
                                {p.dataKey === "taxaRecorrencia" ? `${Number(p.value).toFixed(1)}%` : fmtNum(Number(p.value))}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Bar yAxisId="left" dataKey="novos" fill="var(--chart-2)" stackId="customers" radius={[0, 0, 0, 0]} barSize={28} name="Novos" />
                  <Bar yAxisId="left" dataKey="recorrentes" fill="var(--primary)" stackId="customers" radius={[4, 4, 0, 0]} barSize={28} name="Recorrentes" />
                  <Line yAxisId="right" type="monotone" dataKey="taxaRecorrencia" stroke="var(--chart-5)" strokeWidth={2} dot={{ r: 3, fill: "var(--chart-5)" }} name="Taxa %" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
                Sem dados de clientes para o periodo
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pedidos por Plataforma */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold">Pedidos por Plataforma</CardTitle>
          </CardHeader>
          <CardContent>
            {platformData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={platformData} layout="vertical" barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="platform" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={80} />
                  <Tooltip
                    formatter={(value, name) => [
                      name === "revenue" ? fmt(Number(value)) : Number(value),
                      name === "revenue" ? "Receita" : "Pedidos",
                    ]}
                    cursor={{ fill: "var(--primary)", fillOpacity: 0.06 }}
                  />
                  <Bar dataKey="orders" fill="var(--primary)" radius={[0, 6, 6, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
                Conecte uma plataforma
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base font-semibold">Pedidos Recentes</CardTitle>
          <Link href="/orders" className="text-xs text-primary hover:underline">Ver todos</Link>
        </CardHeader>
        <CardContent>
          {recentOrders.length > 0 ? (
            <div className="space-y-0 divide-y divide-border">
              {recentOrders.map((order) => {
                const statusInfo = statusLabels[order.status] || { label: order.status, variant: "outline" as const };
                return (
                  <div key={order.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">#{order.externalOrderId}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {order.customerName || "Sem nome"} &middot; {platformLabels[order.platform] || order.platform}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      <span className="text-sm font-semibold w-24 text-right">{fmt(order.totalAmount)}</span>
                      <span className="text-xs text-muted-foreground w-14 text-right">{formatDate(order.orderDate)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
              Nenhum pedido ainda. Conecte suas plataformas em{" "}
              <Link href="/integrations" className="text-primary ml-1 hover:underline">Integracoes</Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({ icon: Icon, title, value, change, iconColor }: {
  icon: LucideIcon; title: string; value: string; change: string; iconColor: string;
}) {
  const isPositive = change.startsWith("+");
  const ChangeIcon = isPositive ? ArrowUpRight : ArrowDownRight;
  return (
    <Card className="transition-all hover:shadow-md">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between mb-4">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {change && (
          <p className={`text-xs mt-2 font-medium flex items-center gap-1 ${isPositive ? "text-success" : "text-destructive"}`}>
            <ChangeIcon className="w-3.5 h-3.5" />
            {change}
            <span className="text-muted-foreground font-normal ml-0.5">vs periodo anterior</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
