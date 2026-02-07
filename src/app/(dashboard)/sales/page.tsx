"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DollarSign, ShoppingBag, Receipt } from "lucide-react";
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
  const [days, setDays] = useState("30");

  useEffect(() => {
    loadData();
  }, [days]);

  async function loadData() {
    const d = parseInt(days);
    const [s, daily, status] = await Promise.all([
      getSalesData(d),
      getSalesByDay(d),
      getSalesByStatus(),
    ]);
    if (s) setStats(s);
    setDailyData(daily);
    setStatusData(status);
  }

  function fmt(amount: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Vendas</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Analise suas vendas em todas as plataformas.
          </p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Hoje</SelectItem>
            <SelectItem value="7">7 dias</SelectItem>
            <SelectItem value="30">30 dias</SelectItem>
            <SelectItem value="90">90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground font-medium">Receita Total</p>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight">{fmt(stats?.totalRevenue || 0)}</p>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground font-medium">Total de Pedidos</p>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight">{stats?.totalOrders || 0}</p>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground font-medium">Ticket Medio</p>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Receipt className="w-4 h-4 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight">{fmt(stats?.avgTicket || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Over Time */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receita ao longo do tempo</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="salesRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                  formatter={(value, name) => [
                    name === "revenue" ? fmt(Number(value)) : Number(value),
                    name === "revenue" ? "Receita" : "Pedidos",
                  ]}
                  labelFormatter={(label) => {
                    const d = new Date(label + "T00:00:00");
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
                Integracoes
              </Link>{" "}
              para ver os dados de vendas.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By Platform */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vendas por plataforma</CardTitle>
          </CardHeader>
          <CardContent>
            {stats && stats.byPlatform.length > 0 ? (
              <ResponsiveContainer width="100%" height={256}>
                <BarChart data={stats.byPlatform}>
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
                    tickFormatter={(v) => `R$${v}`}
                  />
                  <Tooltip
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pedidos por status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={256}>
                <BarChart data={statusData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    tickLine={{ stroke: "var(--border)" }}
                    axisLine={{ stroke: "var(--border)" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="status"
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    tickLine={{ stroke: "var(--border)" }}
                    axisLine={{ stroke: "var(--border)" }}
                    width={100}
                  />
                  <Tooltip cursor={{ fill: "var(--primary)", fillOpacity: 0.08 }} />
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
    </div>
  );
}
