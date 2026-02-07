"use client";

import { useState, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link2, Unlink, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getIntegrations, connectApiKeyIntegration, connectShopifyDirect, disconnectIntegration } from "@/actions/integrations";
import { syncPlatform } from "@/actions/sync";
import { Platform } from "@prisma/client";
import { useSearchParams } from "next/navigation";

type PlatformConfig = {
  name: string;
  platform: Platform;
  description: string;
  authType: "oauth" | "apikey";
  color: string;
  fields: { key: string; label: string; placeholder: string }[];
};

const platforms: PlatformConfig[] = [
  {
    name: "Shopify",
    platform: "SHOPIFY",
    description: "Conecte sua loja Shopify para sincronizar pedidos e produtos.",
    authType: "oauth",
    color: "#96BF48",
    fields: [],
  },
  {
    name: "Nuvemshop",
    platform: "NUVEMSHOP",
    description: "Conecte sua Nuvemshop para sincronizar pedidos e produtos.",
    authType: "oauth",
    color: "#2B35AF",
    fields: [],
  },
  {
    name: "Cartpanda",
    platform: "CARTPANDA",
    description: "Conecte sua Cartpanda usando sua API Key.",
    authType: "apikey",
    color: "#FF6B35",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "Cole sua API Key da Cartpanda" },
      { key: "externalStoreId", label: "Store ID", placeholder: "ID da sua loja" },
    ],
  },
  {
    name: "Yampi",
    platform: "YAMPI",
    description: "Conecte sua Yampi usando suas credenciais de API.",
    authType: "apikey",
    color: "#7C3AED",
    fields: [
      { key: "apiKey", label: "Token", placeholder: "Token de API da Yampi" },
      { key: "apiSecret", label: "Secret Key", placeholder: "Secret Key da Yampi" },
      { key: "externalStoreId", label: "Alias da loja", placeholder: "alias-da-sua-loja" },
    ],
  },
  {
    name: "Facebook Ads",
    platform: "FACEBOOK_ADS",
    description: "Conecte sua conta de anuncios do Facebook/Meta.",
    authType: "oauth",
    color: "#1877F2",
    fields: [],
  },
  {
    name: "Google Ads",
    platform: "GOOGLE_ADS",
    description: "Conecte sua conta do Google Ads.",
    authType: "oauth",
    color: "#4285F4",
    fields: [],
  },
  {
    name: "Reportana",
    platform: "REPORTANA",
    description: "Conecte o Reportana usando sua API Key.",
    authType: "apikey",
    color: "#E91E63",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "Cole sua API Key do Reportana" },
    ],
  },
];

type IntegrationData = {
  id: string;
  platform: Platform;
  status: string;
  lastSyncAt: Date | null;
  syncStatus: string;
};

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground text-sm p-4">Carregando...</div>}>
      <IntegrationsContent />
    </Suspense>
  );
}

