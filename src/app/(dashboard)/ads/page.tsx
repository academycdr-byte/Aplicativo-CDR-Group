"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PeriodSelector, periodToParams, type PeriodValue } from "@/components/period-selector";
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Play,
  ShoppingCart,
  CreditCard,
  BarChart2,
  ListFilter
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";
import { getAdMetrics, getAdMetricsByDay, getCreativePerformance } from "@/actions/ads";
import { AdsFilter } from "@/components/ads/ads-filter";
import { FunnelChart } from "@/components/ads/funnel-chart";
import { VideoModal } from "@/components/ads/video-modal";


// Types
type AdTotals = {
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
  addToCart: number;
  initiateCheckout: number;
};

type DayMetric = {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  addToCart: number;
  initiateCheckout: number;
};

type Creative = {
  adId: string;
  adName: string | null;
  campaignName: string | null;
  adSetName: string | null;
  platform: string;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
  addToCart: number;
  initiateCheckout: number;
  ctr: number;
  roas: number;
  cpc: number;
  cpm: number;
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
  addToCart: number;
  initiateCheckout: number;
};

const platformLabels: Record<string, string> = {
  FACEBOOK_ADS: "Facebook Ads",
  GOOGLE_ADS: "Google Ads",
};

export default function AdsPage() {
  const [totals, setTotals] = useState<AdTotals | null>(null);
  const [prevTotals, setPrevTotals] = useState<AdTotals | null>(null);
  const [metrics, setMetrics] = useState<AdMetric[]>([]);
  const [dayData, setDayData] = useState<DayMetric[]>([]);
  const [creatives, setCreatives] = useState<Creative[]>([]);

  // Filters
  const [platformFilter, setPlatformFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [excludedTerms, setExcludedTerms] = useState<string[]>([]);
  const [period, setPeriod] = useState<PeriodValue>({ type: "preset", days: 30 });

  // View State
  const [view, setView] = useState<"overview" | "creatives">("overview");
  const [metricsPage, setMetricsPage] = useState(1);
  const [creativesPage, setCreativesPage] = useState(1);
  const metricsPerPage = 20;
  const creativesPerPage = 12;

  // Chart State
  const [chartMetric, setChartMetric] = useState<"spend_revenue" | "roas" | "cpa" | "ctr">("spend_revenue");

  // Top Performers Toggle
  const [showWorstPerformers, setShowWorstPerformers] = useState(false);

  // Sorting state
  type SortDir = "asc" | "desc";
  const [metricsSortKey, setMetricsSortKey] = useState<string>("spend");
  const [metricsSortDir, setMetricsSortDir] = useState<SortDir>("desc");
  const [creativesSortKey, setCreativesSortKey] = useState<string>("spend");
  const [creativesSortDir, setCreativesSortDir] = useState<SortDir>("desc");

  // Video Modal
  const [selectedCreative, setSelectedCreative] = useState<Creative | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Creative Filtering
  const [uniqueCreatives, setUniqueCreatives] = useState(false);

  // Load Data
  const loadData = useCallback(async () => {
    const { days, from, to } = periodToParams(period);
    const platform = platformFilter === "all" ? undefined : platformFilter;

    // Pass search and exclude params to server actions
    const params = {
      platform,
      days,
      from,
      to,
      search: searchQuery || undefined,
      exclude: excludedTerms
    };

    const [metricsData, dayMetrics, creativeData] = await Promise.all([
      getAdMetrics(params),
      getAdMetricsByDay(days, from, to, searchQuery || undefined, excludedTerms, platform),
      getCreativePerformance(params),
    ]);

    setTotals(metricsData.totals);
    setPrevTotals(metricsData.previousTotals);
    setMetrics(metricsData.metrics);
    setDayData(dayMetrics);
    setCreatives(creativeData);
    setMetricsPage(1);
    setCreativesPage(1);
  }, [period, platformFilter, searchQuery, excludedTerms]);

  useEffect(() => {
    loadData();
  }, [loadData]);


  // Derived Metrics & Sorting

  // Helper for sorting
  function toggleSort(
    key: string,
    currentKey: string,
    currentDir: SortDir,
    setKey: (k: string) => void,
    setDir: (d: SortDir) => void
  ) {
    if (key === currentKey) {
      setDir(currentDir === "desc" ? "asc" : "desc");
    } else {
      setKey(key);
      setDir("desc");
    }
  }

  const sortedMetrics = useMemo(() => {
    const withDerived = metrics.map((m) => ({
      ...m,
      ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
      roas: m.spend > 0 ? m.revenue / m.spend : 0,
      cpa: m.conversions > 0 ? m.spend / m.conversions : 0,
      ticket: m.conversions > 0 ? m.revenue / m.conversions : 0,
    }));
    return withDerived.sort((a, b) => {
      const aVal = (a as any)[metricsSortKey] ?? 0;
      const bVal = (b as any)[metricsSortKey] ?? 0;
      return metricsSortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [metrics, metricsSortKey, metricsSortDir]);

  const sortedCreatives = useMemo(() => {
    let withDerived = creatives.map((c) => ({
      ...c,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
      cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0,
      roas: c.spend > 0 ? c.revenue / c.spend : 0,
      cpa: c.conversions > 0 ? c.spend / c.conversions : 0,
      ticket: c.conversions > 0 ? c.revenue / c.conversions : 0,
    }));

    if (uniqueCreatives) {
      // Group by adName and keep best (High ROAS > High Conversions > High Spend)
      const bestMap = new Map<string, typeof withDerived[0]>();

      for (const c of withDerived) {
        const key = (c.adName || "Sem Nome").trim().toLowerCase(); // Normalize name
        const existing = bestMap.get(key);

        if (!existing) {
          bestMap.set(key, c);
        } else {
          // Compare logic: Is current 'c' better than 'existing'?
          // 1. ROAS
          if (c.roas > existing.roas) {
            bestMap.set(key, c);
          } else if (c.roas === existing.roas) {
            // 2. Conversions
            if (c.conversions > existing.conversions) {
              bestMap.set(key, c);
            } else if (c.conversions === existing.conversions) {
              // 3. Spend (Higher spend usually means main ad)
              if (c.spend > existing.spend) {
                bestMap.set(key, c);
              }
            }
          }
        }
      }
      withDerived = Array.from(bestMap.values());
    }

    return withDerived.sort((a, b) => {
      const aVal = (a as any)[creativesSortKey] ?? 0;
      const bVal = (b as any)[creativesSortKey] ?? 0;
      return creativesSortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [creatives, creativesSortKey, creativesSortDir, uniqueCreatives]);

  // Top Performers Logic
  const topCreatives = useMemo(() => {
    // Filter minimum spend to avoid noise (e.g. ROAS infinity or high luck on R$1)
    const minSpend = 10;
    const candidates = sortedCreatives.filter(c => c.spend >= minSpend);

    const best = [...candidates].sort((a, b) => b.roas - a.roas).slice(0, 5);
    const worst = [...candidates].sort((a, b) => a.roas - b.roas).slice(0, 5);

    return { best, worst };
  }, [sortedCreatives]);


  // Formatters
  function fmt(amount: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
  }
  function fmtNum(n: number) {
    return new Intl.NumberFormat("pt-BR").format(n);
  }

  // KPI Variations
  function getVariation(current: number, previous: number) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  function KPICard({
    title,
    value,
    prevValue,
    icon: Icon,
    prefix = "",
    suffix = "",
    subText,
    invertTrend = false
  }: any) {
    const variation = prevTotals ? getVariation(value, prevValue) : 0;
    const isPositive = variation > 0;
    const isGood = invertTrend ? !isPositive : isPositive; // For CPI/Spend, down is good

    return (
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${title === "Gasto" || title === "CPA" ? "bg-destructive/10" : "bg-primary/10"
              }`}>
              <Icon className={`w-3.5 h-3.5 ${title === "Gasto" || title === "CPA" ? "text-destructive" : "text-primary"
                }`} />
            </div>
          </div>
          <p className="text-xl font-bold tracking-tight">
            {prefix}{typeof value === "number" ? (prefix === "R$" ? fmt(value).replace("R$", "").trim() : fmtNum(value)) : value}{suffix}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {prevTotals && (
              <div className={`flex items-center text-xs ${isGood ? "text-success" : "text-destructive"}`}>
                {isPositive ? <ArrowUp className="w-3 h-3 mr-0.5" /> : <ArrowDown className="w-3 h-3 mr-0.5" />}
                <span>{Math.abs(variation).toFixed(1)}%</span>
              </div>
            )}
            {subText && <p className="text-xs text-muted-foreground">{subText}</p>}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Current Totals
  const t = totals || { spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, revenue: 0, addToCart: 0, initiateCheckout: 0 };
  const p = prevTotals || { spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, revenue: 0, addToCart: 0, initiateCheckout: 0 };

  const cpa = t.conversions > 0 ? t.spend / t.conversions : 0;
  const prevCpa = p.conversions > 0 ? p.spend / p.conversions : 0;

  const roas = t.spend > 0 ? t.revenue / t.spend : 0;
  const prevRoas = p.spend > 0 ? p.revenue / p.spend : 0;

  const ticket = t.conversions > 0 ? t.revenue / t.conversions : 0;
  const prevTicket = p.conversions > 0 ? p.revenue / p.conversions : 0;

  const ctr = t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Anuncios</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Gestao de performance de midia paga.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <PeriodSelector value={period} onChange={setPeriod} />
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
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

      {/* Advanced Filter Component */}
      <AdsFilter
        onSearchChange={setSearchQuery}
        onExcludeChange={setExcludedTerms}
      />

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        <KPICard title="Gasto" value={t.spend} prevValue={p.spend} icon={DollarSign} prefix="R$ " invertTrend />
        <KPICard title="Impressoes" value={t.impressions} prevValue={p.impressions} icon={Eye} />
        <KPICard title="Alcance" value={t.reach} prevValue={p.reach} icon={Users} />
        <KPICard title="Cliques" value={t.clicks} prevValue={p.clicks} icon={MousePointer} subText={`CTR: ${ctr.toFixed(2)}%`} />
        <KPICard title="Conversoes" value={t.conversions} prevValue={p.conversions} icon={TrendingUp} />
        <KPICard title="ROAS" value={roas.toFixed(2)} prevValue={prevRoas} icon={BarChart2} suffix="x" />
        <KPICard title="CPA" value={cpa} prevValue={prevCpa} icon={CreditCard} prefix="R$ " invertTrend />
        <KPICard title="Ticket Medio" value={ticket} prevValue={prevTicket} icon={ShoppingCart} prefix="R$ " />
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 border-b pb-1">
        <Button
          variant={view === "overview" ? "default" : "ghost"}
          size="sm"
          onClick={() => setView("overview")}
          className="rounded-none border-b-2 border-transparent px-4 pb-2 pt-2 data-[state=active]:border-primary"
          data-state={view === "overview" ? "active" : ""}
        >
          <BarChart2 className="w-4 h-4 mr-2" />
          Visao Geral
        </Button>
        <Button
          variant={view === "creatives" ? "default" : "ghost"}
          size="sm"
          onClick={() => setView("creatives")}
          className="rounded-none border-b-2 border-transparent px-4 pb-2 pt-2 data-[state=active]:border-primary"
          data-state={view === "creatives" ? "active" : ""}
        >
          <ImageIcon className="w-4 h-4 mr-2" />
          Criativos ({creatives.length})
        </Button>
      </div>

      {view === "overview" && (
        <div className="space-y-6">

          {/* Section: Funnel & Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Funnel - Left Side (or Top on mobile) */}
            <div className="lg:col-span-4">
              <FunnelChart
                data={{
                  impressions: t.impressions,
                  clicks: t.clicks,
                  addToCart: t.addToCart,
                  initiateCheckout: t.initiateCheckout,
                  purchases: t.conversions
                }}
                className="h-full"
              />
            </div>

            {/* Main Chart - Right Side */}
            <div className="lg:col-span-8">
              <Card className="h-full flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">Evolucao Temporal</CardTitle>
                  <Select value={chartMetric} onValueChange={(v: any) => setChartMetric(v)}>
                    <SelectTrigger className="w-[180px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spend_revenue">Gasto vs Receita</SelectItem>
                      <SelectItem value="roas">ROAS</SelectItem>
                      <SelectItem value="cpa">CPA</SelectItem>
                      <SelectItem value="ctr">CTR</SelectItem>
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent className="flex-1 min-h-[300px]">
                  {dayData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={dayData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => {
                            const d = new Date(v + "T00:00:00");
                            return `${d.getDate()}/${d.getMonth() + 1}`;
                          }}
                          minTickGap={30}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => {
                            if (chartMetric === "roas") return `${v}x`;
                            if (chartMetric === "ctr") return `${v}%`;
                            return `R$${v < 1000 ? v : `${(v / 1000).toFixed(0)}k`}`;
                          }}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px" }}
                          labelFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR")}
                          formatter={(val, name) => {
                            const v = Number(val) || 0;
                            if (name === "Gasto") return [fmt(v), name];
                            if (name === "Receita") return [fmt(v), name];
                            if (name === "ROAS") return [`${v.toFixed(2)}x`, name];
                            if (name === "CPA") return [fmt(v), name];
                            if (name === "CTR") return [`${v.toFixed(2)}%`, name];
                            return [v, name];
                          }}
                        />
                        <Legend />

                        {chartMetric === "spend_revenue" && (
                          <>
                            <Line type="monotone" dataKey="spend" name="Gasto" stroke="var(--destructive)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                            <Line type="monotone" dataKey="revenue" name="Receita" stroke="#aaff00" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                          </>
                        )}
                        {chartMetric === "roas" && (
                          <Line
                            type="monotone"
                            dataKey={(d) => d.spend > 0 ? d.revenue / d.spend : 0}
                            name="ROAS"
                            stroke="#aaff00"
                            strokeWidth={2}
                            dot={false}
                          />
                        )}
                        {chartMetric === "cpa" && (
                          <Line
                            type="monotone"
                            dataKey={(d) => d.conversions > 0 ? d.spend / d.conversions : 0}
                            name="CPA"
                            stroke="var(--primary)"
                            strokeWidth={2}
                            dot={false}
                          />
                        )}
                        {chartMetric === "ctr" && (
                          <Line
                            type="monotone"
                            dataKey={(d) => d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0}
                            name="CTR"
                            stroke="var(--primary)"
                            strokeWidth={2}
                            dot={false}
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      Sem dados para o periodo.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Top Performers Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Top 5 Anuncios (ROAS)</CardTitle>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="worst-mode" className="text-xs">Ver Piores</Label>
                  <Switch id="worst-mode" checked={showWorstPerformers} onCheckedChange={setShowWorstPerformers} />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-0 divide-y">
                  {(showWorstPerformers ? topCreatives.worst : topCreatives.best).map((c, idx) => (
                    <div key={c.adId} className="flex items-center p-3 hover:bg-muted/30 transition-colors">
                      <span className="w-6 text-center text-muted-foreground text-sm font-medium mr-2">{idx + 1}</span>
                      <div className="w-10 h-10 bg-muted rounded relative overflow-hidden shrink-0 mr-3 border border-border">
                        {c.thumbnailUrl ? (
                          <Image src={c.thumbnailUrl} alt="" fill className="object-cover" unoptimized />
                        ) : <ImageIcon className="w-5 h-5 absolute inset-0 m-auto text-muted-foreground/50" />}
                      </div>
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="text-sm font-medium truncate text-foreground">{c.adName || "Sem nome"}</p>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <span>{fmt(c.spend)} gastos</span>
                          <span>•</span>
                          <span>{c.conversions} conv.</span>
                        </div>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <p className={`text-sm font-bold ${c.roas >= 3 ? "text-success" : c.roas < 1 ? "text-destructive" : "text-warning"}`}>
                          {c.roas.toFixed(2)}x
                        </p>
                        <p className="text-xs text-muted-foreground">ROAS</p>
                      </div>
                    </div>
                  ))}
                  {(showWorstPerformers ? topCreatives.worst : topCreatives.best).length === 0 && (
                    <div className="p-6 text-center text-muted-foreground text-sm">
                      Nenhum anuncio com gasto relevante encontrado.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Secondary metric exploration - or simply empty for now, user asked for Top 5 section.
                    Since we have space, let's keep it clean or maybe expand table width?
                    The requirements asked for "Section D: Top Performers".
                    Let's use the other half for a breakdown by Platform maybe? 
                    Actually, let's just make the Main Table Full Width below.
                    This grid cell can be used for "Top Products" later if we had that data.
                    For now, let's just make the Top Performers take full width or be half width? 
                    Let's stick to the request. We'll leave the chart and funnel above.
                    Let's make this section just the Top 5 cards, maybe side-by-side: Best vs Worst?
                    No, toggle was requested. 
                    Let's keep it simple.
                */}
          </div>

          {/* Detailed Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Detalhamento Completo</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Anuncio</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("spend", metricsSortKey, metricsSortDir, setMetricsSortKey, setMetricsSortDir)}>Gasto <ArrowUpDown className="inline w-3 h-3 ml-1" /></TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("impressions", metricsSortKey, metricsSortDir, setMetricsSortKey, setMetricsSortDir)}>Impr.</TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("clicks", metricsSortKey, metricsSortDir, setMetricsSortKey, setMetricsSortDir)}>Cliques</TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("ctr", metricsSortKey, metricsSortDir, setMetricsSortKey, setMetricsSortDir)}>CTR</TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("cpa", metricsSortKey, metricsSortDir, setMetricsSortKey, setMetricsSortDir)}>CPA</TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("roas", metricsSortKey, metricsSortDir, setMetricsSortKey, setMetricsSortDir)}>ROAS</TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("revenue", metricsSortKey, metricsSortDir, setMetricsSortKey, setMetricsSortDir)}>Receita</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedMetrics
                    .slice((metricsPage - 1) * metricsPerPage, metricsPage * metricsPerPage)
                    .map((m: any) => (
                      <TableRow key={m.id} className={m.roas >= 3 ? "bg-success/5 hover:bg-success/10" : ""}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {m.thumbnailUrl && <Image src={m.thumbnailUrl} alt="" width={32} height={32} className="rounded object-cover" unoptimized />}
                            <div className="min-w-0 max-w-[250px]">
                              <p className="text-sm font-medium truncate" title={m.adName || ""}>{m.adName || "Anuncio"}</p>
                              <p className="text-xs text-muted-foreground truncate">{m.campaignName}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{platformLabels[m.platform] || "Meta"}</Badge></TableCell>
                        <TableCell className="text-right">{fmt(m.spend)}</TableCell>
                        <TableCell className="text-right">{fmtNum(m.impressions)}</TableCell>
                        <TableCell className="text-right">{fmtNum(m.clicks)}</TableCell>
                        <TableCell className="text-right">{m.ctr.toFixed(2)}%</TableCell>
                        <TableCell className="text-right">{m.cpa > 0 ? fmt(m.cpa) : "-"}</TableCell>
                        <TableCell className="text-right font-medium text-foreground">{m.roas > 0 ? m.roas.toFixed(2) + "x" : "-"}</TableCell>
                        <TableCell className="text-right">{fmt(m.revenue)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {sortedMetrics.length > metricsPerPage && (
                <div className="flex items-center justify-between px-4 py-4 border-t">
                  <p className="text-xs text-muted-foreground">
                    Pagina {metricsPage} de {Math.ceil(sortedMetrics.length / metricsPerPage)}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMetricsPage(p => Math.max(1, p - 1))} disabled={metricsPage === 1}><ChevronLeft className="w-4 h-4" /></Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMetricsPage(p => Math.min(Math.ceil(sortedMetrics.length / metricsPerPage), p + 1))} disabled={metricsPage >= Math.ceil(sortedMetrics.length / metricsPerPage)}><ChevronRight className="w-4 h-4" /></Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      )}

      {view === "creatives" && (
        <div className="space-y-6">
          {/* Search is at the top of the page, globally applied */}

          {/* Creatives Toolbar */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <p className="text-sm text-muted-foreground">Exibindo {sortedCreatives.length} criativos</p>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="unique-mode"
                  checked={uniqueCreatives}
                  onCheckedChange={setUniqueCreatives}
                />
                <Label htmlFor="unique-mode" className="text-sm cursor-pointer">Ocultar duplicatas</Label>
              </div>

              <div className="flex items-center gap-2">
                <ListFilter className="w-4 h-4 text-muted-foreground" />
                <Select value={creativesSortKey} onValueChange={setCreativesSortKey}>
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue placeholder="Ordenar por" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spend">Maior Gasto</SelectItem>
                    <SelectItem value="roas">Maior ROAS</SelectItem>
                    <SelectItem value="revenue">Maior Receita</SelectItem>
                    <SelectItem value="ctr">Maior CTR</SelectItem>
                    <SelectItem value="conversions">Mais Conversoes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedCreatives
              .slice((creativesPage - 1) * creativesPerPage, creativesPage * creativesPerPage)
              .map((c) => (
                <Card
                  key={c.adId}
                  className={`group overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02] border-l-4 ${c.roas >= 3 ? "border-l-[#aaff00]" : c.roas >= 1 ? "border-l-yellow-500" : "border-l-red-500"
                    }`}
                  onClick={() => {
                    setSelectedCreative(c);
                    setIsModalOpen(true);
                  }}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-muted flex items-center justify-center overflow-hidden">
                    {c.thumbnailUrl ? (
                      <Image src={c.thumbnailUrl} alt="" fill className="object-cover transition-transform group-hover:scale-105" unoptimized />
                    ) : <ImageIcon className="w-8 h-8 opacity-20" />}

                    {/* Overlay Play Icon if we assume it's a video or just generally for "Detail View" affordance */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                        <Play className="w-5 h-5 ml-1 fill-current" />
                      </div>
                    </div>

                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="backdrop-blur-md bg-black/40 text-white border-none text-[10px] h-5">
                        {platformLabels[c.platform] || "Ads"}
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="p-4 space-y-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate" title={c.adName || ""}>{c.adName || "Sem Titulo"}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.campaignName}</p>
                    </div>

                    {/* Primary Metrics */}
                    <div className="flex items-end justify-between border-b pb-2 mb-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Gasto</p>
                        <p className="font-semibold">{fmt(c.spend)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground uppercase">ROAS</p>
                        <p className={`font-bold text-lg ${c.roas >= 3 ? "text-[#aaff00]" : c.roas > 1 ? "text-yellow-500" : "text-red-500"}`}>
                          {c.roas.toFixed(2)}x
                        </p>
                      </div>
                    </div>

                    {/* Secondary Metrics Grid */}
                    <div className="grid grid-cols-3 gap-y-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Impr.</p>
                        <p className="font-medium">{fmtNum(c.impressions)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cliques</p>
                        <p className="font-medium">{fmtNum(c.clicks)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">CTR</p>
                        <p className="font-medium">{c.ctr.toFixed(2)}%</p>
                      </div>

                      <div className="col-span-3 pt-1 flex justify-between border-t mt-1">
                        <span className="text-muted-foreground">Receita: <span className="text-foreground">{fmt(c.revenue)}</span></span>
                        <span className="text-muted-foreground">Conv: <span className="text-foreground">{c.conversions}</span></span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>

          {/* Pagination */}
          {sortedCreatives.length > creativesPerPage && (
            <div className="flex justify-center mt-6 gap-2">
              <Button
                variant="outline"
                onClick={() => setCreativesPage(p => Math.max(1, p - 1))}
                disabled={creativesPage === 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                onClick={() => setCreativesPage(p => Math.min(Math.ceil(sortedCreatives.length / creativesPerPage), p + 1))}
                disabled={creativesPage >= Math.ceil(sortedCreatives.length / creativesPerPage)}
              >
                Proxima
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Video/Creative Details Modal */}
      <VideoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        creative={selectedCreative}
      />
    </div>
  );
}
