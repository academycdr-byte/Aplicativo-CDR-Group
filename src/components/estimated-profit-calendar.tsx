"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

type MetricPoint = {
    date: string;
    faturamento: number;
    investimento: number;
};

interface EstimatedProfitCalendarProps {
    data: MetricPoint[];
    totalProfit: number;
    currentMonthLabel: string;
}

export function EstimatedProfitCalendar({ data, totalProfit, currentMonthLabel }: EstimatedProfitCalendarProps) {
    const calendarDays = useMemo(() => {
        const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));

        return sorted.map(day => {
            const profit = day.faturamento - day.investimento;
            const dateObj = new Date(day.date + "T00:00:00");
            return {
                date: day.date,
                dayOfMonth: dateObj.getDate(),
                dayOfWeek: dateObj.getDay(), // 0 = Sun
                profit,
                isPositive: profit >= 0,
                hasData: day.faturamento > 0 || day.investimento > 0
            };
        });
    }, [data]);

    const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header */}
            <div className="mb-6 flex items-end justify-between">
                <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Lucro Estimado</p>
                    <p className="text-2xl font-bold tracking-tight text-foreground">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalProfit)}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-xs font-medium text-foreground bg-secondary/50 px-2 py-1 rounded-md">{currentMonthLabel}</p>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-2 w-full">
                {/* Weekday Headers */}
                {weekDays.map((d, i) => (
                    <div key={i} className="text-[10px] text-muted-foreground/50 text-center font-bold py-1">
                        {d}
                    </div>
                ))}

                {/* Days */}
                {calendarDays.length > 0 && Array.from({ length: calendarDays[0].dayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="w-full aspect-square" />
                ))}

                {calendarDays.map((day) => (
                    <div
                        key={day.date}
                        className={cn(
                            "w-full aspect-square rounded-xl flex items-center justify-center text-[10px] font-semibold transition-all duration-300 relative group cursor-default border",
                            day.profit >= 0
                                ? "bg-emerald-500/5 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20"
                                : "bg-red-500/5 text-red-600 border-red-500/20 hover:bg-red-500/20",
                        )}
                    >
                        {day.dayOfMonth}

                        {/* Tooltip */}
                        <div className="absolute opacity-0 group-hover:opacity-100 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-popover/95 backdrop-blur-md text-popover-foreground text-xs px-3 py-1.5 rounded-lg shadow-floating border border-border/50 whitespace-nowrap z-50 pointer-events-none transition-opacity duration-200">
                            <div className="font-semibold text-center mb-0.5">{day.dayOfMonth}</div>
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(day.profit)}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-8 flex items-center justify-center gap-6 text-[11px] font-medium text-muted-foreground">
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Lucro</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span>Prejuízo</span>
                </div>
            </div>
        </div>
    );
}
