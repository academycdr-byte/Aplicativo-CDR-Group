"use client";

import { useMemo } from "react";
import type { PlanMetrics } from "@/actions/action-plan";

// ─── Floating Particles ───────────────────────────

const PARTICLE_COUNT = 28;

export function FloatingParticles({ metrics }: { metrics: PlanMetrics | null }) {
  const particles = useMemo(() => {
    const labels = metrics
      ? [
          `R$ ${(metrics.faturamento / 1000).toFixed(0)}K`,
          `${metrics.roas.toFixed(1)}x`,
          `${metrics.totalPedidos}`,
          `R$ ${metrics.cpa.toFixed(0)}`,
          "ROAS",
          "CPA",
          "CTR",
          "%",
          "R$",
          "AOV",
        ]
      : ["ROAS", "CPA", "CTR", "R$", "%", "AOV"];

    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      text: labels[i % labels.length],
      style: {
        left: `${(i * 3.6 + (i % 3) * 7) % 100}%`,
        fontSize: `${9 + (i % 3) * 2}px`,
        opacity: 0.025 + (i % 4) * 0.012,
        animationDuration: `${12 + (i % 8) * 2.5}s`,
        animationDelay: `${-(i * 1.3)}s`,
      } as React.CSSProperties,
    }));
  }, [metrics]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {particles.map((p) => (
        <span key={p.id} className="plan-particle" style={p.style}>
          {p.text}
        </span>
      ))}
    </div>
  );
}

// ─── 3D Metrics Cube ──────────────────────────────

export function MetricsCube({ metrics }: { metrics: PlanMetrics | null }) {
  const fmtK = (v: number) => {
    if (v >= 1000) return `R$ ${(v / 1000).toFixed(0)}K`;
    return `R$ ${v.toFixed(0)}`;
  };

  const faces = metrics
    ? [
        { label: "Faturamento", value: fmtK(metrics.faturamento) },
        { label: "ROAS", value: `${metrics.roas.toFixed(1)}x` },
        { label: "Investido", value: fmtK(metrics.investido) },
        { label: "Convertido", value: fmtK(metrics.convertido) },
        { label: "CPA", value: fmtK(metrics.cpa) },
        { label: "Ticket Médio", value: fmtK(metrics.ticketMedio) },
      ]
    : [
        { label: "Plano", value: "de Ação" },
        { label: "Dados", value: "Reais" },
        { label: "CDR", value: "Group" },
        { label: "Performance", value: "Total" },
        { label: "Estratégia", value: "Data" },
        { label: "Resultados", value: "Claros" },
      ];

  const faceClasses = [
    "plan-cube-face--front",
    "plan-cube-face--back",
    "plan-cube-face--right",
    "plan-cube-face--left",
    "plan-cube-face--top",
    "plan-cube-face--bottom",
  ];

  return (
    <div className="plan-cube-scene flex items-center justify-center">
      <div className="plan-cube">
        {faces.map((face, i) => (
          <div key={i} className={`plan-cube-face ${faceClasses[i]}`}>
            <span className="text-[10px] md:text-xs font-medium uppercase tracking-[0.15em]" style={{ color: "rgba(255,255,255,0.35)" }}>
              {face.label}
            </span>
            <span className="text-xl md:text-2xl font-bold tracking-tight text-white">
              {face.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
