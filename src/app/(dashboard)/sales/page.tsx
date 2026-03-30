"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingBag, Receipt } from "lucide-react";
import { PeriodSelector, periodToParams, type PeriodValue } from "@/components/period-selector";
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
  Cell,
} from "recharts";
import { getSalesData, getSalesByDay, getSalesByStatus } from "@/actions/sales";

type SalesStats = {
  totalRevenue: number;
  totalOrders: number;
  avgTicket: number;
  byPlatform: { platform: string; orders: number; revenue: number }[];
};

type DaySale = { date: string; revenue: number; orders: number };
type StatusData = { status: string; count: number };

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--primary)",
];

export default function SalesPage() {
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [dailyData, setDailyData] = useState<DaySale[]>([]);
  const [statusData, setStatusData] = useState<StatusData[]>([]);
  const [period, setPeriod] = useState<PeriodValue>({ type: "preset", days: 30 });
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { days, from, to } = periodToParams(period);
      const results = await Promise.allSettled([
        getSalesData(days, from, to),
        getSalesByDay(days, from, to),
        getSalesByStatus(),
      ]);
      if (results[0].status === "fulfilled" && results[0].value) setStats(results[0].value);
      if (results[1].status === "fulfilled") setDailyData(results[1].value);
      if (results[2].status === "fulfilled") setStatusData(results[2].value);
    } catch (error) {
      console.error("Failed to load sales data", error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function fmt(amount: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[30px] font-bold tracking-[-0.02em]">Vendas</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Analise suas vendas em todas as plataformas.
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-border rounded-[20px] shadow-none">
                <CardContent className="p-3 sm:p-5">
                  <div className="animate-pulse space-y-3">
                    <div className="h-3 w-20 bg-muted/30 rounded" />
                    <div className="h-7 w-28 bg-muted/30 rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="h-80 border-border rounded-[20px] shadow-none">
            <div className="animate-pulse h-full w-full bg-muted/10 rounded-lg" />
          </Card>
        </div>
      ) : (
      <>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card className="border-border rounded-[20px] shadow-none">
          <CardContent className="p-3 sm:p-5">
            <p className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2 sm:mb-3">Receita Total</p>
            <p className="text-xl sm:text-[28px] font-bold tracking-tight" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(stats?.totalRevenue || 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-border rounded-[20px] shadow-none">
          <CardContent className="p-3 sm:p-5">
            <p className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2 sm:mb-3">Total de Pedidos</p>
            <p className="text-xl sm:text-[28px] font-bold tracking-tight" style={{ fontVariantNumeric: "tabular-nums" }}>{stats?.totalOrders || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-border rounded-[20px] shadow-none">
          <CardContent className="p-3 sm:p-5">
            <p className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2 sm:mb-3">Ticket Médio</p>
            <p className="text-xl sm:text-[28px] font-bold tracking-tight" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(stats?.avgTicket || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Over Time */}
      <Card className="border-border rounded-[20px] shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Receita ao longo do tempo</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300} aria-label="Gráfico de receita ao longo do tempo">
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="salesRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} opacity={0.3} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => {
                    const parts = String(v).split("-");
                    return `${parseInt(parts[2])}/${parseInt(parts[1])}`;
                  }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => {
                    if (v >= 1000000) return `R$${(v / 1000000).toFixed(1)}M`;
                    if (v >= 1000) return `R$${(v / 1000).toFixed(1)}k`;
                    return `R$${v.toFixed(0)}`;
                  }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px" }}
                  formatter={(value, name) => [
                    name === "revenue" ? fmt(Number(value)) : Number(value).toLocaleString("pt-BR"),
                    name === "revenue" ? "Receita" : "Pedidos",
                  ]}
                  labelFormatter={(label) => {
                    const d = new Date(label + "T12:00:00");
                    return d.toLocaleDateString("pt-BR");
                  }}
                  cursor={{ stroke: "var(--primary)", strokeOpacity: 0.3 }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--primary)"
                  fill="url(#salesRevenueGradient)"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              Conecte suas plataformas em{" "}
              <Link href="/integrations" className="text-primary mx-1 hover:underline">
                Integrações
              </Link>{" "}
              para ver os dados de vendas.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By Platform */}
        <Card className="rounded-[20px] shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base">Vendas por plataforma</CardTitle>
          </CardHeader>
          <CardContent>
            {stats && stats.byPlatform.length > 0 ? (
              <ResponsiveContainer width="100%" height={256} aria-label="Gráfico de vendas por plataforma">
                <BarChart data={stats.byPlatform}>
                  <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} opacity={0.3} />
                  <XAxis
                    dataKey="platform"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => {
                      if (v >= 1000000) return `R$${(v / 1000000).toFixed(1)}M`;
                      if (v >= 1000) return `R$${(v / 1000).toFixed(1)}k`;
                      return `R$${v.toFixed(0)}`;
                    }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px" }}
                    formatter={(value) => [fmt(Number(value)), "Receita"]}
                    cursor={{ fill: "var(--primary)", fillOpacity: 0.08 }}
                  />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                    {stats.byPlatform.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                Sem dados de vendas
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Status */}
        <Card className="rounded-[20px] shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base">Pedidos por status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={256} aria-label="Gráfico de pedidos por status">
                <BarChart data={statusData} layout="vertical">
                  <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" horizontal={false} opacity={0.3} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="status"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px" }}
                    formatter={(value) => [Number(value).toLocaleString("pt-BR"), "Pedidos"]}
                    cursor={{ fill: "var(--primary)", fillOpacity: 0.08 }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                Sem dados de status
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </>
      )}
    </div>
  );
}
