"use server";

import { prisma } from "@/lib/prisma";
import { getSessionWithOrg } from "@/lib/session";
import { fetchShopifyOrderDocuments, syncShopifyOrders } from "@/lib/integrations/shopify";
import {
  cotarFrete,
  contaConfigurada,
  consultarSaldo,
  enviarParaCarrinho,
  envioJaNoCarrinho,
  MelhorEnvioError,
  type OpcaoFrete,
  type FreteIndisponivel,
} from "@/lib/integrations/melhor-envio";

/**
 * Módulo de Envios — Etapa 1 (leitura)
 *
 * Lista os pedidos que estão prontos para despachar: pagos e ainda não enviados.
 * Nesta etapa nada é escrito na Shopify e nada é comprado no Melhor Envio;
 * o objetivo é conferir se os dados que a etiqueta exige chegam completos.
 *
 * A fonte é a tabela `orders`, que o sync da Shopify já preenche com o pedido
 * cru em `rawData` (REST /orders.json sem `fields`, então vem tudo).
 */

const PESO_PADRAO_GRAMAS = 250;

export type ItemDoPedido = {
  titulo: string;
  variante: string | null;
  sku: string | null;
  quantidade: number;
  gramas: number;
};

export type PedidoParaEnvio = {
  id: string;
  numero: string;
  dataPedido: Date;
  despachoParcial: boolean;
  cliente: {
    nome: string | null;
    email: string | null;
    telefone: string | null;
    documento: string | null;
  };
  destino: {
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    cep: string | null;
  };
  /// true quando os dados de entrega foram corrigidos à mão no painel
  corrigido: boolean;
  /// o frete que o cliente escolheu e pagou no checkout
  fretePago: FretePago | null;
  itens: ItemDoPedido[];
  totalPecas: number;
  pesoGramas: number;
  pesoEstimado: boolean;
  valorTotal: number;
  /// preenchido quando este pedido já foi mandado pro carrinho do Melhor
  /// Envio. Vem do banco (sobrevive a reload), não do estado da tela.
  jaEnviado: JaEnviado | null;
  /// o que impede de gerar a etiqueta
  pendencias: string[];
  /// o que merece atenção mas não impede o envio
  avisos: string[];
};

export type JaEnviado = {
  enviadoEm: Date;
  protocolo: string | null;
  servico: string;
  transportadora: string | null;
  preco: number;
};

export type FretePago = { titulo: string | null; valor: number };

type Json = Record<string, unknown>;

function obj(valor: unknown): Json | null {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? (valor as Json) : null;
}

function texto(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim();
  return limpo.length > 0 ? limpo : null;
}

