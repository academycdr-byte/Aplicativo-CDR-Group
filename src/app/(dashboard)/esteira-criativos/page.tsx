"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Trophy,
  FlaskConical,
  Recycle,
  XCircle,
  PauseCircle,
  RefreshCw,
  Settings2,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  ImageIcon,
  ArrowRight,
  Loader2,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import {
  getCreativePipeline,
  getBenchmarkConfig,
  saveBenchmarkConfig,
  runClassification,
} from "@/actions/creative-pipeline";
import type { CreativeStatus } from "@prisma/client";
import Image from "next/image";

// ─── STATUS CONFIG ────────────────────────────────

const STATUS_CONFIG: Record<
  CreativeStatus,
  { label: string; icon: typeof Trophy; color: string; bg: string; border: string }
> = {
  CAMPEOES_ATIVOS: {
    label: "Campeões Ativos",
    icon: Trophy,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/20",
  },
  EM_TESTE: {
    label: "Em Teste",
    icon: FlaskConical,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/20",
  },
  RECICLAGEM: {
    label: "Reciclagem",
    icon: Recycle,
    color: "text-orange-400",
    bg: "bg-orange-400/10",
    border: "border-orange-400/20",
  },
  DESATIVADOS: {
    label: "Desativados",
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-400/10",
    border: "border-red-400/20",
  },
  CAMPEOES_INATIVOS: {
    label: "Campeões Inativos",
    icon: PauseCircle,
    color: "text-purple-400",
    bg: "bg-purple-400/10",
    border: "border-purple-400/20",
  },
};

const STATUS_ORDER: CreativeStatus[] = [
  "CAMPEOES_ATIVOS",
  "EM_TESTE",
  "RECICLAGEM",
  "CAMPEOES_INATIVOS",
  "DESATIVADOS",
];

// ─── FORMATTERS ───────────────────────────────────

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function formatRoas(value: number) {
  return value.toFixed(2) + "x";
}

// ─── MAIN PAGE ────────────────────────────────────

type PipelineData = Awaited<ReturnType<typeof getCreativePipeline>>;
type BenchmarkData = Awaited<ReturnType<typeof getBenchmarkConfig>>;

