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
    totalProfit: number; // calculated in parent or here
    currentMonthLabel: string; // e.g., "Fevereiro 2026"
}

export function EstimatedProfitCalendar({ data, totalProfit, currentMonthLabel }: EstimatedProfitCalendarProps) {
    // Helper to get days for the calendar grid
    // We will assume we are focusing on the range of data provided or the current month.
    // For simplicity and robustness, let's map the data to days.
    // If data covers multiple months, this visual might need adjustment, but the requirement implies a monthly view or "period" view.
    // We'll generate a grid based on the dates in 'data' if it's less than ~31 days, or just show the last 30 days.

    const calendarDays = useMemo(() => {
        // Sort data by date
        const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));

        // Create a map for quick lookup
        const dataMap = new Map(sorted.map(d => [d.date, d]));

        // Generate days (simple approach: use the data points as days if they are consecutive enough)
        // Or better: just render the squares for the dates available in the data, 
        // assuming the parent filters 'data' to the relevant view.
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

    const weekDays = ["DO", "SE", "TE", "QU", "QU", "SE", "SA"];

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="mb-6">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Lucro Estimado</p>
                <p className="text-2xl font-bold tracking-tight text-foreground">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalProfit)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{currentMonthLabel}</p>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-1.5 w-full max-w-[280px]">
                {/* Weekday Headers */}
                {weekDays.map((d, i) => (
                    <div key={i} className="text-[9px] text-muted-foreground text-center font-medium py-1">
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
                            "w-full aspect-square rounded-md flex items-center justify-center text-[10px] font-medium transition-colors border relative group cursor-default",
                            day.profit >= 0
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                : "bg-red-500/10 text-red-600 border-red-500/20",
                            // Highlight today (optional, need real today check)
                            // isToday && "ring-2 ring-primary ring-offset-2"
                        )}
                    >
                        {day.dayOfMonth}
                        {/* Tooltip on hover (simple native title for now or custom if needed) */}
                        <span className="sr-only">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(day.profit)}
                        </span>

                        <div className="absolute opacity-0 group-hover:opacity-100 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded shadow-lg border whitespace-nowrap z-10 pointer-events-none">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(day.profit)}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 flex items-center gap-3 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500/20 border border-emerald-500/50" />
                    <span>Lucro</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-500/20 border border-red-500/50" />
                    <span>Prejuízo</span>
                </div>
            </div>
        </div>
    );
}
