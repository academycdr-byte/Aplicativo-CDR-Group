import { prisma } from "@/lib/prisma";
import {
  buscarEtiqueta,
  codigoDeRastreio,
  contaConfigurada,
  etiquetaCancelada,
  linkDeRastreio,
  MelhorEnvioError,
  type EtiquetaMelhorEnvio,
} from "@/lib/integrations/melhor-envio";
import { marcarPedidoComoEnviado } from "@/lib/integrations/shopify";

/**
 * Volta do rastreio: pedido que o app mandou para o carrinho do Melhor Envio
 * ganha baixa na Shopify assim que a etiqueta é gerada lá, com o código e o
 * link de rastreio, e a Shopify avisa o cliente por e-mail.
 *
 * Antes disso a equipe copiava o código no Melhor Envio e digitava pedido a
 * pedido na Shopify. Roda sozinho pelo cron e também quando a tela de Envios
 * é aberta.
 *
 * Não grava nada no banco: quem diz se o pedido já foi processado é a própria
 * Shopify, então rodar duas vezes seguidas não duplica nada.
 */

/**
 * Item no carrinho do Melhor Envio expira em 7 dias; duas semanas cobrem a
 * etiqueta paga e gerada com folga sem reconsultar envio antigo para sempre.
 */
const JANELA_DIAS = 14;

/** Mesmo ritmo do despacho: a API deles bloqueia rajada de chamadas. */
const CONCORRENCIA = 4;

export type PedidoBaixado = {
  pedidoId: string;
  numero: string;
  codigo: string;
  transportadora: string | null;
};

export type ResumoRastreio = {
  /** false quando a conta do Melhor Envio não está configurada no app */
  ativo: boolean;
  conferidos: number;
  baixados: PedidoBaixado[];
  /** no carrinho ou pagos, mas sem etiqueta gerada ainda */
  aguardandoEtiqueta: number;
  /** sobraram para a próxima rodada por causa do tempo limite */
  adiados: number;
  semPermissaoShopify: boolean;
  problemas: { numero: string; mensagem: string }[];
};

type Candidato = {
  pedidoId: string;
  organizationId: string;
  externalOrderId: string;
  numero: string;
  protocolo: string;
  transportadora: string | null;
};

function resumoVazio(ativo: boolean): ResumoRastreio {
  return {
    ativo,
    conferidos: 0,
    baixados: [],
    aguardandoEtiqueta: 0,
    adiados: 0,
    semPermissaoShopify: false,
    problemas: [],
  };
}

/** Pedido ainda por despachar segundo a última sincronização com a Shopify. */
function aindaPorDespachar(rawData: unknown): { numero: string } | null {
  const pedido = (rawData ?? {}) as {
    name?: string;
    order_number?: number;
    fulfillment_status?: string | null;
    cancelled_at?: string | null;
  };
  if (pedido.cancelled_at) return null;
  if (pedido.fulfillment_status === "fulfilled") return null;
  return { numero: pedido.name ?? (pedido.order_number ? `#${pedido.order_number}` : "") };
}

async function buscarCandidatos(organizationId?: string): Promise<Candidato[]> {
  const desde = new Date(Date.now() - JANELA_DIAS * 24 * 60 * 60 * 1000);

  const envios = await prisma.melhorEnvioShipment.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
      enviadoEm: { gte: desde },
      protocolo: { not: null },
    },
    select: { orderId: true, organizationId: true, protocolo: true, transportadora: true },
    orderBy: { enviadoEm: "asc" },
  });
  if (envios.length === 0) return [];

  const pedidos = await prisma.order.findMany({
    where: {
      id: { in: envios.map((e) => e.orderId) },
      // pedido pago com reembolso parcial continua tendo que ser despachado
      status: { in: ["paid", "partially_refunded"] },
    },
    select: { id: true, externalOrderId: true, rawData: true },
  });
  const porId = new Map(pedidos.map((p) => [p.id, p]));

  const candidatos: Candidato[] = [];
  for (const envio of envios) {
    const pedido = porId.get(envio.orderId);
    // "sim" é a marca antiga de quando o item foi achado no carrinho sem protocolo
    if (!pedido || !envio.protocolo || envio.protocolo === "sim") continue;
    const pendente = aindaPorDespachar(pedido.rawData);
    if (!pendente) continue;
    candidatos.push({
      pedidoId: pedido.id,
      organizationId: envio.organizationId,
      externalOrderId: pedido.externalOrderId,
      numero: pendente.numero || `pedido ${pedido.externalOrderId}`,
      protocolo: envio.protocolo,
      transportadora: envio.transportadora,
    });
  }
  return candidatos;
}

