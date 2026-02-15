"use client";

import { memo, useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { formatBRL, type RevenueMatrixCell } from "@/lib/dre-calculator";
import { cn } from "@/lib/utils";

type RevenueHeatmapProps = {
  matrix: RevenueMatrixCell[][];
  roasLevels: number[];
  budgetLevels: number[];
  breakevenRoas: number;
};

function getHeatmapColor(value: number, min: number, max: number, isDark: boolean): string {
  if (max === min) return "transparent";

  // Normalize to -1..1 range (0 = breakeven)
  let normalized: number;
  if (value >= 0) {
    normalized = max > 0 ? value / max : 0;
  } else {
    normalized = min < 0 ? -(value / min) : 0;
  }

  if (value >= 0) {
    // Green spectrum
    const alpha = Math.min(normalized * 0.5 + 0.05, 0.55);
    return isDark
      ? `oklch(0.45 ${0.08 + normalized * 0.12} 145 / ${alpha + 0.1})`
      : `oklch(0.92 ${0.04 + normalized * 0.14} 145 / ${alpha + 0.3})`;
  } else {
    // Red spectrum
    const intensity = Math.abs(normalized);
    const alpha = Math.min(intensity * 0.5 + 0.05, 0.55);
    return isDark
      ? `oklch(0.45 ${0.08 + intensity * 0.15} 25 / ${alpha + 0.1})`
      : `oklch(0.92 ${0.04 + intensity * 0.16} 25 / ${alpha + 0.3})`;
  }
}

export const RevenueHeatmap = memo(function RevenueHeatmap({
  matrix,
  roasLevels,
  budgetLevels,
  breakevenRoas,
}: RevenueHeatmapProps) {
  // Find min/max for color scaling
  const { min, max } = useMemo(() => {
    let min = 0;
    let max = 0;
    for (const row of matrix) {
      for (const cell of row) {
        if (cell.lucro < min) min = cell.lucro;
        if (cell.lucro > max) max = cell.lucro;
      }
    }
    return { min, max };
  }, [matrix]);

  // Reactive dark mode detection
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    setIsDark(root.classList.contains("dark"));

    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains("dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <Card className="border border-border shadow-sm rounded-lg p-4 sm:p-6">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-foreground">
          Projeção de Lucro por Cenário
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Cruze diferentes níveis de ROAS com investimentos em anúncios para ver o lucro estimado. Verde = lucro, vermelho = prejuízo.
        </p>
      </div>

      {/* Scroll indicator */}
      <div className="relative">
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-card to-transparent pointer-events-none z-10 sm:hidden" />

        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full border-collapse min-w-[700px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-card p-2 text-[10px] sm:text-xs font-semibold text-muted-foreground text-left w-16">
                  ROAS
                </th>
                {budgetLevels.map((budget) => (
                  <th
                    key={budget}
                    className="p-1.5 sm:p-2 text-[9px] sm:text-[10px] font-medium text-muted-foreground text-center whitespace-nowrap"
                  >
                    {formatBRL(budget, true)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, rowIdx) => {
                const roas = roasLevels[rowIdx];
                const isBreakeven = Math.abs(roas - breakevenRoas) < 0.3;

                return (
                  <tr
                    key={roas}
                    className={cn(
                      "transition-colors",
                      isBreakeven && "ring-1 ring-primary/30"
                    )}
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-20 bg-card p-1.5 sm:p-2 text-xs sm:text-sm font-semibold text-foreground",
                        isBreakeven && "text-primary"
                      )}
                    >
                      {roas % 1 === 0 ? `${roas}x` : `${roas.toFixed(1)}x`}
                      {isBreakeven && (
                        <span className="text-[8px] text-primary/70 block leading-tight">mín.</span>
                      )}
                    </td>
                    {row.map((cell, colIdx) => {
                      const bgColor = getHeatmapColor(cell.lucro, min, max, isDark);
                      const isNeg = cell.lucro < 0;

                      return (
                        <td
                          key={`${rowIdx}-${colIdx}`}
                          className={cn(
                            "p-1 sm:p-1.5 text-center text-[9px] sm:text-[10px] font-medium transition-all",
                            "hover:ring-1 hover:ring-primary/40 cursor-default",
                            isNeg ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"
                          )}
                          style={{ backgroundColor: bgColor }}
                          title={`ROAS ${roas}x | Investimento ${formatBRL(cell.budget)} | Lucro: ${formatBRL(cell.lucro)}`}
                        >
                          {formatBRL(cell.lucro, true)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 text-[10px] sm:text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 rounded-sm" style={{ background: "oklch(0.92 0.14 25 / 0.6)" }} />
          Prejuízo
        </div>
        <div className="w-8 h-3 rounded-sm bg-gradient-to-r" style={{
          background: "linear-gradient(to right, oklch(0.92 0.14 25 / 0.4), oklch(0.97 0 0), oklch(0.92 0.14 145 / 0.4))"
        }} />
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 rounded-sm" style={{ background: "oklch(0.92 0.14 145 / 0.6)" }} />
          Lucro
        </div>
      </div>
    </Card>
  );
});
