"use client";

import { memo, useMemo, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RotateCcw, HelpCircle, ChevronDown, Settings2 } from "lucide-react";
import { formatBRL, type DREInputs } from "@/lib/dre-calculator";
import { cn } from "@/lib/utils";

type DREInputPanelProps = {
  inputs: DREInputs;
  onChange: (field: keyof DREInputs, value: number) => void;
  onReset: () => void;
};

function InputField({
  label,
  field,
  value,
  onChange,
  prefix,
  suffix,
  help,
  step,
  min,
  max,
}: {
  label: string;
  field: keyof DREInputs;
  value: number;
  onChange: (field: keyof DREInputs, value: number) => void;
  prefix?: string;
  suffix?: string;
  help?: string;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={field} className="text-sm font-medium">
          {label}
        </Label>
        {help && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/50 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px]">
                <p className="text-xs">{help}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
            {prefix}
          </span>
        )}
        <Input
          id={field}
          type="number"
          value={value || ""}
          onChange={(e) => {
            let v = parseFloat(e.target.value) || 0;
            if (min !== undefined) v = Math.max(min, v);
            if (max !== undefined) v = Math.min(max, v);
            onChange(field, v);
          }}
          step={step ?? 1}
          min={min ?? 0}
          className={`h-11 border-border ${prefix ? "pl-10" : ""} ${suffix ? "pr-10" : ""}`}
          placeholder="0"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export const DREInputPanel = memo(function DREInputPanel({
  inputs,
  onChange,
  onReset,
}: DREInputPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const ticketMedio = useMemo(
    () => (inputs.numeroPedidos > 0 ? inputs.receitaMensal / inputs.numeroPedidos : 0),
    [inputs.receitaMensal, inputs.numeroPedidos]
  );
  const numDevolucoes = useMemo(
    () => Math.round(inputs.numeroPedidos * (inputs.percentualDevolucoes / 100)),
    [inputs.numeroPedidos, inputs.percentualDevolucoes]
  );

  // Handler for Ticket Médio: when ticket changes, recalculate numeroPedidos
  const handleTicketChange = useCallback((_field: keyof DREInputs, value: number) => {
    if (value > 0) {
      onChange("numeroPedidos", Math.round(inputs.receitaMensal / value));
    }
  }, [onChange, inputs.receitaMensal]);

  return (
    <Card className="border border-border shadow-none rounded-lg bg-card/80 backdrop-blur-sm overflow-hidden">
      {/* Collapsed Summary - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Settings2 className="w-4 h-4 text-primary" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground">Dados da Operação</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
              <span className="text-xs text-muted-foreground">
                Receita <span className="font-medium text-foreground">{formatBRL(inputs.receitaMensal, true)}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                Ticket <span className="font-medium text-foreground">{formatBRL(ticketMedio)}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                CMV <span className="font-medium text-foreground">{formatBRL(inputs.cmvUnitario)}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                CPA <span className="font-medium text-foreground">{formatBRL(inputs.cpaAlvo)}</span>
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onReset(); }}
              className="text-muted-foreground hidden sm:flex"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Restaurar
            </Button>
          )}
          <ChevronDown className={cn(
            "w-5 h-5 text-muted-foreground transition-transform duration-200",
            isExpanded && "rotate-180"
          )} />
        </div>
      </button>

      {/* Expandable Content */}
      <div className={cn(
        "grid transition-all duration-300 ease-in-out",
        isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}>
        <div className="overflow-hidden">
          <div className="px-4 pb-5 sm:px-6 sm:pb-6 space-y-5">
            <Separator />

            {/* Receita & Pedidos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">
                  Receita & Pedidos
                </p>
                {inputs.numeroPedidos > 0 && (
                  <Badge variant="secondary" className="text-[10px] font-medium">
                    {Math.round(inputs.numeroPedidos)} pedidos | {numDevolucoes} devoluções
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <InputField label="Receita Mensal" field="receitaMensal" value={inputs.receitaMensal} onChange={onChange} prefix="R$" step={1000} help="Faturamento bruto total do mês" />
                <InputField label="Ticket Médio" field="numeroPedidos" value={Math.round(ticketMedio)} onChange={handleTicketChange} prefix="R$" step={5} help="Valor médio de cada pedido (altera o número de pedidos automaticamente)" />
                <InputField label="% Pedidos Aprovados" field="percentualAprovados" value={inputs.percentualAprovados} onChange={onChange} suffix="%" step={1} min={1} max={100} help="Percentual de pedidos que são efetivamente aprovados" />
                <InputField label="% Devoluções" field="percentualDevolucoes" value={inputs.percentualDevolucoes} onChange={onChange} suffix="%" step={0.5} min={0} max={100} help={`Percentual de pedidos devolvidos (${numDevolucoes} devoluções)`} />
              </div>
            </div>

            <Separator />

            {/* Custos & Taxas + Investimento side by side on desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">
                  Custos & Taxas por Venda
                </p>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <InputField label="Custo do Produto" field="cmvUnitario" value={inputs.cmvUnitario} onChange={onChange} prefix="R$" step={1} help="Quanto custa produzir ou comprar cada unidade (CMV)" />
                  <InputField label="Taxa do Gateway" field="taxaGateway" value={inputs.taxaGateway} onChange={onChange} suffix="%" step={0.1} min={0} max={100} help="Taxa cobrada pelo meio de pagamento" />
                  <InputField label="Impostos sobre Receita" field="taxaImpostos" value={inputs.taxaImpostos} onChange={onChange} suffix="%" step={0.1} min={0} max={100} help="Percentual de impostos incidentes" />
                  <InputField label="Frete por Pedido" field="freteUnitario" value={inputs.freteUnitario} onChange={onChange} prefix="R$" step={1} help="Custo médio de frete por pedido" />
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">
                  Investimento em Tráfego Pago
                </p>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <InputField label="Investimento em Anúncios" field="budgetAnuncios" value={inputs.budgetAnuncios} onChange={onChange} prefix="R$" step={500} help="Valor total investido em anúncios" />
                  <InputField label="Custo por Venda (CPA)" field="cpaAlvo" value={inputs.cpaAlvo} onChange={onChange} prefix="R$" step={1} help="Quanto você paga para conquistar cada venda" />
                  <InputField label="Imposto Meta Ads" field="impostoMetaAds" value={inputs.impostoMetaAds} onChange={onChange} suffix="%" step={0.5} min={0} max={100} help="Imposto pago sobre o investimento em Meta Ads (IOF, ISS)" />
                </div>
              </div>
            </div>

            {/* Mobile reset button */}
            <div className="sm:hidden">
              <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground w-full">
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Restaurar valores padrão
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
});
