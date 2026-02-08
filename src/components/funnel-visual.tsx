"use client";

import { Eye, ShoppingCart, MousePointerClick, Package, ArrowDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
            <Card className="h-full flex items-center justify-center p-6 text-muted-foreground text-sm">
                Sem dados do funil
            </Card>
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
        <Card className="h-full">
            <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold">Funil de Conversão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {steps.map((step, i) => {
                    const widthPct = Math.max((step.value / maxVal) * 100, 5); // min 5% width
                    const prevStep = steps[i - 1];
                    const conversionRate = prevStep && prevStep.value > 0
                        ? ((step.value / prevStep.value) * 100).toFixed(1)
                        : null;

                    const Icon = step.icon;

                    return (
                        <div key={step.id} className="relative group">
                            {/* Conversion Indicator connecting steps */}
                            {conversionRate && (
                                <div className="absolute -top-4 left-8 text-[10px] text-muted-foreground flex items-center gap-1 font-medium bg-background px-1 z-10">
                                    <ArrowDown className="w-3 h-3 text-muted-foreground/50" />
                                    {conversionRate}%
                                </div>
                            )}

                            <div className="flex items-center gap-4">
                                {/* Icon Box */}
                                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center border shrink-0", step.color)}>
                                    <Icon className="w-4 h-4" />
                                </div>

                                {/* Bar Area */}
                                <div className="flex-1">
                                    <div className="flex justify-between items-end mb-1.5">
                                        <span className="text-sm font-medium leading-none">{step.label}</span>
                                        <span className="text-sm font-bold leading-none">{fmtNum(step.value)}</span>
                                    </div>

                                    {/* Visual Bar Container */}
                                    <div className="h-2.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                                        <div
                                            className={cn("h-full rounded-full transition-all duration-500", step.barColor)}
                                            style={{ width: `${widthPct}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