function IntegrationsContent() {
  const [integrations, setIntegrations] = useState<IntegrationData[]>([]);
  const [connectDialog, setConnectDialog] = useState<PlatformConfig | null>(null);
  const [shopifyDialog, setShopifyDialog] = useState(false);
  const [shopDomain, setShopDomain] = useState("");
  const [shopifyToken, setShopifyToken] = useState("");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const searchParams = useSearchParams();

  useEffect(() => {
    loadIntegrations();

    // Mostrar mensagens de sucesso/erro do OAuth callback
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const detail = searchParams.get("detail");

    if (success === "shopify") {
      toast.success("Shopify conectada com sucesso!");
    } else if (error === "shopify_oauth_failed") {
      const isAppNotFound = detail?.includes("nao encontrado") || detail?.includes("application_cannot_be_found");
      if (isAppNotFound) {
        toast.error("App Shopify nao encontrado. Verifique as credenciais (API Key) no Shopify Partners e nas variaveis de ambiente do Vercel.", { duration: 10000 });
      } else {
        toast.error(`Erro ao conectar Shopify${detail ? `: ${detail}` : ""}`, { duration: 8000 });
      }
    } else if (error === "shopify_config_error") {
      toast.error(`Configuracao Shopify incorreta${detail ? `: ${detail}` : ""}. Verifique as variaveis de ambiente no Vercel.`, { duration: 10000 });
    } else if (error === "shopify_denied") {
      toast.error(`Shopify negou acesso${detail ? `: ${detail}` : ""}`);
    } else if (error === "missing_params") {
      toast.error("Erro no fluxo OAuth: parametros ausentes");
    } else if (error === "unauthorized") {
      toast.error("Voce nao tem permissao para esta integracao");
    }
  }, [searchParams]);

  async function loadIntegrations() {
    const data = await getIntegrations();
    setIntegrations(data);
  }

  function getStatus(platform: Platform) {
    const integration = integrations.find((i) => i.platform === platform);
    return integration?.status || "DISCONNECTED";
  }

  function openConnect(platform: PlatformConfig) {
    if (platform.platform === "SHOPIFY") {
      setShopDomain("");
      setShopifyToken("");
      setMsg("");
      setShopifyDialog(true);
      return;
    }

    if (platform.authType === "oauth") {
      const oauthRoutes: Record<string, string> = {
        NUVEMSHOP: "/api/integrations/nuvemshop",
        FACEBOOK_ADS: "/api/integrations/facebook",
        GOOGLE_ADS: "/api/integrations/google",
      };
      const route = oauthRoutes[platform.platform];
      if (route) {
        window.location.href = route;
      }
      return;
    }
    setFormData({});
    setMsg("");
    setConnectDialog(platform);
  }

  async function handleShopifyConnect(e: React.FormEvent) {
    e.preventDefault();
    const domain = shopDomain.trim().toLowerCase();
    const token = shopifyToken.trim();
    if (!domain || !token) return;

    setLoading(true);
    setMsg("");

    const result = await connectShopifyDirect(domain, token);

    if (result.error) {
      setMsg(result.error);
    } else {
      setShopifyDialog(false);
      toast.success(`Shopify conectada com sucesso!${result.shopName ? ` Loja: ${result.shopName}` : ""}`);
      loadIntegrations();
    }
    setLoading(false);
  }

  async function handleSync(platform: Platform) {
    setSyncing(platform);
    const result = await syncPlatform(platform);
    if ("error" in result && result.error) {
      toast.error(`Erro ao sincronizar: ${result.error}`);
    } else {
      toast.success("Sincronizacao concluida!");
      loadIntegrations();
    }
    setSyncing(null);
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!connectDialog) return;
    setLoading(true);
    setMsg("");

    const result = await connectApiKeyIntegration({
      platform: connectDialog.platform,
      apiKey: formData.apiKey || "",
      apiSecret: formData.apiSecret,
      externalStoreId: formData.externalStoreId,
    });

    if (result.error) {
      setMsg(result.error);
    } else {
      setConnectDialog(null);
      toast.success("Plataforma conectada com sucesso!");
      loadIntegrations();
    }
    setLoading(false);
  }

  async function handleDisconnect(platform: Platform) {
    if (!confirm("Tem certeza que deseja desconectar esta integracao?")) return;
    const result = await disconnectIntegration(platform);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Plataforma desconectada.");
      loadIntegrations();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Plataformas</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Conecte suas plataformas para centralizar os dados no dashboard.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {platforms.map((platform) => {
          const status = getStatus(platform.platform);
          const isConnected = status === "CONNECTED";

          return (
            <Card key={platform.platform} className="flex flex-col">
              <CardContent className="pt-6 flex flex-col flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                    style={{ backgroundColor: platform.color }}
                  >
                    {platform.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold">{platform.name}</h3>
                    <span className="text-xs text-muted-foreground">
                      {platform.authType === "oauth" ? "OAuth" : "API Key"}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-4 flex-1">
                  {platform.description}
                </p>

                <div className="flex items-center justify-between">
                  <Badge variant={isConnected ? "default" : "secondary"} className="gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isConnected ? "bg-green-400" : "bg-muted-foreground"
                      }`}
                    />
                    {isConnected ? "Conectado" : "Desconectado"}
                  </Badge>

                  {isConnected ? (
                    <div className="flex gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSync(platform.platform)}
                        disabled={syncing === platform.platform}
                      >
                        <RefreshCw className={`w-4 h-4 mr-1 ${syncing === platform.platform ? "animate-spin" : ""}`} />
                        Sync
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(platform.platform)}
                      >
                        <Unlink className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" onClick={() => openConnect(platform)}>
                      <Link2 className="w-4 h-4 mr-1" />
                      Conectar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Shopify Connect Dialog - conexao via Custom App Access Token */}
      <Dialog open={shopifyDialog} onOpenChange={setShopifyDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Conectar Shopify</DialogTitle>
            <DialogDescription>
              Conecte usando um Custom App criado no admin da sua loja Shopify.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-sm rounded-lg p-3 space-y-2">
            <div className="flex gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="text-xs font-semibold">Como obter o Access Token:</span>
            </div>
            <ol className="text-xs space-y-1 ml-6 list-decimal">
              <li>No admin da Shopify, va em <strong>Configuracoes &gt; Apps e canais de vendas</strong></li>
              <li>Clique em <strong>Desenvolver apps</strong> (no topo)</li>
              <li>Clique <strong>Criar um app</strong> e de um nome (ex: CDR Group)</li>
              <li>Em <strong>Configuracao</strong>, clique em <strong>Configurar escopos da Admin API</strong></li>
              <li>Selecione: <strong>read_orders</strong>, <strong>read_products</strong>, <strong>read_customers</strong></li>
              <li>Clique <strong>Salvar</strong> e depois <strong>Instalar app</strong></li>
              <li>Copie o <strong>Admin API access token</strong> (comeca com <code>shpat_</code>)</li>
            </ol>
          </div>

          {msg && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3">
              {msg}
            </div>
          )}

          <form onSubmit={handleShopifyConnect} className="space-y-4">
            <div className="space-y-2">
              <Label>Dominio da loja</Label>
              <Input
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                placeholder="minha-loja.myshopify.com"
                required
              />
              <p className="text-xs text-muted-foreground">
                Ex: minha-loja.myshopify.com ou apenas minha-loja
              </p>
            </div>
            <div className="space-y-2">
              <Label>Admin API Access Token</Label>
              <Input
                value={shopifyToken}
                onChange={(e) => setShopifyToken(e.target.value)}
                placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                required
                type="password"
              />
              <p className="text-xs text-muted-foreground">
                Token do Custom App (comeca com shpat_). Este token nao expira.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShopifyDialog(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Validando e conectando..." : "Conectar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Connect Dialog for API Key platforms */}
      <Dialog open={!!connectDialog} onOpenChange={() => setConnectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar {connectDialog?.name}</DialogTitle>
            <DialogDescription>
              Insira as credenciais da plataforma para conectar.
            </DialogDescription>
          </DialogHeader>

          {msg && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3">
              {msg}
            </div>
          )}

          <form onSubmit={handleConnect} className="space-y-4">
            {connectDialog?.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label>{field.label}</Label>
                <Input
                  value={formData[field.key] || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  placeholder={field.placeholder}
                  required={field.key === "apiKey"}
                />
              </div>
            ))}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConnectDialog(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Conectando..." : "Conectar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