export default function EsteiraPage() {
  const [data, setData] = useState<PipelineData>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkData>(null);
  const [loading, setLoading] = useState(true);
  const [classifying, setClassifying] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [activeFilter, setActiveFilter] = useState<CreativeStatus | "ALL">("ALL");
  const [transitions, setTransitions] = useState<
    { name: string; from: string | null; to: string }[]
  >([]);

  // Config form state
  const [configForm, setConfigForm] = useState({
    roasBreakeven: 1.5,
    roasIdeal: 2.5,
    minPurchases: 5,
    lookbackDays: 7,
  });

  const loadData = useCallback(async () => {
    const [pipelineData, benchmarkData] = await Promise.all([
      getCreativePipeline(),
      getBenchmarkConfig(),
    ]);
    setData(pipelineData);
    setBenchmark(benchmarkData);
    if (benchmarkData) {
      setConfigForm({
        roasBreakeven: benchmarkData.roasBreakeven,
        roasIdeal: benchmarkData.roasIdeal,
        minPurchases: benchmarkData.minPurchases,
        lookbackDays: benchmarkData.lookbackDays,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClassify = async () => {
    setClassifying(true);
    try {
      const result = await runClassification();
      if (result.success) {
        toast.success(
          `Classificação concluída: ${result.classified} criativos analisados`
        );
        if (result.transitions && result.transitions.length > 0) {
          setTransitions(
            result.transitions.map((t) => ({
              name: t.name,
              from: t.from ? STATUS_CONFIG[t.from].label : null,
              to: STATUS_CONFIG[t.to].label,
            }))
          );
        }
        await loadData();
      } else {
        toast.error(result.error || "Erro ao classificar");
      }
    } catch {
      toast.error("Erro ao executar classificação");
    } finally {
      setClassifying(false);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const result = await saveBenchmarkConfig(configForm);
      if (result.success) {
        toast.success("Benchmarks salvos com sucesso");
        setShowConfig(false);
        await loadData();
      } else {
        toast.error(result.error || "Erro ao salvar");
      }
    } catch {
      toast.error("Erro ao salvar configuração");
    } finally {
      setSavingConfig(false);
    }
  };

  const filteredCreatives =
    data?.creatives.filter(
      (c) => activeFilter === "ALL" || c.status === activeFilter
    ) ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Esteira de Criativos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Classificação automática de criativos por performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfig(!showConfig)}
          >
            <Settings2 className="w-4 h-4 mr-2" />
            Benchmarks
          </Button>
          <Button
            size="sm"
            onClick={handleClassify}
            disabled={classifying}
          >
            {classifying ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {classifying ? "Classificando..." : "Atualizar Esteira"}
          </Button>
        </div>
      </div>

      {/* Benchmark Config Panel */}
      {showConfig && (
        <Card className="border-primary/20">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Configurar Benchmarks</CardTitle>
            <CardDescription>
              Defina os limites de classificação para seus criativos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="roasBreakeven">ROAS Breakeven</Label>
                <Input
                  id="roasBreakeven"
                  type="number"
                  step="0.1"
                  min="0"
                  value={configForm.roasBreakeven}
                  onChange={(e) =>
                    setConfigForm((prev) => ({
                      ...prev,
                      roasBreakeven: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Abaixo disso = prejuízo
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="roasIdeal">ROAS Ideal</Label>
                <Input
                  id="roasIdeal"
                  type="number"
                  step="0.1"
                  min="0"
                  value={configForm.roasIdeal}
                  onChange={(e) =>
                    setConfigForm((prev) => ({
                      ...prev,
                      roasIdeal: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Acima disso = campeão
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="minPurchases">Compras Mínimas</Label>
                <Input
                  id="minPurchases"
                  type="number"
                  min="1"
                  value={configForm.minPurchases}
                  onChange={(e) =>
                    setConfigForm((prev) => ({
                      ...prev,
                      minPurchases: parseInt(e.target.value) || 1,
                    }))
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Mínimo para sair de &quot;Em teste&quot;
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lookbackDays">Período (dias)</Label>
                <Input
                  id="lookbackDays"
                  type="number"
                  min="1"
                  max="90"
                  value={configForm.lookbackDays}
                  onChange={(e) =>
                    setConfigForm((prev) => ({
                      ...prev,
                      lookbackDays: parseInt(e.target.value) || 7,
                    }))
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Janela de análise
                </p>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button size="sm" onClick={handleSaveConfig} disabled={savingConfig}>
                {savingConfig ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar Benchmarks
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STATUS_ORDER.map((status) => {
          const config = STATUS_CONFIG[status];
          const count = data?.summary.byStatus[status] ?? 0;
          const Icon = config.icon;
          const isActive = activeFilter === status;
          const pct =
            data && data.summary.total > 0
              ? Math.round((count / data.summary.total) * 100)
              : 0;

          return (
            <Card
              key={status}
              className={`cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
                isActive ? `ring-2 ring-offset-2 ring-offset-background ${config.border.replace("border", "ring")}` : ""
              } ${config.border} border`}
              onClick={() =>
                setActiveFilter(isActive ? "ALL" : status)
              }
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Icon className={`w-5 h-5 ${config.color}`} />
                  <span className="text-2xl font-bold">{count}</span>
                </div>
                <p className="text-xs font-medium text-muted-foreground">
                  {config.label}
                </p>
                <p className={`text-[11px] ${config.color} font-medium mt-0.5`}>
                  {pct}% do total
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Transitions Alert */}
      {transitions.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-sm font-semibold mb-2">Mudanças de Status</p>
            <div className="space-y-1">
              {transitions.map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="font-medium truncate max-w-[200px]">
                    {t.name}
                  </span>
                  <span className="text-muted-foreground">
                    {t.from ?? "Novo"}
                  </span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <span className="font-medium">{t.to}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {(!data || data.creatives.length === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FlaskConical className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Nenhum criativo classificado
            </h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Clique em &quot;Atualizar Esteira&quot; para classificar seus
              criativos com base nas métricas do Meta Ads.
            </p>
            <Button onClick={handleClassify} disabled={classifying}>
              {classifying ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Classificar Agora
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Creatives Table */}
      {filteredCreatives.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {activeFilter === "ALL"
                  ? "Todos os Criativos"
                  : STATUS_CONFIG[activeFilter].label}
              </CardTitle>
              <Badge variant="secondary" className="font-mono">
                {filteredCreatives.length} criativos
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[280px]">Criativo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">ROAS</TableHead>
                    <TableHead className="text-right">Compras</TableHead>
                    <TableHead className="text-right">Investimento</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCreatives.map((creative) => {
                    const sc = STATUS_CONFIG[creative.status];
                    const Icon = sc.icon;

                    return (
                      <TableRow key={creative.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                              {creative.thumbnailUrl ? (
                                <Image
                                  src={creative.thumbnailUrl}
                                  alt={creative.creativeName}
                                  fill
                                  className="object-cover"
                                  sizes="40px"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ImageIcon className="w-4 h-4 text-muted-foreground/40" />
                                </div>
                              )}
                            </div>
                            <span className="font-medium text-sm truncate max-w-[200px]">
                              {creative.creativeName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`${sc.bg} ${sc.border} ${sc.color} border gap-1`}
                          >
                            <Icon className="w-3 h-3" />
                            {sc.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className={`font-mono font-medium ${
                              creative.roas >= (benchmark?.roasIdeal ?? 2.5)
                                ? "text-emerald-400"
                                : creative.roas >= (benchmark?.roasBreakeven ?? 1.5)
                                ? "text-orange-400"
                                : "text-red-400"
                            }`}>
                              {formatRoas(creative.roas)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <ShoppingCart className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-mono">
                              {creative.purchases}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono text-sm text-muted-foreground">
                            {formatCurrency(creative.spend)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-400/60" />
                            <span className="font-mono font-medium">
                              {formatCurrency(creative.revenue)}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Benchmark Info */}
      {benchmark && (
        <div className="text-xs text-muted-foreground text-center">
          Benchmarks: ROAS Breakeven {benchmark.roasBreakeven}x | ROAS Ideal{" "}
          {benchmark.roasIdeal}x | Min. Compras {benchmark.minPurchases} |
          Período {benchmark.lookbackDays} dias
          {benchmark.isDefault && " (padrão)"}
        </div>
      )}
    </div>
  );
}
