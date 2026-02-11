"use client";

import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type FunnelStep = {
    id: string;
    label: string;
    value: number;
    icon: LucideIcon;
    color: string;
    barColor: string;
};

export type FunnelRate = {
    label: string;
    value: number;
    colorClass: string;
    bgClass: string;
};

interface FunnelVisualProps {
    steps: FunnelStep[];
    rates?: FunnelRate[];
}

export function FunnelVisual({ steps, rates }: FunnelVisualProps) {
    if (!steps || steps.length === 0) {
        return (
            <div className="h-full flex items-center justify-center p-6 text-muted-foreground text-sm">
                Sem dados do funil
            </div>
        );
    }

    const maxVal = Math.max(steps[0]?.value || 1, 1);

    function fmtNum(n: number) {
        return new Intl.NumberFormat("pt-BR").format(n);
    }

    return (
        <div className="space-y-6">
            {/* Funnel Steps */}
            {steps.map((step, i) => {
                const widthPct = Math.max((step.value / maxVal) * 100, 2);
                const prevStep = steps[i - 1];
                const conversionRate = prevStep && prevStep.value > 0
                    ? ((step.value / prevStep.value) * 100).toFixed(1)
                    : null;

                const Icon = step.icon;

                return (
                    <div key={step.id} className="relative group">
                        {conversionRate && (
                            <div className="absolute -top-4 left-[1.15rem] h-4 w-px bg-border/50 z-0" />
                        )}

                        <div className="flex items-center gap-4 relative z-10">
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 transition-all duration-300", step.color)}>
                                <Icon className="w-5 h-5" />
                            </div>

                            <div className="flex-1">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-sm font-medium leading-none text-muted-foreground">{step.label}</span>
                                    <div className="flex items-center gap-2">
                                        {conversionRate && (
                                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-muted-foreground/80">
                                                {conversionRate}%
                                            </span>
                                        )}
                                        <span className="text-sm font-bold leading-none text-foreground">{fmtNum(step.value)}</span>
                                    </div>
                                </div>

                                <div className="h-2.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                                    <div
                                        className={cn("h-full rounded-full transition-all duration-1000 ease-out", step.barColor)}
                                        style={{ width: `${widthPct}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Key Conversion Rates */}
            {rates && rates.length > 0 && (
                <div className="mt-8 pt-6 border-t border-border/40">
                    <div className={cn("grid gap-2 sm:gap-3", `grid-cols-${Math.min(rates.length, 3)}`)}>
                        {rates.map((rate) => (
                            <RateHighlight
                                key={rate.label}
                                label={rate.label}
                                value={rate.value}
                                colorClass={rate.colorClass}
                                bgClass={rate.bgClass}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function RateHighlight({ label, value, colorClass, bgClass }: {
    label: string;
    value: number;
    colorClass: string;
    bgClass: string;
}) {
    return (
        <div className={cn("rounded-xl border p-2 sm:p-3 text-center transition-all", bgClass)}>
            <p className={cn("text-lg sm:text-2xl font-bold tracking-tight", colorClass)}>
                {value.toFixed(1)}%
            </p>
            <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5 sm:mt-1 leading-tight">
                {label}
            </p>
        </div>
    );
}
