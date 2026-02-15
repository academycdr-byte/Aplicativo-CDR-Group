// ============================================================
// DRE Performance Calculator - Motor de Calculos
// Todas as funcoes sao puras (sem side effects) para memoizacao
// ============================================================

export type DREInputs = {
  receitaMensal: number;
  numeroPedidos: number;
  percentualDevolucoes: number;
  taxaGateway: number;
  taxaImpostos: number;
  freteUnitario: number;
  cmvUnitario: number;
  cpaAlvo: number;
  budgetAnuncios: number;
};

export type DREResult = {
  ticketMedio: number;
  custoGateway: number;
  custoGatewayPct: number;
  custoDevolucao: number;
  custoDevolucaoPct: number;
  custoImpostos: number;
  custoImpostosPct: number;
  cmv: number;
  cmvPct: number;
  custoFrete: number;
  custoFretePct: number;
  margemBrutaUnit: number;
  margemBrutaPct: number;
  margemContribUnit: number;
  mcPct: number;
  roasRealizado: number;
  lucroBruto: number;
  breakevenRoas: number;
  markup: number;
  pedidosEfetivos: number;
  numeroDevolucoes: number;
};

export type ROASSensitivityPoint = {
  roas: number;
  mcPct: number;
  cpaImplicito: number;
  lucroBruto: number;
};

export type RevenueMatrixCell = {
  roas: number;
  budget: number;
  lucro: number;
};

export type RecompraResult = {
  receitaAdicional: number;
  margemAdicional: number;
  receitaD60: number;
  receitaD90: number;
  margemD60: number;
  margemD90: number;
  margemTotalComRecompra: number;
  margemTotalPct: number;
};

// Valores default baseados na planilha do Ivan
export const DEFAULT_INPUTS: DREInputs = {
  receitaMensal: 400000,
  numeroPedidos: 1264,
  percentualDevolucoes: 5,
  taxaGateway: 3.7,
  taxaImpostos: 3,
  freteUnitario: 0,
  cmvUnitario: 180,
  cpaAlvo: 40,
  budgetAnuncios: 50547,
};

/**
 * Calcula todas as metricas do DRE a partir dos inputs.
 * Funcao pura - segura para useMemo.
 */
export function calculateDRE(inputs: DREInputs): DREResult {
  const {
    receitaMensal,
    numeroPedidos,
    percentualDevolucoes,
    taxaGateway,
    taxaImpostos,
    freteUnitario,
    cmvUnitario,
    cpaAlvo,
    budgetAnuncios,
  } = inputs;

  // Ticket medio
  const ticketMedio = numeroPedidos > 0 ? receitaMensal / numeroPedidos : 0;

  // Devolucoes
  const numeroDevolucoes = Math.round(numeroPedidos * (percentualDevolucoes / 100));
  const pedidosEfetivos = numeroPedidos - numeroDevolucoes;

  // Custos unitarios sobre ticket
  const custoGateway = ticketMedio * (taxaGateway / 100);
  const custoDevolucao = ticketMedio * (percentualDevolucoes / 100);
  const custoImpostos = ticketMedio * (taxaImpostos / 100);
  const cmv = cmvUnitario;
  const custoFrete = freteUnitario;

  // Percentuais sobre ticket
  const custoGatewayPct = taxaGateway;
  const custoDevolucaoPct = percentualDevolucoes;
  const custoImpostosPct = taxaImpostos;
  const cmvPct = ticketMedio > 0 ? (cmv / ticketMedio) * 100 : 0;
  const custoFretePct = ticketMedio > 0 ? (custoFrete / ticketMedio) * 100 : 0;

  // Margem bruta (por unidade, antes do CPA)
  const margemBrutaUnit = ticketMedio - custoGateway - custoDevolucao - custoImpostos - cmv - custoFrete;
  const margemBrutaPct = ticketMedio > 0 ? (margemBrutaUnit / ticketMedio) * 100 : 0;

  // Margem de contribuicao (por unidade, apos CPA)
  const margemContribUnit = margemBrutaUnit - cpaAlvo;
  const mcPct = ticketMedio > 0 ? (margemContribUnit / ticketMedio) * 100 : 0;

  // ROAS realizado
  const roasRealizado = budgetAnuncios > 0 ? receitaMensal / budgetAnuncios : 0;

  // Lucro bruto (usa total de pedidos porque devolucao ja esta no custo unitario)
  const lucroBruto = margemContribUnit * numeroPedidos;

  // ROAS breakeven: ponto onde MC% = 0, ou seja margemBrutaPct = 1/ROAS
  // breakevenRoas = 1 / (margemBrutaPct / 100) = 100 / margemBrutaPct
  const breakevenRoas = margemBrutaPct > 0 ? 100 / margemBrutaPct : 0;

  // Markup
  const markup = cmvUnitario > 0 ? ticketMedio / cmvUnitario : 0;

  return {
    ticketMedio,
    custoGateway,
    custoGatewayPct,
    custoDevolucao,
    custoDevolucaoPct,
    custoImpostos,
    custoImpostosPct,
    cmv,
    cmvPct,
    custoFrete,
    custoFretePct,
    margemBrutaUnit,
    margemBrutaPct,
    margemContribUnit,
    mcPct,
    roasRealizado,
    lucroBruto,
    breakevenRoas,
    markup,
    pedidosEfetivos,
    numeroDevolucoes,
  };
}

