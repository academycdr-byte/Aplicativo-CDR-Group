"use server";

import { prisma } from "@/lib/prisma";
import { getSessionWithOrg } from "@/lib/session";
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
    complemento: string | null;
    cidade: string | null;
    uf: string | null;
    cep: string | null;
  };
  itens: ItemDoPedido[];
  totalPecas: number;
  pesoGramas: number;
  pesoEstimado: boolean;
  valorTotal: number;
  pendencias: string[];
};

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
  const documento = extrairDocumento(pedido);
  const telefone = extrairTelefone(pedido);
  const cep = texto(endereco?.zip);

  const pendencias: string[] = [];
  if (!endereco) pendencias.push("Pedido sem endereço de entrega");
  if (!cep) pendencias.push("Sem CEP");
  if (!texto(endereco?.address1)) pendencias.push("Sem rua e número");
  if (!documento) pendencias.push("Sem CPF do destinatário");
  if (!telefone) pendencias.push("Sem telefone");
  if (peso.estimado) pendencias.push("Peso estimado (produto sem peso cadastrado)");

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
      // colado no address1 e o bairro/complemento no address2.
      logradouro: texto(endereco?.address1),
      complemento: texto(endereco?.address2),
      cidade: texto(endereco?.city),
      uf: texto(endereco?.province_code) ?? texto(endereco?.province),
      cep,
    },
    itens,
    totalPecas,
    pesoGramas: peso.gramas,
    pesoEstimado: peso.estimado,
    valorTotal: numero(registro.totalAmount),
    pendencias,
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
              valorSegurado: pedido.valorTotal,
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

  // bairro: primeiro pedaço do complemento, que é onde a Shopify costuma jogar
  const partes = (complemento ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const bairro = partes[0] ?? "";
  const resto = partes.slice(1).join(", ");

  return { logradouro, numero, bairro, complementoLimpo: resto };
}

export async function enviarPedidoParaMelhorEnvio(params: {
  pedidoId: string;
  servicoId: number;
  transportadoraId: number | null;
}): Promise<{ ok: boolean; mensagem: string; protocolo?: string | null }> {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  if (!contaConfigurada()) {
    return { ok: false, mensagem: "Conta do Melhor Envio ainda não configurada." };
  }

  try {
    const registro = await prisma.order.findFirst({
      where: { id: params.pedidoId, organizationId: ctx.organization.id },
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

    if (!registro) return { ok: false, mensagem: "Pedido não encontrado." };

    const pedido = normalizar({ ...registro, totalAmount: registro.totalAmount });
    if (!pedido) return { ok: false, mensagem: "Pedido sem dados suficientes para envio." };

    if (!pedido.destino.cep || !pedido.destino.cidade || !pedido.destino.uf) {
      return { ok: false, mensagem: "Endereço de entrega incompleto neste pedido." };
    }

    const { logradouro, numero, bairro, complementoLimpo } = separarEndereco(
      pedido.destino.logradouro,
      pedido.destino.complemento
    );

    const marca = `Pedido ${pedido.numero}`;

    const jaEnviado = await envioJaNoCarrinho(marca);
    if (jaEnviado) {
      return {
        ok: false,
        mensagem: `O pedido ${pedido.numero} já está no carrinho do Melhor Envio (${jaEnviado}). Pague por lá para não gerar etiqueta em dobro.`,
      };
    }

    // O saldo é só um aviso: se a consulta falhar, o envio continua.
    let saldoDisponivel: number | null = null;
    try {
      saldoDisponivel = (await consultarSaldo()).disponivel;
    } catch {
      saldoDisponivel = null;
    }

    const resultado = await enviarParaCarrinho({
      servicoId: params.servicoId,
      transportadoraId: params.transportadoraId,
      destinatario: {
        nome: pedido.cliente.nome ?? "Cliente",
        telefone: pedido.cliente.telefone,
        email: pedido.cliente.email,
        documento: pedido.cliente.documento,
        logradouro,
        numero,
        complemento: complementoLimpo || null,
        bairro,
        cidade: pedido.destino.cidade,
        uf: pedido.destino.uf,
        cep: pedido.destino.cep,
      },
      itens: pedido.itens.map((i) => ({
        nome: i.titulo,
        quantidade: i.quantidade,
        valorUnitario: Math.max(pedido.valorTotal / Math.max(pedido.totalPecas, 1), 1),
      })),
      pesoGramas: pedido.pesoGramas,
      valorSegurado: pedido.valorTotal,
      observacao: marca,
      ...CAIXA_PADRAO,
    });

    const aviso =
      saldoDisponivel !== null && saldoDisponivel <= 0
        ? " Atenção: seu saldo no Melhor Envio está zerado, então será preciso recarregar antes de pagar."
        : "";

    return {
      ok: true,
      protocolo: resultado.protocolo,
      mensagem: `Pedido ${pedido.numero} enviado para o carrinho do Melhor Envio.${aviso}`,
    };
  } catch (e) {
    const mensagem =
      e instanceof MelhorEnvioError ? e.message : "Não foi possível enviar este pedido agora.";
    console.error("[envios] falha ao enviar para o carrinho", e);
    return { ok: false, mensagem };
  }
}
