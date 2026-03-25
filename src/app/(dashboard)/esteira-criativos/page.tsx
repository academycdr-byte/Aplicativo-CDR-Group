"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
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
  Trophy,
  FlaskConical,
  Recycle,
  XCircle,
  PauseCircle,
  RefreshCw,
  Settings2,
  ImageIcon,
  Loader2,
  Save,
  ArrowRight,
  Clock,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import {
  getCreativePipeline,
  getBenchmarkConfig,
  saveBenchmarkConfig,
  runClassification,
  getCreativeAdId,
  updateCreativeStatus,
} from "@/actions/creative-pipeline";
import { VideoModal } from "@/components/ads/video-modal";
import type { CreativeStatus } from "@prisma/client";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";

// ─── STATUS CONFIG ────────────────────────────────

const STATUS_CONFIG: Record<
  CreativeStatus,
  {
    label: string;
    icon: typeof Trophy;
    color: string;
    bg: string;
    border: string;
    headerBg: string;
    dot: string;
  }
> = {
  CAMPEOES_ATIVOS: {
    label: "Campeões Ativos",
    icon: Trophy,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/30",
    headerBg: "bg-amber-400/8",
    dot: "bg-amber-400",
  },
  EM_TESTE: {
    label: "Em Teste",
    icon: FlaskConical,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/30",
    headerBg: "bg-blue-400/8",
    dot: "bg-blue-400",
  },
  RECICLAGEM: {
    label: "Reciclagem",
    icon: Recycle,
    color: "text-orange-400",
    bg: "bg-orange-400/10",
    border: "border-orange-400/30",
    headerBg: "bg-orange-400/8",
    dot: "bg-orange-400",
  },
  CAMPEOES_INATIVOS: {
    label: "Campeões Inativos",
    icon: PauseCircle,
    color: "text-purple-400",
    bg: "bg-purple-400/10",
    border: "border-purple-400/30",
    headerBg: "bg-purple-400/8",
    dot: "bg-purple-400",
  },
  DESATIVADOS: {
    label: "Desativados",
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-400/10",
    border: "border-red-400/30",
    headerBg: "bg-red-400/8",
    dot: "bg-red-400",
  },
};

const KANBAN_ORDER: CreativeStatus[] = [
  "CAMPEOES_ATIVOS",
  "EM_TESTE",
  "RECICLAGEM",
  "CAMPEOES_INATIVOS",
  "DESATIVADOS",
];

// ─── FORMATTERS ───────────────────────────────────

