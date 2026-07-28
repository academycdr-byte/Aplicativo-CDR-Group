/**
 * Integração com a API do Melhor Envio.
 *
 * Fala direto com a API deles, sem app intermediário. Isso dá acesso a todas as
 * transportadoras (Correios, Jadlog, Loggi, Total Express, JeT, LATAM), ao
 * contrário dos apps de mercado que só emitem Correios.
 *
 * O token hoje vem de variável de ambiente porque a tabela Integration usa um
 * enum de plataforma que não inclui o Melhor Envio, e mudar o enum exige
 * migration. Quando houver mais de uma loja usando, promover para o banco.
 */

const BASE_PRODUCAO = "https://melhorenvio.com.br/api/v2";
const BASE_SANDBOX = "https://sandbox.melhorenvio.com.br/api/v2";

/** A API do Melhor Envio exige User-Agent identificando a aplicação e um contato. */
const USER_AGENT = "CDR Group Envios (dev@cdrgroup.com)";

/** Dimensões mínimas aceitas pelos Correios, em centímetros. */
const MINIMO = { comprimento: 16, largura: 11, altura: 2 };

/** Teto por chamada, para uma indisponibilidade deles não travar a tela. */
const TEMPO_LIMITE_MS = 20_000;

export type PacoteCotacao = {
  /** peso total em gramas */
  pesoGramas: number;
  comprimentoCm?: number;
  larguraCm?: number;
  alturaCm?: number;
  /** valor declarado, usado para o seguro */
  valorSegurado?: number;
};

export type OpcaoFrete = {
  id: number;
  transportadora: string;
  servico: string;
  preco: number;
  prazoDias: number | null;
  logoUrl: string | null;
};

export type FreteIndisponivel = {
  transportadora: string;
  servico: string;
  motivo: string;
};

export type ResultadoCotacao = {
  opcoes: OpcaoFrete[];
  indisponiveis: FreteIndisponivel[];
};

export class MelhorEnvioError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "MelhorEnvioError";
  }
}

function ehSandbox(): boolean {
  return process.env.MELHOR_ENVIO_SANDBOX === "true";
}

function baseUrl(): string {
  return ehSandbox() ? BASE_SANDBOX : BASE_PRODUCAO;
}

function token(): string {
  const t = ehSandbox()
    ? process.env.MELHOR_ENVIO_TOKEN_SANDBOX
    : process.env.MELHOR_ENVIO_TOKEN;

  if (!t) {
    throw new MelhorEnvioError(
      "Conta do Melhor Envio não configurada. Falta a variável de ambiente com o token."
    );
  }
  return t.trim();
}

/** CEP de origem dos envios, só dígitos. */
export function cepOrigem(): string {
  const cep = (process.env.MELHOR_ENVIO_CEP_ORIGEM ?? "").replace(/\D/g, "");
  if (cep.length !== 8) {
    throw new MelhorEnvioError(
      "CEP de origem não configurado. Sem ele não dá para cotar nem emitir etiqueta."
    );
  }
  return cep;
}

function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

async function chamar<T>(
  caminho: string,
  opcoes: { metodo?: "GET" | "POST"; corpo?: unknown } = {}
): Promise<T> {
  const { metodo = "GET", corpo } = opcoes;

  // Fora do try: falta de token é erro de configuração e precisa chegar com a
  // mensagem certa, não disfarçado de "servidor fora do ar".
  const autorizacao = `Bearer ${token()}`;
  const url = `${baseUrl()}${caminho}`;

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      method: metodo,
      headers: {
        Authorization: autorizacao,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new MelhorEnvioError("O Melhor Envio demorou demais para responder.");
    }
    throw new MelhorEnvioError("Não foi possível falar com o Melhor Envio.");
  }

  if (resposta.status === 401) {
    throw new MelhorEnvioError(
      "O token do Melhor Envio foi recusado. Ele pode ter expirado ou sido apagado.",
      401
    );
  }

  const texto = await resposta.text();
  let dados: unknown = null;
  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    throw new MelhorEnvioError(
      `Resposta inesperada do Melhor Envio (${resposta.status}).`,
      resposta.status
    );
  }

  if (!resposta.ok) {
    const d = dados as { message?: string; error?: string } | null;
    throw new MelhorEnvioError(
      d?.message ?? d?.error ?? `Erro ${resposta.status} no Melhor Envio.`,
      resposta.status
    );
  }

  return dados as T;
}

