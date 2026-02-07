"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
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
import {
  DollarSign,
  Eye,
  MousePointer,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Users,
  ImageIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { getAdMetrics, getAdMetricsByDay, getCreativePerformance } from "@/actions/ads";

type AdTotals = {
  impressions: number;
  reach: number;
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

type Creative = {
  adId: string;
  adName: string | null;
  campaignName: string | null;
  adSetName: string | null;
  platform: string;
  thumbnailUrl: string | null;
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
};

type AdMetric = {
  id: string;
  platform: string;
  campaignName: string | null;
  adSetName: string | null;
  adId: string | null;
  adName: string | null;
  thumbnailUrl: string | null;
  date: Date;
  impressions: number;
  reach: number;
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
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [days, setDays] = useState("30");
  const [view, setView] = useState<"overview" | "creatives">("overview");
  const [metricsPage, setMetricsPage] = useState(1);
  const [creativesPage, setCreativesPage] = useState(1);
  const metricsPerPage = 20;
  const creativesPerPage = 12;

  useEffect(() => {
    loadData();
  }, [platformFilter, days]);

  async function loadData() {
    const d = parseInt(days);
    const platform = platformFilter === "all" ? undefined : platformFilter;
    const [metricsData, dayMetrics, creativeData] = await Promise.all([
      getAdMetrics({ platform, days: d }),
      getAdMetricsByDay(d),
      getCreativePerformance({ platform, days: d }),
    ]);
    setTotals(metricsData.totals);
    setMetrics(metricsData.metrics);
    setDayData(dayMetrics);
    setCreatives(creativeData);
    setMetricsPage(1);
    setCreativesPage(1);
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
            Acompanhe o desempenho dos seus anuncios e criativos.
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground font-medium">Gasto</p>
              <div className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5 text-destructive" />
              </div>
            </div>
            <p className="text-xl font-bold tracking-tight">{fmt(totals?.spend || 0)}</p>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground font-medium">Impressoes</p>
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Eye className="w-3.5 h-3.5 text-primary" />
              </div>
            </div>
            <p className="text-xl font-bold tracking-tight">{fmtNum(totals?.impressions || 0)}</p>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground font-medium">Alcance</p>
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-primary" />
              </div>
            </div>
            <p className="text-xl font-bold tracking-tight">{fmtNum(totals?.reach || 0)}</p>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground font-medium">Cliques</p>
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <MousePointer className="w-3.5 h-3.5 text-primary" />
              </div>
            </div>
            <p className="text-xl font-bold tracking-tight">{fmtNum(totals?.clicks || 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">CTR: {ctr.toFixed(2)}%</p>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground font-medium">Conversoes</p>
              <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-success" />
              </div>
            </div>
            <p className="text-xl font-bold tracking-tight">{fmtNum(totals?.conversions || 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">Receita: {fmt(totals?.revenue || 0)}</p>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground font-medium">ROAS</p>
              <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-success" />
              </div>
            </div>
            <p className="text-xl font-bold tracking-tight">{roas.toFixed(2)}x</p>
            <p className="text-xs text-muted-foreground mt-1">
              CPA: {totals && totals.conversions > 0 ? fmt(totals.spend / totals.conversions) : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        <Button
          variant={view === "overview" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("overview")}
        >
          <Eye className="w-4 h-4 mr-1" />
          Visao Geral
        </Button>
        <Button
          variant={view === "creatives" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("creatives")}
        >
          <ImageIcon className="w-4 h-4 mr-1" />
          Criativos ({creatives.length})
        </Button>
      </div>

      {view === "overview" && (
        <>
          {/* Spend Over Time Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gasto vs Receita</CardTitle>
            </CardHeader>
            <CardContent>
              {dayData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dayData}>
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
                      cursor={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.3 }}
                    />
                    <Line type="monotone" dataKey="spend" stroke="var(--destructive)" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2.5} dot={false} />
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
                    Detalhamento por Anuncio ({metrics.length} resultado{metrics.length !== 1 ? "s" : ""})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Anuncio</TableHead>
                        <TableHead>Plataforma</TableHead>
                        <TableHead className="text-right">Impressoes</TableHead>
                        <TableHead className="text-right">Cliques</TableHead>
                        <TableHead className="text-right">CTR</TableHead>
                        <TableHead className="text-right">Gasto</TableHead>
                        <TableHead className="text-right">Conv.</TableHead>
                        <TableHead className="text-right">ROAS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedMetrics.map((m) => {
                        const mCtr = m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0;
                        const mRoas = m.spend > 0 ? m.revenue / m.spend : 0;
                        return (
                          <TableRow key={m.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {m.thumbnailUrl && (
                                  <Image
                                    src={m.thumbnailUrl}
                                    alt=""
                                    width={40}
                                    height={40}
                                    className="rounded object-cover"
                                    unoptimized
                                  />
                                )}
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">{m.adName || m.campaignName || "-"}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {m.campaignName && m.adName ? m.campaignName : ""}
                                    {m.adSetName ? ` > ${m.adSetName}` : ""}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(m.date).toLocaleDateString("pt-BR")}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{platformLabels[m.platform] || m.platform}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{fmtNum(m.impressions)}</TableCell>
                            <TableCell className="text-right">{fmtNum(m.clicks)}</TableCell>
                            <TableCell className="text-right">{mCtr.toFixed(2)}%</TableCell>
                            <TableCell className="text-right">{fmt(m.spend)}</TableCell>
                            <TableCell className="text-right">{m.conversions}</TableCell>
                            <TableCell className="text-right">
                              {mRoas > 0 ? mRoas.toFixed(1) + "x" : "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
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
        </>
      )}

      {view === "creatives" && (
        <>
          {creatives.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground text-sm">
                  <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>Nenhum criativo encontrado.</p>
                  <p className="mt-1">
                    Conecte{" "}
                    <Link href="/integrations" className="text-primary hover:underline">
                      Facebook Ads
                    </Link>{" "}
                    e sincronize para ver os criativos.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Creative Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {creatives
                  .slice((creativesPage - 1) * creativesPerPage, creativesPage * creativesPerPage)
                  .map((c) => {
                    const cCtr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
                    const cCpc = c.clicks > 0 ? c.spend / c.clicks : 0;
                    const cCpm = c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0;
                    const cRoas = c.spend > 0 ? c.revenue / c.spend : 0;

                    return (
                      <Card key={c.adId} className="overflow-hidden">
                        {/* Thumbnail */}
                        <div className="relative w-full h-40 bg-muted flex items-center justify-center">
                          {c.thumbnailUrl ? (
                            <Image
                              src={c.thumbnailUrl}
                              alt={c.adName || "Criativo"}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
                          )}
                        </div>

                        <CardContent className="pt-4 space-y-3">
                          {/* Ad Info */}
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{c.adName || "Sem nome"}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {c.campaignName || "-"}
                              {c.adSetName ? ` > ${c.adSetName}` : ""}
                            </p>
                            <Badge variant="outline" className="mt-1 text-xs">
                              {platformLabels[c.platform] || c.platform}
                            </Badge>
                          </div>

                          {/* Metrics Grid */}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <div>
                              <p className="text-muted-foreground text-xs">Gasto</p>
                              <p className="font-semibold">{fmt(c.spend)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">ROAS</p>
                              <p className={`font-semibold ${cRoas >= 1 ? "text-success" : cRoas > 0 ? "text-warning" : ""}`}>
                                {cRoas > 0 ? cRoas.toFixed(2) + "x" : "-"}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Impressoes</p>
                              <p className="font-semibold">{fmtNum(c.impressions)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Alcance</p>
                              <p className="font-semibold">{fmtNum(c.reach)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Cliques</p>
                              <p className="font-semibold">{fmtNum(c.clicks)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">CTR</p>
                              <p className="font-semibold">{cCtr.toFixed(2)}%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">CPC</p>
                              <p className="font-semibold">{cCpc > 0 ? fmt(cCpc) : "-"}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">CPM</p>
                              <p className="font-semibold">{cCpm > 0 ? fmt(cCpm) : "-"}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Conversoes</p>
                              <p className="font-semibold">{c.conversions}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Receita</p>
                              <p className="font-semibold">{fmt(c.revenue)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>

              {/* Creatives Pagination */}
              {creatives.length > creativesPerPage && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {((creativesPage - 1) * creativesPerPage) + 1}-{Math.min(creativesPage * creativesPerPage, creatives.length)} de {creatives.length} criativos
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={creativesPage === 1}
                      onClick={() => setCreativesPage(creativesPage - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={creativesPage * creativesPerPage >= creatives.length}
                      onClick={() => setCreativesPage(creativesPage + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Creatives Table (detailed view) */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ranking de Criativos</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Criativo</TableHead>
                        <TableHead className="text-right">Gasto</TableHead>
                        <TableHead className="text-right">Impressoes</TableHead>
                        <TableHead className="text-right">Cliques</TableHead>
                        <TableHead className="text-right">CTR</TableHead>
                        <TableHead className="text-right">CPC</TableHead>
                        <TableHead className="text-right">CPM</TableHead>
                        <TableHead className="text-right">Conv.</TableHead>
                        <TableHead className="text-right">ROAS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {creatives.map((c, idx) => {
                        const cCtr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
                        const cCpc = c.clicks > 0 ? c.spend / c.clicks : 0;
                        const cCpm = c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0;
                        const cRoas = c.spend > 0 ? c.revenue / c.spend : 0;

                        return (
                          <TableRow key={c.adId}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                                {c.thumbnailUrl ? (
                                  <Image
                                    src={c.thumbnailUrl}
                                    alt=""
                                    width={36}
                                    height={36}
                                    className="rounded object-cover shrink-0"
                                    unoptimized
                                  />
                                ) : (
                                  <div className="w-9 h-9 bg-muted rounded flex items-center justify-center shrink-0">
                                    <ImageIcon className="w-4 h-4 text-muted-foreground/50" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate max-w-[200px]">{c.adName || "Sem nome"}</p>
                                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">{c.campaignName || "-"}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">{fmt(c.spend)}</TableCell>
                            <TableCell className="text-right">{fmtNum(c.impressions)}</TableCell>
                            <TableCell className="text-right">{fmtNum(c.clicks)}</TableCell>
                            <TableCell className="text-right">{cCtr.toFixed(2)}%</TableCell>
                            <TableCell className="text-right">{cCpc > 0 ? fmt(cCpc) : "-"}</TableCell>
                            <TableCell className="text-right">{cCpm > 0 ? fmt(cCpm) : "-"}</TableCell>
                            <TableCell className="text-right">{c.conversions}</TableCell>
                            <TableCell className="text-right">
                              <span className={cRoas >= 1 ? "text-success font-medium" : cRoas > 0 ? "text-warning" : ""}>
                                {cRoas > 0 ? cRoas.toFixed(2) + "x" : "-"}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
