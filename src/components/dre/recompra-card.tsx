"use client";

import { memo } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { RefreshCw } from "lucide-react";
import { formatBRL, formatPct, type RecompraResult, type DREResult } from "@/lib/dre-calculator";

type RecompraCardProps = {
  recompraD60: number;
  recompraD90: number;
  onD60Change: (value: number) => void;
  onD90Change: (value: number) => void;
  result: RecompraResult;
  dreMetrics: DREResult;
  budgetAnuncios: number;
};

export const RecompraCard = memo(function RecompraCard({
  recompraD60,
  recompraD90,
  onD60Change,
  onD90Change,
  result,
  dreMetrics,
  budgetAnuncios,
}: RecompraCardProps) {
  return (
    <Card className="border border-border shadow-sm rounded-lg p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-violet-500/10">
          <RefreshCw className="w-4 h-4 text-violet-500" />
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-semibold">Impacto da Recompra</h3>
          <p className="text-xs text-muted-foreground">
            Simule quanto lucro extra você ganha quando clientes compram de novo — sem custo de aquisição
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">Recompra em 60 dias</Label>
              <span className="text-sm font-bold text-violet-500">{recompraD60}%</span>
            </div>
            <Slider
              value={[recompraD60]}
              onValueChange={([v]) => onD60Change(v)}
              min={0}
              max={50}
              step={0.5}
              className="w-full"
              aria-label="Percentual de clientes que recompram em 60 dias"
            />
            <p className="text-[10px] text-muted-foreground/60">
              % dos clientes que voltam a comprar dentro de 60 dias
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">Recompra em 90 dias</Label>
              <span className="text-sm font-bold text-violet-500">{recompraD90}%</span>
            </div>
            <Slider
              value={[recompraD90]}
              onValueChange={([v]) => onD90Change(v)}
              min={0}
              max={50}
              step={0.5}
              className="w-full"
              aria-label="Percentual de clientes que recompram em 90 dias"
            />
            <p className="text-[10px] text-muted-foreground/60">
              % dos clientes que voltam a comprar dentro de 90 dias
            </p>
          </div>
        </div>

        <Separator />

        {/* Breakdown */}
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">
            Resultado com Recompra
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Investimento */}
            <div className="p-3 rounded-lg border border-border bg-muted/30 text-center">
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Investimento</p>
              <p className="text-sm sm:text-base font-bold">{formatBRL(budgetAnuncios, true)}</p>
            </div>

            {/* Receita Original */}
            <div className="p-3 rounded-lg border border-border bg-muted/30 text-center">
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">1ª Compra</p>
              <p className="text-sm sm:text-base font-bold">{formatBRL(dreMetrics.ticketMedio * dreMetrics.pedidosEfetivos, true)}</p>
              <p className="text-[10px] text-muted-foreground/60">Margem: {formatBRL(dreMetrics.lucroBruto, true)}</p>
            </div>

            {/* Recompra D+60 */}
            <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-center">
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Recompra 60d</p>
              <p className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
                {formatBRL(result.receitaD60, true)}
              </p>
              <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">
                +{formatBRL(result.margemD60, true)} margem
              </p>
            </div>

            {/* Recompra D+90 */}
            <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-center">
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Recompra 90d</p>
              <p className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
                {formatBRL(result.receitaD90, true)}
              </p>
              <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">
                +{formatBRL(result.margemD90, true)} margem
              </p>
            </div>
          </div>

          {/* Total */}
          <div className="p-4 rounded-lg border-2 border-primary/20 bg-primary/5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Margem Total</p>
                <p className="text-lg sm:text-xl font-bold text-primary">
                  {formatBRL(result.margemTotalComRecompra, true)}
                </p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Margem Final %</p>
                <p className="text-lg sm:text-xl font-bold text-primary">
                  {formatPct(result.margemTotalPct)}
                </p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Receita Extra</p>
                <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  +{formatBRL(result.receitaAdicional, true)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
});