/**
 * Calcula MC% para diferentes niveis de ROAS.
 * Para cada ROAS X: CPA implicito = Ticket/X, MC% = margemBrutaPct - (100/X)
 */
export function calculateROASSensitivity(
  inputs: DREInputs,
  roasLevels: number[]
): ROASSensitivityPoint[] {
  const dre = calculateDRE(inputs);

  return roasLevels.map((roas) => {
    const cpaImplicito = roas > 0 ? dre.ticketMedio / roas : 0;
    const mcUnit = dre.margemBrutaUnit - cpaImplicito;
    const mcPct = dre.ticketMedio > 0 ? (mcUnit / dre.ticketMedio) * 100 : 0;
    const lucroBruto = mcUnit * dre.pedidosEfetivos;

    return { roas, mcPct, cpaImplicito, lucroBruto };
  });
}

/**
 * Calcula matriz de lucro para combinacoes ROAS x Budget.
 * Cada celula: receita gerada - budget - custos variaveis.
 */
export function calculateRevenueMatrix(
  inputs: DREInputs,
  roasLevels: number[],
  budgetLevels: number[]
): RevenueMatrixCell[][] {
  const dre = calculateDRE(inputs);

  // Custo variavel por unidade (tudo exceto CPA, que e determinado pelo ROAS/budget)
  const custoVarUnit =
    dre.custoGateway + dre.custoDevolucao + dre.custoImpostos + dre.cmv + dre.custoFrete;

  return roasLevels.map((roas) =>
    budgetLevels.map((budget) => {
      const receita = roas * budget;
      const pedidos = dre.ticketMedio > 0 ? receita / dre.ticketMedio : 0;
      const custosVariaveis = custoVarUnit * pedidos;
      const lucro = receita - budget - custosVariaveis;

      return { roas, budget, lucro };
    })
  );
}

/**
 * Calcula impacto de recompra (D+60 e D+90) na margem total.
 */
export function calculateRecompra(
  inputs: DREInputs,
  recompraD60Pct: number,
  recompraD90Pct: number
): RecompraResult {
  const dre = calculateDRE(inputs);

  // Recompras nao tem custo de aquisicao (CPA = 0), apenas custos variaveis
  const pedidosD60 = inputs.numeroPedidos * (recompraD60Pct / 100);
  const pedidosD90 = inputs.numeroPedidos * (recompraD90Pct / 100);

  const receitaD60 = pedidosD60 * dre.ticketMedio;
  const receitaD90 = pedidosD90 * dre.ticketMedio;
  const receitaAdicional = receitaD60 + receitaD90;

  // Margem da recompra = margem bruta unitaria (sem CPA)
  const margemD60 = pedidosD60 * dre.margemBrutaUnit;
  const margemD90 = pedidosD90 * dre.margemBrutaUnit;
  const margemAdicional = margemD60 + margemD90;

  // Margem total combinada
  const margemTotalComRecompra = dre.lucroBruto + margemAdicional;
  const receitaTotal = inputs.receitaMensal + receitaAdicional;
  const margemTotalPct = receitaTotal > 0 ? (margemTotalComRecompra / receitaTotal) * 100 : 0;

  return {
    receitaAdicional,
    margemAdicional,
    receitaD60,
    receitaD90,
    margemD60,
    margemD90,
    margemTotalComRecompra,
    margemTotalPct,
  };
}

// Budget levels para a matriz (escala geometrica ~25% de crescimento)
export const DEFAULT_BUDGET_LEVELS = [
  50547, 63183, 78979, 98724, 123405, 154256, 192820, 241025, 301281, 376601,
];

// ROAS levels para a matriz
export const DEFAULT_ROAS_LEVELS = [
  1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12,
];

// ROAS levels para sensitivity (inteiros de 1 a 13)
export const SENSITIVITY_ROAS_LEVELS = Array.from({ length: 13 }, (_, i) => i + 1);

// Formatacao
export function formatBRL(value: number, compact = false): string {
  if (compact) {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) {
      return `${value < 0 ? "-" : ""}R$ ${(abs / 1_000_000).toFixed(1)}M`;
    }
    if (abs >= 1_000) {
      return `${value < 0 ? "-" : ""}R$ ${(abs / 1_000).toFixed(0)}k`;
    }
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPct(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}
