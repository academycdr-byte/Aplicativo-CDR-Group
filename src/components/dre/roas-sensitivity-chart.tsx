"use client";

import { memo, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatPct, type ROASSensitivityPoint } from "@/lib/dre-calculator";

type ROASSensitivityChartProps = {
  data: ROASSensitivityPoint[];
  breakevenRoas: number;
  currentRoas: number;
};

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const pt = payload[0]?.payload as ROASSensitivityPoint;
  if (!pt) return null;

  const isPositive = pt.mcPct >= 0;

  return (
    <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl p-3 min-w-[200px]">
      <p className="text-xs text-muted-foreground mb-2">Se o ROAS for {pt.roas}x</p>
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Margem por venda</span>
          <span className={`text-sm font-bold ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
            {formatPct(pt.mcPct)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Custo por venda</span>
          <span className="text-sm font-medium">{formatBRL(pt.cpaImplicito)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Lucro mensal</span>
          <span className={`text-sm font-medium ${pt.lucroBruto >= 0 ? "text-emerald-500" : "text-red-500"}`}>
            {formatBRL(pt.lucroBruto, true)}
          </span>
        </div>
      </div>
    </div>
  );
}

export const ROASSensitivityChart = memo(function ROASSensitivityChart({
  data,
  breakevenRoas,
  currentRoas,
}: ROASSensitivityChartProps) {
  // Split data into positive and negative for dual gradient
  const chartData = useMemo(
    () =>
      data.map((pt) => ({
        ...pt,
        positive: pt.mcPct >= 0 ? pt.mcPct : 0,
        negative: pt.mcPct < 0 ? pt.mcPct : 0,
      })),
    [data]
  );

  return (
    <Card className="border border-border shadow-sm rounded-lg p-4 sm:p-6">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            Quanto Você Lucra em Cada Nível de ROAS
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Simula sua margem se o ROAS subir ou cair
          </p>
        </div>
        <Badge variant="outline" className="text-xs font-mono shrink-0">
          Mínimo: {breakevenRoas.toFixed(1)}x
        </Badge>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <defs>
            <linearGradient id="gradPositive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.62 0.19 145)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="oklch(0.62 0.19 145)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradNegative" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.63 0.22 25)" stopOpacity={0.02} />
              <stop offset="100%" stopColor="oklch(0.63 0.22 25)" stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            opacity={0.15}
            vertical={false}
          />
          <XAxis
            dataKey="roas"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v}x`}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Zero reference line */}
          <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} />

          {/* Breakeven reference */}
          {breakevenRoas > 0 && breakevenRoas <= 13 && (
            <ReferenceLine
              x={Math.round(breakevenRoas)}
              stroke="var(--primary)"
              strokeDasharray="5 5"
              strokeOpacity={0.6}
            />
          )}

          {/* Current ROAS marker */}
          {currentRoas > 0 && currentRoas <= 13 && (
            <ReferenceLine
              x={Math.round(currentRoas)}
              stroke="oklch(0.59 0.2 260)"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
          )}

          {/* Positive area (green) */}
          <Area
            type="monotone"
            dataKey="positive"
            stroke="oklch(0.62 0.19 145)"
            fill="url(#gradPositive)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, fill: "var(--card)" }}
          />

          {/* Negative area (red) */}
          <Area
            type="monotone"
            dataKey="negative"
            stroke="oklch(0.63 0.22 25)"
            fill="url(#gradNegative)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, fill: "var(--card)" }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-muted-foreground justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "oklch(0.62 0.19 145)" }} />
          Lucro
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "oklch(0.63 0.22 25)" }} />
          Prejuízo
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 border-t-2 border-dashed" style={{ borderColor: "var(--primary)" }} />
          ROAS Mínimo
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 border-t-2 border-dashed" style={{ borderColor: "oklch(0.59 0.2 260)" }} />
          Seu ROAS Atual
        </div>
      </div>
    </Card>
  );
});