function fmt(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

function fmtNum(n: number) {
  return new Intl.NumberFormat("pt-BR").format(n);
}

function timeAgo(date: Date) {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "agora";
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  return `${days}d atrás`;
}

// ─── TYPES ────────────────────────────────────────

type ClassifiedCreative = {
  id: string;
  creativeName: string;
  status: CreativeStatus;
  previousStatus: CreativeStatus | null;
  roas: number;
  purchases: number;
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
  thumbnailUrl: string | null;
  lastClassifiedAt: Date;
};

type PipelineData = Awaited<ReturnType<typeof getCreativePipeline>>;
type BenchmarkData = Awaited<ReturnType<typeof getBenchmarkConfig>>;

// ─── CREATIVE CARD (static, used for DragOverlay) ─

function CreativeCardContent({
  creative,
  benchmark,
  isDragging,
}: {
  creative: ClassifiedCreative;
  benchmark: BenchmarkData;
  isDragging?: boolean;
}) {
  const sc = STATUS_CONFIG[creative.status];
  const ctr =
    creative.impressions > 0
      ? (creative.clicks / creative.impressions) * 100
      : 0;

  const roasIdeal = benchmark?.roasIdeal ?? 2.5;
  const roasBreakeven = benchmark?.roasBreakeven ?? 1.5;

  const borderColor =
    creative.roas >= roasIdeal
      ? "border-l-emerald-500"
      : creative.roas >= roasBreakeven
      ? "border-l-amber-500"
      : "border-l-red-500";

  return (
    <Card
      className={`group overflow-hidden transition-colors duration-300 border border-border/40 hover:border-border/60 shadow-none rounded-xl border-l-4 cursor-pointer ${borderColor} ${isDragging ? "shadow-xl ring-2 ring-primary/40 rotate-2 scale-105" : ""}`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-muted flex items-center justify-center overflow-hidden">
        {creative.thumbnailUrl ? (
          <Image
            src={creative.thumbnailUrl}
            alt={creative.creativeName}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, 280px"
            unoptimized
          />
        ) : (
          <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
        )}

        {/* Drag handle indicator */}
        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-black/50 backdrop-blur-sm rounded p-0.5">
            <GripVertical className="w-3.5 h-3.5 text-white" />
          </div>
        </div>

        {/* Status badge on thumbnail */}
        <div className="absolute top-2 right-2">
          <Badge
            variant="secondary"
            className={`backdrop-blur-md border-none text-[10px] h-5 gap-1 ${sc.bg} ${sc.color}`}
          >
            <sc.icon className="w-3 h-3" />
            {sc.label}
          </Badge>
        </div>

        {/* Previous status transition */}
        {creative.previousStatus &&
          creative.previousStatus !== creative.status && (
            <div className="absolute bottom-2 left-2">
              <Badge
                variant="secondary"
                className="backdrop-blur-md bg-black/40 text-white border-none text-[9px] h-4 gap-1"
              >
                {STATUS_CONFIG[creative.previousStatus].label}
                <ArrowRight className="w-2.5 h-2.5" />
                {sc.label}
              </Badge>
            </div>
          )}
      </div>

      <CardContent className="p-3 space-y-2.5">
        {/* Name */}
        <div className="min-w-0">
          <p
            className="font-semibold text-sm truncate"
            title={creative.creativeName}
          >
            {creative.creativeName}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3 text-muted-foreground/50" />
            <span className="text-[10px] text-muted-foreground">
              {timeAgo(creative.lastClassifiedAt)}
            </span>
          </div>
        </div>

        {/* Primary Metrics: Gasto + ROAS */}
        <div className="flex items-end justify-between border-b border-border/50 pb-2">
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase">Gasto</p>
            <p className="font-semibold text-sm truncate">{fmt(creative.spend)}</p>
          </div>
          <div className="text-right shrink-0 ml-2">
            <p className="text-[10px] text-muted-foreground uppercase">ROAS</p>
            <p
              className={`font-bold text-lg ${
                creative.roas >= roasIdeal
                  ? "text-emerald-500"
                  : creative.roas >= roasBreakeven
                  ? "text-amber-500"
                  : "text-red-500"
              }`}
            >
              {creative.roas.toFixed(2)}x
            </p>
          </div>
        </div>

        {/* Secondary Metrics Grid */}
        <div className="grid grid-cols-3 gap-y-1.5 text-xs">
          <div className="min-w-0">
            <p className="text-muted-foreground">Impr.</p>
            <p className="font-medium truncate">{fmtNum(creative.impressions)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground">Cliques</p>
            <p className="font-medium truncate">{fmtNum(creative.clicks)}</p>
          </div>
          <div className="text-right min-w-0">
            <p className="text-muted-foreground">CTR</p>
            <p className="font-medium">{ctr.toFixed(2)}%</p>
          </div>

          <div className="col-span-3 pt-1.5 flex justify-between border-t border-border/50 mt-1">
            <span className="text-muted-foreground text-[11px]">
              Receita:{" "}
              <span className="text-foreground font-medium">
                {fmt(creative.revenue)}
              </span>
            </span>
            <span className="text-muted-foreground text-[11px]">
              Compras:{" "}
              <span className="text-foreground font-medium">
                {creative.purchases}
              </span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── DRAGGABLE CREATIVE CARD ─────────────────────

function DraggableCreativeCard({
  creative,
  benchmark,
  onClick,
}: {
  creative: ClassifiedCreative;
  benchmark: BenchmarkData;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: creative.id,
    data: { creative },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      style={{ opacity: isDragging ? 0.3 : 1 }}
    >
      <CreativeCardContent creative={creative} benchmark={benchmark} />
    </div>
  );
}

// ─── DROPPABLE KANBAN COLUMN ─────────────────────

function KanbanColumn({
  status,
  creatives,
  benchmark,
  onCreativeClick,
}: {
  status: CreativeStatus;
  creatives: ClassifiedCreative[];
  benchmark: BenchmarkData;
  onCreativeClick?: (creative: ClassifiedCreative) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `column-${status}`,
    data: { status },
  });
  const sc = STATUS_CONFIG[status];
  const Icon = sc.icon;

  return (
    <div className="flex flex-col min-w-[300px] max-w-[320px] flex-shrink-0">
      {/* Column Header */}
      <div
        className={`flex items-center gap-2 px-3 py-2.5 rounded-t-xl ${sc.headerBg} border ${sc.border} border-b-0`}
      >
        <div className={`w-2 h-2 rounded-full ${sc.dot}`} />
        <Icon className={`w-4 h-4 ${sc.color}`} />
        <span className="text-sm font-semibold flex-1">{sc.label}</span>
        <Badge
          variant="outline"
          className={`${sc.border} ${sc.color} text-[11px] h-5 font-mono`}
        >
          {creatives.length}
        </Badge>
      </div>

      {/* Cards Container (droppable) */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto space-y-3 p-3 border ${sc.border} border-t-0 rounded-b-xl min-h-[200px] max-h-[calc(100vh-260px)] transition-colors duration-200 ${
          isOver
            ? `${sc.bg} ring-2 ${sc.border}`
            : "bg-card/30"
        }`}
      >
        {creatives.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center opacity-50">
            <Icon className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">
              {isOver ? "Solte aqui" : "Nenhum criativo"}
            </p>
          </div>
        ) : (
          creatives.map((creative) => (
            <DraggableCreativeCard
              key={creative.id}
              creative={creative}
              benchmark={benchmark}
              onClick={() => onCreativeClick?.(creative)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────

export default function EsteiraPage() {
  const [data, setData] = useState<PipelineData>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkData>(null);
  const [loading, setLoading] = useState(true);
  const [classifying, setClassifying] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedCreative, setSelectedCreative] = useState<any>(null);
  const [loadingCreative, setLoadingCreative] = useState(false);

  // Drag state
  const [activeDragCreative, setActiveDragCreative] = useState<ClassifiedCreative | null>(null);

  // Require 8px movement to start drag (so clicks still work)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

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
    const initPage = async () => {
      await loadData();
      // Auto-classificar ao entrar na página
      setClassifying(true);
      try {
        const result = await runClassification();
        if (result.success) {
          await loadData();
        }
      } catch {
        // Silencioso — dados existentes já foram carregados acima
      } finally {
        setClassifying(false);
      }
    };
    initPage();
  }, [loadData]);

  const handleClassify = async () => {
    setClassifying(true);
    try {
      const result = await runClassification();
      if (result.success) {
        toast.success(
          `Classificação concluída: ${result.classified} criativos analisados`
        );
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

  const handleCreativeClick = async (creative: ClassifiedCreative) => {
    setLoadingCreative(true);
    try {
      const adInfo = await getCreativeAdId(creative.creativeName);
      if (!adInfo) {
        toast.error("Não foi possível encontrar o anúncio correspondente");
        return;
      }
      const ctr = creative.impressions > 0 ? (creative.clicks / creative.impressions) * 100 : 0;
      const cpc = creative.clicks > 0 ? creative.spend / creative.clicks : 0;
      const cpm = creative.impressions > 0 ? (creative.spend / creative.impressions) * 1000 : 0;

      setSelectedCreative({
        adId: adInfo.adId,
        adName: creative.creativeName,
        platform: "FACEBOOK_ADS",
        thumbnailUrl: creative.thumbnailUrl,
        videoUrl: null,
        impressions: creative.impressions,
        clicks: creative.clicks,
        spend: creative.spend,
        conversions: creative.purchases,
        revenue: creative.revenue,
        ctr,
        roas: creative.roas,
        cpc,
        cpm,
        campaignName: adInfo.campaignName,
      });
      setIsModalOpen(true);
    } catch {
      toast.error("Erro ao carregar criativo");
    } finally {
      setLoadingCreative(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const creative = event.active.data.current?.creative as ClassifiedCreative;
    setActiveDragCreative(creative ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragCreative(null);

    const { active, over } = event;
    if (!over) return;

    const creative = active.data.current?.creative as ClassifiedCreative;
    const targetStatus = over.data.current?.status as CreativeStatus;

    if (!creative || !targetStatus || creative.status === targetStatus) return;

    // Optimistic update
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        creatives: prev.creatives.map((c) =>
          c.id === creative.id
            ? { ...c, previousStatus: c.status, status: targetStatus }
            : c
        ),
      };
    });

    const result = await updateCreativeStatus(creative.id, targetStatus);
    if (result.success) {
      toast.success(
        `"${creative.creativeName}" movido para ${STATUS_CONFIG[targetStatus].label}`
      );
    } else {
      toast.error(result.error || "Erro ao mover criativo");
      await loadData(); // Revert on error
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

  // Group creatives by status for Kanban
  const creativesByStatus = useMemo(() => {
    const groups: Record<CreativeStatus, ClassifiedCreative[]> = {
      CAMPEOES_ATIVOS: [],
      EM_TESTE: [],
      RECICLAGEM: [],
      CAMPEOES_INATIVOS: [],
      DESATIVADOS: [],
    };

    if (!data?.creatives) return groups;

    const query = searchQuery.toLowerCase().trim();

    for (const c of data.creatives) {
      if (query && !c.creativeName.toLowerCase().includes(query)) continue;
      groups[c.status].push(c);
    }

    // Sort each group by revenue desc
    for (const status of KANBAN_ORDER) {
      groups[status].sort((a, b) => b.revenue - a.revenue);
    }

    return groups;
  }, [data, searchQuery]);

  const totalCreatives = data?.summary.total ?? 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Esteira de Criativos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalCreatives > 0
              ? `${totalCreatives} criativos classificados`
              : "Classificação automática por performance"}
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
          <Button size="sm" onClick={handleClassify} disabled={classifying}>
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
              <Button
                size="sm"
                onClick={handleSaveConfig}
                disabled={savingConfig}
              >
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

      {/* Summary Row */}
      {totalCreatives > 0 && (
        <div className="flex items-center gap-4 overflow-x-auto pb-1">
          {KANBAN_ORDER.map((status) => {
            const sc = STATUS_CONFIG[status];
            const count = data?.summary.byStatus[status] ?? 0;
            const pct =
              totalCreatives > 0
                ? Math.round((count / totalCreatives) * 100)
                : 0;
            return (
              <div
                key={status}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${sc.bg} ${sc.border} border shrink-0`}
              >
                <div className={`w-2 h-2 rounded-full ${sc.dot}`} />
                <span className={`text-xs font-medium ${sc.color}`}>
                  {count} {sc.label}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Search */}
      {totalCreatives > 0 && (
        <Input
          placeholder="Buscar criativo por nome..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      )}

      {/* Empty State */}
      {totalCreatives === 0 && (
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

      {/* Kanban Board with Drag & Drop */}
      {totalCreatives > 0 && (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
            {KANBAN_ORDER.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                creatives={creativesByStatus[status]}
                benchmark={benchmark}
                onCreativeClick={handleCreativeClick}
              />
            ))}
          </div>

          {/* Drag Overlay — ghost card that follows cursor */}
          <DragOverlay dropAnimation={null}>
            {activeDragCreative ? (
              <div className="w-[300px]">
                <CreativeCardContent
                  creative={activeDragCreative}
                  benchmark={benchmark}
                  isDragging
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Benchmark Info Footer */}
      {benchmark && totalCreatives > 0 && (
        <div className="text-xs text-muted-foreground text-center pb-4">
          Benchmarks: ROAS Breakeven {benchmark.roasBreakeven}x | ROAS Ideal{" "}
          {benchmark.roasIdeal}x | Min. Compras {benchmark.minPurchases} |
          Período {benchmark.lookbackDays} dias
          {benchmark.isDefault && " (padrão)"}
        </div>
      )}

      {/* Loading overlay for creative click */}
      {loadingCreative && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="bg-card rounded-xl p-6 flex items-center gap-3 shadow-lg">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm">Carregando criativo...</span>
          </div>
        </div>
      )}

      {/* Creative Detail Modal */}
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
