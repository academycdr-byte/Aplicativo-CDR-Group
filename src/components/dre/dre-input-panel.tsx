"use client";

import { memo, useMemo } from "react";
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
import { RotateCcw, HelpCircle } from "lucide-react";
import { formatBRL, type DREInputs } from "@/lib/dre-calculator";

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
  // Derived values shown inline
  const ticketMedio = useMemo(
    () => (inputs.numeroPedidos > 0 ? inputs.receitaMensal / inputs.numeroPedidos : 0),
    [inputs.receitaMensal, inputs.numeroPedidos]
  );
  const numDevolucoes = useMemo(
    () => Math.round(inputs.numeroPedidos * (inputs.percentualDevolucoes / 100)),
    [inputs.numeroPedidos, inputs.percentualDevolucoes]
  );

  return (
    <Card className="border border-border shadow-none rounded-lg p-4 sm:p-6 bg-card/80 backdrop-blur-sm">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-semibold">Dados da Sua Operação</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Preencha com os valores reais do seu negócio para simular cenários
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground">
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Restaurar
          </Button>
        </div>

        {/* Receita & Pedidos */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">
              Receita & Pedidos
            </p>
            {ticketMedio > 0 && (
              <Badge variant="secondary" className="text-[10px] font-medium">
                Ticket Médio: {formatBRL(ticketMedio)}
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <InputField
              label="Receita Mensal"
              field="receitaMensal"
              value={inputs.receitaMensal}
              onChange={onChange}
              prefix="R$"
              step={1000}
              help="Faturamento bruto total do mês"
            />
            <InputField
              label="Número de Pedidos"
              field="numeroPedidos"
              value={inputs.numeroPedidos}
              onChange={onChange}
              step={1}
              help="Quantidade total de pedidos realizados no período"
            />
            <InputField
              label="% Devoluções"
              field="percentualDevolucoes"
              value={inputs.percentualDevolucoes}
              onChange={onChange}
              suffix="%"
              step={0.5}
              min={0}
              max={100}
              help={`Percentual de pedidos devolvidos (≈ ${numDevolucoes} devoluções)`}
            />
          </div>
        </div>

        <Separator />

        {/* Custos & Taxas */}
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">
            Custos & Taxas por Venda
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <InputField
              label="Custo do Produto"
              field="cmvUnitario"
              value={inputs.cmvUnitario}
              onChange={onChange}
              prefix="R$"
              step={1}
              help="Quanto custa produzir ou comprar cada unidade vendida (CMV)"
            />
            <InputField
              label="Taxa do Gateway"
              field="taxaGateway"
              value={inputs.taxaGateway}
              onChange={onChange}
              suffix="%"
              step={0.1}
              min={0}
              max={100}
              help="Taxa cobrada pelo meio de pagamento (ex: Pagar.me, Mercado Pago)"
            />
            <InputField
              label="Impostos sobre Receita"
              field="taxaImpostos"
              value={inputs.taxaImpostos}
              onChange={onChange}
              suffix="%"
              step={0.1}
              min={0}
              max={100}
              help="Percentual de impostos incidentes sobre o faturamento"
            />
            <InputField
              label="Frete por Pedido"
              field="freteUnitario"
              value={inputs.freteUnitario}
              onChange={onChange}
              prefix="R$"
              step={1}
              help="Custo médio de frete por pedido enviado"
            />
          </div>
        </div>

        <Separator />

        {/* Investimento */}
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">
            Investimento em Tráfego Pago
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <InputField
              label="Investimento em Anúncios"
              field="budgetAnuncios"
              value={inputs.budgetAnuncios}
              onChange={onChange}
              prefix="R$"
              step={500}
              help="Valor total investido em anúncios (Meta Ads, Google Ads, etc.)"
            />
            <InputField
              label="Custo por Venda (CPA)"
              field="cpaAlvo"
              value={inputs.cpaAlvo}
              onChange={onChange}
              prefix="R$"
              step={1}
              help="Quanto você paga em média para conquistar cada venda via anúncios"
            />
          </div>
        </div>
      </div>
    </Card>
  );
});
