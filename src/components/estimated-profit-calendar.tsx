"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type DailyProfit = {
    date: string;
    profit: number;
    revenue: number;
    costs: number;
};

interface EstimatedProfitCalendarProps {
    data: DailyProfit[];
    totalProfit: number;
    currentMonthLabel: string;
    formatter?: (value: number) => string;
}

export function EstimatedProfitCalendar({ data, totalProfit, currentMonthLabel, formatter }: EstimatedProfitCalendarProps) {
    const [selectedDay, setSelectedDay] = useState<DailyProfit | null>(null);

    const formatMoney = (value: number) => {
        if (formatter) return formatter(value);
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
    };

    const calendarDays = useMemo(() => {
        const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));

        return sorted.map(day => {
            const dateObj = new Date(day.date + "T00:00:00");
            return {
                ...day,
                dayOfMonth: dateObj.getDate(),
                dayOfWeek: dateObj.getDay(),
                isPositive: day.profit >= 0,
                hasData: day.revenue > 0 || day.costs > 0,
            };
        });
    }, [data]);

    const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];

    const handleDayClick = (day: DailyProfit) => {
        if (selectedDay?.date === day.date) {
            setSelectedDay(null);
        } else {
            setSelectedDay(day);
        }
    };

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header */}
            <div className="mb-6 flex items-end justify-between">
                <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Lucro Estimado</p>
                    <p className={cn(
                        "text-2xl font-bold tracking-tight",
                        totalProfit >= 0 ? "text-emerald-600" : "text-red-600"
                    )}>
                        {formatMoney(totalProfit)}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-xs font-medium text-foreground bg-secondary/50 px-2 py-1 rounded-md">{currentMonthLabel}</p>
                </div>
            </div>

            {/* Selected Day Detail */}
            {selectedDay && (
                <div className="mb-4 p-3 rounded-lg border border-border bg-muted/30 animate-in fade-in duration-200">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                        {new Date(selectedDay.date + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <p className="text-[10px] text-muted-foreground">Receita</p>
                            <p className="text-sm font-bold text-foreground">{formatMoney(selectedDay.revenue)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-muted-foreground">Custos</p>
                            <p className="text-sm font-bold text-red-500">{formatMoney(selectedDay.costs)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-muted-foreground">Lucro</p>
                            <p className={cn(
                                "text-sm font-bold",
                                selectedDay.profit >= 0 ? "text-emerald-600" : "text-red-600"
                            )}>
                                {formatMoney(selectedDay.profit)}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 w-full">
                {/* Weekday Headers */}
                {weekDays.map((d, i) => (
                    <div key={i} className="text-[10px] text-muted-foreground/50 text-center font-bold py-1">
                        {d}
                    </div>
                ))}

                {/* Empty days before first day */}
                {calendarDays.length > 0 && Array.from({ length: calendarDays[0].dayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="w-full aspect-square" />
                ))}

                {/* Days */}
                {calendarDays.map((day) => (
                    <div
                        key={day.date}
                        onClick={() => handleDayClick(day)}
                        className={cn(
                            "w-full aspect-square rounded-xl flex items-center justify-center text-[10px] font-semibold transition-all duration-300 relative cursor-pointer border",
                            day.profit >= 0
                                ? "bg-emerald-500/5 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20"
                                : "bg-red-500/5 text-red-600 border-red-500/20 hover:bg-red-500/20",
                            selectedDay?.date === day.date && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                        )}
                    >
                        {day.dayOfMonth}

                        {/* Hover Tooltip */}
                        <div className="absolute opacity-0 hover:opacity-100 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-popover/95 backdrop-blur-md text-popover-foreground text-xs px-3 py-1.5 rounded-lg shadow-floating border border-border/50 whitespace-nowrap z-50 pointer-events-none transition-opacity duration-200">
                            <div className="font-semibold text-center mb-0.5">{day.dayOfMonth}</div>
                            {formatMoney(day.profit)}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 sm:mt-8 flex items-center justify-center gap-4 sm:gap-6 text-[11px] font-medium text-muted-foreground">
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Lucro</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span>Prejuizo</span>
                </div>
            </div>
        </div>
    );
}
