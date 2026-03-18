
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { type Product } from "@/lib/ecommerce-service";
import { getBestSellersAction, getOrdersRevenueTotalAction } from "@/actions/ecommerce";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShoppingBag, TrendingUp, Search, AlertCircle, Package, LayoutGrid, List, ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import Image from "next/image";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PeriodSelector, periodToParams, type PeriodValue } from "@/components/period-selector";
import { motion } from "framer-motion";

type SortField = "totalSold" | "revenue" | "ticket";
type SortDir = "desc" | "asc";

export default function BestSellersPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [period, setPeriod] = useState<PeriodValue>({ type: "preset", days: 30 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [revenueTotal, setRevenueTotal] = useState<number>(0);
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [sortField, setSortField] = useState<SortField>("totalSold");
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const [search, setSearch] = useState("");

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const params = periodToParams(period);
                let fromDate: Date | undefined;
                let toDate: Date | undefined;

                if (period.type === "custom" && params.from && params.to) {
                    fromDate = new Date(params.from);
                    toDate = new Date(params.to);
                } else if (period.type === "preset") {
                    toDate = new Date();
                    fromDate = new Date();
                    fromDate.setDate(toDate.getDate() - period.days);
                    if (period.days === 0) {
                        fromDate.setHours(0, 0, 0, 0);
                    }
                }

                const results = await Promise.allSettled([
                    getBestSellersAction(undefined, fromDate, toDate),
                    getOrdersRevenueTotalAction(fromDate, toDate)
                ]);

                if (results[0].status === "fulfilled") setProducts(results[0].value);
                if (results[1].status === "fulfilled") setRevenueTotal(results[1].value);
            } catch (err) {
                console.error("Failed to fetch data:", err);
                setError("Não foi possível carregar os produtos. Verifique sua conexão com a loja ou tente novamente mais tarde.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [period]);

    const formatCurrency = (value: number, currency: string) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: currency,
        }).format(value);
    };

    const handleSort = useCallback((field: SortField) => {
        if (sortField === field) {
            setSortDir(prev => prev === "desc" ? "asc" : "desc");
        } else {
            setSortField(field);
            setSortDir("desc");
        }
    }, [sortField]);

    const getProductRevenue = (p: Product) => p.totalRevenue ?? ((p.totalSold || 0) * p.price);
    const getProductTicket = (p: Product) => {
        const sold = p.totalSold || 0;
        return sold > 0 ? getProductRevenue(p) / sold : 0;
    };

    const searchTerm = search.trim().toLowerCase();
    const filteredProducts = useMemo(() => {
        if (!searchTerm) return products;
        return products.filter(p => p.title.toLowerCase().includes(searchTerm));
    }, [products, searchTerm]);

    const sortedProducts = [...filteredProducts].sort((a, b) => {
        const getVal = (p: Product) => {
            if (sortField === "totalSold") return p.totalSold || 0;
            if (sortField === "revenue") return getProductRevenue(p);
            return getProductTicket(p);
        };
        const diff = getVal(b) - getVal(a);
        return sortDir === "desc" ? diff : -diff;
    });

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 opacity-40" />;
        return sortDir === "desc"
            ? <ArrowDown className="w-3.5 h-3.5 ml-1" />
            : <ArrowUp className="w-3.5 h-3.5 ml-1" />;
    };

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/40 pb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">
                        Mais Vendidos
                    </h2>
                    <p className="text-muted-foreground mt-2 max-w-2xl">
                        Acompanhe o desempenho dos seus produtos em tempo real. Identifique tendências e oportunidades de vendas.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {/* View Toggle */}
                    <div className="flex items-center rounded-lg border border-border/50 bg-background/50 p-1">
                        <button
                            onClick={() => setViewMode("grid")}
                            className={`p-2 rounded-md transition-colors ${viewMode === "grid" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode("list")}
                            className={`p-2 rounded-md transition-colors ${viewMode === "list" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>

                    <PeriodSelector
                        value={period}
                        onChange={setPeriod}
                    />

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder="Buscar produto..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-[180px] sm:w-[220px] pl-9 pr-8 bg-background/50 backdrop-blur-sm border-border/50 hover:bg-accent/50 transition-colors"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {error && (
                <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erro na conexão</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* KPI Cards */}
            {!loading && products.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card className="border border-border/40 hover:border-border/60 transition-colors duration-300 bg-card/30 backdrop-blur-sm shadow-none rounded-lg">
                        <CardContent className="p-5">
                            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Produtos Diferentes</p>
                            <p className="text-2xl font-bold tracking-tight text-foreground mt-1">{filteredProducts.length}</p>
                        </CardContent>
                    </Card>
                    <Card className="border border-border/40 hover:border-border/60 transition-colors duration-300 bg-card/30 backdrop-blur-sm shadow-none rounded-lg">
                        <CardContent className="p-5">
                            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Total Unidades Vendidas</p>
                            <p className="text-2xl font-bold tracking-tight text-foreground mt-1">
                                {filteredProducts.reduce((sum, p) => sum + (p.totalSold || 0), 0).toLocaleString("pt-BR")}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="border border-border/40 hover:border-border/60 transition-colors duration-300 bg-card/30 backdrop-blur-sm shadow-none rounded-lg">
                        <CardContent className="p-5">
                            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Receita Total</p>
                            <p className="text-2xl font-bold tracking-tight text-foreground mt-1">
                                {formatCurrency(
                                    searchTerm
                                        ? filteredProducts.reduce((sum, p) => sum + getProductRevenue(p), 0)
                                        : revenueTotal,
                                    "BRL"
                                )}
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {loading ? (
                viewMode === "grid" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <Card key={i} className="border-border/40 bg-card/30 overflow-hidden h-[380px]">
                                <div className="animate-pulse h-full w-full bg-muted/10"></div>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <Card className="border-border/40 bg-card/30 overflow-hidden">
                        <div className="animate-pulse h-80 w-full bg-muted/10"></div>
                    </Card>
                )
            ) : (
                <>
                    {filteredProducts.length > 0 ? (
                        viewMode === "grid" ? (
                            /* Grid View */
                            <motion.div
                                variants={container}
                                initial="hidden"
                                animate="show"
                                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
                            >
                                {sortedProducts.map((product, index) => (
                                    <motion.div key={product.id} variants={item}>
                                        <Card className="overflow-hidden bg-gradient-to-b from-card/50 to-card/30 border-white/5 transition-all duration-300 h-full flex flex-col backdrop-blur-sm">
                                            {/* Image Container */}
                                            <div className="relative aspect-[4/5] overflow-hidden bg-muted/20">
                                                {product.imageUrl ? (
                                                    <Image
                                                        src={product.imageUrl}
                                                        alt={product.title}
                                                        fill
                                                        unoptimized
                                                        className="object-cover"
                                                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center bg-muted/30 text-muted-foreground gap-2">
                                                        <Package className="w-10 h-10 opacity-20" />
                                                        <span className="text-xs">Sem Imagem</span>
                                                    </div>
                                                )}

                                                {/* Rank Badge */}
                                                <div className="absolute top-3 left-3 z-10">
                                                    <Badge className={`${index < 3 ? 'bg-primary text-primary-foreground' : 'bg-black/60 text-white border-white/10'} backdrop-blur-md px-2.5 py-1 shadow-lg`}>
                                                        #{index + 1}
                                                    </Badge>
                                                </div>
                                            </div>

                                            <CardContent className="p-5 flex-1 flex flex-col justify-between gap-4">
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between items-start gap-2">
                                                        <h3 className="font-medium leading-snug line-clamp-2 text-foreground/90 min-h-[2.75rem]" title={product.title}>
                                                            {product.title}
                                                        </h3>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{product.vendor}</p>
                                                </div>

                                                <div className="flex items-end justify-between border-t border-border/40 pt-4 mt-2">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-muted-foreground uppercase opacity-70">Receita</span>
                                                        <span className="text-lg font-bold text-foreground">
                                                            {formatCurrency(getProductRevenue(product), product.currency)}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[10px] text-muted-foreground uppercase opacity-70">Vendas</span>
                                                        <div className="flex items-center gap-1.5 text-emerald-500 font-medium">
                                                            <TrendingUp className="w-3.5 h-3.5" />
                                                            <span>{product.totalSold || "-"}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                ))}
                            </motion.div>
                        ) : (
                            /* List View */
                            <Card className="overflow-hidden border-border/40 bg-card/30 backdrop-blur-sm">
                                {/* Mobile scroll hint */}
                                <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground border-b border-border/30 sm:hidden">
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 opacity-60">
                                        <path d="M2 8h12M10 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    Arraste para o lado para ver mais colunas
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[640px]">
                                        <thead>
                                            <tr className="border-b border-border/40 text-xs text-muted-foreground uppercase tracking-wider">
                                                <th className="text-left px-4 py-3 font-medium w-12">#</th>
                                                <th className="text-left px-4 py-3 font-medium w-16">Imagem</th>
                                                <th className="text-left px-4 py-3 font-medium">Nome</th>
                                                <th className="text-right px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("totalSold")}>
                                                    <span className="inline-flex items-center justify-end">Qtd Vendida <SortIcon field="totalSold" /></span>
                                                </th>
                                                <th className="text-right px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("revenue")}>
                                                    <span className="inline-flex items-center justify-end">Receita <SortIcon field="revenue" /></span>
                                                </th>
                                                <th className="text-right px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort("ticket")}>
                                                    <span className="inline-flex items-center justify-end">Ticket Médio <SortIcon field="ticket" /></span>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedProducts.map((product, index) => {
                                                const sold = product.totalSold || 0;
                                                const revenue = getProductRevenue(product);
                                                const ticket = getProductTicket(product);
                                                return (
                                                    <tr key={product.id} className="border-b border-border/20 hover:bg-accent/30 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <Badge className={`${index < 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'} text-xs`}>
                                                                {index + 1}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-muted/20 flex-shrink-0">
                                                                {product.imageUrl ? (
                                                                    <Image
                                                                        src={product.imageUrl}
                                                                        alt={product.title}
                                                                        fill
                                                                        unoptimized
                                                                        className="object-cover"
                                                                        sizes="40px"
                                                                    />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center">
                                                                        <Package className="w-4 h-4 opacity-30" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div>
                                                                <p className="font-medium text-sm text-foreground/90 line-clamp-1">{product.title}</p>
                                                                <p className="text-xs text-muted-foreground">{product.vendor}</p>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <span className="font-medium text-sm">{sold.toLocaleString("pt-BR")}</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <span className="font-medium text-sm">{formatCurrency(revenue, product.currency)}</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <span className="font-medium text-sm text-muted-foreground">{formatCurrency(ticket, product.currency)}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        )
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border/30 rounded-xl bg-muted/5 animate-in fade-in zoom-in duration-500">
                            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
                                <ShoppingBag className="w-10 h-10 text-muted-foreground/50" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">Nenhum produto encontrado</h3>
                            <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                                {searchTerm
                                    ? `Nenhum produto encontrado para "${search.trim()}".`
                                    : "Não encontramos produtos vendidos no período selecionado."}
                            </p>
                            {searchTerm && (
                                <Button variant="outline" onClick={() => setSearch("")}>
                                    Limpar Busca
                                </Button>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