/**
 * Confere as etiquetas dos pedidos mandados pelo app e dá baixa na Shopify nos
 * que já têm código. Sem organizationId confere todas as lojas (uso do cron).
 */
export async function conferirRastreios(params?: {
  organizationId?: string;
  /** tempo máximo de trabalho; o que sobrar fica para a próxima rodada */
  orcamentoMs?: number;
}): Promise<ResumoRastreio> {
  if (!contaConfigurada()) return resumoVazio(false);

  const resumo = resumoVazio(true);
  const prazo = Date.now() + (params?.orcamentoMs ?? 40_000);
  const candidatos = await buscarCandidatos(params?.organizationId);

  /** loja cuja conexão com a Shopify não deixa dar baixa: não adianta insistir */
  const lojasSemPermissao = new Set<string>();
  /** token do Melhor Envio recusado: as outras consultas falhariam igual */
  const conta = { recusada: null as string | null };

  async function conferir(c: Candidato): Promise<void> {
    if (conta.recusada || Date.now() > prazo) {
      resumo.adiados++;
      return;
    }
    resumo.conferidos++;

    let etiqueta: EtiquetaMelhorEnvio | null;
    try {
      etiqueta = await buscarEtiqueta(c.protocolo);
    } catch (e) {
      if (e instanceof MelhorEnvioError && (e.status === 401 || e.status === 403)) {
        conta.recusada =
          "O Melhor Envio recusou a consulta das etiquetas. O token da conta precisa da permissão de ver pedidos.";
        return;
      }
      resumo.problemas.push({
        numero: c.numero,
        mensagem: e instanceof Error ? e.message : "Falha ao consultar o Melhor Envio.",
      });
      return;
    }

    // apagado do carrinho ou cancelado: não há código para mandar
    if (!etiqueta || etiquetaCancelada(etiqueta)) return;

    const codigo = codigoDeRastreio(etiqueta);
    if (!codigo) {
      resumo.aguardandoEtiqueta++;
      return;
    }

    if (lojasSemPermissao.has(c.organizationId)) return;

    const transportadora = etiqueta.transportadora ?? c.transportadora;
    const baixa = await marcarPedidoComoEnviado(c.organizationId, c.externalOrderId, {
      numero: codigo,
      transportadora,
      url: linkDeRastreio(codigo),
    });

    if (baixa.resultado === "baixado") {
      resumo.baixados.push({ pedidoId: c.pedidoId, numero: c.numero, codigo, transportadora });
    } else if (baixa.resultado === "sem_permissao") {
      lojasSemPermissao.add(c.organizationId);
      resumo.semPermissaoShopify = true;
    } else if (baixa.resultado === "erro") {
      resumo.problemas.push({ numero: c.numero, mensagem: baixa.mensagem });
    }
  }

  for (let i = 0; i < candidatos.length; i += CONCORRENCIA) {
    await Promise.all(candidatos.slice(i, i + CONCORRENCIA).map(conferir));
  }

  if (conta.recusada) resumo.problemas.unshift({ numero: "", mensagem: conta.recusada });

  if (resumo.conferidos > 0 || resumo.problemas.length > 0) {
    console.log(
      `[rastreio] conferidos=${resumo.conferidos} baixados=${resumo.baixados.length}` +
        ` aguardando=${resumo.aguardandoEtiqueta} adiados=${resumo.adiados}` +
        ` semPermissao=${resumo.semPermissaoShopify} problemas=${resumo.problemas.length}`,
      resumo.baixados.map((b) => `${b.numero}:${b.codigo}`).join(" "),
      resumo.problemas.map((p) => `${p.numero}:${p.mensagem}`).join(" | ")
    );
  }

  return resumo;
}
