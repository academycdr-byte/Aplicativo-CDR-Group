"use client";

import { useMemo } from "react";
import type { PlanMetrics } from "@/actions/action-plan";

// ─── Data Rain ────────────────────────────────────

const RAIN_ITEMS = 40;

function generateRainData(metrics: PlanMetrics | null) {
  const metricStrings = metrics
    ? [
        `R$ ${(metrics.faturamento / 1000).toFixed(0)}K`,
        `${metrics.roas.toFixed(1)}x`,
        `R$ ${(metrics.investido / 1000).toFixed(0)}K`,
        `${metrics.totalPedidos}`,
        `R$ ${metrics.cpa.toFixed(0)}`,
        `R$ ${metrics.ticketMedio.toFixed(0)}`,
        `${metrics.totalConversoes}`,
        `${((metrics.convertido / metrics.investido) * 100).toFixed(0)}%`,
        "ROAS",
        "CPA",
        "CTR",
        "CPM",
        "AOV",
        "CVR",
        "R$",
        "%",
      ]
    : ["R$", "ROAS", "CPA", "%", "CTR", "CPM", "AOV", "CVR"];

  return Array.from({ length: RAIN_ITEMS }, (_, i) => ({
    id: i,
    text: metricStrings[i % metricStrings.length],
    left: `${(i * 2.5) % 100}%`,
    duration: `${8 + (i % 12) * 1.5}s`,
    delay: `${-(i * 0.7)}s`,
    opacity: 0.03 + (i % 5) * 0.02,
    fontSize: `${10 + (i % 4) * 2}px`,
  }));
}

export function DataRain({ metrics }: { metrics: PlanMetrics | null }) {
  const items = useMemo(() => generateRainData(metrics), [metrics]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {items.map((item) => (
        <span
          key={item.id}
          className="absolute text-white font-mono font-bold animate-data-rain select-none"
          style={{
            left: item.left,
            animationDuration: item.duration,
            animationDelay: item.delay,
            opacity: item.opacity,
            fontSize: item.fontSize,
          }}
        >
          {item.text}
        </span>
      ))}
    </div>
  );
}

// ─── 3D Cube ──────────────────────────────────────

export function MetricsCube({ metrics }: { metrics: PlanMetrics | null }) {
  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

  const faces = metrics
    ? [
        { label: "Faturamento", value: fmt(metrics.faturamento), color: "from-emerald-500/30 to-emerald-600/10" },
        { label: "ROAS", value: `${metrics.roas.toFixed(1)}x`, color: "from-primary/30 to-primary/10" },
        { label: "Investido", value: fmt(metrics.investido), color: "from-blue-500/30 to-blue-600/10" },
        { label: "Convertido", value: fmt(metrics.convertido), color: "from-violet-500/30 to-violet-600/10" },
        { label: "CPA", value: fmt(metrics.cpa), color: "from-amber-500/30 to-amber-600/10" },
        { label: "Ticket Médio", value: fmt(metrics.ticketMedio), color: "from-rose-500/30 to-rose-600/10" },
      ]
    : [
        { label: "CDR", value: "Group", color: "from-primary/30 to-primary/10" },
        { label: "Plano", value: "de Ação", color: "from-emerald-500/30 to-emerald-600/10" },
        { label: "Dados", value: "Reais", color: "from-blue-500/30 to-blue-600/10" },
        { label: "Resultados", value: "Claros", color: "from-violet-500/30 to-violet-600/10" },
        { label: "Performance", value: "Total", color: "from-amber-500/30 to-amber-600/10" },
        { label: "Estratégia", value: "CDR", color: "from-rose-500/30 to-rose-600/10" },
      ];

  return (
    <div className="flex items-center justify-center" style={{ perspective: "800px" }}>
      <div className="relative w-[140px] h-[140px] md:w-[180px] md:h-[180px] animate-cube-rotate" style={{ transformStyle: "preserve-3d" }}>
        {/* Front */}
        <CubeFace face={faces[0]} transform="translateZ(70px)" transformMd="translateZ(90px)" />
        {/* Back */}
        <CubeFace face={faces[1]} transform="rotateY(180deg) translateZ(70px)" transformMd="rotateY(180deg) translateZ(90px)" />
        {/* Right */}
        <CubeFace face={faces[2]} transform="rotateY(90deg) translateZ(70px)" transformMd="rotateY(90deg) translateZ(90px)" />
        {/* Left */}
        <CubeFace face={faces[3]} transform="rotateY(-90deg) translateZ(70px)" transformMd="rotateY(-90deg) translateZ(90px)" />
        {/* Top */}
        <CubeFace face={faces[4]} transform="rotateX(90deg) translateZ(70px)" transformMd="rotateX(90deg) translateZ(90px)" />
        {/* Bottom */}
        <CubeFace face={faces[5]} transform="rotateX(-90deg) translateZ(70px)" transformMd="rotateX(-90deg) translateZ(90px)" />
      </div>
    </div>
  );
}

function CubeFace({
  face,
  transform,
}: {
  face: { label: string; value: string; color: string };
  transform: string;
  transformMd: string;
}) {
  return (
    <div
      className={`absolute inset-0 rounded-2xl border border-white/[0.08] bg-gradient-to-br ${face.color} backdrop-blur-md flex flex-col items-center justify-center gap-1`}
      style={{
        transform,
        backfaceVisibility: "hidden",
      }}
    >
      <span className="text-[10px] md:text-xs font-medium text-white/50 uppercase tracking-widest">
        {face.label}
      </span>
      <span className="text-lg md:text-2xl font-bold text-white tracking-tight">
        {face.value}
      </span>
    </div>
  );
}
