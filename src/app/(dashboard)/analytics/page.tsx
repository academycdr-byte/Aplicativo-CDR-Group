"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    TrendingUp,
    MousePointerClick,
    Eye,
    Target,
    MapPin,
    Users,
    Smartphone,
    Globe,
    Monitor,
    Tablet,
    FileText,
    Link2,
    Info,
    type LucideIcon,
} from "lucide-react";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    BarChart,
    Bar,
    Legend,
} from "recharts";
import { loadAllAnalyticsData } from "@/actions/ads";
import { PeriodSelector, periodToParams, type PeriodValue } from "@/components/period-selector";
import { cn } from "@/lib/utils";

type GAData = {
    totals: {
        sessions: number;
        activeUsers: number;
        newUsers: number;
        screenPageViews: number;
        conversions: number;
        bounceRate: number;
        engagementRate: number;
        avgSessionDuration: number;
    };
    dailyData: { date: string; sessions: number; activeUsers: number; screenPageViews: number; newUsers: number }[];
    trafficSources: { source: string; sessions: number; activeUsers: number }[];
    devices: { device: string; sessions: number; activeUsers: number }[];
    geography: { country: string; sessions: number; activeUsers: number }[];
    topPages: { path: string; screenPageViews: number; activeUsers: number }[];
    gender?: { label: string; sessions: number; activeUsers: number }[];
    age?: { label: string; sessions: number; activeUsers: number }[];
};

type PlatformComparisonEntry = { platform: string; cpa: number; roas: number };

const TRAFFIC_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

function fmtCurrencyGlobal(val: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
}

function fmtNumGlobal(val: number) {
    return new Intl.NumberFormat("pt-BR").format(val);
}

