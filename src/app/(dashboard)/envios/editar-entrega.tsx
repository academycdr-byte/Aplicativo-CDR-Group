"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { salvarCorrecaoEntrega, type PedidoParaEnvio } from "@/actions/shipments";

/**
 * Correção dos dados de entrega direto no painel.
 *
 * Existe porque nem tudo que a etiqueta exige chega da Shopify: o CPF não vem
 * na API usada no sync, e número e bairro chegam misturados no endereço.
 * Sem isto, arrumar um pedido significava ir na Shopify, editar e sincronizar.
 */
export function EditarEntrega({
  pedido,
  aberto,
  onFechar,
  onSalvo,
}: {
  pedido: PedidoParaEnvio;
  aberto: boolean;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: pedido.cliente.nome ?? "",
    documento: pedido.cliente.documento ?? "",
    telefone: pedido.cliente.telefone ?? "",
    email: pedido.cliente.email ?? "",
    logradouro: pedido.destino.logradouro ?? "",
    numero: pedido.destino.numero ?? "",
    complemento: pedido.destino.complemento ?? "",
    bairro: pedido.destino.bairro ?? "",
    cidade: pedido.destino.cidade ?? "",
    uf: pedido.destino.uf ?? "",
    cep: pedido.destino.cep ?? "",
  });

  const campo = (chave: keyof typeof form) => ({
    value: form[chave],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [chave]: e.target.value })),
  });

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      const r = await salvarCorrecaoEntrega(pedido.id, form);
      if (r.ok) {
        onSalvo();
        onFechar();
      } else {
        setErro(r.mensagem);
      }
    } catch {
      setErro("Não foi possível salvar agora.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dados de entrega do pedido {pedido.numero}</DialogTitle>
          <DialogDescription>
            O que você corrigir aqui vale para a etiqueta, sem precisar mexer na Shopify.
          </DialogDescription>
        </DialogHeader>

        {erro && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3">
            {erro}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Nome de quem recebe</Label>
            <Input {...campo("nome")} placeholder="Nome completo" />
          </div>

          <div className="space-y-2">
            <Label>CPF ou CNPJ</Label>
            <Input {...campo("documento")} placeholder="somente números" inputMode="numeric" />
          </div>

          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input {...campo("telefone")} placeholder="com DDD" inputMode="numeric" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>E-mail</Label>
            <Input {...campo("email")} placeholder="email@cliente.com" type="email" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Rua</Label>
            <Input {...campo("logradouro")} placeholder="Rua, avenida, travessa" />
          </div>

          <div className="space-y-2">
            <Label>Número</Label>
            <Input {...campo("numero")} placeholder="123" />
          </div>

          <div className="space-y-2">
            <Label>Complemento</Label>
            <Input {...campo("complemento")} placeholder="apto, bloco, sala" />
          </div>

          <div className="space-y-2">
            <Label>Bairro</Label>
            <Input {...campo("bairro")} placeholder="Bairro" />
          </div>

          <div className="space-y-2">
            <Label>CEP</Label>
            <Input {...campo("cep")} placeholder="somente números" inputMode="numeric" />
          </div>

          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input {...campo("cidade")} placeholder="Cidade" />
          </div>

          <div className="space-y-2">
            <Label>Estado</Label>
            <Input {...campo("uf")} placeholder="SP" maxLength={2} />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Campo deixado em branco mantém o que veio da loja.
        </p>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
