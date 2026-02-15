"use client";

import { memo, useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card } from "@/components/ui/card";
import { formatBRL, formatPct, type DREResult } from "@/lib/dre-calculator";

type DREWaterfallChartProps = {
  metrics: DREResult;
};

type WaterfallStep = {
  name: string;
  shortName: string;
  start: number;
  value: number;
  displayValue: number;
  pct: number;
  color: string;
  type: "revenue" | "cost" | "result";
};

function buildWaterfallData(m: DREResult): WaterfallStep[] {
  const ticket = m.ticketMedio;
  const steps: WaterfallStep[] = [];

  // Receita (ticket)
  steps.push({
    name: "Ticket Médio",
    shortName: "Receita",
    start: 0,
    value: ticket,
    displayValue: ticket,
    pct: 100,
    color: "oklch(0.62 0.19 145)", // system-green
    type: "revenue",
  });

  let cursor = ticket;

  // Custos (barras descendentes)
  const costs: { name: string; shortName: string; value: number; pct: number; color: string }[] = [
    { name: "Gateway de Pagamento", shortName: "Gateway", value: m.custoGateway, pct: m.custoGatewayPct, color: "oklch(0.59 0.2 260)" },
    { name: "Devoluções", shortName: "Devol.", value: m.custoDevolucao, pct: m.custoDevolucaoPct, color: "oklch(0.75 0.17 55)" },
    { name: "Impostos", shortName: "Impostos", value: m.custoImpostos, pct: m.custoImpostosPct, color: "oklch(0.55 0.2 300)" },
    { name: "Custo do Produto", shortName: "Produto", value: m.cmv, pct: m.cmvPct, color: "oklch(0.63 0.22 25)" },
  ];

  if (m.custoFrete > 0) {
    costs.push({ name: "Frete", shortName: "Frete", value: m.custoFrete, pct: m.custoFretePct, color: "oklch(0.56 0 0)" });
  }

  for (const cost of costs) {
    if (cost.value <= 0) continue;
    steps.push({
      name: cost.name,
      shortName: cost.shortName,
      start: cursor - cost.value,
      value: cost.value,
      displayValue: -cost.value,
      pct: cost.pct,
      color: cost.color,
      type: "cost",
    });
    cursor -= cost.value;
  }

  // Margem Bruta (resultado)
  steps.push({
    name: "Margem Bruta",
    shortName: "Margem",
    start: 0,
    value: m.margemBrutaUnit,
    displayValue: m.margemBrutaUnit,
    pct: m.margemBrutaPct,
    color: m.margemBrutaUnit >= 0 ? "oklch(0.62 0.19 145)" : "oklch(0.63 0.22 25)",
    type: "result",
  });

  return steps;
}

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
  const data = payload[0]?.payload as WaterfallStep;
  if (!data) return null;

  return (
    <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl p-3 min-w-[200px]">
      <p className="text-xs text-muted-foreground mb-1.5">{data.name}</p>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-lg font-bold" style={{ color: data.color }}>
          {data.type === "cost" ? "- " : ""}
          {formatBRL(Math.abs(data.displayValue))}
        </p>
        <p className="text-xs font-medium text-muted-foreground">
          {formatPct(data.pct)}
        </p>
      </div>
    </div>
  );
}

export const DREWaterfallChart = memo(function DREWaterfallChart({
  metrics,
}: DREWaterfallChartProps) {
  const data = useMemo(() => buildWaterfallData(metrics), [metrics]);

  return (
    <Card className="border border-border shadow-sm rounded-lg p-4 sm:p-6">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-foreground">
          Para Onde Vai o Dinheiro de Cada Venda
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Veja como o valor de cada pedido é dividido entre custos e margem
        </p>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
          barCategoryGap="20%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            opacity={0.15}
            vertical={false}
          />
          <XAxis
            dataKey="shortName"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickFormatter={(v: number) => `R$ ${v.toFixed(0)}`}
            tickLine={false}
            axisLine={false}
            width={65}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "var(--muted)", opacity: 0.1 }}
          />
          {/* Invisible offset bar */}
          <Bar dataKey="start" stackId="a" fill="transparent" isAnimationActive={false} />
          {/* Visible value bar */}
          <Bar dataKey="value" stackId="a" radius={[6, 6, 0, 0]} isAnimationActive={true} animationDuration={800}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
});
