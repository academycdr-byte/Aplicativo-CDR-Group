"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCw, DollarSign, ShoppingBag, Megaphone, TrendingUp, type LucideIcon } from "lucide-react";
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
            <h2 className="text-xl font-bold">Dashboard</h2>
            <p className="text-muted-foreground text-sm mt-1">Carregando dados...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-5">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-8 w-32 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="animate-pulse h-64 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Visao geral de todas as plataformas conectadas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={DollarSign}
          title="Receita Total"
          value={fmt(stats?.revenue || 0)}
          change={stats?.revenueChange || "0%"}
        />
        <KPICard
          icon={ShoppingBag}
          title="Pedidos"
          value={String(stats?.totalOrders || 0)}
          change={stats?.ordersChange || "0%"}
        />
        <KPICard
          icon={Megaphone}
          title="Gasto com Ads"
          value={fmt(stats?.adSpend || 0)}
          change={stats?.adSpendChange || "0%"}
        />
        <KPICard
          icon={TrendingUp}
          title="ROAS"
          value={`${(stats?.roas || 0).toFixed(1)}x`}
          change=""
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receita ao longo do tempo</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={256}>
                <AreaChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    tickLine={{ stroke: "var(--border)" }}
                    axisLine={{ stroke: "var(--border)" }}
                    tickFormatter={(v) => {
                      const d = new Date(v + "T00:00:00");
                      return `${d.getDate()}/${d.getMonth() + 1}`;
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    tickLine={{ stroke: "var(--border)" }}
                    axisLine={{ stroke: "var(--border)" }}
                    tickFormatter={(v) => `R$${v}`}
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
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--primary)"
                    fill="url(#revenueGradient)"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                Conecte uma plataforma para ver os dados
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pedidos por plataforma</CardTitle>
          </CardHeader>
          <CardContent>
            {platformData.length > 0 ? (
              <ResponsiveContainer width="100%" height={256}>
                <BarChart data={platformData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="platform"
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    tickLine={{ stroke: "var(--border)" }}
                    axisLine={{ stroke: "var(--border)" }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    tickLine={{ stroke: "var(--border)" }}
                    axisLine={{ stroke: "var(--border)" }}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      name === "revenue" ? fmt(Number(value)) : Number(value),
                      name === "revenue" ? "Receita" : "Pedidos",
                    ]}
                    cursor={{ fill: "var(--primary)", fillOpacity: 0.08 }}
                  />
                  <Bar dataKey="orders" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                Conecte uma plataforma para ver os dados
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pedidos recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrders.length > 0 ? (
            <div className="space-y-3">
              {recentOrders.map((order) => {
                const statusInfo = statusLabels[order.status] || { label: order.status, variant: "outline" as const };
                return (
                  <div key={order.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">#{order.externalOrderId}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.customerName || "Sem nome"} &middot; {platformLabels[order.platform] || order.platform}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      <span className="text-sm font-medium w-24 text-right">{fmt(order.totalAmount)}</span>
                      <span className="text-xs text-muted-foreground w-16 text-right">{formatDate(order.orderDate)}</span>
                    </div>
                  </div>
                );
              })}
              <Link href="/orders" className="text-sm text-primary hover:underline block text-center pt-2">
                Ver todos os pedidos
              </Link>
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
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  change: string;
}) {
  const isPositive = change.startsWith("+");
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        </div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {change && (
          <p className={`text-xs mt-1.5 font-medium ${isPositive ? "text-success" : "text-destructive"}`}>
            {change} vs periodo anterior
          </p>
        )}
      </CardContent>
    </Card>
  );
}
