"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Link2,
  PackageCheck,
  RefreshCw,
  Search,
  Send,
  Truck,
  X,
} from "lucide-react";
import { EditarEntrega } from "./editar-entrega";
import {
  atualizarPedidosParaEnvio,
  cotarPedidos,
  despacharPedidos,
  enviarPedidoParaMelhorEnvio,
  getPedidosParaEnvio,
  type CotacaoDoPedido,
  type PedidoParaEnvio,
  type ResultadoDespacho,
} from "@/actions/shipments";

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

const formatarData = (data: Date | string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(
    new Date(data)
  );

const formatarPeso = (gramas: number) =>
  gramas >= 1000 ? `${(gramas / 1000).toFixed(2).replace(".", ",")} kg` : `${gramas} g`;

const formatarCep = (cep: string | null) => {
  if (!cep) return "";
  const digitos = cep.replace(/\D/g, "");
  return digitos.length === 8 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : cep;
};

export default function EnviosPage() {
  const [pedidos, setPedidos] = useState<PedidoParaEnvio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semIntegracao, setSemIntegracao] = useState(false);
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [expandido, setExpandido] = useState<string | null>(null);
  const [cotacoes, setCotacoes] = useState<Map<string, CotacaoDoPedido>>(new Map());
  const [cotando, setCotando] = useState(false);
  const [erroCotacao, setErroCotacao] = useState<string | null>(null);
  const [editando, setEditando] = useState<PedidoParaEnvio | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [despachando, setDespachando] = useState<Set<string>>(new Set());
  const [resultados, setResultados] = useState<Map<string, ResultadoDespacho>>(new Map());
  const [sincronizando, setSincronizando] = useState(false);
  const [avisoSincronia, setAvisoSincronia] = useState<string | null>(null);
  /// pedido aguardando confirmação de reenvio (já tem envio registrado no banco)
  const [confirmarReenvio, setConfirmarReenvio] = useState<
    { pedido: PedidoParaEnvio; executar: () => void } | null
  >(null);

  const guardarResultados = (lista: ResultadoDespacho[]) => {
    setResultados((atual) => {
      const proximo = new Map(atual);
      lista.forEach((r) => proximo.set(r.pedidoId, r));
      return proximo;
    });
  };

  /**
   * O cliente da loja já escolheu o frete quando comprou, então aqui é um
   * clique só: o app cota, repete o serviço que ele pagou e manda para o
   * carrinho do Melhor Envio.
   */
  const despachar = async (ids: string[], forcarReenvioIds?: string[]) => {
    if (ids.length === 0) return;
    setDespachando(new Set(ids));
    setErroCotacao(null);
    try {
      const r = await despacharPedidos(ids, forcarReenvioIds ? { forcarReenvioIds } : undefined);
      if (r.erro) {
        setErroCotacao(r.erro);
        return;
      }
      guardarResultados(r.resultados);

      // problema fica visível sem precisar procurar: abre a linha e avisa em cima
      const comProblema = r.resultados.find((x) => !x.ok);
      if (comProblema) {
        setExpandido(comProblema.pedidoId);
        setErroCotacao(
          r.resultados.length === 1
            ? comProblema.mensagem
            : `${r.resultados.filter((x) => x.ok).length} de ${r.resultados.length} foram para o carrinho. Veja abaixo o que travou os outros.`
        );
      } else {
        const aviso = r.resultados.find((x) => /atenção/i.test(x.mensagem));
        if (aviso) setErroCotacao(aviso.mensagem);
        setSelecionados(new Set());
      }
    } catch {
      setErroCotacao("Não foi possível falar com o servidor.");
    } finally {
      setDespachando(new Set());
    }
  };

  /**
   * Reenvio de propósito de um pedido que o banco já marca como enviado.
   * Passa só depois do lojista confirmar no dialog: é a trava que faltava
   * para não sair uma segunda etiqueta por um clique sem querer.
   */
  const pedirConfirmacaoDeReenvio = (pedido: PedidoParaEnvio, executar: () => void) => {
    setConfirmarReenvio({ pedido, executar });
  };

  /** Envio com transportadora escolhida à mão, quando o lojista quer trocar. */
  const enviarParaMelhorEnvio = async (
    pedido: PedidoParaEnvio,
    opcao: { id: number; transportadoraId: number | null; transportadora: string; servico: string; preco: number },
    forcarReenvio = false
  ) => {
    const chave = `${pedido.id}-${opcao.id}`;
    setEnviando(chave);
    setErroCotacao(null);
    try {
      const r = await enviarPedidoParaMelhorEnvio({
        pedidoId: pedido.id,
        servicoId: opcao.id,
        transportadoraId: opcao.transportadoraId,
        transportadoraNome: opcao.transportadora,
        servicoNome: opcao.servico,
        preco: opcao.preco,
        forcarReenvio,
      });
      if (r.precisaConfirmarReenvio) {
        setEnviando(null);
        // r.jaEnviadoAntes vem fresco do banco: pedido (closure) pode estar
        // desatualizado se este envio aconteceu sem um reload da lista.
        const pedidoParaDialog = r.jaEnviadoAntes
          ? { ...pedido, jaEnviado: r.jaEnviadoAntes }
          : pedido;
        pedirConfirmacaoDeReenvio(pedidoParaDialog, () =>
          enviarParaMelhorEnvio(pedido, opcao, true)
        );
        return;
      }
      if (r.ok) {
        guardarResultados([
          {
            pedidoId: pedido.id,
            numero: pedido.numero,
            ok: true,
            mensagem: r.mensagem,
            servico: `${opcao.transportadora} ${opcao.servico}`,
            preco: opcao.preco,
            motivo: "foi você que escolheu",
            protocolo: r.protocolo ?? null,
            jaEstava: false,
          },
        ]);
        // o aviso de saldo zerado vem junto da confirmação e precisa aparecer
        if (/atenção/i.test(r.mensagem)) setErroCotacao(r.mensagem);
      } else {
        setErroCotacao(r.mensagem);
      }
    } catch {
      setErroCotacao("Não foi possível falar com o servidor.");
    } finally {
      setEnviando(null);
    }
  };

  const cotar = async () => {
    setCotando(true);
    setErroCotacao(null);
    try {
      const ids = Array.from(selecionados);
      const resultado = await cotarPedidos(ids);
      if (resultado.erro) {
        setErroCotacao(resultado.erro);
      } else {
        setCotacoes((atual) => {
          const proximo = new Map(atual);
          resultado.cotacoes.forEach((c) => proximo.set(c.pedidoId, c));
          return proximo;
        });
        // abre o primeiro cotado para o resultado não ficar escondido
        const primeiro = resultado.cotacoes[0];
        if (primeiro) setExpandido(primeiro.pedidoId);
      }
    } catch {
      setErroCotacao("Não foi possível falar com o servidor.");
    } finally {
      setCotando(false);
    }
  };

  /**
   * A sincronia com a Shopify leva dezenas de segundos. Se o lojista digitar
   * uma busca no meio, a resposta atrasada não pode sobrescrever o resultado
   * filtrado, então só a requisição mais nova tem permissão de escrever.
   */
  const requisicao = useRef(0);

  const carregar = useCallback(async () => {
    const minhaVez = ++requisicao.current;
    setCarregando(true);
    try {
      const resultado = await getPedidosParaEnvio({ busca: buscaAplicada || undefined });
      if (minhaVez !== requisicao.current) return;
      setPedidos(resultado.pedidos);
      setErro(resultado.erro);
      setSemIntegracao(resultado.semIntegracao);
      setSelecionados(new Set());
    } catch {
      // queda de rede ou deploy novo no meio da chamada
      if (minhaVez !== requisicao.current) return;
      setPedidos([]);
      setErro("Não foi possível falar com o servidor. Tente atualizar.");
    } finally {
      if (minhaVez === requisicao.current) setCarregando(false);
    }
  }, [buscaAplicada]);

  /**
   * Puxa as vendas novas da Shopify e já mostra a lista atualizada. É um clique
   * só de propósito: sincronizar num lugar e recarregar noutro era trabalho
   * repetido para uma coisa só.
   */
  const atualizar = useCallback(async () => {
    const minhaVez = ++requisicao.current;
    setSincronizando(true);
    setAvisoSincronia(null);
    try {
      const resultado = await atualizarPedidosParaEnvio({ busca: buscaAplicada || undefined });
      if (minhaVez !== requisicao.current) return;
      setPedidos(resultado.pedidos);
      setErro(resultado.erro);
      setSemIntegracao(resultado.semIntegracao);
      setAvisoSincronia(resultado.avisoDeSincronia);
      setSelecionados(new Set());
    } catch {
      if (minhaVez === requisicao.current) {
        setErro("Não foi possível falar com o servidor. Tente de novo.");
      }
    } finally {
      setSincronizando(false);
      if (minhaVez === requisicao.current) setCarregando(false);
    }
  }, [buscaAplicada]);

  // ao abrir a tela já busca as vendas novas, sem esperar clique
  useEffect(() => {
    atualizar();
    // de propósito só na montagem: trocar a busca não precisa falar com a Shopify
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const primeiraCarga = useRef(true);
  useEffect(() => {
    if (primeiraCarga.current) {
      primeiraCarga.current = false;
      return;
    }
    carregar();
  }, [carregar]);

  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(busca), 400);
    return () => clearTimeout(t);
  }, [busca]);

  const alternar = (id: string) => {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  };

  const alternarTodos = () => {
    setSelecionados((atual) =>
      atual.size === pedidos.length ? new Set() : new Set(pedidos.map((p) => p.id))
    );
  };

  const resumo = useMemo(() => {
    const comPendencia = pedidos.filter((p) => p.pendencias.length > 0).length;
    const pecas = pedidos.reduce((s, p) => s + p.totalPecas, 0);
    return { comPendencia, pecas };
  }, [pedidos]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-[30px] font-bold tracking-[-0.02em]">Envios</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Pedidos pagos que ainda não foram despachados.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={atualizar}
          disabled={sincronizando || carregando}
        >
          <RefreshCw
            className={`w-4 h-4 mr-2 ${sincronizando || carregando ? "animate-spin" : ""}`}
          />
          {sincronizando ? "Buscando vendas novas..." : "Atualizar"}
        </Button>
      </div>

      {semIntegracao ? (
        <Card className="border border-border shadow-none rounded-[20px]">
          <CardContent className="py-12 text-center">
            <Link2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">Loja não conectada</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Conecte a Shopify para os pedidos aparecerem aqui.
            </p>
            <Button asChild size="sm">
              <Link href="/integrations">Ir para Integrações</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border border-border shadow-none rounded-[20px]">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Aguardando envio</p>
                <p className="text-2xl font-bold mt-1">{pedidos.length}</p>
              </CardContent>
            </Card>
            <Card className="border border-border shadow-none rounded-[20px]">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Peças a despachar</p>
                <p className="text-2xl font-bold mt-1">{resumo.pecas}</p>
              </CardContent>
            </Card>
            <Card className="border border-border shadow-none rounded-[20px]">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Com pendência</p>
                <p
                  className={`text-2xl font-bold mt-1 ${
                    resumo.comPendencia > 0 ? "text-amber-600" : ""
                  }`}
                >
                  {resumo.comPendencia}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[240px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, e-mail ou número do pedido"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9 pr-9"
                aria-label="Buscar pedidos"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpar busca"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {selecionados.size > 0 && (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-muted-foreground">
                  {selecionados.size} selecionado{selecionados.size > 1 ? "s" : ""}
                </span>
                <Button
                  size="sm"
                  onClick={() => despachar(Array.from(selecionados))}
                  disabled={despachando.size > 0 || cotando}
                >
                  <Send className={`w-4 h-4 mr-2 ${despachando.size > 0 ? "animate-pulse" : ""}`} />
                  {despachando.size > 0
                    ? "Enviando..."
                    : `Enviar para o Melhor Envio${selecionados.size > 1 ? ` (${selecionados.size})` : ""}`}
                </Button>
                <Button size="sm" variant="ghost" onClick={cotar} disabled={cotando}>
                  <Truck className={`w-4 h-4 mr-2 ${cotando ? "animate-pulse" : ""}`} />
                  {cotando ? "Cotando..." : "Ver preços antes"}
                </Button>
              </div>
            )}
          </div>

          {(erro || erroCotacao) && (
            <Card className="border-destructive/40 shadow-none rounded-[20px]">
              <CardContent className="pt-6 text-sm text-destructive">
                {erro ?? erroCotacao}
              </CardContent>
            </Card>
          )}

          {avisoSincronia && !erro && (
            <Card className="border-amber-500/40 shadow-none rounded-[20px]">
              <CardContent className="pt-6 text-sm text-amber-700">{avisoSincronia}</CardContent>
            </Card>
          )}

          <Card className="border border-border shadow-none rounded-[20px]">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table aria-label="Pedidos aguardando envio">
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col" className="w-[44px]">
                        <Checkbox
                          checked={pedidos.length > 0 && selecionados.size === pedidos.length}
                          onCheckedChange={alternarTodos}
                          aria-label="Selecionar todos"
                          disabled={pedidos.length === 0}
                        />
                      </TableHead>
                      <TableHead scope="col" className="w-[40px]" />
                      <TableHead scope="col">Pedido</TableHead>
                      <TableHead scope="col">Cliente</TableHead>
                      <TableHead scope="col">Destino</TableHead>
                      <TableHead scope="col" className="text-center">
                        Peças
                      </TableHead>
                      <TableHead scope="col" className="text-right">
                        Peso
                      </TableHead>
                      <TableHead scope="col" className="text-right">
                        Valor
                      </TableHead>
                      <TableHead scope="col">Situação</TableHead>
                      <TableHead scope="col" className="text-right">
                        Envio
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {carregando && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                          Carregando pedidos...
                        </TableCell>
                      </TableRow>
                    )}

                    {!carregando && pedidos.length === 0 && !erro && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-12">
                          <PackageCheck className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                          {buscaAplicada ? (
                            <>
                              <p className="font-medium">
                                Nenhum pedido encontrado para “{buscaAplicada}”
                              </p>
                              <Button
                                variant="link"
                                size="sm"
                                className="mt-1"
                                onClick={() => setBusca("")}
                              >
                                Limpar busca
                              </Button>
                            </>
                          ) : (
                            <>
                              <p className="font-medium">Nenhum pedido aguardando envio</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                Assim que entrar uma venda paga, ela aparece aqui.
                              </p>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    )}

                    {!carregando &&
                      pedidos.map((pedido) => (
                        <Fragment key={pedido.id}>
                          <TableRow
                            data-state={selecionados.has(pedido.id) ? "selected" : undefined}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selecionados.has(pedido.id)}
                                onCheckedChange={() => alternar(pedido.id)}
                                aria-label={`Selecionar pedido ${pedido.numero}`}
                              />
                            </TableCell>

                            <TableCell>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandido((a) => (a === pedido.id ? null : pedido.id))
                                }
                                className="text-muted-foreground hover:text-foreground"
                                aria-label={`Ver itens do pedido ${pedido.numero}`}
                                aria-expanded={expandido === pedido.id}
                              >
                                {expandido === pedido.id ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                            </TableCell>

                            <TableCell>
                              <p className="font-medium whitespace-nowrap">{pedido.numero}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatarData(pedido.dataPedido)}
                              </p>
                            </TableCell>

                            <TableCell>
                              <p className="font-medium">{pedido.cliente.nome ?? "Sem nome"}</p>
                              <button
                                type="button"
                                onClick={() => setEditando(pedido)}
                                className="text-xs text-muted-foreground hover:text-foreground underline decoration-dotted underline-offset-2"
                                title="Corrigir os dados de entrega"
                              >
                                {pedido.cliente.documento ?? "sem CPF"}
                                {pedido.corrigido ? " · corrigido" : ""}
                              </button>
                            </TableCell>

                            <TableCell className="max-w-[260px]">
                              <p className="truncate">
                                {pedido.destino.logradouro ?? "Sem endereço"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {[pedido.destino.cidade, pedido.destino.uf]
                                  .filter(Boolean)
                                  .join("/")}
                                {pedido.destino.cep ? ` · ${formatarCep(pedido.destino.cep)}` : ""}
                              </p>
                            </TableCell>

                            <TableCell className="text-center">{pedido.totalPecas}</TableCell>

                            <TableCell className="text-right whitespace-nowrap">
                              {formatarPeso(pedido.pesoGramas)}
                              {pedido.pesoEstimado && (
                                <span className="block text-[11px] text-amber-600">estimado</span>
                              )}
                            </TableCell>

                            <TableCell className="text-right whitespace-nowrap">
                              {formatarMoeda(pedido.valorTotal)}
                            </TableCell>

                            <TableCell>
                              <div className="flex flex-col gap-1 items-start">
                                {(resultados.get(pedido.id)?.ok || pedido.jaEnviado) && (
                                  <Badge className="bg-emerald-600 hover:bg-emerald-700 border-transparent">
                                    <PackageCheck className="w-3 h-3 mr-1" />
                                    No carrinho
                                  </Badge>
                                )}
                                {cotacoes.get(pedido.id)?.opcoes[0] && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-primary/10 text-primary hover:bg-primary/20 font-semibold"
                                  >
                                    frete{" "}
                                    {formatarMoeda(cotacoes.get(pedido.id)!.opcoes[0].preco)}
                                  </Badge>
                                )}
                                {pedido.pendencias.length === 0 ? (
                                  <Badge className="bg-emerald-500 hover:bg-emerald-600 border-transparent">
                                    Pronto
                                  </Badge>
                                ) : (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge
                                          variant="secondary"
                                          className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 cursor-help"
                                        >
                                          <AlertTriangle className="w-3 h-3 mr-1" />
                                          {pedido.pendencias.length} pendência
                                          {pedido.pendencias.length > 1 ? "s" : ""}
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <ul className="text-xs space-y-1">
                                          {pedido.pendencias.map((p) => (
                                            <li key={p}>{p}</li>
                                          ))}
                                        </ul>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}

                                {pedido.despachoParcial && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20"
                                  >
                                    Envio parcial
                                  </Badge>
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="text-right">
                              {resultados.get(pedido.id)?.ok ? (
                                <span className="text-xs text-muted-foreground">
                                  {resultados.get(pedido.id)!.servico ?? "já estava lá"}
                                </span>
                              ) : pedido.jaEnviado ? (
                                <div className="flex items-center justify-end gap-2">
                                  <span className="text-xs text-muted-foreground text-right leading-tight">
                                    já enviado
                                    <br />
                                    {formatarData(pedido.jaEnviado.enviadoEm)}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8"
                                    disabled={despachando.size > 0}
                                    onClick={() =>
                                      pedirConfirmacaoDeReenvio(pedido, () =>
                                        despachar([pedido.id], [pedido.id])
                                      )
                                    }
                                    title="Este pedido já foi enviado para o Melhor Envio. Confirme se quer mandar de novo."
                                  >
                                    Reenviar
                                  </Button>
                                </div>
                              ) : pedido.pendencias.length > 0 ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span>
                                        <Button size="sm" disabled className="h-8">
                                          Enviar
                                        </Button>
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">
                                        Complete os dados de entrega para liberar o envio.
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <Button
                                  size="sm"
                                  className="h-8"
                                  disabled={despachando.size > 0}
                                  onClick={() => despachar([pedido.id])}
                                  title="Cotar, escolher o frete e mandar para o carrinho do Melhor Envio"
                                >
                                  {despachando.has(pedido.id) ? (
                                    "Enviando..."
                                  ) : (
                                    <>
                                      <Send className="w-3.5 h-3.5 mr-1.5" />
                                      Enviar
                                    </>
                                  )}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>

                          {expandido === pedido.id && (
                            <TableRow className="bg-muted/20">
                              <TableCell colSpan={10} className="py-4">
                                {resultados.has(pedido.id) && (
                                  <div
                                    className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
                                      resultados.get(pedido.id)!.ok
                                        ? "border-emerald-500/40 bg-emerald-500/10"
                                        : "border-destructive/40 bg-destructive/10 text-destructive"
                                    }`}
                                  >
                                    {resultados.get(pedido.id)!.jaEstava ? (
                                      resultados.get(pedido.id)!.mensagem
                                    ) : resultados.get(pedido.id)!.ok ? (
                                      <>
                                        Enviado para o carrinho do Melhor Envio por{" "}
                                        <strong>{resultados.get(pedido.id)!.servico}</strong>
                                        {resultados.get(pedido.id)!.preco !== null
                                          ? ` · ${formatarMoeda(resultados.get(pedido.id)!.preco!)}`
                                          : ""}
                                        {resultados.get(pedido.id)!.protocolo
                                          ? ` · ${resultados.get(pedido.id)!.protocolo}`
                                          : ""}
                                        .{" "}
                                        <span className="text-muted-foreground">
                                          {resultados.get(pedido.id)!.motivo
                                            ? `Escolhido porque ${resultados.get(pedido.id)!.motivo}. `
                                            : ""}
                                          Pague e imprima lá, junto com os outros pedidos do dia.
                                        </span>
                                      </>
                                    ) : (
                                      resultados.get(pedido.id)!.mensagem
                                    )}
                                  </div>
                                )}

                                {!resultados.has(pedido.id) && pedido.jaEnviado && (
                                  <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm">
                                    Enviado para o carrinho do Melhor Envio em{" "}
                                    <strong>{formatarData(pedido.jaEnviado.enviadoEm)}</strong> por{" "}
                                    <strong>
                                      {pedido.jaEnviado.transportadora} {pedido.jaEnviado.servico}
                                    </strong>
                                    {pedido.jaEnviado.protocolo
                                      ? ` · ${pedido.jaEnviado.protocolo}`
                                      : ""}
                                    .{" "}
                                    <span className="text-muted-foreground">
                                      Se precisar mandar de novo, use o botão Reenviar (pede
                                      confirmação, para não sair etiqueta duplicada).
                                    </span>
                                  </div>
                                )}

                                {cotacoes.has(pedido.id) && (
                                  <div className="mb-4">
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                                      Opções de frete
                                    </p>
                                    {cotacoes.get(pedido.id)!.erro ? (
                                      <p className="text-sm text-destructive">
                                        {cotacoes.get(pedido.id)!.erro}
                                      </p>
                                    ) : (
                                      <>
                                        <p className="text-xs text-muted-foreground mb-2">
                                          Você não precisa escolher: o botão Enviar já usa o frete
                                          que o cliente pagou. Isto aqui é só para trocar.
                                        </p>

                                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                          {cotacoes.get(pedido.id)!.opcoes.map((o) => (
                                            <div
                                              key={o.id}
                                              className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2"
                                            >
                                              <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">
                                                  {o.transportadora} {o.servico}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                  {o.prazoDias
                                                    ? `${o.prazoDias} dia${o.prazoDias > 1 ? "s" : ""} úteis`
                                                    : "prazo não informado"}
                                                </p>
                                              </div>
                                              <div className="flex items-center gap-2 shrink-0">
                                                <p className="text-sm font-semibold whitespace-nowrap">
                                                  {formatarMoeda(o.preco)}
                                                </p>
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  className="h-7 px-2"
                                                  disabled={enviando !== null}
                                                  onClick={() => enviarParaMelhorEnvio(pedido, o)}
                                                  title="Enviar este pedido para o carrinho do Melhor Envio"
                                                >
                                                  {enviando === `${pedido.id}-${o.id}` ? (
                                                    "..."
                                                  ) : (
                                                    <Send className="w-3.5 h-3.5" />
                                                  )}
                                                </Button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>

                                        {cotacoes.get(pedido.id)!.indisponiveis.length > 0 && (
                                          <details className="mt-2">
                                            <summary className="text-xs text-muted-foreground cursor-pointer">
                                              {cotacoes.get(pedido.id)!.indisponiveis.length}{" "}
                                              transportadora
                                              {cotacoes.get(pedido.id)!.indisponiveis.length > 1
                                                ? "s"
                                                : ""}{" "}
                                              não atende
                                            </summary>
                                            <ul className="mt-1 space-y-0.5">
                                              {cotacoes
                                                .get(pedido.id)!
                                                .indisponiveis.map((i, idx) => (
                                                  <li
                                                    key={`${i.transportadora}-${idx}`}
                                                    className="text-xs text-muted-foreground"
                                                  >
                                                    {i.transportadora} {i.servico}: {i.motivo}
                                                  </li>
                                                ))}
                                            </ul>
                                          </details>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )}

                                <div className="grid gap-4 md:grid-cols-2">
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                                      Itens da caixa
                                    </p>
                                    <ul className="space-y-1 text-sm">
                                      {pedido.itens.map((item, i) => (
                                        <li key={`${item.sku ?? item.titulo}-${i}`}>
                                          <span className="font-medium">{item.quantidade}x</span>{" "}
                                          {item.titulo}
                                          {item.variante ? ` · ${item.variante}` : ""}
                                          {item.sku ? (
                                            <span className="text-muted-foreground">
                                              {" "}
                                              ({item.sku})
                                            </span>
                                          ) : null}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                                      Entrega
                                    </p>
                                    <p className="text-sm">
                                      {pedido.destino.logradouro ?? "Sem endereço"}
                                      {pedido.destino.complemento
                                        ? `, ${pedido.destino.complemento}`
                                        : ""}
                                    </p>
                                    <p className="text-sm">
                                      {[
                                        [pedido.destino.cidade, pedido.destino.uf]
                                          .filter(Boolean)
                                          .join("/"),
                                        formatarCep(pedido.destino.cep),
                                      ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {pedido.cliente.telefone ?? "sem telefone"}
                                      {pedido.cliente.email ? ` · ${pedido.cliente.email}` : ""}
                                    </p>
                                    {pedido.fretePago && (
                                      <p className="text-sm text-muted-foreground mt-2">
                                        Frete que o cliente escolheu:{" "}
                                        <span className="text-foreground">
                                          {pedido.fretePago.titulo ?? "sem nome"}
                                        </span>{" "}
                                        · {formatarMoeda(pedido.fretePago.valor)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
      {editando && (
        <EditarEntrega
          pedido={editando}
          aberto={editando !== null}
          onFechar={() => setEditando(null)}
          onSalvo={carregar}
        />
      )}

      <Dialog
        open={confirmarReenvio !== null}
        onOpenChange={(v) => !v && setConfirmarReenvio(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reenviar pedido {confirmarReenvio?.pedido.numero}?</DialogTitle>
            <DialogDescription>
              {confirmarReenvio?.pedido.jaEnviado ? (
                <>
                  Este pedido já foi enviado para o Melhor Envio em{" "}
                  <strong>{formatarData(confirmarReenvio.pedido.jaEnviado.enviadoEm)}</strong> por{" "}
                  <strong>
                    {confirmarReenvio.pedido.jaEnviado.transportadora}{" "}
                    {confirmarReenvio.pedido.jaEnviado.servico}
                  </strong>
                  . Se aquele envio já foi pago ou impresso, mandar de novo cria uma segunda
                  etiqueta paga para o mesmo pedido. Confirme só se tiver certeza de que precisa
                  mesmo de um novo envio.
                </>
              ) : (
                "Este pedido já foi enviado antes. Confirme se quer mandar de novo mesmo assim."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarReenvio(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                confirmarReenvio?.executar();
                setConfirmarReenvio(null);
              }}
            >
              Reenviar mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
