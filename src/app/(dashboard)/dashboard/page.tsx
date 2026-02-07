"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  DollarSign,
  ShoppingBag,
  Megaphone,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  type LucideIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { toast } from "sonner";
import { getDashboardData, getRevenueByDay, getOrdersByPlatform, getRecentOrders } from "@/actions/dashboard";
import { syncAll } from "@/actions/sync";

type DashboardStats = {
  totalOrders: number;
  ordersChange: string;
  revenue: number;
  revenueChange: string;
  adSpend: number;
  adSpendChange: string;
  roas: number;
};

type RevenuePoint = { date: string; revenue: number };
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

const periodOptions = [
  { value: "0", label: "Hoje" },
  { value: "7", label: "7d" },
  { value: "30", label: "Mes" },
  { value: "90", label: "90d" },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [revenueData, setRevenueData] = useState<RevenuePoint[]>([]);
  const [platformData, setPlatformData] = useState<PlatformData[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [period, setPeriod] = useState("30");
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [period]);

  async function loadData() {
    setLoading(true);
    const days = parseInt(period);
    const [s, r, p, o] = await Promise.all([
      getDashboardData(days),
      getRevenueByDay(days),
      getOrdersByPlatform(),
      getRecentOrders(5),
    ]);
    if (s) setStats(s);
    setRevenueData(r);
    setPlatformData(p);
    setRecentOrders(o);
    setLoading(false);
  }

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

  function fmt(amount: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
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
        <Card>
          <CardContent className="pt-6">
            <div className="animate-pulse h-72 bg-muted rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

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
        <div className="flex items-center gap-3">
          {/* Inline period pills */}
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            {periodOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  period === opt.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={ShoppingBag}
          title="Pedidos Pagos"
          value={fmt(stats?.revenue || 0)}
          change={stats?.revenueChange || "0%"}
          iconColor="bg-primary/10 text-primary"
        />
        <KPICard
          icon={DollarSign}
          title="Valor Gasto"
          value={fmt(stats?.adSpend || 0)}
          change={stats?.adSpendChange || "0%"}
          iconColor="bg-destructive/10 text-destructive"
        />
        <KPICard
          icon={DollarSign}
          title="Pedidos"
          value={String(stats?.totalOrders || 0)}
          change={stats?.ordersChange || "0%"}
          iconColor="bg-success/10 text-success"
        />
        <KPICard
          icon={TrendingUp}
          title="ROAS"
          value={`${(stats?.roas || 0).toFixed(2)}x`}
          change=""
          iconColor="bg-chart-4/10 text-chart-4"
        />
      </div>

      {/* Main Chart + Side Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Revenue Chart - takes 2/3 */}
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold">Desempenho no Periodo</CardTitle>
            <Link href="/sales" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Detalhes
            </Link>
          </CardHeader>
          <CardContent>
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={revenueData}>
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
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => {
                      if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                      return String(v);
                    }}
                    width={45}
                  />
                  <Tooltip
                    formatter={(value) => [fmt(Number(value)), "Receita"]}
                    labelFormatter={(label) => {
                      const d = new Date(label + "T00:00:00");
                      return d.toLocaleDateString("pt-BR");
                    }}
                    cursor={{ stroke: "var(--primary)", strokeOpacity: 0.3 }}
                  />
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--primary)"
                    fill="url(#revenueGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground text-sm">
                Conecte uma plataforma para ver os dados
              </div>
            )}
          </CardContent>
        </Card>

        {/* Side Panel - Platform breakdown */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold">Pedidos por Plataforma</CardTitle>
          </CardHeader>
          <CardContent>
            {platformData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={platformData} layout="vertical" barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="platform"
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={80}
                  />
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
              <div className="h-80 flex items-center justify-center text-muted-foreground text-sm">
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
          <Link href="/orders" className="text-xs text-primary hover:underline">
            Ver todos
          </Link>
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
              <Link href="/integrations" className="text-primary ml-1 hover:underline">
                Integracoes
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({
  icon: Icon,
  title,
  value,
  change,
  iconColor,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  change: string;
  iconColor: string;
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
