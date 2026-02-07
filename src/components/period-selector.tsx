"use client";

import { useState } from "react";
import { CalendarDays, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type PeriodValue =
  | { type: "preset"; days: number }
  | { type: "custom"; from: Date; to: Date };

const presets = [
  { days: 0, label: "Hoje" },
  { days: 7, label: "7d" },
  { days: 30, label: "Mes" },
  { days: 90, label: "90d" },
];

interface PeriodSelectorProps {
  value: PeriodValue;
  onChange: (value: PeriodValue) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function PeriodSelector({ value, onChange, onRefresh, refreshing }: PeriodSelectorProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(
    value.type === "custom" ? { from: value.from, to: value.to } : undefined
  );

  const isCustom = value.type === "custom";

  function handleRangeSelect(selected: DateRange | undefined) {
    setRange(selected);
    if (selected?.from && selected?.to) {
      onChange({ type: "custom", from: selected.from, to: selected.to });
      setCalendarOpen(false);
    }
  }

  function formatCustomLabel() {
    if (value.type !== "custom") return "";
    return `${format(value.from, "dd/MM", { locale: ptBR })} - ${format(value.to, "dd/MM", { locale: ptBR })}`;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Preset pills */}
      <div className="flex items-center bg-muted rounded-lg p-0.5">
        {presets.map((p) => (
          <button
            key={p.days}
            onClick={() => {
              setRange(undefined);
              onChange({ type: "preset", days: p.days });
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              value.type === "preset" && value.days === p.days
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}

        {/* Calendar icon button */}
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <button
              className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                isCustom
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              {isCustom && (
                <span className="hidden sm:inline">{formatCustomLabel()}</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={range}
              onSelect={handleRangeSelect}
              numberOfMonths={2}
              disabled={{ after: new Date() }}
              locale={ptBR}
              className="rounded-md"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Refresh button */}
      {onRefresh && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Atualizar</span>
        </Button>
      )}
    </div>
  );
}

/** Helper to convert PeriodValue to { days, from?, to? } for server actions */
export function periodToParams(value: PeriodValue): { days: number; from?: string; to?: string } {
  if (value.type === "custom") {
    const fromStr = value.from.toISOString();
    const toStr = value.to.toISOString();
    // Calculate approximate days for comparison period
    const diffMs = value.to.getTime() - value.from.getTime();
    const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    return { days, from: fromStr, to: toStr };
  }
  return { days: value.days };
}
