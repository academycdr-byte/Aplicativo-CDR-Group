// ============================================================
// DRE Performance Calculator - Motor de Calculos
// Todas as funcoes sao puras (sem side effects) para memoizacao
// ============================================================

export type DREInputs = {
  receitaMensal: number;
  numeroPedidos: number;
  percentualDevolucoes: number;
  percentualAprovados: number;
  taxaGateway: number;
  taxaImpostos: number;
  freteUnitario: number;
  cmvUnitario: number;
  cpaAlvo: number;
  budgetAnuncios: number;
  impostoMetaAds: number;
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
  // Campos ajustados por imposto Meta Ads e % aprovados
  budgetEfetivo: number;
  cpaReal: number;
  receitaEfetiva: number;
  pedidosAprovadosCount: number;
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
  percentualAprovados: 100,
  taxaGateway: 3.7,
  taxaImpostos: 3,
  freteUnitario: 0,
  cmvUnitario: 180,
  cpaAlvo: 40,
  budgetAnuncios: 50547,
  impostoMetaAds: 0,
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
    percentualAprovados,
    taxaGateway,
    taxaImpostos,
    freteUnitario,
    cmvUnitario,
    cpaAlvo,
    budgetAnuncios,
    impostoMetaAds,
  } = inputs;

  // Ticket medio
  const ticketMedio = numeroPedidos > 0 ? receitaMensal / numeroPedidos : 0;

  // Pedidos aprovados (antes de devolucoes)
  const pedidosAprovadosCount = Math.round(numeroPedidos * (percentualAprovados / 100));

  // Devolucoes (apenas sobre pedidos aprovados)
  const numeroDevolucoes = Math.round(pedidosAprovadosCount * (percentualDevolucoes / 100));
  const pedidosEfetivos = pedidosAprovadosCount - numeroDevolucoes;

  // Receita efetiva (apenas pedidos aprovados)
  const receitaEfetiva = receitaMensal * (percentualAprovados / 100);

  // Budget efetivo (com imposto sobre Meta Ads)
  const budgetEfetivo = budgetAnuncios * (1 + impostoMetaAds / 100);

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

  // CPA real ajustado:
  // - Imposto Meta Ads: custo real dos anuncios e maior
  // - Pedidos aprovados: cada venda real custa mais porque parte dos pedidos nao converte
  const aprovadosFator = percentualAprovados > 0 ? percentualAprovados / 100 : 1;
  const cpaReal = cpaAlvo * (1 + impostoMetaAds / 100) / aprovadosFator;

  // Margem de contribuicao (por unidade, apos CPA real)
  const margemContribUnit = margemBrutaUnit - cpaReal;
  const mcPct = ticketMedio > 0 ? (margemContribUnit / ticketMedio) * 100 : 0;

  // ROAS realizado (receita efetiva / budget efetivo)
  const roasRealizado = budgetEfetivo > 0 ? receitaEfetiva / budgetEfetivo : 0;

  // Lucro bruto (MC * pedidos aprovados, devolucao ja no custo unitario)
  const lucroBruto = margemContribUnit * pedidosAprovadosCount;

  // ROAS breakeven ajustado:
  // Formula base: 100 / margemBrutaPct
  // Ajuste imposto: multiplica por (1 + impostoMetaAds/100)
  // Ajuste aprovados: divide por (aprovados/100) — menos aprovados = precisa mais ROAS
  const breakevenBase = margemBrutaPct > 0 ? 100 / margemBrutaPct : 0;
  const breakevenRoas = breakevenBase * (1 + impostoMetaAds / 100) / aprovadosFator;

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
    budgetEfetivo,
    cpaReal,
    receitaEfetiva,
    pedidosAprovadosCount,
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

  // Fator de ajuste: imposto Meta Ads + taxa de aprovacao
  const aprovadosFator = inputs.percentualAprovados > 0 ? inputs.percentualAprovados / 100 : 1;
  const ajusteFator = (1 + inputs.impostoMetaAds / 100) / aprovadosFator;

  return roasLevels.map((roas) => {
    // CPA implicito ajustado pelo imposto e aprovacao
    const cpaBase = roas > 0 ? dre.ticketMedio / roas : 0;
    const cpaImplicito = cpaBase * ajusteFator;
    const mcUnit = dre.margemBrutaUnit - cpaImplicito;
    const mcPct = dre.ticketMedio > 0 ? (mcUnit / dre.ticketMedio) * 100 : 0;
    const lucroBruto = mcUnit * dre.pedidosAprovadosCount;

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

  const aprovadosFator = inputs.percentualAprovados > 0 ? inputs.percentualAprovados / 100 : 1;

  return roasLevels.map((roas) =>
    budgetLevels.map((budget) => {
      // Receita efetiva = ROAS reportado * budget, ajustada pela taxa de aprovacao
      const receitaEfetiva = roas * budget * aprovadosFator;
      // Budget efetivo inclui imposto Meta Ads
      const budgetEfetivo = budget * (1 + inputs.impostoMetaAds / 100);
      const pedidos = dre.ticketMedio > 0 ? receitaEfetiva / dre.ticketMedio : 0;
      const custosVariaveis = custoVarUnit * pedidos;
      const lucro = receitaEfetiva - budgetEfetivo - custosVariaveis;

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

  // Recompras: apenas clientes aprovados podem recomprar
  const pedidosD60 = dre.pedidosAprovadosCount * (recompraD60Pct / 100);
  const pedidosD90 = dre.pedidosAprovadosCount * (recompraD90Pct / 100);

  const receitaD60 = pedidosD60 * dre.ticketMedio;
  const receitaD90 = pedidosD90 * dre.ticketMedio;
  const receitaAdicional = receitaD60 + receitaD90;

  // Margem da recompra = margem bruta unitaria (sem CPA)
  const margemD60 = pedidosD60 * dre.margemBrutaUnit;
  const margemD90 = pedidosD90 * dre.margemBrutaUnit;
  const margemAdicional = margemD60 + margemD90;

  // Margem total combinada (usa receita efetiva, nao a total)
  const margemTotalComRecompra = dre.lucroBruto + margemAdicional;
  const receitaTotal = dre.receitaEfetiva + receitaAdicional;
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
