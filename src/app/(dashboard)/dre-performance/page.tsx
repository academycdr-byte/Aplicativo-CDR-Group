"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import {
  calculateDRE,
  calculateROASSensitivity,
  calculateRevenueMatrix,
  calculateRecompra,
  formatBRL,
  formatPct,
  DEFAULT_INPUTS,
  DEFAULT_BUDGET_LEVELS,
  DEFAULT_ROAS_LEVELS,
  SENSITIVITY_ROAS_LEVELS,
  type DREInputs,
} from "@/lib/dre-calculator";
import { DREInputPanel } from "@/components/dre/dre-input-panel";
import { DREWaterfallChart } from "@/components/dre/dre-waterfall-chart";
import { ROASSensitivityChart } from "@/components/dre/roas-sensitivity-chart";
import { RevenueHeatmap } from "@/components/dre/revenue-heatmap";
import { RecompraCard } from "@/components/dre/recompra-card";

const STORAGE_KEY = "cdr-dre-calculator-inputs";
const RECOMPRA_KEY = "cdr-dre-recompra";

function KPICard({
  title,
  value,
  valueClass,
  subText,
  className,
}: {
  title: string;
  value: string;
  valueClass?: string;
  subText?: string;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "border border-border/40 hover:border-border/60 shadow-none rounded-lg p-3 sm:p-5 transition-colors duration-300",
        className
      )}
    >
      <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-medium text-muted-foreground leading-tight">
        {title}
      </span>
      <div className={cn("text-lg sm:text-2xl font-bold tracking-tight mt-1", valueClass)}>
        {value}
      </div>
      {subText && (
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">{subText}</p>
      )}
    </Card>
  );
}