type RespostaCotacao = {
  id: number;
  name: string;
  price?: string | number;
  delivery_time?: number;
  company?: { name?: string; picture?: string };
  error?: string;
}[];

/**
 * Cota o frete para um pacote. Devolve as opções que dão para contratar e,
 * separadamente, as que a transportadora recusou com o motivo, porque saber
 * por que uma opção sumiu evita suporte depois.
 */
export async function cotarFrete(params: {
  cepDestino: string;
  pacote: PacoteCotacao;
  cepOrigem?: string;
}): Promise<ResultadoCotacao> {
  const destino = somenteDigitos(params.cepDestino);
  if (destino.length !== 8) {
    throw new MelhorEnvioError("CEP de destino inválido.");
  }

  const origem = params.cepOrigem ? somenteDigitos(params.cepOrigem) : cepOrigem();
  const p = params.pacote;

  const corpo = {
    from: { postal_code: origem },
    to: { postal_code: destino },
    package: {
      // a API trabalha em quilos
      weight: Math.max(p.pesoGramas, 1) / 1000,
      length: Math.max(p.comprimentoCm ?? MINIMO.comprimento, MINIMO.comprimento),
      width: Math.max(p.larguraCm ?? MINIMO.largura, MINIMO.largura),
      height: Math.max(p.alturaCm ?? MINIMO.altura, MINIMO.altura),
    },
    options: {
      insurance_value: p.valorSegurado ?? 0,
      receipt: false,
      own_hand: false,
    },
  };

  const resposta = await chamar<RespostaCotacao>("/me/shipment/calculate", {
    metodo: "POST",
    corpo,
  });

  const opcoes: OpcaoFrete[] = [];
  const indisponiveis: FreteIndisponivel[] = [];

  for (const item of resposta ?? []) {
    const transportadora = item.company?.name ?? "";
    if (item.error) {
      indisponiveis.push({ transportadora, servico: item.name, motivo: item.error });
      continue;
    }

    const preco = typeof item.price === "number" ? item.price : parseFloat(String(item.price));
    if (!Number.isFinite(preco)) continue;

    opcoes.push({
      id: item.id,
      transportadora,
      servico: item.name,
      preco,
      prazoDias: item.delivery_time ?? null,
      logoUrl: item.company?.picture ?? null,
    });
  }

  opcoes.sort((a, b) => a.preco - b.preco);

  return { opcoes, indisponiveis };
}

type RespostaConta = {
  firstname?: string;
  lastname?: string;
  email?: string;
  document?: string;
  company?: { document?: string } | null;
};

/** Dados da conta conectada. Serve para conferir remetente e diagnosticar token. */
export async function consultarConta(): Promise<{
  nome: string;
  email: string | null;
  cpf: string | null;
  cnpj: string | null;
  sandbox: boolean;
}> {
  const d = await chamar<RespostaConta>("/me");
  return {
    nome: [d.firstname, d.lastname].filter(Boolean).join(" "),
    email: d.email ?? null,
    cpf: d.document ?? null,
    cnpj: d.company?.document ?? null,
    sandbox: ehSandbox(),
  };
}

export function contaConfigurada(): boolean {
  const t = ehSandbox()
    ? process.env.MELHOR_ENVIO_TOKEN_SANDBOX
    : process.env.MELHOR_ENVIO_TOKEN;
  return Boolean(t && (process.env.MELHOR_ENVIO_CEP_ORIGEM ?? "").replace(/\D/g, "").length === 8);
}
