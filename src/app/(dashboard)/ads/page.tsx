"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  MousePointer,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  ArrowUpDown,
  ArrowUpRight,
  ArrowDownRight,
  Play,
  ShoppingCart,
  CreditCard,
  BarChart2,
  ListFilter,
  Users
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
import { loadAllAdsData } from "@/actions/ads";
import { AdsFilter } from "@/components/ads/ads-filter";
import { FunnelChart } from "@/components/ads/funnel-chart";
import { VideoModal } from "@/components/ads/video-modal";
import { AdAccountFilter } from "@/components/ad-account-filter";


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

type AdSet = {
  adSetId: string;
  adSetName: string | null;
  campaignName: string | null;
  platform: string;
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
  cpa: number;
  cpc: number;
  cpm: number;
  adCount: number;
};

const platformLabels: Record<string, string> = {
  FACEBOOK_ADS: "Facebook Ads",
  GOOGLE_ADS: "Google Ads",
};

function AdThumbnail({ src, alt, fill, width, height, className, sizes }: {
  src: string;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  sizes?: string;
}) {
  const [error, setError] = useState(false);
  if (error || !src) {
    return (
      <div className={`flex items-center justify-center bg-muted/30 ${fill ? "absolute inset-0" : ""}`} style={!fill ? { width, height } : undefined}>
        <ImageIcon className="w-5 h-5 text-muted-foreground/50" />
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      width={!fill ? width : undefined}
      height={!fill ? height : undefined}
      className={className}
      sizes={sizes}
      onError={() => setError(true)}
    />
  );
}

export default function AdsPage() {
  const [totals, setTotals] = useState<AdTotals | null>(null);
  const [prevTotals, setPrevTotals] = useState<AdTotals | null>(null);
  const [metrics, setMetrics] = useState<AdMetric[]>([]);
  const [dayData, setDayData] = useState<DayMetric[]>([]);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [adSets, setAdSets] = useState<AdSet[]>([]);

  // Filters
  const [platformFilter, setPlatformFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [excludedTerms, setExcludedTerms] = useState<string[]>([]);
  const [period, setPeriod] = useState<PeriodValue>({ type: "preset", days: 30 });

  // Stable callback to avoid spurious re-renders when AdsFilter fires on mount
  const handleExcludeChange = useCallback((newTerms: string[]) => {
    setExcludedTerms(prev => {
      if (prev.length === newTerms.length && prev.every((t, i) => t === newTerms[i])) return prev;
      return newTerms;
    });
  }, []);

  // Pagination State
  const [metricsPage, setMetricsPage] = useState(1);
  const [creativesPage, setCreativesPage] = useState(1);
  const [adSetsPage, setAdSetsPage] = useState(1);
  const metricsPerPage = 20;
  const creativesPerPage = 12;
  const adSetsPerPage = 15;

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
  const [adSetsSortKey, setAdSetsSortKey] = useState<string>("spend");
  const [adSetsSortDir, setAdSetsSortDir] = useState<SortDir>("desc");

  // Video Modal
  const [selectedCreative, setSelectedCreative] = useState<Creative | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Creative Filtering
  const [uniqueCreatives, setUniqueCreatives] = useState(false);

  // Loading & Error
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Stale load prevention: each new load increments the counter.
  // If the counter changes mid-load, the old load is discarded.
  const loadIdRef = useRef(0);

  // Load Data
  const loadData = useCallback(async (retries = 2) => {
    const currentLoadId = ++loadIdRef.current;
    setLoading(true);
    setLoadError(null);
    const { days, from, to } = periodToParams(period);
    const platform = platformFilter === "all" ? undefined : platformFilter;

    const params = {
      platform,
      days,
      from,
      to,
      search: searchQuery || undefined,
      exclude: excludedTerms,
      accountId: accountFilter !== "all" ? accountFilter : undefined,
    };

    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      // Abort if a newer load was triggered
      if (loadIdRef.current !== currentLoadId) return;

      try {
        const data = await loadAllAdsData(params, searchQuery || undefined, excludedTerms);

        // Abort if a newer load was triggered while awaiting
        if (loadIdRef.current !== currentLoadId) return;

        if (!data) {
          setLoading(false);
          return;
        }

        setTotals(data.metrics.totals);
        setPrevTotals(data.metrics.previousTotals);
        setMetrics(data.metrics.metrics);
        setDayData(data.dailyData);
        setCreatives(data.creatives);
        setAdSets(data.adSets);
        setLoading(false);
        setMetricsPage(1);
        setCreativesPage(1);
        setAdSetsPage(1);
        return; // Success
      } catch (error) {
        lastError = error;
        console.error(`[Ads] loadData attempt ${attempt + 1}/${retries + 1} failed:`, error);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    // All retries exhausted — only set error if still the current load
    if (loadIdRef.current !== currentLoadId) return;
    console.error("[Ads] All retries exhausted:", lastError);
    setLoadError("Erro ao carregar dados dos anúncios. Tente novamente.");
    setLoading(false);
  }, [period, platformFilter, accountFilter, searchQuery, excludedTerms]);

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

  // Dedup state for detailed table
  const [uniqueMetrics, setUniqueMetrics] = useState(false);

  const sortedMetrics = useMemo(() => {
    let withDerived = metrics.map((m) => ({
      ...m,
      ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
      roas: m.spend > 0 ? m.revenue / m.spend : 0,
      cpa: m.conversions > 0 ? m.spend / m.conversions : 0,
      ticket: m.conversions > 0 ? m.revenue / m.conversions : 0,
    }));

    if (uniqueMetrics) {
      const bestMap = new Map<string, typeof withDerived[0]>();
      for (const m of withDerived) {
        const key = (m.adName || "Sem Nome").trim().toLowerCase();
        const existing = bestMap.get(key);
        if (!existing) {
          bestMap.set(key, m);
        } else if (
          m.roas > existing.roas ||
          (m.roas === existing.roas && m.conversions > existing.conversions) ||
          (m.roas === existing.roas && m.conversions === existing.conversions && m.spend > existing.spend)
        ) {
          bestMap.set(key, m);
        }
      }
      withDerived = Array.from(bestMap.values());
    }

    return withDerived.sort((a, b) => {
      const aVal = Number((a as unknown as Record<string, unknown>)[metricsSortKey]) || 0;
      const bVal = Number((b as unknown as Record<string, unknown>)[metricsSortKey]) || 0;
      return metricsSortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [metrics, metricsSortKey, metricsSortDir, uniqueMetrics]);

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
      const aVal = Number((a as unknown as Record<string, unknown>)[creativesSortKey]) || 0;
      const bVal = Number((b as unknown as Record<string, unknown>)[creativesSortKey]) || 0;
      return creativesSortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [creatives, creativesSortKey, creativesSortDir, uniqueCreatives]);

  // AdSets Sorting
  const sortedAdSets = useMemo(() => {
    return [...adSets].sort((a, b) => {
      const aVal = Number((a as unknown as Record<string, unknown>)[adSetsSortKey]) || 0;
      const bVal = Number((b as unknown as Record<string, unknown>)[adSetsSortKey]) || 0;
      return adSetsSortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [adSets, adSetsSortKey, adSetsSortDir]);

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
    variant = "default"
  }: {
    title: string;
    value: number | string;
    prevValue: number;
    icon: React.ComponentType<{ className?: string }>;
    prefix?: string;
    suffix?: string;
    subText?: string;
    variant?: "default" | "destructive" | "success" | "blue" | "purple" | "amber";
  }) {
    const numValue = typeof value === "string" ? parseFloat(value) || 0 : value;
    const variation = prevTotals ? getVariation(numValue, prevValue) : 0;
    const isPositive = variation > 0;
    const isNegative = variation < 0;

    let iconClass = "bg-primary/10 text-primary";
    if (variant === "destructive") iconClass = "bg-red-500/10 text-red-500";
    if (variant === "success") iconClass = "bg-emerald-500/10 text-emerald-500";
    if (variant === "blue") iconClass = "bg-blue-500/10 text-blue-500";
    if (variant === "purple") iconClass = "bg-purple-500/10 text-purple-500";
    if (variant === "amber") iconClass = "bg-amber-500/10 text-amber-500";

    const displayValue = typeof value === "number"
      ? (prefix === "R$" ? fmt(value) : fmtNum(value))
      : value;

    return (
      <Card className="border border-border/40 shadow-none rounded-xl p-4 sm:p-5 hover:border-primary/30 transition-colors overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-medium text-muted-foreground truncate mr-2">{title}</span>
          <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 ${iconClass}`}>
            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
            {prefix === "R$" ? displayValue : `${prefix}${displayValue}${suffix}`}
          </div>
          {prevTotals && (
            <div className="flex items-center gap-1 mt-1.5">
              {isPositive && <ArrowUpRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500 shrink-0" />}
              {isNegative && <ArrowDownRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-500 shrink-0" />}
              <span className={`text-[11px] sm:text-xs font-medium ${isPositive ? 'text-emerald-500' : isNegative ? 'text-red-500' : 'text-muted-foreground'}`}>
                {Math.abs(variation).toFixed(1)}%
              </span>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground">vs anterior</span>
            </div>
          )}
          {subText && !prevTotals && <p className="text-xs text-muted-foreground mt-1">{subText}</p>}
        </div>
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
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Anúncios</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Gestão de performance Mídia Paga.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
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
          <AdAccountFilter value={accountFilter} onChange={setAccountFilter} />
        </div>
      </div>

      {/* Advanced Filter Component */}
      <AdsFilter
        onSearchChange={setSearchQuery}
        onExcludeChange={handleExcludeChange}
      />

      {/* Error Banner */}
      {loadError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-red-500 font-medium">{loadError}</p>
          <Button variant="outline" size="sm" onClick={() => loadData()} className="shrink-0 text-xs">
            Tentar novamente
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Card key={i} className="h-[110px] rounded-xl">
                <CardContent className="pt-5">
                  <div className="animate-pulse space-y-3">
                    <div className="h-3 w-16 bg-muted/40 rounded" />
                    <div className="h-7 w-24 bg-muted/40 rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="h-80 rounded-xl">
            <div className="animate-pulse h-full w-full bg-muted/10 rounded-xl" />
          </Card>
        </div>
      ) : (
      <>
      {/* KPI Grid — 2 cols mobile, 4 cols desktop, wraps naturally */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        <KPICard title="Investimento" value={t.spend} prevValue={p.spend} icon={DollarSign} prefix="R$" variant="destructive" />
        <KPICard title="Valor Convertido" value={t.revenue} prevValue={p.revenue} icon={DollarSign} prefix="R$" variant="success" />
        <KPICard title="Cliques" value={t.clicks} prevValue={p.clicks} icon={MousePointer} variant="amber" />
        <KPICard title="Conversões" value={t.conversions} prevValue={p.conversions} icon={TrendingUp} variant="success" />
        <KPICard title="ROAS" value={roas.toFixed(2)} prevValue={prevRoas} icon={BarChart2} suffix="x" variant="default" />
        <KPICard title="CPA" value={cpa} prevValue={prevCpa} icon={CreditCard} prefix="R$" variant="destructive" />
        <KPICard title="Ticket Médio" value={ticket} prevValue={prevTicket} icon={ShoppingCart} prefix="R$" variant="success" />
      </div>

      {/* Section: Funnel & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Funnel - Left Side (or Top on mobile) */}
        <div className="lg:col-span-5 xl:col-span-4">
          <Card className="h-full border border-border/40 shadow-none rounded-xl">
            <CardHeader className="border-b border-border/50 px-4 sm:px-5 py-3 sm:py-4">
              <CardTitle className="text-base font-semibold">Funil de Vendas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
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
            </CardContent>
          </Card>
        </div>

        {/* Main Chart - Right Side */}
        <div className="lg:col-span-7 xl:col-span-8">
          <Card className="h-full flex flex-col border border-border/40 shadow-none rounded-xl">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 px-4 sm:px-5 py-3 sm:py-4">
              <CardTitle className="text-base font-semibold">Evolução Temporal</CardTitle>
              <Select value={chartMetric} onValueChange={(v) => setChartMetric(v as typeof chartMetric)}>
                <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs">
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
            <CardContent className="flex-1 min-h-[260px] sm:min-h-[300px] p-3 sm:p-5">
              {dayData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" aria-label="Gráfico de evolução temporal dos anúncios">
                  <LineChart data={dayData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.15} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => {
                        const d = new Date(v + "T00:00:00");
                        return `${d.getDate()}/${d.getMonth() + 1}`;
                      }}
                      minTickGap={30}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                      width={45}
                      tickFormatter={(v) => {
                        if (chartMetric === "roas") return `${v}x`;
                        if (chartMetric === "ctr") return `${v}%`;
                        if (v >= 1000) return `R$${(v / 1000).toFixed(0)}k`;
                        return `R$${v}`;
                      }}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px", fontSize: "13px" }}
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
                    <Legend wrapperStyle={{ fontSize: "12px" }} />

                    {chartMetric === "spend_revenue" && (
                      <>
                        <Line type="monotone" dataKey="spend" name="Gasto" stroke="#f43f5e" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#f43f5e", stroke: "#fff", strokeWidth: 2 }} />
                        <Line type="monotone" dataKey="revenue" name="Receita" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }} />
                      </>
                    )}
                    {chartMetric === "roas" && (
                      <Line
                        type="monotone"
                        dataKey={(d) => d.spend > 0 ? d.revenue / d.spend : 0}
                        name="ROAS"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }}
                      />
                    )}
                    {chartMetric === "cpa" && (
                      <Line
                        type="monotone"
                        dataKey={(d) => d.conversions > 0 ? d.spend / d.conversions : 0}
                        name="CPA"
                        stroke="#f43f5e"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: "#f43f5e", stroke: "#fff", strokeWidth: 2 }}
                      />
                    )}
                    {chartMetric === "ctr" && (
                      <Line
                        type="monotone"
                        dataKey={(d) => d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0}
                        name="CTR"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: "#8b5cf6", stroke: "#fff", strokeWidth: 2 }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados para o período.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Creatives Gallery Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pt-2">
          <ImageIcon className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold tracking-tight">Galeria de Criativos</h3>
          <Badge variant="secondary" className="font-mono text-xs">{sortedCreatives.length}</Badge>
        </div>

        {/* Creatives Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <p className="text-sm text-muted-foreground hidden sm:block">Exibindo {sortedCreatives.length} criativos</p>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <Switch
                id="unique-mode"
                checked={uniqueCreatives}
                onCheckedChange={setUniqueCreatives}
              />
              <Label htmlFor="unique-mode" className="text-xs sm:text-sm cursor-pointer whitespace-nowrap">Ocultar duplicatas</Label>
            </div>

            <div className="flex items-center gap-2">
              <ListFilter className="w-4 h-4 text-muted-foreground shrink-0" />
              <Select value={creativesSortKey} onValueChange={setCreativesSortKey}>
                <SelectTrigger className="w-[140px] sm:w-[170px] h-8 text-xs">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spend">Maior Gasto</SelectItem>
                  <SelectItem value="roas">Maior ROAS</SelectItem>
                  <SelectItem value="revenue">Maior Receita</SelectItem>
                  <SelectItem value="ctr">Maior CTR</SelectItem>
                  <SelectItem value="conversions">Mais Conversões</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Creative Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
          {sortedCreatives
            .slice((creativesPage - 1) * creativesPerPage, creativesPage * creativesPerPage)
            .map((c) => (
              <Card
                key={c.adId}
                className={`group overflow-hidden cursor-pointer transition-colors duration-300 border border-border/40 hover:border-border/60 shadow-none rounded-xl border-l-4 ${c.roas >= 3 ? "border-l-emerald-500" : c.roas >= 1 ? "border-l-amber-500" : "border-l-red-500"
                  }`}
                onClick={() => {
                  setSelectedCreative(c);
                  setIsModalOpen(true);
                }}
                role="button"
                tabIndex={0}
                aria-label={`Criativo ${c.adName || "Sem Título"} - ROAS ${c.roas.toFixed(2)}x, Gasto ${fmt(c.spend)}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedCreative(c);
                    setIsModalOpen(true);
                  }
                }}
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-muted flex items-center justify-center overflow-hidden">
                  {c.thumbnailUrl ? (
                    <AdThumbnail src={c.thumbnailUrl} alt="" fill className="object-cover transition-transform group-hover:scale-105" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
                  ) : <ImageIcon className="w-8 h-8 opacity-20" />}

                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                      <Play className="w-5 h-5 ml-0.5 fill-current" />
                    </div>
                  </div>

                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="backdrop-blur-md bg-black/40 text-white border-none text-[10px] h-5">
                      {platformLabels[c.platform] || "Ads"}
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-3 sm:p-4 space-y-2.5">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate" title={c.adName || ""}>{c.adName || "Sem Título"}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.campaignName}</p>
                  </div>

                  {/* Primary Metrics */}
                  <div className="flex items-end justify-between border-b border-border/50 pb-2">
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase">Gasto</p>
                      <p className="font-semibold text-sm truncate">{fmt(c.spend)}</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-[10px] text-muted-foreground uppercase">ROAS</p>
                      <p className={`font-bold text-lg ${c.roas >= 3 ? "text-emerald-500" : c.roas > 1 ? "text-amber-500" : "text-red-500"}`}>
                        {c.roas.toFixed(2)}x
                      </p>
                    </div>
                  </div>

                  {/* Secondary Metrics Grid */}
                  <div className="grid grid-cols-3 gap-y-1.5 text-xs">
                    <div className="min-w-0">
                      <p className="text-muted-foreground">Impr.</p>
                      <p className="font-medium truncate">{fmtNum(c.impressions)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-muted-foreground">Cliques</p>
                      <p className="font-medium truncate">{fmtNum(c.clicks)}</p>
                    </div>
                    <div className="text-right min-w-0">
                      <p className="text-muted-foreground">CTR</p>
                      <p className="font-medium">{c.ctr.toFixed(2)}%</p>
                    </div>

                    <div className="col-span-3 pt-1.5 flex justify-between border-t border-border/50 mt-1">
                      <span className="text-muted-foreground text-[11px]">Receita: <span className="text-foreground font-medium">{fmt(c.revenue)}</span></span>
                      <span className="text-muted-foreground text-[11px]">Conv: <span className="text-foreground font-medium">{c.conversions}</span></span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>

        {/* Creatives Pagination */}
        {sortedCreatives.length > creativesPerPage && (
          <div className="flex items-center justify-between px-0 py-4">
            <p className="text-xs text-muted-foreground">
              Página {creativesPage} de {Math.ceil(sortedCreatives.length / creativesPerPage)}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCreativesPage(p => Math.max(1, p - 1))} disabled={creativesPage === 1} aria-label="Página anterior de criativos"><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCreativesPage(p => Math.min(Math.ceil(sortedCreatives.length / creativesPerPage), p + 1))} disabled={creativesPage >= Math.ceil(sortedCreatives.length / creativesPerPage)} aria-label="Próxima página de criativos"><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
      </div>

      {/* AdSet Performance Section */}
      {sortedAdSets.length > 0 && (
      <Card className="border border-border/40 shadow-none rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 px-5 py-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base font-semibold">Performance por Públicos</CardTitle>
            <span className="text-sm text-muted-foreground">({sortedAdSets.length})</span>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table aria-label="Performance por públicos">
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border/50">
                <TableHead scope="col" className="w-[280px]">Público</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col" className="text-center">Anúncios</TableHead>
                <TableHead scope="col" className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("spend", adSetsSortKey, adSetsSortDir, setAdSetsSortKey, setAdSetsSortDir)} role="button" aria-label="Ordenar por gasto">Gasto <ArrowUpDown className="inline w-3 h-3 ml-1" aria-hidden="true" /></TableHead>
                <TableHead scope="col" className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("clicks", adSetsSortKey, adSetsSortDir, setAdSetsSortKey, setAdSetsSortDir)} role="button" aria-label="Ordenar por cliques">Cliques</TableHead>
                <TableHead scope="col" className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("ctr", adSetsSortKey, adSetsSortDir, setAdSetsSortKey, setAdSetsSortDir)} role="button" aria-label="Ordenar por CTR">CTR</TableHead>
                <TableHead scope="col" className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("conversions", adSetsSortKey, adSetsSortDir, setAdSetsSortKey, setAdSetsSortDir)} role="button" aria-label="Ordenar por conversões">Conv.</TableHead>
                <TableHead scope="col" className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("cpa", adSetsSortKey, adSetsSortDir, setAdSetsSortKey, setAdSetsSortDir)} role="button" aria-label="Ordenar por CPA">CPA</TableHead>
                <TableHead scope="col" className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("roas", adSetsSortKey, adSetsSortDir, setAdSetsSortKey, setAdSetsSortDir)} role="button" aria-label="Ordenar por ROAS">ROAS <ArrowUpDown className="inline w-3 h-3 ml-1" aria-hidden="true" /></TableHead>
                <TableHead scope="col" className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("revenue", adSetsSortKey, adSetsSortDir, setAdSetsSortKey, setAdSetsSortDir)} role="button" aria-label="Ordenar por receita">Receita</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAdSets
                .slice((adSetsPage - 1) * adSetsPerPage, adSetsPage * adSetsPerPage)
                .map((s) => (
                  <TableRow key={s.adSetId} className={`hover:bg-muted/30 border-b border-border/50 ${s.roas >= 3 ? "bg-emerald-500/5 hover:bg-emerald-500/10" : ""}`}>
                    <TableCell>
                      <div className="min-w-0 max-w-[260px]">
                        <p className="text-sm font-medium truncate" title={s.adSetName || ""}>{s.adSetName || "Sem Nome"}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.campaignName}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.roas >= 3 ? "default" : s.roas >= 1 ? "secondary" : "destructive"} className="text-[10px]">
                        {s.roas >= 3 ? "Validado" : s.roas >= 1 ? "Testando" : "Negativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px]">{s.adCount}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{fmt(s.spend)}</TableCell>
                    <TableCell className="text-right">{fmtNum(s.clicks)}</TableCell>
                    <TableCell className="text-right">{s.ctr.toFixed(2)}%</TableCell>
                    <TableCell className="text-right">{fmtNum(s.conversions)}</TableCell>
                    <TableCell className="text-right">{s.cpa > 0 ? fmt(s.cpa) : "-"}</TableCell>
                    <TableCell className="text-right font-medium text-foreground">
                      <span className={s.roas >= 3 ? "text-emerald-500" : s.roas >= 1 ? "text-amber-500" : "text-red-500"}>
                        {s.roas > 0 ? s.roas.toFixed(2) + "x" : "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{fmt(s.revenue)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>

          {sortedAdSets.length > adSetsPerPage && (
            <div className="flex items-center justify-between px-4 py-4 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                Página {adSetsPage} de {Math.ceil(sortedAdSets.length / adSetsPerPage)}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setAdSetsPage(p => Math.max(1, p - 1))} disabled={adSetsPage === 1} aria-label="Página anterior de públicos"><ChevronLeft className="w-4 h-4" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setAdSetsPage(p => Math.min(Math.ceil(sortedAdSets.length / adSetsPerPage), p + 1))} disabled={adSetsPage >= Math.ceil(sortedAdSets.length / adSetsPerPage)} aria-label="Próxima página de públicos"><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Top Performers Section */}
      <Card className="border border-border/40 shadow-none rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 px-5 py-4">
          <CardTitle className="text-base font-semibold">Top 5 Anúncios (ROAS)</CardTitle>
          <div className="flex items-center space-x-2">
            <Label htmlFor="worst-mode" className="text-xs">Ver Piores</Label>
            <Switch id="worst-mode" checked={showWorstPerformers} onCheckedChange={setShowWorstPerformers} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-0 divide-y divide-border/50">
            {(showWorstPerformers ? topCreatives.worst : topCreatives.best).map((c, idx) => (
              <div key={c.adId} className="flex items-center p-3 hover:bg-muted/30 transition-colors">
                <span className="w-6 text-center text-muted-foreground text-sm font-medium mr-2">{idx + 1}</span>
                <div className="w-10 h-10 bg-muted rounded relative overflow-hidden shrink-0 mr-3 border border-border">
                  {c.thumbnailUrl ? (
                    <AdThumbnail src={c.thumbnailUrl} alt="" fill className="object-cover" sizes="40px" />
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
                  <p className={`text-sm font-bold ${c.roas >= 3 ? "text-emerald-500" : c.roas < 1 ? "text-red-500" : "text-amber-500"}`}>
                    {c.roas.toFixed(2)}x
                  </p>
                  <p className="text-xs text-muted-foreground">ROAS</p>
                </div>
              </div>
            ))}
            {(showWorstPerformers ? topCreatives.worst : topCreatives.best).length === 0 && (
              <div className="p-6 text-center text-muted-foreground text-sm">
                Nenhum anúncio com gasto relevante encontrado.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Table */}
      <Card className="border border-border/40 shadow-none rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 px-5 py-4">
          <CardTitle className="text-base font-semibold">Detalhamento Completo</CardTitle>
          <div className="flex items-center gap-2">
            <Switch
              id="unique-metrics"
              checked={uniqueMetrics}
              onCheckedChange={setUniqueMetrics}
            />
            <Label htmlFor="unique-metrics" className="text-sm cursor-pointer">Ocultar duplicatas</Label>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table aria-label="Detalhamento completo dos anúncios">
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border/50">
                <TableHead scope="col" className="w-[300px]">Anúncio</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col" className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("spend", metricsSortKey, metricsSortDir, setMetricsSortKey, setMetricsSortDir)} role="button" aria-label="Ordenar por gasto">Gasto <ArrowUpDown className="inline w-3 h-3 ml-1" aria-hidden="true" /></TableHead>
                <TableHead scope="col" className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("impressions", metricsSortKey, metricsSortDir, setMetricsSortKey, setMetricsSortDir)} role="button" aria-label="Ordenar por impressões">Impr.</TableHead>
                <TableHead scope="col" className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("clicks", metricsSortKey, metricsSortDir, setMetricsSortKey, setMetricsSortDir)} role="button" aria-label="Ordenar por cliques">Cliques</TableHead>
                <TableHead scope="col" className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("ctr", metricsSortKey, metricsSortDir, setMetricsSortKey, setMetricsSortDir)} role="button" aria-label="Ordenar por CTR">CTR</TableHead>
                <TableHead scope="col" className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("cpa", metricsSortKey, metricsSortDir, setMetricsSortKey, setMetricsSortDir)} role="button" aria-label="Ordenar por CPA">CPA</TableHead>
                <TableHead scope="col" className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("roas", metricsSortKey, metricsSortDir, setMetricsSortKey, setMetricsSortDir)} role="button" aria-label="Ordenar por ROAS">ROAS</TableHead>
                <TableHead scope="col" className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("revenue", metricsSortKey, metricsSortDir, setMetricsSortKey, setMetricsSortDir)} role="button" aria-label="Ordenar por receita">Receita</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMetrics
                .slice((metricsPage - 1) * metricsPerPage, metricsPage * metricsPerPage)
                .map((m) => (
                  <TableRow key={m.id} className={`hover:bg-muted/30 border-b border-border/50 ${m.roas >= 3 ? "bg-emerald-500/5 hover:bg-emerald-500/10" : ""}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {m.thumbnailUrl && <AdThumbnail src={m.thumbnailUrl} alt="" width={32} height={32} className="rounded object-cover" />}
                        <div className="min-w-0 max-w-[250px]">
                          <p className="text-sm font-medium truncate" title={m.adName || ""}>{m.adName || "Anúncio"}</p>
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
            <div className="flex items-center justify-between px-4 py-4 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                Página {metricsPage} de {Math.ceil(sortedMetrics.length / metricsPerPage)}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMetricsPage(p => Math.max(1, p - 1))} disabled={metricsPage === 1} aria-label="Página anterior de detalhamento"><ChevronLeft className="w-4 h-4" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMetricsPage(p => Math.min(Math.ceil(sortedMetrics.length / metricsPerPage), p + 1))} disabled={metricsPage >= Math.ceil(sortedMetrics.length / metricsPerPage)} aria-label="Próxima página de detalhamento"><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      </>
      )}

      {/* Modals */}
      {isModalOpen && selectedCreative && (
        <VideoModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          creative={selectedCreative}
        />
      )}
    </div>
  );
}
