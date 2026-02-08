"use client";

import { Eye, ShoppingCart, MousePointerClick, Package, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

type FunnelData = {
    sessoes: number;
    adicoesCarrinho: number;
    checkoutsIniciados: number;
    pedidosGerados: number;
};

interface FunnelVisualProps {
    data: FunnelData | null;
}

export function FunnelVisual({ data }: FunnelVisualProps) {
    if (!data) {
        return (
            <div className="h-full flex items-center justify-center p-6 text-muted-foreground text-sm">
                Sem dados do funil
            </div>
        );
    }

    const steps = [
        {
            id: "sessions",
            label: "Sessões",
            value: data.sessoes,
            icon: Eye,
            color: "bg-primary/10 text-primary border-primary/20",
            barColor: "bg-primary"
        },
        {
            id: "atc",
            label: "Add. Carrinho",
            value: data.adicoesCarrinho,
            icon: ShoppingCart,
            color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
            barColor: "bg-blue-500"
        },
        {
            id: "checkout",
            label: "Checkout",
            value: data.checkoutsIniciados,
            icon: MousePointerClick,
            color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
            barColor: "bg-amber-500"
        },
        {
            id: "orders",
            label: "Compras",
            value: data.pedidosGerados,
            icon: Package,
            color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
            barColor: "bg-emerald-500"
        },
    ];

    /* Calculate percentages relative to sessions (max width) */
    const maxVal = Math.max(data.sessoes, 1);

    function fmtNum(n: number) {
        return new Intl.NumberFormat("pt-BR").format(n);
    }

    return (
        <div className="space-y-6">
            {steps.map((step, i) => {
                const widthPct = Math.max((step.value / maxVal) * 100, 2); // min 2% width
                const prevStep = steps[i - 1];
                const conversionRate = prevStep && prevStep.value > 0
                    ? ((step.value / prevStep.value) * 100).toFixed(1)
                    : null;

                const Icon = step.icon;

                return (
                    <div key={step.id} className="relative group">
                        {/* Conversion Indicator */}
                        {conversionRate && (
                            <div className="absolute -top-4 left-[1.15rem] h-4 w-px bg-border/50 z-0"></div>
                        )}

                        <div className="flex items-center gap-4 relative z-10">
                            {/* Icon Box */}
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 transition-all duration-300", step.color)}>
                                <Icon className="w-5 h-5" />
                            </div>

                            {/* Bar Area */}
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

                                {/* Visual Bar Container */}
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
        </div>
    );
}
