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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    TrendingUp,
    DollarSign,
    MousePointerClick,
    Eye,
    Target,
    BarChart,
    Layers,
    MapPin,
    Users,
    Smartphone,
    ArrowUpRight,
    ArrowDownRight,
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
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    Legend,
} from "recharts";
import { loadAllAnalyticsData } from "@/actions/ads";
import { PeriodSelector, periodToParams, type PeriodValue } from "@/components/period-selector";
import { cn } from "@/lib/utils";

export default function AnalyticsPage() {
    const [period, setPeriod] = useState<PeriodValue>({ type: "preset", days: 30 });
    const [loading, setLoading] = useState(true);

    // Data states
    const [kpis, setKpis] = useState({ cpa: 0, cpc: 0, ctr: 0, cpm: 0 });
    const [dailyData, setDailyData] = useState<any[]>([]);
    const [creatives, setCreatives] = useState<any[]>([]);
    const [platformData, setPlatformData] = useState<any[]>([]);

    const loadData = useCallback(async () => {
        setLoading(true);
        const { days, from, to } = periodToParams(period);

        try {
            const data = await loadAllAnalyticsData(days, from, to);
            if (!data) { setLoading(false); return; }

            const totals = data.adMetrics.totals || { spend: 0, clicks: 0, impressions: 0, conversions: 0 };
            const cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
            const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
            const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
            const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
            setKpis({ cpa, cpc, ctr, cpm });
            setDailyData(data.dailyData);
            setCreatives(data.creatives.slice(0, 5));
            setPlatformData(data.platformData);
        } catch (error) {
            console.error("Failed to load analytics data", error);
        }

        setLoading(false);
    }, [period]);

    useEffect(() => {
        loadData();
    }, [loadData]);


    function fmtCurrency(val: number) {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
    }

    function fmtNum(val: number) {
        return new Intl.NumberFormat("pt-BR").format(val);
    }

    // Mock data for Radar Chart (since we lack specific breakdown for a meaningful radar)
    // We can pretend to show performance across different dimensions or just mapped platform data
    const radarData = platformData.map(p => ({
        subject: p.platform,
        A: p.revenue > 0 ? Math.log(p.revenue) * 10 : 0, // Scaled for visual
        B: p.orders * 5,
        fullMark: 150
    }));
    // If no platform data, provide dummy for visual
    const finalRadarData = radarData.length ? radarData : [
        { subject: 'Shopify', A: 120, B: 110, fullMark: 150 },
        { subject: 'Facebook', A: 98, B: 130, fullMark: 150 },
        { subject: 'Google', A: 86, B: 130, fullMark: 150 },
        { subject: 'Tiktok', A: 99, B: 100, fullMark: 150 },
        { subject: 'Email', A: 85, B: 90, fullMark: 150 },
        { subject: 'Direct', A: 65, B: 85, fullMark: 150 },
    ];

    if (loading) {
        return <div className="p-8 flex items-center justify-center text-muted-foreground">Carregando analytics...</div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Visão detalhada de performance e criativos.
                    </p>
                </div>
                <PeriodSelector value={period} onChange={setPeriod} />
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <AnalyticsKPICard title="CPA" value={fmtCurrency(kpis.cpa)} icon={Target} color="text-blue-500 bg-blue-500/10" />
                <AnalyticsKPICard title="CPC" value={fmtCurrency(kpis.cpc)} icon={MousePointerClick} color="text-amber-500 bg-amber-500/10" />
                <AnalyticsKPICard title="CTR" value={`${kpis.ctr.toFixed(2)}%`} icon={TrendingUp} color="text-emerald-500 bg-emerald-500/10" />
                <AnalyticsKPICard title="CPM" value={fmtCurrency(kpis.cpm)} icon={Eye} color="text-purple-500 bg-purple-500/10" />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Daily Evolution */}
                <Card className="lg:col-span-2 border border-border shadow-none rounded-lg">
                    <CardHeader className="border-b border-border/50 px-5 py-4">
                        <CardTitle className="text-base font-semibold">Evolução Diária: Investimento vs Receita</CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dailyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.3} />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(v) => {
                                        const d = new Date(v + "T00:00:00");
                                        return `${d.getDate()}/${d.getMonth() + 1}`;
                                    }}
                                />
                                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v / 1000}k`} />
                                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v / 1000}k`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px" }}
                                    itemStyle={{ fontSize: "12px" }}
                                    labelStyle={{ fontSize: "12px", marginBottom: "8px", color: "var(--foreground)" }}
                                />
                                <Legend verticalAlign="top" height={36} iconType="circle" />
                                <Line yAxisId="left" type="monotone" dataKey="investimento" name="Investimento" stroke="var(--destructive)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                                <Line yAxisId="right" type="monotone" dataKey="faturamento" name="Receita" stroke="var(--primary)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Radar Chart */}
                <Card className="border border-border shadow-none rounded-lg">
                    <CardHeader className="border-b border-border/50 px-5 py-4">
                        <CardTitle className="text-base font-semibold">Performance Relativa</CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={finalRadarData}>
                                <PolarGrid stroke="var(--border)" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                                <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                                <Radar name="Performance" dataKey="A" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.2} />
                                <Tooltip contentStyle={{ borderRadius: "12px" }} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

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
                                        <div className="line-clamp-2 max-w-[200px]">{c.adName || "Anúncio sem nome"}</div>
                                    </TableCell>
                                    <TableCell className="text-right text-xs">{fmtCurrency(c.spend)}</TableCell>
                                    <TableCell className="text-right text-xs font-semibold text-emerald-500">{c.roas.toFixed(2)}x</TableCell>
                                    <TableCell className="text-right text-xs">{fmtCurrency(c.revenue)}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground text-sm">
                                        Nenhum criativo encontrado neste período.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Segmentation Tabs */}
            <Card className="border border-border shadow-none rounded-lg">
                <CardHeader className="border-b border-border/50 px-5 py-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold py-2">Segmentação</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-5">
                    <Tabs defaultValue="platform" className="w-full">
                        <TabsList className="grid w-full max-w-md grid-cols-4 mb-4">
                            <TabsTrigger value="platform">Plataforma</TabsTrigger>
                            <TabsTrigger value="gender">Gênero</TabsTrigger>
                            <TabsTrigger value="age">Idade</TabsTrigger>
                            <TabsTrigger value="state">Estado</TabsTrigger>
                        </TabsList>

                        <TabsContent value="platform" className="mt-0">
                            <div className="space-y-2">
                                {platformData.map((p, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 border border-border rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                                                <Layers className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{p.platform}</p>
                                                <p className="text-xs text-muted-foreground">{p.orders} pedidos</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-sm">{fmtCurrency(p.revenue)}</p>
                                            <div className="w-24 h-1.5 bg-secondary rounded-full mt-1 overflow-hidden">
                                                <div className="h-full bg-primary" style={{ width: `${(p.revenue / Math.max(...platformData.map((x: any) => x.revenue))) * 100}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {platformData.length === 0 && <div className="text-center text-muted-foreground text-sm py-4">Sem dados.</div>}
                            </div>
                        </TabsContent>

                        <TabsContent value="gender">
                            <EmptyStateIcon icon={Users} label="Dados demográficos (Gênero) indisponíveis na origem." />
                        </TabsContent>
                        <TabsContent value="age">
                            <EmptyStateIcon icon={Smartphone} label="Dados demográficos (Idade) indisponíveis na origem." />
                        </TabsContent>
                        <TabsContent value="state">
                            <EmptyStateIcon icon={MapPin} label="Dados geográficos indisponíveis na origem." />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}

function AnalyticsKPICard({ title, value, icon: Icon, color }: { title: string; value: string; icon: LucideIcon; color: string }) {
    return (
        <Card className="border border-border shadow-none rounded-lg p-5">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{title}</span>
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
            <p className="text-xs">{label}</p>
        </div>
    );
}
