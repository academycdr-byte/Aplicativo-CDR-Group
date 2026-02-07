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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, Eye, MousePointer, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { getAdMetrics, getAdMetricsByDay } from "@/actions/ads";

type AdTotals = {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
};

type DayMetric = {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
};

type AdMetric = {
  id: string;
  platform: string;
  campaignName: string | null;
  adSetName: string | null;
  date: Date;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
};

const platformLabels: Record<string, string> = {
  FACEBOOK_ADS: "Facebook Ads",
  GOOGLE_ADS: "Google Ads",
};

export default function AdsPage() {
  const [totals, setTotals] = useState<AdTotals | null>(null);
  const [metrics, setMetrics] = useState<AdMetric[]>([]);
  const [dayData, setDayData] = useState<DayMetric[]>([]);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [days, setDays] = useState("30");
  const [metricsPage, setMetricsPage] = useState(1);
  const metricsPerPage = 20;

  useEffect(() => {
    loadData();
  }, [platformFilter, days]);

  async function loadData() {
    const d = parseInt(days);
    const [metricsData, dayMetrics] = await Promise.all([
      getAdMetrics({
        platform: platformFilter === "all" ? undefined : platformFilter,
        days: d,
      }),
      getAdMetricsByDay(d),
    ]);
    setTotals(metricsData.totals);
    setMetrics(metricsData.metrics);
    setDayData(dayMetrics);
  }

  function fmt(amount: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
  }

  function fmtNum(n: number) {
    return new Intl.NumberFormat("pt-BR").format(n);
  }

  const roas = totals && totals.spend > 0 ? totals.revenue / totals.spend : 0;
  const ctr = totals && totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Anuncios</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Acompanhe o desempenho dos seus anuncios no Facebook e Google.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Plataforma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="FACEBOOK_ADS">Facebook Ads</SelectItem>
              <SelectItem value="GOOGLE_ADS">Google Ads</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Gasto Total</p>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{fmt(totals?.spend || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Impressoes</p>
              <Eye className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{fmtNum(totals?.impressions || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Cliques</p>
              <MousePointer className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{fmtNum(totals?.clicks || 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">CTR: {ctr.toFixed(2)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">ROAS</p>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{roas.toFixed(1)}x</p>
            <p className="text-xs text-muted-foreground mt-1">{fmtNum(totals?.conversions || 0)} conversoes</p>
          </CardContent>
        </Card>
      </div>

      {/* Spend Over Time Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gasto ao longo do tempo</CardTitle>
        </CardHeader>
        <CardContent>
          {dayData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dayData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => {
                    const d = new Date(v + "T00:00:00");
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                  }}
                />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  formatter={(value, name) => {
                    const v = Number(value);
                    if (name === "spend") return [fmt(v), "Gasto"];
                    if (name === "revenue") return [fmt(v), "Receita"];
                    return [v, String(name)];
                  }}
                  labelFormatter={(label) => {
                    const d = new Date(label + "T00:00:00");
                    return d.toLocaleDateString("pt-BR");
                  }}
                />
                <Line type="monotone" dataKey="spend" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              Conecte{" "}
              <Link href="/integrations" className="text-primary mx-1 hover:underline">
                Facebook Ads ou Google Ads
              </Link>{" "}
              para ver as metricas.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campaigns Table with Pagination */}
      {metrics.length > 0 && (() => {
        const totalMetricsPages = Math.ceil(metrics.length / metricsPerPage);
        const paginatedMetrics = metrics.slice(
          (metricsPage - 1) * metricsPerPage,
          metricsPage * metricsPerPage
        );

        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Campanhas ({metrics.length} resultado{metrics.length !== 1 ? "s" : ""})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Plataforma</TableHead>
                    <TableHead className="text-right">Impressoes</TableHead>
                    <TableHead className="text-right">Cliques</TableHead>
                    <TableHead className="text-right">Gasto</TableHead>
                    <TableHead className="text-right">Conv.</TableHead>
                    <TableHead className="text-right">ROAS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedMetrics.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{m.campaignName || "-"}</p>
                          {m.adSetName && <p className="text-xs text-muted-foreground">{m.adSetName}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{platformLabels[m.platform] || m.platform}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{fmtNum(m.impressions)}</TableCell>
                      <TableCell className="text-right">{fmtNum(m.clicks)}</TableCell>
                      <TableCell className="text-right">{fmt(m.spend)}</TableCell>
                      <TableCell className="text-right">{m.conversions}</TableCell>
                      <TableCell className="text-right">
                        {m.spend > 0 ? (m.revenue / m.spend).toFixed(1) + "x" : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalMetricsPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Pagina {metricsPage} de {totalMetricsPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={metricsPage === 1}
                      onClick={() => setMetricsPage(metricsPage - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={metricsPage === totalMetricsPages}
                      onClick={() => setMetricsPage(metricsPage + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