export default function AnalyticsPage() {
    const [period, setPeriod] = useState<PeriodValue>({ type: "preset", days: 30 });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("ads");

    // Ad metrics data states
    const [kpis, setKpis] = useState({ cpa: 0, cpc: 0, ctr: 0, cpm: 0 });
    const [creatives, setCreatives] = useState<{ adId: string; adName: string | null; thumbnailUrl: string | null; spend: number; revenue: number; roas: number; clicks: number; impressions: number }[]>([]);
    const [platformComparison, setPlatformComparison] = useState<PlatformComparisonEntry[]>([]);

    // Google Analytics data
    const [gaData, setGaData] = useState<GAData | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        const { days, from, to } = periodToParams(period);

        try {
            const data = await loadAllAnalyticsData(days, from, to);
            if (!data) { setLoading(false); return; }

            const totals = data.adMetrics.totals || { spend: 0, clicks: 0, impressions: 0, conversions: 0, revenue: 0 };
            const cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
            const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
            const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
            const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
            setKpis({ cpa, cpc, ctr, cpm });
            setCreatives(data.creatives.slice(0, 5));
            setGaData(data.gaData || null);

            // CPA/ROAS by ad platform
            const byPlatform: Record<string, { spend: number; revenue: number; conversions: number }> = {};
            for (const m of (data.adMetrics.metrics || [])) {
                const rec = m as Record<string, unknown>;
                const p = String(rec.platform || "");
                if (!byPlatform[p]) byPlatform[p] = { spend: 0, revenue: 0, conversions: 0 };
                byPlatform[p].spend += Number(rec.spend) || 0;
                byPlatform[p].revenue += Number(rec.revenue) || 0;
                byPlatform[p].conversions += Number(rec.conversions) || 0;
            }
            setPlatformComparison(
                Object.entries(byPlatform).map(([platform, vals]) => ({
                    platform: platform.replace("FACEBOOK_ADS", "Facebook").replace("GOOGLE_ADS", "Google"),
                    cpa: vals.conversions > 0 ? vals.spend / vals.conversions : 0,
                    roas: vals.spend > 0 ? vals.revenue / vals.spend : 0,
                }))
            );
        } catch (error) {
            console.error("Failed to load analytics data", error);
        }

        setLoading(false);
    }, [period]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    function fmtCurrency(val: number) {
        return fmtCurrencyGlobal(val);
    }

    function fmtNum(val: number) {
        return fmtNumGlobal(val);
    }

    function fmtDuration(seconds: number) {
        const m = Math.floor(seconds / 60);
        const s = Math.round(seconds % 60);
        return `${m}m ${s}s`;
    }

    function fmtPercent(val: number) {
        return `${(val * 100).toFixed(2)}%`;
    }

    if (loading) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
                        <p className="text-muted-foreground text-sm mt-0.5">Visao detalhada de performance, criativos e website.</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Card key={i} className="h-28">
                            <CardContent className="pt-5">
                                <div className="animate-pulse space-y-3">
                                    <div className="h-4 w-20 bg-muted/40 rounded" />
                                    <div className="h-8 w-28 bg-muted/40 rounded" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
                <Card className="h-80">
                    <div className="animate-pulse h-full w-full bg-muted/10 rounded-lg" />
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Visao detalhada de performance, criativos e website.
                    </p>
                </div>
                <PeriodSelector value={period} onChange={setPeriod} />
            </div>

            {/* Main Tabs: Ads vs Website (GA) */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-xs grid-cols-2">
                    <TabsTrigger value="ads">Anuncios</TabsTrigger>
                    <TabsTrigger value="website">Website</TabsTrigger>
                </TabsList>

                {/* ============ ADS TAB ============ */}
                <TabsContent value="ads" className="mt-6 space-y-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <AnalyticsKPICard title="CPA" value={fmtCurrency(kpis.cpa)} icon={Target} color="text-blue-500 bg-blue-500/10" />
                        <AnalyticsKPICard title="CPC" value={fmtCurrency(kpis.cpc)} icon={MousePointerClick} color="text-amber-500 bg-amber-500/10" />
                        <AnalyticsKPICard title="CTR" value={`${kpis.ctr.toFixed(2)}%`} icon={TrendingUp} color="text-emerald-500 bg-emerald-500/10" />
                        <AnalyticsKPICard title="CPM" value={fmtCurrency(kpis.cpm)} icon={Eye} color="text-purple-500 bg-purple-500/10" />
                    </div>

                    {/* CPA / ROAS by Platform */}
                    {platformComparison.length > 0 && (
                        <Card className="border border-border shadow-none rounded-lg">
                            <CardHeader className="border-b border-border/50 px-5 py-4">
                                <CardTitle className="text-base font-semibold">CPA e ROAS por Plataforma</CardTitle>
                            </CardHeader>
                            <CardContent className="p-5 h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={platformComparison} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.3} />
                                        <XAxis dataKey="platform" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                                        <YAxis yAxisId="cpa" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v.toFixed(0)}`} />
                                        <YAxis yAxisId="roas" orientation="right" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v.toFixed(1)}x`} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px" }}
                                            formatter={(value, name) => name === "CPA" ? fmtCurrencyGlobal(Number(value)) : `${Number(value).toFixed(2)}x`}
                                        />
                                        <Legend verticalAlign="top" height={36} iconType="circle" />
                                        <Bar yAxisId="cpa" dataKey="cpa" name="CPA" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
                                        <Bar yAxisId="roas" dataKey="roas" name="ROAS" fill="#10b981" radius={[4, 4, 0, 0]} barSize={32} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}

                    {/* Top Creatives */}
                    <Card className="border border-border shadow-none rounded-lg">
                        <CardHeader className="border-b border-border/50 px-5 py-4">
                            <CardTitle className="text-base font-semibold">Top Criativos</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent border-b border-border/50">
                                        <TableHead className="w-[80px]">Preview</TableHead>
                                        <TableHead>Nome</TableHead>
                                        <TableHead className="text-right">Spend</TableHead>
                                        <TableHead className="text-right">ROAS</TableHead>
                                        <TableHead className="text-right">Revenue</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {creatives.length > 0 ? creatives.map((c) => (
                                        <TableRow key={c.adId} className="hover:bg-muted/50 border-b border-border/50">
                                            <TableCell className="py-2">
                                                <Avatar className="h-10 w-10 text-[10px] rounded-md border">
                                                    <AvatarImage src={c.thumbnailUrl || ""} alt="Ad" className="object-cover" />
                                                    <AvatarFallback className="rounded-md">AD</AvatarFallback>
                                                </Avatar>
                                            </TableCell>
                                            <TableCell className="font-medium text-xs text-muted-foreground">
                                                <div className="line-clamp-2 max-w-[200px]">{c.adName || "Anuncio sem nome"}</div>
                                            </TableCell>
                                            <TableCell className="text-right text-xs">{fmtCurrency(c.spend)}</TableCell>
                                            <TableCell className="text-right text-xs font-semibold text-emerald-500">{c.roas.toFixed(2)}x</TableCell>
                                            <TableCell className="text-right text-xs">{fmtCurrency(c.revenue)}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground text-sm">
                                                Nenhum criativo encontrado neste periodo.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Segmentation - Gender, Age, Region only */}
                    <Card className="border border-border shadow-none rounded-lg">
                        <CardHeader className="border-b border-border/50 px-5 py-2">
                            <CardTitle className="text-base font-semibold py-2">Segmentacao</CardTitle>
                        </CardHeader>
                        <CardContent className="p-5">
                            <Tabs defaultValue="gender" className="w-full">
                                <TabsList className="grid w-full max-w-sm grid-cols-3 mb-4">
                                    <TabsTrigger value="gender">Genero</TabsTrigger>
                                    <TabsTrigger value="age">Idade</TabsTrigger>
                                    <TabsTrigger value="state">Regiao</TabsTrigger>
                                </TabsList>
                                <TabsContent value="gender" className="mt-0">
                                    {gaData?.gender && gaData.gender.length > 0 ? (
                                        <SegmentationList data={gaData.gender} icon={Users} />
                                    ) : (
                                        <EmptyStateIcon icon={Users} label="Sem dados de genero. Verifique se o Google Signals esta ativo no GA4." />
                                    )}
                                </TabsContent>
                                <TabsContent value="age" className="mt-0">
                                    {gaData?.age && gaData.age.length > 0 ? (
                                        <SegmentationList data={gaData.age} icon={Users} />
                                    ) : (
                                        <EmptyStateIcon icon={Users} label="Sem dados de idade. Verifique se o Google Signals esta ativo no GA4." />
                                    )}
                                </TabsContent>
                                <TabsContent value="state" className="mt-0">
                                    {gaData?.geography && gaData.geography.length > 0 ? (
                                        <div className="space-y-2">
                                            {gaData.geography.map((g, i) => {
                                                const maxSessions = Math.max(...gaData.geography.map(x => x.sessions), 1);
                                                return (
                                                    <div key={i} className="flex items-center justify-between p-3 border border-border rounded-lg">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                                                                <MapPin className="w-4 h-4 text-muted-foreground" />
                                                            </div>
                                                            <p className="font-medium text-sm">{g.country}</p>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
                                                                <div className="h-full bg-primary" style={{ width: `${(g.sessions / maxSessions) * 100}%` }} />
                                                            </div>
                                                            <span className="text-sm font-semibold w-16 text-right">{fmtNum(g.sessions)}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <EmptyStateIcon icon={MapPin} label="Sem dados geograficos. Conecte o Google Analytics para ver esta informacao." />
                                    )}
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ============ WEBSITE (GA) TAB ============ */}
                <TabsContent value="website" className="mt-6 space-y-6">
                    {!gaData ? (
                        <Card className="border border-dashed border-border shadow-none rounded-lg">
                            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                                <Globe className="w-12 h-12 text-muted-foreground opacity-50" />
                                <div className="text-center">
                                    <p className="font-medium text-sm">Google Analytics nao conectado</p>
                                    <p className="text-muted-foreground text-xs mt-1">
                                        Conecte sua propriedade GA4 para ver dados do website.
                                    </p>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => window.location.href = "/integrations"}>
                                    <Link2 className="w-4 h-4 mr-1.5" />
                                    Conectar Google Analytics
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            {/* GA4 Disclaimer */}
                            <div className="flex items-start gap-2.5 px-4 py-3 bg-muted/40 border border-border rounded-lg">
                                <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Os dados abaixo sao fornecidos pelo Google Analytics 4. Pequenas variacoes em relacao ao painel do GA4 sao normais devido a diferenca nos momentos de processamento e amostragem de dados.
                                </p>
                            </div>

                            {/* GA KPI Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <AnalyticsKPICard title="Sessoes" value={fmtNum(gaData.totals.sessions)} icon={Users} color="text-blue-500 bg-blue-500/10" />
                                <AnalyticsKPICard title="Usuarios Ativos" value={fmtNum(gaData.totals.activeUsers)} icon={Eye} color="text-emerald-500 bg-emerald-500/10" />
                                <AnalyticsKPICard title="Pageviews" value={fmtNum(gaData.totals.screenPageViews)} icon={FileText} color="text-amber-500 bg-amber-500/10" />
                                <AnalyticsKPICard
                                    title="Engajamento"
                                    value={fmtPercent(gaData.totals.engagementRate)}
                                    icon={TrendingUp}
                                    color="text-purple-500 bg-purple-500/10"
                                    tooltip="Percentual de sessoes que duraram mais de 10 segundos, tiveram um evento de conversao ou tiveram 2 ou mais visualizacoes de pagina."
                                />
                            </div>

                            {/* GA Secondary KPIs */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <Card className="border border-border shadow-none rounded-lg p-4">
                                    <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Novos Usuarios</span>
                                    <div className="text-lg font-bold mt-1">{fmtNum(gaData.totals.newUsers)}</div>
                                </Card>
                                <Card className="border border-border shadow-none rounded-lg p-4">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Bounce Rate</span>
                                        <div className="relative group">
                                            <Info className="w-3.5 h-3.5 text-muted-foreground/50 cursor-help" />
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-56 z-50 pointer-events-none">
                                                Percentual de sessoes que nao foram engajadas, ou seja, duraram menos de 10 segundos e nao tiveram conversao nem segunda visualizacao.
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-lg font-bold mt-1">{fmtPercent(gaData.totals.bounceRate)}</div>
                                </Card>
                                <Card className="border border-border shadow-none rounded-lg p-4">
                                    <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Tempo Medio</span>
                                    <div className="text-lg font-bold mt-1">{fmtDuration(gaData.totals.avgSessionDuration)}</div>
                                </Card>
                            </div>

                            {/* GA Daily Chart */}
                            <Card className="border border-border shadow-none rounded-lg">
                                <CardHeader className="border-b border-border/50 px-5 py-4">
                                    <CardTitle className="text-base font-semibold">Sessoes e Usuarios por Dia</CardTitle>
                                </CardHeader>
                                <CardContent className="p-5 h-[350px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={gaData.dailyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.3} />
                                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false}
                                                tickFormatter={(v) => { const d = new Date(v + "T00:00:00"); return `${d.getDate()}/${d.getMonth() + 1}`; }}
                                            />
                                            <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                                            <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px" }} itemStyle={{ fontSize: "12px" }} labelStyle={{ fontSize: "12px", marginBottom: "8px", color: "var(--foreground)" }} />
                                            <Legend verticalAlign="top" height={36} iconType="circle" />
                                            <Line type="monotone" dataKey="sessions" name="Sessoes" stroke="var(--primary)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                                            <Line type="monotone" dataKey="activeUsers" name="Usuarios Ativos" stroke="#8b5cf6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                                            <Line type="monotone" dataKey="screenPageViews" name="Pageviews" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            {/* Traffic Sources (redesigned) + Traffic Table + Top Pages */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Traffic Sources - Horizontal Bars */}
                                <Card className="lg:col-span-1 border border-border shadow-none rounded-lg">
                                    <CardHeader className="border-b border-border/50 px-5 py-4">
                                        <CardTitle className="text-base font-semibold">Origens de Trafego</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5">
                                        {gaData.trafficSources.length > 0 ? (
                                            <div className="space-y-3">
                                                {gaData.trafficSources.slice(0, 8).map((s, i) => {
                                                    const totalSessions = gaData.trafficSources.reduce((sum, t) => sum + t.sessions, 0) || 1;
                                                    const maxSessions = Math.max(...gaData.trafficSources.slice(0, 8).map(t => t.sessions), 1);
                                                    const pct = ((s.sessions / totalSessions) * 100).toFixed(1);
                                                    return (
                                                        <div key={i} className="space-y-1.5">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: TRAFFIC_COLORS[i % TRAFFIC_COLORS.length] }} />
                                                                    <span className="text-sm font-medium truncate">{s.source}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                                                    <span className="text-xs text-muted-foreground">{pct}%</span>
                                                                    <span className="text-sm font-semibold w-14 text-right">{fmtNum(s.sessions)}</span>
                                                                </div>
                                                            </div>
                                                            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full rounded-full transition-all duration-500"
                                                                    style={{
                                                                        width: `${(s.sessions / maxSessions) * 100}%`,
                                                                        backgroundColor: TRAFFIC_COLORS[i % TRAFFIC_COLORS.length],
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Sem dados.</div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Traffic Sources Table */}
                                <Card className="border border-border shadow-none rounded-lg">
                                    <CardHeader className="border-b border-border/50 px-5 py-4">
                                        <CardTitle className="text-base font-semibold">Fontes de Trafego</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent border-b border-border/50">
                                                    <TableHead>Fonte / Meio</TableHead>
                                                    <TableHead className="text-right">Sessoes</TableHead>
                                                    <TableHead className="text-right">Usuarios</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {gaData.trafficSources.length > 0 ? gaData.trafficSources.map((s, i) => (
                                                    <TableRow key={i} className="hover:bg-muted/50 border-b border-border/50">
                                                        <TableCell className="font-medium text-sm">{s.source}</TableCell>
                                                        <TableCell className="text-right text-sm">{fmtNum(s.sessions)}</TableCell>
                                                        <TableCell className="text-right text-sm">{fmtNum(s.activeUsers)}</TableCell>
                                                    </TableRow>
                                                )) : (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="h-16 text-center text-muted-foreground text-sm">Sem dados.</TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>

                                {/* Top Pages */}
                                <Card className="border border-border shadow-none rounded-lg">
                                    <CardHeader className="border-b border-border/50 px-5 py-4">
                                        <CardTitle className="text-base font-semibold">Top Paginas</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent border-b border-border/50">
                                                    <TableHead>Pagina</TableHead>
                                                    <TableHead className="text-right">Views</TableHead>
                                                    <TableHead className="text-right">Usuarios</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {gaData.topPages.length > 0 ? gaData.topPages.map((p, i) => (
                                                    <TableRow key={i} className="hover:bg-muted/50 border-b border-border/50">
                                                        <TableCell className="font-medium text-xs max-w-[200px] truncate">{p.path}</TableCell>
                                                        <TableCell className="text-right text-sm">{fmtNum(p.screenPageViews)}</TableCell>
                                                        <TableCell className="text-right text-sm">{fmtNum(p.activeUsers)}</TableCell>
                                                    </TableRow>
                                                )) : (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="h-16 text-center text-muted-foreground text-sm">Sem dados.</TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Devices */}
                                <Card className="border border-border shadow-none rounded-lg">
                                    <CardHeader className="border-b border-border/50 px-5 py-4">
                                        <div>
                                            <CardTitle className="text-base font-semibold">Dispositivos</CardTitle>
                                            <p className="text-xs text-muted-foreground mt-0.5">Sessoes por tipo de dispositivo</p>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-5">
                                        <div className="space-y-3">
                                            {gaData.devices.length > 0 ? gaData.devices.map((d, i) => {
                                                const maxSessions = Math.max(...gaData.devices.map(x => x.sessions), 1);
                                                const DeviceIcon = d.device === "desktop" ? Monitor : d.device === "mobile" ? Smartphone : Tablet;
                                                return (
                                                    <div key={i} className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                                                            <DeviceIcon className="w-4 h-4 text-muted-foreground" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="font-medium text-sm capitalize">{d.device}</span>
                                                                <span className="text-sm font-semibold">{fmtNum(d.sessions)} <span className="text-xs font-normal text-muted-foreground">sessoes</span></span>
                                                            </div>
                                                            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                                                                <div className="h-full bg-primary rounded-full" style={{ width: `${(d.sessions / maxSessions) * 100}%` }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }) : (
                                                <div className="text-center text-muted-foreground text-sm py-4">Sem dados.</div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Geography - Top 10 */}
                                <Card className="border border-border shadow-none rounded-lg">
                                    <CardHeader className="border-b border-border/50 px-5 py-4">
                                        <div>
                                            <CardTitle className="text-base font-semibold">Top 10 Regioes</CardTitle>
                                            <p className="text-xs text-muted-foreground mt-0.5">Sessoes por regiao</p>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-5">
                                        <div className="space-y-2">
                                            {gaData.geography.length > 0 ? gaData.geography.slice(0, 10).map((g, i) => {
                                                const maxSessions = Math.max(...gaData.geography.map(x => x.sessions), 1);
                                                return (
                                                    <div key={i} className="flex items-center justify-between p-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-muted-foreground font-medium w-5">{i + 1}.</span>
                                                            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                                                            <span className="text-sm">{g.country}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                                                                <div className="h-full bg-primary rounded-full" style={{ width: `${(g.sessions / maxSessions) * 100}%` }} />
                                                            </div>
                                                            <span className="text-sm font-medium w-20 text-right">{fmtNum(g.sessions)} <span className="text-xs font-normal text-muted-foreground">sessoes</span></span>
                                                        </div>
                                                    </div>
                                                );
                                            }) : (
                                                <div className="text-center text-muted-foreground text-sm py-4">Sem dados.</div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

function AnalyticsKPICard({ title, value, icon: Icon, color, tooltip }: { title: string; value: string; icon: LucideIcon; color: string; tooltip?: string }) {
    return (
        <Card className="border border-border shadow-none rounded-lg p-5">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                    <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{title}</span>
                    {tooltip && (
                        <div className="relative group">
                            <Info className="w-3.5 h-3.5 text-muted-foreground/50 cursor-help" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-56 z-50 pointer-events-none">
                                {tooltip}
                            </div>
                        </div>
                    )}
                </div>
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", color)}>
                    <Icon className="w-4 h-4" />
                </div>
            </div>
            <div className="text-2xl font-bold tracking-tight">{value}</div>
        </Card>
    );
}

function EmptyStateIcon({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
    return (
        <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2 border border-dashed rounded-lg">
            <Icon className="w-8 h-8 opacity-50" />
            <p className="text-xs text-center px-4">{label}</p>
        </div>
    );
}

function SegmentationList({ data, icon: Icon }: { data: { label: string; sessions: number; activeUsers: number }[]; icon: LucideIcon }) {
    const maxSessions = Math.max(...data.map(d => d.sessions), 1);
    return (
        <div className="space-y-2">
            {data.map((d, i) => (
                <div key={i} className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="font-medium text-sm">{d.label}</p>
                            <p className="text-xs text-muted-foreground">{fmtNumGlobal(d.activeUsers)} usuarios</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-sm">{fmtNumGlobal(d.sessions)} sessoes</p>
                        <div className="w-24 h-1.5 bg-secondary rounded-full mt-1 overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${(d.sessions / maxSessions) * 100}%` }} />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
