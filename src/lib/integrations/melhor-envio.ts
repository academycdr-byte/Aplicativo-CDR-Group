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
  transportadoraId: number | null;
  transportadora: string;
  servico: string;
  preco: number;
  prazoDias: number | null;
  logoUrl: string | null;
};

/** Correios não aceitam agência de postagem no carrinho; as demais exigem. */
const CORREIOS_ID = 1;

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
  company?: { id?: number; name?: string; picture?: string };
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
      transportadoraId: item.company?.id ?? null,
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

/* ------------------------------------------------------------------ *
 * Ponte: manda o pedido para o carrinho do Melhor Envio
 * ------------------------------------------------------------------ */

export type Remetente = {
  name: string;
  phone: string;
  email: string;
  document: string;
  address: string;
  complement: string;
  number: string;
  district: string;
  city: string;
  state_abbr: string;
  country_id: "BR";
  postal_code: string;
};

type RespostaConta2 = RespostaConta & {
  phone?: { phone?: string };
  address?: {
    postal_code?: string;
    address?: string;
    number?: string;
    complement?: string;
    district?: string;
    city?: { city?: string; state?: { state_abbr?: string } };
  };
};

/**
 * Monta o remetente a partir do cadastro da própria conta do Melhor Envio,
 * para não pedir de novo dados que já estão lá.
 */
export async function consultarRemetente(): Promise<Remetente> {
  const d = await chamar<RespostaConta2>("/me");
  const a = d.address ?? {};

  const remetente: Remetente = {
    name: [d.firstname, d.lastname].filter(Boolean).join(" ").trim(),
    phone: (d.phone?.phone ?? "").replace(/\D/g, ""),
    email: d.email ?? "",
    document: (d.document ?? "").replace(/\D/g, ""),
    address: a.address ?? "",
    complement: a.complement ?? "",
    number: a.number ?? "",
    district: a.district ?? "",
    city: a.city?.city ?? "",
    state_abbr: a.city?.state?.state_abbr ?? "",
    country_id: "BR",
    postal_code: (a.postal_code ?? "").replace(/\D/g, ""),
  };

  const faltando = (["name", "document", "address", "number", "city", "state_abbr", "postal_code"] as const).filter(
    (k) => !remetente[k]
  );
  if (faltando.length > 0) {
    throw new MelhorEnvioError(
      "O endereço de origem no Melhor Envio está incompleto. Complete o cadastro da loja lá antes de enviar."
    );
  }

  return remetente;
}

export async function consultarSaldo(): Promise<{ disponivel: number; reservado: number; dividas: number }> {
  const d = await chamar<{ balance?: number; reserved?: number; debts?: number }>("/me/balance");
  return {
    disponivel: (d.balance ?? 0) - (d.reserved ?? 0),
    reservado: d.reserved ?? 0,
    dividas: d.debts ?? 0,
  };
}

type RespostaAgencia = { id: number; name?: string; distance?: number }[];

/** Agência de postagem mais próxima. Correios não usam; as outras exigem. */
async function buscarAgencia(
  transportadoraId: number,
  cidade: string,
  uf: string
): Promise<number | null> {
  if (transportadoraId === CORREIOS_ID) return null;

  const params = new URLSearchParams({
    company: String(transportadoraId),
    country: "BR",
    state: uf,
    city: cidade,
  });

  try {
    const lista = await chamar<RespostaAgencia>(`/me/shipment/agencies?${params.toString()}`);
    if (!Array.isArray(lista) || lista.length === 0) return null;
    return lista[0].id;
  } catch {
    return null; // sem agência, tenta enviar assim mesmo e deixa a API decidir
  }
}

export type DestinatarioEnvio = {
  nome: string;
  telefone: string | null;
  email: string | null;
  documento: string | null;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
};

export type ItemEnvio = { nome: string; quantidade: number; valorUnitario: number };

/**
 * Coloca o envio no carrinho do Melhor Envio. Não paga e não gera etiqueta:
 * o lojista fecha tudo de uma vez lá dentro, que é onde ele já tem saldo,
 * seleção em lote e impressão conjunta.
 */
export async function enviarParaCarrinho(params: {
  servicoId: number;
  transportadoraId: number | null;
  destinatario: DestinatarioEnvio;
  itens: ItemEnvio[];
  pesoGramas: number;
  valorSegurado: number;
  observacao?: string;
  comprimentoCm?: number;
  larguraCm?: number;
  alturaCm?: number;
}): Promise<{ id: string; protocolo: string | null }> {
  const remetente = await consultarRemetente();
  const d = params.destinatario;

  const documentoDestino = (d.documento ?? "").replace(/\D/g, "");
  if (!documentoDestino) {
    throw new MelhorEnvioError(
      "Este pedido está sem o CPF do cliente, e ele é obrigatório na etiqueta."
    );
  }
  if (documentoDestino === remetente.document) {
    throw new MelhorEnvioError(
      "O CPF do cliente é igual ao do remetente. O Melhor Envio não aceita envio para você mesmo."
    );
  }

  const agencia = params.transportadoraId
    ? await buscarAgencia(params.transportadoraId, d.cidade, d.uf)
    : null;

  const corpo: Record<string, unknown> = {
    service: params.servicoId,
    from: remetente,
    to: {
      name: d.nome,
      phone: (d.telefone ?? "").replace(/\D/g, ""),
      email: d.email ?? "",
      document: documentoDestino,
      address: d.logradouro,
      complement: d.complemento ?? "",
      number: d.numero,
      district: d.bairro,
      city: d.cidade,
      state_abbr: d.uf,
      country_id: "BR",
      postal_code: d.cep.replace(/\D/g, ""),
      note: params.observacao ?? "",
    },
    products: params.itens.map((i) => ({
      name: i.nome,
      quantity: i.quantidade,
      unitary_value: i.valorUnitario,
    })),
    volumes: [
      {
        height: Math.max(params.alturaCm ?? MINIMO.altura, MINIMO.altura),
        width: Math.max(params.larguraCm ?? MINIMO.largura, MINIMO.largura),
        length: Math.max(params.comprimentoCm ?? MINIMO.comprimento, MINIMO.comprimento),
        weight: Math.max(params.pesoGramas, 1) / 1000,
      },
    ],
    options: {
      insurance_value: params.valorSegurado,
      receipt: false,
      own_hand: false,
      reverse: false,
      non_commercial: true, // sem nota fiscal: vai com declaração de conteúdo
      platform: "CDR Group",
    },
  };

  if (agencia) corpo.agency = agencia;

  const resposta = await chamar<{ id?: string; protocol?: string }>("/me/cart", {
    metodo: "POST",
    corpo,
  });

  if (!resposta?.id) {
    throw new MelhorEnvioError("O Melhor Envio não confirmou o envio para o carrinho.");
  }

  return { id: resposta.id, protocolo: resposta.protocol ?? null };
}

export function contaConfigurada(): boolean {
  const t = ehSandbox()
    ? process.env.MELHOR_ENVIO_TOKEN_SANDBOX
    : process.env.MELHOR_ENVIO_TOKEN;
  return Boolean(t && (process.env.MELHOR_ENVIO_CEP_ORIGEM ?? "").replace(/\D/g, "").length === 8);
}
