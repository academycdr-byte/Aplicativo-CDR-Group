
"use client";

import { useState, useEffect } from "react";
import { type Product, type Collection } from "@/lib/ecommerce-service";
import { getBestSellersAction, getCollectionsAction } from "@/actions/ecommerce";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShoppingBag, TrendingUp, Filter, AlertCircle, ExternalLink, Package } from "lucide-react";
import Image from "next/image";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PeriodSelector, periodToParams, type PeriodValue } from "@/components/period-selector";
import { motion } from "framer-motion";

export default function BestSellersPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [selectedCollection, setSelectedCollection] = useState<string>("all");
    const [period, setPeriod] = useState<PeriodValue>({ type: "preset", days: 30 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
                    // Calculate dates for preset periods
                    toDate = new Date();
                    fromDate = new Date();
                    fromDate.setDate(toDate.getDate() - period.days);

                    // Specific adjustment for "Today" (0 days) to be start of day
                    if (period.days === 0) {
                        fromDate.setHours(0, 0, 0, 0);
                    }
                }

                const [productsData, collectionsData] = await Promise.all([
                    getBestSellersAction(selectedCollection === "all" ? undefined : selectedCollection, fromDate, toDate),
                    getCollectionsAction()
                ]);

                setProducts(productsData);

                if (collections.length === 0 && collectionsData.length > 0) {
                    setCollections(collectionsData);
                }
            } catch (err) {
                console.error("Failed to fetch data:", err);
                setError("Não foi possível carregar os produtos. Verifique sua conexão com a loja ou tente novamente mais tarde.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedCollection, period]);

    const formatCurrency = (value: number, currency: string) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: currency,
        }).format(value);
    };

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
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
                    <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                        Mais Vendidos
                    </h2>
                    <p className="text-muted-foreground mt-2 max-w-2xl">
                        Acompanhe o desempenho dos seus produtos em tempo real. Identifique tendências e oportunidades de vendas.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <PeriodSelector
                        value={period}
                        onChange={setPeriod}
                    />

                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                        <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                            <SelectTrigger className="w-[220px] pl-9 bg-background/50 backdrop-blur-sm border-border/50 hover:bg-accent/50 transition-colors">
                                <SelectValue placeholder="Filtrar por Coleção" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas as Coleções</SelectItem>
                                {collections.map((col) => (
                                    <SelectItem key={col.id} value={col.id}>
                                        {col.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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

            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <Card key={i} className="border-border/40 bg-card/30 overflow-hidden h-[380px]">
                            <div className="animate-pulse h-full w-full bg-muted/10"></div>
                        </Card>
                    ))}
                </div>
            ) : (
                <>
                    {products.length > 0 ? (
                        <motion.div
                            variants={container}
                            initial="hidden"
                            animate="show"
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                        >
                            {products.map((product, index) => (
                                <motion.div key={product.id} variants={item}>
                                    <Card className="group overflow-hidden bg-gradient-to-b from-card/50 to-card/30 border-white/5 hover:border-primary/50 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5 h-full flex flex-col backdrop-blur-sm">
                                        {/* Image Container */}
                                        <div className="relative aspect-[4/5] overflow-hidden bg-muted/20">
                                            {product.imageUrl ? (
                                                <Image
                                                    src={product.imageUrl}
                                                    alt={product.title}
                                                    fill
                                                    className="object-cover transition-transform duration-700 group-hover:scale-105"
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

                                            {/* Overlay Actions */}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                                                <Button variant="secondary" size="sm" className="gap-2 font-medium bg-white/90 text-black hover:bg-white transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                                    <ExternalLink className="w-4 h-4" />
                                                    Ver na Loja
                                                </Button>
                                            </div>
                                        </div>

                                        <CardContent className="p-5 flex-1 flex flex-col justify-between gap-4">
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-start gap-2">
                                                    <h3 className="font-medium leading-snug line-clamp-2 text-foreground/90 group-hover:text-primary transition-colors min-h-[2.75rem]" title={product.title}>
                                                        {product.title}
                                                    </h3>
                                                </div>
                                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{product.vendor}</p>
                                            </div>

                                            <div className="flex items-end justify-between border-t border-border/40 pt-4 mt-2">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-muted-foreground uppercase opacity-70">Preço</span>
                                                    <span className="text-lg font-bold text-foreground">
                                                        {formatCurrency(product.price, product.currency)}
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
                        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border/50 rounded-xl bg-card/20 animate-in fade-in zoom-in duration-500">
                            <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mb-6">
                                <ShoppingBag className="w-8 h-8 text-muted-foreground/60" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Nenhum produto encontrado</h3>
                            <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                                Não encontramos produtos na sua loja correspondentes aos filtros selecionados.
                            </p>
                            <Button variant="outline" onClick={() => setSelectedCollection("all")}>
                                Limpar Filtros
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