export default function DREPerformancePage() {
  // Inputs state
  const [inputs, setInputs] = useState<DREInputs>(DEFAULT_INPUTS);
  const [recompraD60, setRecompraD60] = useState(1);
  const [recompraD90, setRecompraD90] = useState(1);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const savedInputs = localStorage.getItem(STORAGE_KEY);
      if (savedInputs) {
        const parsed = JSON.parse(savedInputs);
        setInputs({ ...DEFAULT_INPUTS, ...parsed });
      }
      const savedRecompra = localStorage.getItem(RECOMPRA_KEY);
      if (savedRecompra) {
        const parsed = JSON.parse(savedRecompra);
        if (parsed.d60 !== undefined) setRecompraD60(parsed.d60);
        if (parsed.d90 !== undefined) setRecompraD90(parsed.d90);
      }
    } catch {
      // Ignore parse errors
    }
    setLoaded(true);
  }, []);

  // Save to localStorage (debounced)
  useEffect(() => {
    if (!loaded) return;
    const timeout = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
      localStorage.setItem(RECOMPRA_KEY, JSON.stringify({ d60: recompraD60, d90: recompraD90 }));
    }, 500);
    return () => clearTimeout(timeout);
  }, [inputs, recompraD60, recompraD90, loaded]);

  // Handlers
  const handleInputChange = useCallback((field: keyof DREInputs, value: number) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleReset = useCallback(() => {
    setInputs(DEFAULT_INPUTS);
    setRecompraD60(1);
    setRecompraD90(1);
  }, []);

  // Calculations (memoized)
  const metrics = useMemo(() => calculateDRE(inputs), [inputs]);

  const sensitivityData = useMemo(
    () => calculateROASSensitivity(inputs, SENSITIVITY_ROAS_LEVELS),
    [inputs]
  );

  const revenueMatrix = useMemo(
    () => calculateRevenueMatrix(inputs, DEFAULT_ROAS_LEVELS, DEFAULT_BUDGET_LEVELS),
    [inputs]
  );

  const recompraResult = useMemo(
    () => calculateRecompra(inputs, recompraD60, recompraD90),
    [inputs, recompraD60, recompraD90]
  );

  // Derived insight for hero
  const isHealthy = metrics.mcPct >= 10;
  const isWarning = metrics.mcPct >= 0 && metrics.mcPct < 10;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Simulador de Rentabilidade</h2>
        <p className="text-muted-foreground mt-1 text-[15px]">
          Descubra sua margem real, o ROAS mínimo para lucrar e simule diferentes cenários de investimento.
        </p>
      </div>

      {/* Input Panel */}
      <DREInputPanel inputs={inputs} onChange={handleInputChange} onReset={handleReset} />

      {/* Hero Insight Banner - Apple HIG Alert Style */}
      <Card className={cn(
        "border border-border/40 hover:border-border/60 shadow-none rounded-lg p-4 sm:p-5 backdrop-blur-sm transition-colors duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
        isHealthy
          ? "border-emerald-500/20 bg-emerald-500/[0.04]"
          : isWarning
            ? "border-amber-500/20 bg-amber-500/[0.04]"
            : "border-red-500/20 bg-red-500/[0.04]"
      )}>
        <div className="flex items-start gap-3">
          <div className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5",
            isHealthy
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : isWarning
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "bg-red-500/15 text-red-600 dark:text-red-400"
          )}>
            {isHealthy ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-sm font-semibold",
              isHealthy
                ? "text-emerald-700 dark:text-emerald-300"
                : isWarning
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-red-700 dark:text-red-300"
            )}>
              {isHealthy
                ? "Operação saudável"
                : isWarning
                  ? "Margem apertada — atenção"
                  : "Operação no prejuízo"}
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {isHealthy
                ? `Cada venda gera ${formatBRL(metrics.margemContribUnit)} de lucro líquido. Seu ROAS atual (${metrics.roasRealizado.toFixed(1)}x) está acima do mínimo necessário (${metrics.breakevenRoas.toFixed(1)}x).`
                : isWarning
                  ? `Sua margem por venda é de apenas ${formatBRL(metrics.margemContribUnit)}. Qualquer aumento no CPA ou queda no ROAS pode levar a prejuízo. ROAS mínimo: ${metrics.breakevenRoas.toFixed(1)}x.`
                  : `Você está perdendo ${formatBRL(Math.abs(metrics.margemContribUnit))} por venda. Reduza custos ou aumente o ticket médio para voltar ao lucro. ROAS mínimo necessário: ${metrics.breakevenRoas.toFixed(1)}x.`}
            </p>
          </div>
          <div className="text-right shrink-0 hidden sm:block">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Lucro por venda</p>
            <p className={cn(
              "text-xl font-bold",
              metrics.margemContribUnit >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            )}>
              {formatBRL(metrics.margemContribUnit)}
            </p>
          </div>
        </div>
      </Card>

      {/* KPI Grid - Unified */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <KPICard
          title="Lucro Bruto Mensal"
          value={formatBRL(metrics.lucroBruto, true)}
          className={
            metrics.lucroBruto >= 0
              ? "border-emerald-500/20 bg-emerald-500/5"
              : "border-red-500/20 bg-red-500/5"
          }
          valueClass={
            metrics.lucroBruto >= 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
          }
          subText={`${metrics.pedidosAprovadosCount} pedidos aprovados`}
        />
        <KPICard
          title="Margem Bruta"
          value={formatPct(metrics.margemBrutaPct)}
          valueClass={metrics.margemBrutaPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600"}
          subText={`${formatBRL(metrics.margemBrutaUnit)} / venda`}
        />
        <KPICard
          title="Margem de Contribuição"
          value={formatPct(metrics.mcPct)}
          valueClass={metrics.mcPct >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600"}
          subText={`${formatBRL(metrics.margemContribUnit)} / venda`}
        />
        <KPICard
          title="ROAS Mínimo"
          value={`${metrics.breakevenRoas.toFixed(2)}x`}
          subText="Breakeven da operação"
        />
        <KPICard
          title="ROAS Realizado"
          value={`${metrics.roasRealizado.toFixed(2)}x`}
          subText={`Ticket ${formatBRL(metrics.ticketMedio)} | Markup ${metrics.markup.toFixed(1)}x`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <DREWaterfallChart metrics={metrics} />
        <ROASSensitivityChart
          data={sensitivityData}
          breakevenRoas={metrics.breakevenRoas}
          currentRoas={metrics.roasRealizado}
        />
      </div>

      {/* Revenue Heatmap */}
      <RevenueHeatmap
        matrix={revenueMatrix}
        roasLevels={DEFAULT_ROAS_LEVELS}
        budgetLevels={DEFAULT_BUDGET_LEVELS}
        breakevenRoas={metrics.breakevenRoas}
      />

      {/* Recompra Impact */}
      <RecompraCard
        recompraD60={recompraD60}
        recompraD90={recompraD90}
        onD60Change={setRecompraD60}
        onD90Change={setRecompraD90}
        result={recompraResult}
        dreMetrics={metrics}
        budgetAnuncios={metrics.budgetEfetivo}
      />
    </div>
  );
}
