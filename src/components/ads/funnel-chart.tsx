"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";

export type FunnelData = {
    impressions: number;
    clicks: number;
    addToCart: number;
    initiateCheckout: number;
    purchases: number;
};

interface FunnelChartProps {
    data: FunnelData;
    className?: string;
}

export function FunnelChart({ data, className }: FunnelChartProps) {
    // Safe formatting checks
    const safeDiv = (num: number, den: number) => (den > 0 ? num / den : 0);

    const ctr = safeDiv(data.clicks, data.impressions);
    const atcRate = safeDiv(data.addToCart, data.clicks);
    const checkoutRate = safeDiv(data.initiateCheckout, data.addToCart);
    const conversionRate = safeDiv(data.purchases, data.initiateCheckout);

    const steps = [
        {
            label: "Impressoes",
            value: data.impressions,
            rateLabel: "100%",
            subLabel: "Topo do funil",
            color: "bg-[#aaff00]",
            opacity: "opacity-100",
            width: "100%",
        },
        {
            label: "Cliques",
            value: data.clicks,
            rateLabel: `CTR: ${(ctr * 100).toFixed(2)}%`,
            subLabel: "Visitas",
            color: "bg-[#aaff00]",
            opacity: "opacity-80",
            width: "85%", // Visual width
        },
        {
            label: "Adicao ao Carrinho",
            value: data.addToCart,
            rateLabel: `Taxa: ${(atcRate * 100).toFixed(2)}%`,
            subLabel: "Interesse",
            color: "bg-[#aaff00]",
            opacity: "opacity-60",
            width: "70%",
        },
        {
            label: "Checkout",
            value: data.initiateCheckout,
            rateLabel: `Taxa: ${(checkoutRate * 100).toFixed(2)}%`,
            subLabel: "Intencao",
            color: "bg-[#aaff00]",
            opacity: "opacity-40",
            width: "55%",
        },
        {
            label: "Compras",
            value: data.purchases,
            rateLabel: `Conv: ${(conversionRate * 100).toFixed(2)}%`,
            subLabel: "Fundo",
            color: "bg-[#aaff00]",
            opacity: "opacity-20",
            width: "40%",
        },
    ];

    function fmt(n: number) {
        return new Intl.NumberFormat("pt-BR").format(n);
    }

    return (
        <Card className={cn("overflow-hidden", className)}>
            <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                    Funil de Conversao Meta Ads
                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-1 mt-2">
                    {steps.map((step, idx) => (
                        <div key={idx} className="relative group">
                            {/* Label Row */}
                            <div className="flex items-center justify-between text-xs mb-1 px-1">
                                <div className="flex gap-2 items-center">
                                    <span className="font-medium text-foreground">{step.label}</span>
                                    <span className="text-muted-foreground scale-90 hidden sm:inline-block">({step.subLabel})</span>
                                </div>
                                <div className="flex gap-3 text-right">
                                    <span className="font-bold">{fmt(step.value)}</span>
                                    <span className="text-muted-foreground min-w-[70px]">{step.rateLabel}</span>
                                </div>
                            </div>

                            {/* Bar Container */}
                            <div className="h-8 w-full bg-muted/20 rounded-sm relative overflow-hidden">
                                {/* Funnel Bar */}
                                <div
                                    className={cn("h-full transition-all duration-500 ease-out rounded-r-sm", step.color, step.opacity)}
                                    style={{ width: step.width }}
                                />
                            </div>

                            {/* Connecting Lines (Visual Decoration) */}
                            {idx < steps.length - 1 && (
                                <div className="absolute left-4 bottom-[-4px] h-2 w-0.5 bg-muted/20 -z-10" />
                            )}
                        </div>
                    ))}
                </div>

                {data.addToCart === 0 && data.initiateCheckout === 0 && (
                    <div className="mt-4 p-3 bg-muted/30 rounded border border-dashed border-muted text-xs text-center text-muted-foreground">
                        <p>Seus dados de Carrinho e Checkout parecem estar zerados.</p>
                        <p>Verifique se o Pixel do Meta Ads esta enviando os eventos 'AddToCart' e 'InitiateCheckout'.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
