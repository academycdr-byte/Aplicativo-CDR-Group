"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  Truck,
  X,
} from "lucide-react";
import {
  cotarPedidos,
  getPedidosParaEnvio,
  type CotacaoDoPedido,
  type PedidoParaEnvio,
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

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const resultado = await getPedidosParaEnvio({ busca: buscaAplicada || undefined });
      setPedidos(resultado.pedidos);
      setErro(resultado.erro);
      setSemIntegracao(resultado.semIntegracao);
      setSelecionados(new Set());
    } catch {
      // queda de rede ou deploy novo no meio da chamada
      setPedidos([]);
      setErro("Não foi possível falar com o servidor. Tente atualizar.");
    } finally {
      setCarregando(false);
    }
  }, [buscaAplicada]);

  useEffect(() => {
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
        <Button variant="outline" size="sm" onClick={carregar} disabled={carregando}>
          <RefreshCw className={`w-4 h-4 mr-2 ${carregando ? "animate-spin" : ""}`} />
          Atualizar
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
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {selecionados.size} selecionado{selecionados.size > 1 ? "s" : ""}
                </span>
                <Button size="sm" onClick={cotar} disabled={cotando}>
                  <Truck className={`w-4 h-4 mr-2 ${cotando ? "animate-pulse" : ""}`} />
                  {cotando ? "Cotando..." : "Cotar frete"}
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {carregando && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                          Carregando pedidos...
                        </TableCell>
                      </TableRow>
                    )}

                    {!carregando && pedidos.length === 0 && !erro && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12">
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
                              <p className="text-xs text-muted-foreground">
                                {pedido.cliente.documento ?? "sem CPF"}
                              </p>
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
                          </TableRow>

                          {expandido === pedido.id && (
                            <TableRow className="bg-muted/20">
                              <TableCell colSpan={9} className="py-4">
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
                                              <p className="text-sm font-semibold whitespace-nowrap">
                                                {formatarMoeda(o.preco)}
                                              </p>
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
    </div>
  );
}
