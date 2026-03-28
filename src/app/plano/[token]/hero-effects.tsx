"use client";

import { useMemo } from "react";
import type { PlanMetrics } from "@/actions/action-plan";

// ─── Floating Data Particles ──────────────────────

const PARTICLE_COUNT = 20;

export function DataParticles({ metrics }: { metrics: PlanMetrics | null }) {
  const particles = useMemo(() => {
    const labels = metrics
      ? [
          `R$ ${(metrics.faturamento / 1000).toFixed(0)}K`,
          `${metrics.roas.toFixed(1)}x`,
          `${metrics.totalPedidos}`,
          `R$ ${metrics.cpa.toFixed(0)}`,
          "ROAS", "CPA", "CTR", "%", "R$",
        ]
      : ["ROAS", "CPA", "CTR", "R$", "%"];

    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      text: labels[i % labels.length],
      style: {
        left: `${(i * 5.2 + (i % 3) * 8) % 100}%`,
        fontSize: `${9 + (i % 3)}px`,
        opacity: 0.04 + (i % 5) * 0.015,
        animationDuration: `${14 + (i % 7) * 2}s`,
        animationDelay: `${-(i * 1.5)}s`,
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

// ─── Hero Background (Grid + Glow) ───────────────

export function HeroBackground() {
  return (
    <>
      <div className="plan-grid-pattern" />
      <div className="plan-hero-glow" />
    </>
  );
}