function numero(valor: unknown): number {
  const n = typeof valor === "number" ? valor : parseFloat(String(valor ?? ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * O Melhor Envio recusa valor monetário com mais de 2 casas decimais (ex.:
 * 99.50666666666667, que sai de uma divisão sem resto exato). Sem isto todo
 * pedido cujo valor total não divide certo pela quantidade de peças falha
 * com "campo unitary_value precisa ser um valor monetário".
 */
function arredondarCentavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * O CPF não tem um lugar fixo no pedido da Shopify: dependendo de como a loja
 * coleta, ele cai em `localization_extensions`, em `note_attributes` ou no campo
 * `company` do endereço. Procura nos três, na ordem mais confiável.
 */
function extrairDocumento(pedido: Json): string | null {
  const ehDocumento = (chave: string) =>
    /cpf|cnpj|documento|tax[_ ]?id/i.test(chave);

  const extensoes = pedido.localization_extensions;
  if (Array.isArray(extensoes)) {
    for (const item of extensoes) {
      const e = obj(item);
      if (!e) continue;
      const chave = String(e.key ?? e.title ?? "");
      const valor = texto(e.value);
      if (valor && (ehDocumento(chave) || /tax_credential/i.test(String(e.purpose ?? "")))) {
        return valor;
      }
    }
  }

  const atributos = pedido.note_attributes;
  if (Array.isArray(atributos)) {
    for (const item of atributos) {
      const a = obj(item);
      if (!a) continue;
      if (ehDocumento(String(a.name ?? ""))) {
        const valor = texto(a.value);
        if (valor) return valor;
      }
    }
  }

  const endereco = obj(pedido.shipping_address);
  const empresa = texto(endereco?.company);
  if (empresa && /^\d[\d.\-/\s]{8,}$/.test(empresa)) return empresa;

  return null;
}

/**
 * O frete que o cliente escolheu no checkout. É o que manda na hora de
 * despachar: o comprador já pagou por aquele serviço e por aquele prazo.
 */
function extrairFretePago(pedido: Json): FretePago | null {
  const linhas = pedido.shipping_lines;
  if (!Array.isArray(linhas) || linhas.length === 0) return null;

  let valor = 0;
  let titulo: string | null = null;

  for (const item of linhas) {
    const l = obj(item);
    if (!l) continue;
    valor += numero(l.discounted_price ?? l.price);
    if (!titulo) titulo = texto(l.title);
  }

  return titulo || valor > 0 ? { titulo, valor } : null;
}

function extrairTelefone(pedido: Json): string | null {
  const endereco = obj(pedido.shipping_address);
  const cliente = obj(pedido.customer);
  return (
    texto(endereco?.phone) ??
    texto(pedido.phone) ??
    texto(cliente?.phone) ??
    null
  );
}

function montarNome(pedido: Json): string | null {
  const endereco = obj(pedido.shipping_address);
  const doEndereco = texto(endereco?.name);
  if (doEndereco) return doEndereco;

  const partes = [texto(endereco?.first_name), texto(endereco?.last_name)].filter(Boolean);
  if (partes.length > 0) return partes.join(" ");

  const cliente = obj(pedido.customer);
  const doCliente = [texto(cliente?.first_name), texto(cliente?.last_name)].filter(Boolean);
  return doCliente.length > 0 ? doCliente.join(" ") : null;
}

/**
 * Peso em gramas, somado item a item sobre o que realmente vai na caixa.
 * A soma manual vem antes do total_weight da Shopify porque aquele total não
 * desconta item reembolsado nem item que não precisa de transporte.
 * Sem peso nenhum, estima e marca como estimado: peso errado vira cobrança
 * extra automática na hora da postagem.
 */
function extrairPeso(
  pedido: Json,
  itens: ItemDoPedido[],
  totalPecas: number
): { gramas: number; estimado: boolean } {
  if (itens.length > 0) {
    // Item sem peso cadastrado entra pelo padrão, e o pedido inteiro passa a
    // contar como estimado: peso a menos é o que gera cobrança extra na postagem.
    let algumSemPeso = false;
    const somado = itens.reduce((acumulado, i) => {
      const unitario = i.gramas > 0 ? i.gramas : ((algumSemPeso = true), PESO_PADRAO_GRAMAS);
      return acumulado + unitario * i.quantidade;
    }, 0);

    if (somado > 0) return { gramas: Math.round(somado), estimado: algumSemPeso };
  }

  const total = numero(pedido.total_weight);
  if (total > 0) return { gramas: Math.round(total), estimado: false };

  return { gramas: Math.max(totalPecas, 1) * PESO_PADRAO_GRAMAS, estimado: true };
}

/**
 * Só sai da fila quem foi despachado por inteiro. Na Shopify, "partial" significa
 * que ainda sobrou item para enviar, então esse pedido continua na lista.
 */
function estaDespachado(pedido: Json): boolean {
  return texto(pedido.fulfillment_status) === "fulfilled";
}

function despachadoParcialmente(pedido: Json): boolean {
  return texto(pedido.fulfillment_status) === "partial";
}

function estaCancelado(pedido: Json): boolean {
  return Boolean(pedido.cancelled_at);
}

function normalizar(registro: {
  id: string;
  externalOrderId: string;
  orderDate: Date;
  customerName: string | null;
  customerEmail: string | null;
  totalAmount: unknown;
  rawData: unknown;
}): PedidoParaEnvio | null {
  const pedido = obj(registro.rawData);
  if (!pedido) return null;
  if (estaDespachado(pedido) || estaCancelado(pedido)) return null;

  const endereco = obj(pedido.shipping_address);
  const itensCrus = Array.isArray(pedido.line_items) ? pedido.line_items : [];

  /**
   * Só entra na caixa o que precisa de transporte. Serviço de personalização e
   * brinde digital vêm com requires_shipping false e não podem contar peça nem peso.
   * Item já reembolsado tem fulfillable_quantity zero e também sai da conta.
   */
  const itens = itensCrus
    .map((item) => {
      const i = obj(item);
      if (!i) return null;
      if (i.requires_shipping === false) return null;

      const restante =
        i.fulfillable_quantity !== undefined && i.fulfillable_quantity !== null
          ? Math.round(numero(i.fulfillable_quantity))
          : Math.round(numero(i.quantity));
      if (restante <= 0) return null;

      return {
        titulo: texto(i.title) ?? texto(i.name) ?? "Item sem nome",
        variante: texto(i.variant_title),
        sku: texto(i.sku),
        quantidade: restante,
        gramas: Math.round(numero(i.grams)),
      };
    })
    .filter((i): i is ItemDoPedido => i !== null);

  const totalPecas = itens.reduce((soma, i) => soma + i.quantidade, 0);
  if (totalPecas === 0) return null; // nada a despachar (tudo digital ou reembolsado)

  const peso = extrairPeso(pedido, itens, totalPecas);
  const partesEndereco = separarEndereco(
    texto(endereco?.address1),
    texto(endereco?.address2)
  );
  const documento = extrairDocumento(pedido);
  const telefone = extrairTelefone(pedido);
  const cep = texto(endereco?.zip);

  const pendencias: string[] = [];
  if (!endereco) pendencias.push("Pedido sem endereço de entrega");
  if (!cep) pendencias.push("Sem CEP");
  if (!texto(endereco?.address1)) pendencias.push("Sem rua e número");
  // o Melhor Envio recusa a etiqueta sem bairro, e a Shopify não tem esse campo
  if (!partesEndereco.bairro) pendencias.push("Sem bairro");
  if (!documento) pendencias.push("Sem CPF do destinatário");
  if (!telefone) pendencias.push("Sem telefone");

  // aviso não impede o envio: só sinaliza risco de cobrança extra na postagem
  const avisos: string[] = [];
  if (peso.estimado) avisos.push("Peso estimado (produto sem peso cadastrado)");

  return {
    id: registro.id,
    numero: texto(pedido.name) ?? `#${registro.externalOrderId}`,
    dataPedido: registro.orderDate,
    despachoParcial: despachadoParcialmente(pedido),
    cliente: {
      nome: montarNome(pedido) ?? registro.customerName,
      email: texto(pedido.email) ?? registro.customerEmail,
      telefone,
      documento,
    },
    destino: {
      // A Shopify não tem campo de bairro nem de número: o número costuma vir
      // colado no address1 e o bairro no address2. Separamos aqui, e o painel
      // permite corrigir quando a separação não acerta.
      logradouro: partesEndereco.logradouro || texto(endereco?.address1),
      numero: partesEndereco.numero,
      complemento: partesEndereco.complementoLimpo || null,
      bairro: partesEndereco.bairro || null,
      cidade: texto(endereco?.city),
      uf: texto(endereco?.province_code) ?? texto(endereco?.province),
      cep,
    },
    corrigido: false,
    fretePago: extrairFretePago(pedido),
    itens,
    totalPecas,
    pesoGramas: peso.gramas,
    pesoEstimado: peso.estimado,
    valorTotal: numero(registro.totalAmount),
    jaEnviado: null,
    pendencias,
    avisos,
  };
}

/**
 * Pedidos pagos e ainda não despachados da loja atual.
 * O filtro de "não despachado" é feito em memória porque o status de envio mora
 * dentro do JSON do pedido, e não numa coluna própria da tabela.
 */
export async function getPedidosParaEnvio(params?: {
  busca?: string;
  limite?: number;
}): Promise<{
  pedidos: PedidoParaEnvio[];
  erro: string | null;
  semIntegracao: boolean;
}> {
  const ctx = await getSessionWithOrg();
  if (!ctx) {
    return { pedidos: [], erro: "Sessão expirada. Entre de novo.", semIntegracao: false };
  }

  // Server action é endpoint público: o limite não pode vir cru do cliente,
  // senão dá para pedir dezenas de milhares de pedidos com o JSON inteiro.
  const LIMITE_MAXIMO = 200;
  const limitePedido = Math.trunc(Number(params?.limite ?? 100));
  const limite = Number.isFinite(limitePedido)
    ? Math.min(Math.max(limitePedido, 1), LIMITE_MAXIMO)
    : 100;

  try {
    // Sem Shopify conectada a lista viria vazia e pareceria "não tem pedido",
    // quando na verdade falta ligar a loja.
    const integracao = await prisma.integration.findUnique({
      where: {
        organizationId_platform: {
          organizationId: ctx.organization.id,
          platform: "SHOPIFY",
        },
      },
      select: { id: true },
    });

    if (!integracao) {
      return { pedidos: [], erro: null, semIntegracao: true };
    }

    const registros = await prisma.order.findMany({
      where: {
        organizationId: ctx.organization.id,
        platform: "SHOPIFY",
        // pedido pago com reembolso parcial continua tendo que ser despachado
        status: { in: ["paid", "partially_refunded"] },
        ...(params?.busca
          ? {
              OR: [
                { customerName: { contains: params.busca, mode: "insensitive" } },
                { customerEmail: { contains: params.busca, mode: "insensitive" } },
                { externalOrderId: { contains: params.busca, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { orderDate: "desc" },
      take: limite * 3, // margem: parte será descartada por já estar despachada
      select: {
        id: true,
        externalOrderId: true,
        orderDate: true,
        customerName: true,
        customerEmail: true,
        totalAmount: true,
        rawData: true,
      },
    });

    const pedidos = registros
      .map((r) => normalizar({ ...r, totalAmount: r.totalAmount }))
      .filter((p): p is PedidoParaEnvio => p !== null)
      .slice(0, limite);

    await aplicarCorrecoes(ctx.organization.id, pedidos);
    await aplicarJaEnviado(ctx.organization.id, pedidos);
    await completarDocumentos(ctx.organization.id, registros, pedidos);
    recalcularPendencias(pedidos);

    return { pedidos, erro: null, semIntegracao: false };
  } catch (e) {
    console.error("[envios] falha ao listar pedidos para envio", e);
    return {
      pedidos: [],
      erro: "Não foi possível carregar os pedidos agora.",
      semIntegracao: false,
    };
  }
}

/**
 * Sobrescreve os dados do pedido com o que foi corrigido à mão no painel.
 * Roda antes de tudo: se o lojista já arrumou o CPF, não precisa nem consultar
 * a Shopify de novo.
 */
async function aplicarCorrecoes(
  organizationId: string,
  pedidos: PedidoParaEnvio[]
): Promise<void> {
  if (pedidos.length === 0) return;

  try {
    const correcoes = await prisma.shipmentContact.findMany({
      where: { organizationId, orderId: { in: pedidos.map((p) => p.id) } },
    });
    if (correcoes.length === 0) return;

    const porPedido = new Map(correcoes.map((c) => [c.orderId, c]));

    for (const pedido of pedidos) {
      const c = porPedido.get(pedido.id);
      if (!c) continue;

      pedido.corrigido = true;
      if (c.name) pedido.cliente.nome = c.name;
      if (c.document) pedido.cliente.documento = c.document;
      if (c.phone) pedido.cliente.telefone = c.phone;
      if (c.email) pedido.cliente.email = c.email;
      if (c.street) pedido.destino.logradouro = c.street;
      if (c.number) pedido.destino.numero = c.number;
      if (c.complement) pedido.destino.complemento = c.complement;
      if (c.district) pedido.destino.bairro = c.district;
      if (c.city) pedido.destino.cidade = c.city;
      if (c.state) pedido.destino.uf = c.state;
      if (c.zip) pedido.destino.cep = c.zip;
    }
  } catch (e) {
    console.error("[envios] falha ao aplicar correções", e);
  }
}

/**
 * Marca os pedidos que já têm um envio registrado no banco. Essa marca é o
 * que sobrevive a um F5: antes disso a única prova de "já enviado" era o
 * estado da tela (some no reload) ou uma consulta ao vivo no carrinho do
 * Melhor Envio (some assim que o item é pago/impresso lá dentro).
 */
async function aplicarJaEnviado(
  organizationId: string,
  pedidos: PedidoParaEnvio[]
): Promise<void> {
  if (pedidos.length === 0) return;

  try {
    const envios = await prisma.melhorEnvioShipment.findMany({
      where: { organizationId, orderId: { in: pedidos.map((p) => p.id) } },
    });
    if (envios.length === 0) return;

    const porPedido = new Map(envios.map((e) => [e.orderId, e]));

    for (const pedido of pedidos) {
      const e = porPedido.get(pedido.id);
      if (!e) continue;

      pedido.jaEnviado = {
        enviadoEm: e.enviadoEm,
        protocolo: e.protocolo,
        servico: e.servico,
        transportadora: e.transportadora,
        preco: numero(e.preco),
      };
    }
  } catch (e) {
    console.error("[envios] falha ao aplicar marca de já enviado", e);
  }
}

/** As pendências são recalculadas no fim, já com correção e CPF buscado. */
function recalcularPendencias(pedidos: PedidoParaEnvio[]): void {
  for (const p of pedidos) {
    const lista: string[] = [];
    if (!p.destino.cep) lista.push("Sem CEP");
    if (!p.destino.logradouro) lista.push("Sem rua e número");
    if (!p.destino.bairro) lista.push("Sem bairro");
    if (!p.cliente.documento) lista.push("Sem CPF do destinatário");
    if (!p.cliente.telefone) lista.push("Sem telefone");
    p.pendencias = lista;
    p.avisos = p.pesoEstimado
      ? ["Peso estimado (produto sem peso cadastrado)"]
      : [];
  }
}

/**
 * Preenche o CPF que falta buscando na Shopify por GraphQL.
 *
 * O sync usa a API REST, e ela NÃO devolve o documento: em loja brasileira o
 * CPF fica em `localizationExtensions`, que só existe no GraphQL. Sem isso todo
 * pedido aparecia como "sem CPF" mesmo tendo o dado lá na Shopify.
 */
async function completarDocumentos(
  organizationId: string,
  registros: { id: string; externalOrderId: string }[],
  pedidos: PedidoParaEnvio[]
): Promise<void> {
  const semDocumento = pedidos.filter((p) => !p.cliente.documento);
  if (semDocumento.length === 0) return;

  const porId = new Map(registros.map((r) => [r.id, r.externalOrderId]));
  const idsExternos = semDocumento
    .map((p) => porId.get(p.id))
    .filter((v): v is string => Boolean(v));

  try {
    const documentos = await fetchShopifyOrderDocuments(organizationId, idsExternos);
    if (documentos.size === 0) return;

    for (const pedido of semDocumento) {
      const externo = porId.get(pedido.id);
      const doc = externo ? documentos.get(externo) : undefined;
      if (!doc) continue;
      pedido.cliente.documento = doc;
      pedido.pendencias = pedido.pendencias.filter((p) => p !== "Sem CPF do destinatário");
    }
  } catch (e) {
    console.error("[envios] falha ao completar documentos", e);
  }
}

/* ------------------------------------------------------------------ *
 * Cotação de frete
 * ------------------------------------------------------------------ */

export type CotacaoDoPedido = {
  pedidoId: string;
  numero: string;
  opcoes: OpcaoFrete[];
  indisponiveis: FreteIndisponivel[];
  erro: string | null;
};

/** Uma camisa embalada. Vira configuração por loja quando houver mais de uma. */
const CAIXA_PADRAO = { comprimentoCm: 17, larguraCm: 12, alturaCm: 4 };

/** Teto de pedidos por vez, para não estourar limite de chamada da API. */
const MAXIMO_POR_COTACAO = 20;

/**
 * Teto por clique no despacho. Cada pedido custa uma cotação mais um envio,
 * então o lote é menor que o da cotação para caber no tempo da requisição.
 */
const MAXIMO_POR_DESPACHO = 8;

/**
 * Quantos pedidos despachar ao mesmo tempo. Cada um faz três ou quatro
 * chamadas ao Melhor Envio, e disparar tudo de uma vez é pedir bloqueio por
 * excesso de requisição.
 */
const CONCORRENCIA_DESPACHO = 4;

/** Roda a tarefa em grupos, para não disparar tudo de uma vez contra a API. */
async function emLotes<T, R>(
  itens: T[],
  tamanho: number,
  tarefa: (item: T) => Promise<R>
): Promise<R[]> {
  const saida: R[] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    saida.push(...(await Promise.all(itens.slice(i, i + tamanho).map(tarefa))));
  }
  return saida;
}

/**
 * Cota o frete dos pedidos escolhidos. Cotação não gasta saldo: só consulta preço.
 * Cada pedido é cotado separadamente porque o destino muda.
 */
export async function cotarPedidos(
  pedidoIds: string[]
): Promise<{ cotacoes: CotacaoDoPedido[]; erro: string | null }> {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { cotacoes: [], erro: "Sessão expirada. Entre de novo." };

  if (!Array.isArray(pedidoIds) || pedidoIds.length === 0) {
    return { cotacoes: [], erro: "Selecione ao menos um pedido." };
  }

  if (!contaConfigurada()) {
    return {
      cotacoes: [],
      erro: "Conta do Melhor Envio ainda não configurada neste ambiente.",
    };
  }

  const ids = pedidoIds.slice(0, MAXIMO_POR_COTACAO);

  try {
    const registros = await prisma.order.findMany({
      where: { id: { in: ids }, organizationId: ctx.organization.id },
      select: {
        id: true,
        externalOrderId: true,
        orderDate: true,
        customerName: true,
        customerEmail: true,
        totalAmount: true,
        rawData: true,
      },
    });

    const pedidos = registros
      .map((r) => normalizar({ ...r, totalAmount: r.totalAmount }))
      .filter((p): p is PedidoParaEnvio => p !== null);

    // sem isto, um CEP corrigido à mão seria cotado com o endereço velho
    await aplicarCorrecoes(ctx.organization.id, pedidos);

    const cotacoes = await Promise.all(
      pedidos.map(async (pedido): Promise<CotacaoDoPedido> => {
        if (!pedido.destino.cep) {
          return {
            pedidoId: pedido.id,
            numero: pedido.numero,
            opcoes: [],
            indisponiveis: [],
            erro: "Pedido sem CEP de entrega.",
          };
        }

        try {
          const { opcoes, indisponiveis } = await cotarFrete({
            cepDestino: pedido.destino.cep,
            pacote: {
              pesoGramas: pedido.pesoGramas,
              ...CAIXA_PADRAO,
              valorSegurado: arredondarCentavos(pedido.valorTotal),
            },
          });
          return {
            pedidoId: pedido.id,
            numero: pedido.numero,
            opcoes,
            indisponiveis,
            erro: null,
          };
        } catch (e) {
          const mensagem =
            e instanceof MelhorEnvioError ? e.message : "Falha ao cotar este pedido.";
          console.error("[envios] falha ao cotar", pedido.numero, e);
          return {
            pedidoId: pedido.id,
            numero: pedido.numero,
            opcoes: [],
            indisponiveis: [],
            erro: mensagem,
          };
        }
      })
    );

    return { cotacoes, erro: null };
  } catch (e) {
    console.error("[envios] falha geral na cotação", e);
    return { cotacoes: [], erro: "Não foi possível cotar agora." };
  }
}

/* ------------------------------------------------------------------ *
 * Ponte para o Melhor Envio
 * ------------------------------------------------------------------ */

/**
 * A Shopify não separa número nem bairro: manda tudo em address1 e address2.
 * O Melhor Envio exige os dois em campos próprios. Esta função quebra o
 * endereço da forma mais confiável possível e deixa claro quando não deu.
 */
function separarEndereco(logradouroCompleto: string | null, complemento: string | null) {
  const linha = (logradouroCompleto ?? "").trim();

  // número costuma ser o último trecho numérico depois de vírgula ou espaço
  const casamento = linha.match(/^(.*?)[,\s]+(\d+[A-Za-z]?)\s*$/);
  const logradouro = (casamento ? casamento[1] : linha).replace(/[,\s]+$/, "").trim();
  const numero = casamento ? casamento[2] : "S/N";

  // bairro: primeiro pedaço do complemento, que é onde a Shopify costuma jogar.
  // Repetição é comum (o cliente escreve o bairro no complemento também), então
  // tudo que só repete o bairro é descartado em vez de virar complemento.
  const partes = (complemento ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const bairro = partes[0] ?? "";
  const resto = partes
    .slice(1)
    .filter((p) => !mesmoTexto(p, bairro))
    .join(", ");

  return { logradouro, numero, bairro, complementoLimpo: resto };
}

/**
 * Reduz um texto a letras e números minúsculos. NFD separa o acento da letra,
 * e o filtro seguinte descarta tudo que não é letra ou número, então o acento
 * sai junto.
 */
function chaveDeTexto(v: string) {
  return v
    .toLowerCase()
    .replace(/\(melhor envio\)/g, "")
    .normalize("NFD")
    .replace(/[^a-z0-9]/g, "");
}

/** Compara dois pedaços de endereço ignorando acento, caixa e pontuação. */
function mesmoTexto(a: string, b: string) {
  return chaveDeTexto(a) === chaveDeTexto(b) && chaveDeTexto(a) !== "";
}

/**
 * Escolhe sozinho por qual serviço despachar.
 *
 * O cliente já escolheu e pagou um frete no checkout, então a primeira opção é
 * repetir exatamente o que ele comprou: é o prazo que ele viu e o serviço que
 * ele aceitou. Quando o nome não bate com nada da cotação (frete fixo, tabela
 * própria, transportadora que saiu do ar), vale o mais barato que atende.
 */
function escolherFrete(
  opcoes: OpcaoFrete[],
  fretePago: FretePago | null
): { opcao: OpcaoFrete; motivo: string } | null {
  if (opcoes.length === 0) return null;

  const maisBarato = opcoes.reduce((a, b) => (b.preco < a.preco ? b : a));

  const titulo = fretePago?.titulo;
  const alvo = titulo ? chaveDeTexto(titulo) : "";

  // Alvo curto demais ("a", "ok") casaria com qualquer coisa por acaso.
  if (alvo.length >= 3) {
    /**
     * O nome do frete na loja pode ser maior ou menor que o do Melhor Envio:
     * "Correios PAC (Melhor Envio) (0.5 kg)" contém o serviço inteiro, mas
     * "PAC" está contido nele. Os dois valem, com preferência nesta ordem:
     * nome idêntico, depois título que contém o serviço (do mais específico
     * para o mais genérico, para "PAC Mini" não virar "PAC"), e por último
     * serviço que contém o título (do mais curto, que é o mais próximo).
     */
    const pontuar = (nome: string) => {
      if (nome === alvo) return { nivel: 3, distancia: 0 };
      if (alvo.includes(nome)) return { nivel: 2, distancia: alvo.length - nome.length };
      if (nome.includes(alvo)) return { nivel: 1, distancia: nome.length - alvo.length };
      return null;
    };

    const candidatos = opcoes
      .map((o) => ({
        opcao: o,
        peso: pontuar(chaveDeTexto(`${o.transportadora} ${o.servico}`)),
      }))
      .filter((c): c is { opcao: OpcaoFrete; peso: { nivel: number; distancia: number } } =>
        c.peso !== null
      )
      .sort((a, b) => b.peso.nivel - a.peso.nivel || a.peso.distancia - b.peso.distancia);

    if (candidatos[0]) {
      return {
        opcao: candidatos[0].opcao,
        motivo: `é o mesmo serviço que o cliente escolheu no checkout (${titulo})`,
      };
    }
  }

  return {
    opcao: maisBarato,
    motivo: titulo
      ? `é o mais barato que atende este CEP (o "${titulo}" da loja não tem equivalente no Melhor Envio)`
      : "é o mais barato que atende este CEP",
  };
}

/**
 * Puxa as vendas novas da Shopify e devolve a lista já atualizada.
 *
 * Existe para a tela de Envios ter um botão só: antes era preciso sincronizar
 * a loja numa página e recarregar os pedidos noutra, dois cliques em lugares
 * diferentes para uma coisa só.
 */
export async function atualizarPedidosParaEnvio(params?: { busca?: string }): Promise<{
  pedidos: PedidoParaEnvio[];
  erro: string | null;
  semIntegracao: boolean;
  avisoDeSincronia: string | null;
}> {
  const ctx = await getSessionWithOrg();
  if (!ctx) {
    return {
      pedidos: [],
      erro: "Sessão expirada. Entre de novo.",
      semIntegracao: false,
      avisoDeSincronia: null,
    };
  }

  // A sincronia é o melhor esforço: se a Shopify demorar ou recusar, ainda
  // vale mostrar o que já está no banco em vez de deixar a tela vazia.
  let avisoDeSincronia: string | null = null;
  try {
    const r = await syncShopifyOrders(ctx.organization.id, { timeBudgetMs: 25_000 });
    // a mensagem de erro do sync é técnica e em inglês, não serve para o lojista
    if (r.error) {
      console.error("[envios] sync da Shopify voltou com erro", r.error);
      avisoDeSincronia =
        "Não deu para buscar as vendas mais novas agora. A lista abaixo é a da última sincronização.";
    }
  } catch (e) {
    console.error("[envios] falha ao sincronizar com a Shopify", e);
    avisoDeSincronia =
      "Não deu para falar com a Shopify agora. A lista abaixo é a da última sincronização.";
  }

  const lista = await getPedidosParaEnvio({ busca: params?.busca });
  return { ...lista, avisoDeSincronia };
}

/** Campos do pedido que o módulo de envios precisa ler do banco. */
const SELECAO_PEDIDO = {
  id: true,
  externalOrderId: true,
  orderDate: true,
  customerName: true,
  customerEmail: true,
  totalAmount: true,
  rawData: true,
} as const;

type RegistroPedido = {
  id: string;
  externalOrderId: string;
  orderDate: Date;
  customerName: string | null;
  customerEmail: string | null;
  totalAmount: unknown;
  rawData: unknown;
};

/**
 * Deixa os pedidos prontos para despachar: correção manual por cima do que veio
 * da loja, CPF buscado na Shopify quando falta, e pendências recalculadas com
 * tudo isso já aplicado.
 */
async function prepararPedidos(
  organizationId: string,
  registros: RegistroPedido[]
): Promise<PedidoParaEnvio[]> {
  const pedidos = registros
    .map((r) => normalizar(r))
    .filter((p): p is PedidoParaEnvio => p !== null);

  await aplicarCorrecoes(organizationId, pedidos);
  await aplicarJaEnviado(organizationId, pedidos);
  await completarDocumentos(organizationId, registros, pedidos);
  recalcularPendencias(pedidos);

  return pedidos;
}

/**
 * Grava no banco que este pedido foi mandado pro carrinho do Melhor Envio.
 * É o que faz a marca sobreviver a um F5, em vez de depender só do estado
 * da tela ou de uma consulta ao vivo que some assim que o item é pago.
 */
async function registrarEnvio(
  organizationId: string,
  pedido: PedidoParaEnvio,
  opcao: OpcaoFrete,
  protocolo: string | null
): Promise<void> {
  try {
    await prisma.melhorEnvioShipment.upsert({
      where: { orderId: pedido.id },
      create: {
        orderId: pedido.id,
        organizationId,
        protocolo,
        servico: opcao.servico,
        transportadora: opcao.transportadora || null,
        preco: opcao.preco,
      },
      update: {
        protocolo,
        servico: opcao.servico,
        transportadora: opcao.transportadora || null,
        preco: opcao.preco,
        enviadoEm: new Date(),
      },
    });
  } catch (e) {
    // Não travar o retorno pro lojista por causa disso: o envio já aconteceu
    // no Melhor Envio. Mas se este upsert falhar, a marca não fica salva e
    // o pedido volta a aparecer como não enviado na próxima listagem — a
    // única rede que sobra aí é a consulta ao vivo envioJaNoCarrinho, que é
    // justamente a que falha depois que o item é pago/impresso.
    console.error("[envios] falha ao registrar envio no banco", pedido.numero, e);
  }
}

/**
 * Coloca um pedido no carrinho do Melhor Envio. Não paga e não gera etiqueta:
 * isso o lojista faz lá dentro, em lote, onde já tem saldo e impressão junta.
 */
async function colocarNoCarrinho(
  pedido: PedidoParaEnvio,
  servicoId: number,
  transportadoraId: number | null
): Promise<{ ok: boolean; mensagem: string; protocolo: string | null; jaEstava: boolean }> {
  if (!pedido.destino.cep || !pedido.destino.cidade || !pedido.destino.uf) {
    return {
      ok: false,
      mensagem: "Endereço de entrega incompleto neste pedido.",
      protocolo: null,
      jaEstava: false,
    };
  }

  const marca = `Pedido ${pedido.numero}`;

  // Já estar no carrinho não é falha: é exatamente o resultado que se queria.
  // Tratar como erro faria o lojista tentar de novo achando que não foi.
  const jaEnviado = await envioJaNoCarrinho(marca);
  if (jaEnviado) {
    return {
      ok: true,
      protocolo: jaEnviado,
      jaEstava: true,
      mensagem: `O pedido ${pedido.numero} já estava no carrinho do Melhor Envio (${jaEnviado}), então não foi mandado de novo.`,
    };
  }

  const resultado = await enviarParaCarrinho({
    servicoId,
    transportadoraId,
    destinatario: {
      nome: pedido.cliente.nome ?? "Cliente",
      telefone: pedido.cliente.telefone,
      email: pedido.cliente.email,
      documento: pedido.cliente.documento,
      logradouro: pedido.destino.logradouro ?? "",
      numero: pedido.destino.numero ?? "S/N",
      complemento: pedido.destino.complemento,
      bairro: pedido.destino.bairro ?? "",
      cidade: pedido.destino.cidade,
      uf: pedido.destino.uf,
      cep: pedido.destino.cep,
    },
    itens: pedido.itens.map((i) => ({
      nome: i.titulo,
      quantidade: i.quantidade,
      valorUnitario: arredondarCentavos(
        Math.max(pedido.valorTotal / Math.max(pedido.totalPecas, 1), 1)
      ),
    })),
    pesoGramas: pedido.pesoGramas,
    valorSegurado: arredondarCentavos(pedido.valorTotal),
    observacao: marca,
    ...CAIXA_PADRAO,
  });

  return {
    ok: true,
    protocolo: resultado.protocolo,
    jaEstava: false,
    mensagem: `Pedido ${pedido.numero} enviado para o carrinho do Melhor Envio.`,
  };
}

/** Saldo é só aviso: se a consulta falhar, o envio continua normalmente. */
async function avisoDeSaldo(): Promise<string> {
  try {
    const { disponivel } = await consultarSaldo();
    return disponivel <= 0
      ? " Atenção: seu saldo no Melhor Envio está zerado, então será preciso recarregar antes de pagar."
      : "";
  } catch {
    return "";
  }
}

export type ResultadoDespacho = {
  pedidoId: string;
  numero: string;
  ok: boolean;
  mensagem: string;
  /// transportadora e serviço escolhidos, quando deu certo
  servico: string | null;
  preco: number | null;
  motivo: string | null;
  protocolo: string | null;
  /// já estava no carrinho antes deste clique, então nada foi criado agora
  jaEstava: boolean;
};

/**
 * Despacha os pedidos escolhidos sem perguntar nada.
 *
 * O cliente da loja já escolheu o frete quando comprou, então não faz sentido
 * o lojista escolher de novo: aqui o app cota, repete o serviço que o comprador
 * pagou e manda para o carrinho do Melhor Envio. Pedido com pendência não passa,
 * e o motivo volta na resposta para o lojista arrumar.
 */
export async function despacharPedidos(
  pedidoIds: string[],
  opts?: {
    /// pedidos que o lojista já confirmou reenviar mesmo já tendo um envio
    /// registrado; qualquer id fora desta lista continua bloqueado
    forcarReenvioIds?: string[];
  }
): Promise<{ resultados: ResultadoDespacho[]; erro: string | null }> {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { resultados: [], erro: "Sessão expirada. Entre de novo." };

  if (!Array.isArray(pedidoIds) || pedidoIds.length === 0) {
    return { resultados: [], erro: "Selecione ao menos um pedido." };
  }

  if (!contaConfigurada()) {
    return { resultados: [], erro: "Conta do Melhor Envio ainda não configurada." };
  }

  const ids = pedidoIds.slice(0, MAXIMO_POR_DESPACHO);

  try {
    const registros = await prisma.order.findMany({
      where: { id: { in: ids }, organizationId: ctx.organization.id },
      select: SELECAO_PEDIDO,
    });

    const pedidos = await prepararPedidos(ctx.organization.id, registros);
    const aviso = await avisoDeSaldo();

    const resultados = await emLotes(
      pedidos,
      CONCORRENCIA_DESPACHO,
      async (pedido): Promise<ResultadoDespacho> => {
        const base = {
          pedidoId: pedido.id,
          numero: pedido.numero,
          servico: null,
          preco: null,
          motivo: null,
          protocolo: null,
          jaEstava: false,
        };

        if (pedido.pendencias.length > 0) {
          return {
            ...base,
            ok: false,
            mensagem: `Falta ${pedido.pendencias.join(", ").toLowerCase()}. Corrija os dados de entrega e tente de novo.`,
          };
        }

        // Despacho em lote nunca reenvia sozinho um pedido que o banco já
        // marca como enviado: isso era o buraco que deixava um segundo
        // clique criar uma segunda etiqueta. Só passa quem o lojista marcou
        // explicitamente para reenviar (forcarReenvioIds), depois de confirmar.
        if (pedido.jaEnviado && !opts?.forcarReenvioIds?.includes(pedido.id)) {
          return {
            ...base,
            ok: false,
            mensagem: `Pedido ${pedido.numero} já foi enviado para o Melhor Envio (${pedido.jaEnviado.transportadora ?? ""} ${pedido.jaEnviado.servico}). Use "Reenviar" nesse pedido se quiser mandar de novo mesmo assim.`,
          };
        }

        try {
          const { opcoes } = await cotarFrete({
            cepDestino: pedido.destino.cep!,
            pacote: {
              pesoGramas: pedido.pesoGramas,
              ...CAIXA_PADRAO,
              valorSegurado: arredondarCentavos(pedido.valorTotal),
            },
          });

          const escolha = escolherFrete(opcoes, pedido.fretePago);
          if (!escolha) {
            return {
              ...base,
              ok: false,
              mensagem: "Nenhuma transportadora atende este CEP com o peso deste pedido.",
            };
          }

          const envio = await colocarNoCarrinho(
            pedido,
            escolha.opcao.id,
            escolha.opcao.transportadoraId
          );

          if (envio.ok && !envio.jaEstava) {
            await registrarEnvio(ctx.organization.id, pedido, escolha.opcao, envio.protocolo);
          }

          return {
            ...base,
            ok: envio.ok,
            mensagem: envio.ok ? envio.mensagem + aviso : envio.mensagem,
            servico:
              envio.ok && !envio.jaEstava
                ? `${escolha.opcao.transportadora} ${escolha.opcao.servico}`
                : null,
            preco: envio.ok && !envio.jaEstava ? escolha.opcao.preco : null,
            motivo: envio.ok && !envio.jaEstava ? escolha.motivo : null,
            protocolo: envio.protocolo,
            jaEstava: envio.jaEstava,
          };
        } catch (e) {
          const mensagem =
            e instanceof MelhorEnvioError ? e.message : "Não foi possível despachar este pedido.";
          console.error("[envios] falha ao despachar", pedido.numero, e);
          return { ...base, ok: false, mensagem };
        }
      }
    );

    // Pedido que não coube no lote ou que o banco não devolveu precisa voltar
    // com resposta própria: sem isso a tela conta como sucesso o que nem foi
    // tentado, e o lojista acha que despachou.
    const tentados = new Set(resultados.map((r) => r.pedidoId));
    const naoTentados: ResultadoDespacho[] = pedidoIds
      .filter((id) => !tentados.has(id))
      .map((id) => ({
        pedidoId: id,
        numero: pedidos.find((p) => p.id === id)?.numero ?? "",
        ok: false,
        servico: null,
        preco: null,
        motivo: null,
        protocolo: null,
        jaEstava: false,
        mensagem: ids.includes(id)
          ? "Este pedido não pôde ser preparado para envio. Atualize a lista e tente de novo."
          : `Só dá para enviar ${MAXIMO_POR_DESPACHO} por vez. Este ficou de fora, é só selecionar e enviar de novo.`,
      }));

    return { resultados: [...resultados, ...naoTentados], erro: null };
  } catch (e) {
    console.error("[envios] falha geral no despacho", e);
    return { resultados: [], erro: "Não foi possível despachar agora." };
  }
}

/**
 * Envio com o serviço escolhido à mão, para quando o lojista quer trocar a
 * transportadora que o app escolheria sozinho, ou para reenviar de propósito
 * um pedido que o banco já marca como enviado (forcarReenvio).
 */
export async function enviarPedidoParaMelhorEnvio(params: {
  pedidoId: string;
  servicoId: number;
  transportadoraId: number | null;
  transportadoraNome?: string;
  servicoNome?: string;
  preco?: number;
  /// true quando o lojista já confirmou que quer mandar de novo mesmo
  /// sabendo que este pedido já tem um envio registrado
  forcarReenvio?: boolean;
}): Promise<{
  ok: boolean;
  mensagem: string;
  protocolo?: string | null;
  /// true quando a chamada foi bloqueada só porque falta a confirmação de
  /// reenvio; a tela deve perguntar e chamar de novo com forcarReenvio: true
  precisaConfirmarReenvio?: boolean;
  jaEnviadoAntes?: JaEnviado;
}> {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  if (!contaConfigurada()) {
    return { ok: false, mensagem: "Conta do Melhor Envio ainda não configurada." };
  }

  try {
    const registro = await prisma.order.findFirst({
      where: { id: params.pedidoId, organizationId: ctx.organization.id },
      select: SELECAO_PEDIDO,
    });

    if (!registro) return { ok: false, mensagem: "Pedido não encontrado." };

    const [pedido] = await prepararPedidos(ctx.organization.id, [registro]);
    if (!pedido) return { ok: false, mensagem: "Pedido sem dados suficientes para envio." };

    if (pedido.pendencias.length > 0) {
      return {
        ok: false,
        mensagem: `Falta ${pedido.pendencias.join(", ").toLowerCase()}. Corrija os dados de entrega e tente de novo.`,
      };
    }

    if (pedido.jaEnviado && !params.forcarReenvio) {
      return {
        ok: false,
        precisaConfirmarReenvio: true,
        jaEnviadoAntes: pedido.jaEnviado,
        mensagem: `Este pedido já foi enviado para o Melhor Envio (${pedido.jaEnviado.transportadora ?? ""} ${pedido.jaEnviado.servico}). Confirme se quer mandar de novo mesmo assim.`,
      };
    }

    const aviso = await avisoDeSaldo();
    const envio = await colocarNoCarrinho(pedido, params.servicoId, params.transportadoraId);

    if (envio.ok && !envio.jaEstava) {
      const opcao: OpcaoFrete = {
        id: params.servicoId,
        transportadoraId: params.transportadoraId,
        transportadora: params.transportadoraNome ?? "",
        servico: params.servicoNome ?? "Serviço escolhido manualmente",
        preco: params.preco ?? 0,
        prazoDias: null,
        logoUrl: null,
      };
      await registrarEnvio(ctx.organization.id, pedido, opcao, envio.protocolo);
    }

    return {
      ok: envio.ok,
      protocolo: envio.protocolo,
      mensagem: envio.ok ? envio.mensagem + aviso : envio.mensagem,
    };
  } catch (e) {
    const mensagem =
      e instanceof MelhorEnvioError ? e.message : "Não foi possível enviar este pedido agora.";
    console.error("[envios] falha ao enviar para o carrinho", e);
    return { ok: false, mensagem };
  }
}

/* ------------------------------------------------------------------ *
 * Correção manual dos dados de entrega
 * ------------------------------------------------------------------ */

export type DadosEntregaEditaveis = {
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
};

/** Devolve o que já foi corrigido à mão para este pedido, se houver. */
export async function getCorrecaoEntrega(
  pedidoId: string
): Promise<Partial<DadosEntregaEditaveis> | null> {
  const ctx = await getSessionWithOrg();
  if (!ctx) return null;

  const c = await prisma.shipmentContact.findFirst({
    where: { orderId: pedidoId, organizationId: ctx.organization.id },
  });
  if (!c) return null;

  return {
    nome: c.name ?? "",
    documento: c.document ?? "",
    telefone: c.phone ?? "",
    email: c.email ?? "",
    logradouro: c.street ?? "",
    numero: c.number ?? "",
    complemento: c.complement ?? "",
    bairro: c.district ?? "",
    cidade: c.city ?? "",
    uf: c.state ?? "",
    cep: c.zip ?? "",
  };
}

/**
 * Salva a correção dos dados de entrega. Campo vazio significa "não corrigir",
 * então o valor original da Shopify continua valendo para ele.
 */
export async function salvarCorrecaoEntrega(
  pedidoId: string,
  dados: Partial<DadosEntregaEditaveis>
): Promise<{ ok: boolean; mensagem: string }> {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const limpar = (v: string | undefined) => {
    const t = (v ?? "").trim();
    return t.length > 0 ? t : null;
  };

  const documento = limpar(dados.documento)?.replace(/\D/g, "") ?? null;
  if (documento && documento.length !== 11 && documento.length !== 14) {
    return { ok: false, mensagem: "O CPF precisa ter 11 dígitos e o CNPJ, 14." };
  }

  const cep = limpar(dados.cep)?.replace(/\D/g, "") ?? null;
  if (cep && cep.length !== 8) {
    return { ok: false, mensagem: "O CEP precisa ter 8 dígitos." };
  }

  const uf = limpar(dados.uf)?.toUpperCase() ?? null;
  if (uf && uf.length !== 2) {
    return { ok: false, mensagem: "O estado deve ser a sigla de 2 letras, como SP." };
  }

  try {
    const pertence = await prisma.order.findFirst({
      where: { id: pedidoId, organizationId: ctx.organization.id },
      select: { id: true },
    });
    if (!pertence) return { ok: false, mensagem: "Pedido não encontrado." };

    const valores = {
      name: limpar(dados.nome),
      document: documento,
      phone: limpar(dados.telefone),
      email: limpar(dados.email),
      street: limpar(dados.logradouro),
      number: limpar(dados.numero),
      complement: limpar(dados.complemento),
      district: limpar(dados.bairro),
      city: limpar(dados.cidade),
      state: uf,
      zip: cep,
    };

    await prisma.shipmentContact.upsert({
      where: { orderId: pedidoId },
      create: { orderId: pedidoId, organizationId: ctx.organization.id, ...valores },
      update: valores,
    });

    return { ok: true, mensagem: "Dados de entrega atualizados." };
  } catch (e) {
    console.error("[envios] falha ao salvar correção de entrega", e);
    return { ok: false, mensagem: "Não foi possível salvar agora." };
  }
}
