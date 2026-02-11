"use client";

import Image from "next/image";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
import { Link2, Unlink, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { getIntegrations, connectApiKeyIntegration, saveShopifyCredentials, disconnectIntegration, selectFacebookAdAccount, selectMultipleFacebookAdAccounts, selectGoogleAnalyticsProperty } from "@/actions/integrations";
import { syncPlatform } from "@/actions/sync";
import { Platform } from "@prisma/client";

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
    description: "Conecte sua loja Shopify usando o Access Token do admin.",
    authType: "apikey",
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
    name: "Facebook Ads",
    platform: "FACEBOOK_ADS",
    description: "Conecte sua conta de anuncios do Facebook/Meta.",
    authType: "oauth",
    color: "#1877F2",
    fields: [],
  },
  {
    name: "Google Analytics",
    platform: "GOOGLE_ANALYTICS",
    description: "Conecte sua propriedade do Google Analytics 4 (GA4).",
    authType: "oauth",
    color: "#E37400",
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
  metadata?: Record<string, unknown> | null;
};

type FacebookAdAccount = {
  id: string;
  name: string;
  account_status?: number;
};

type GA4Property = {
  id: string;
  name: string;
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
  const [shopifyClientId, setShopifyClientId] = useState("");
  const [shopifyClientSecret, setShopifyClientSecret] = useState("");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [fbAccountDialog, setFbAccountDialog] = useState(false);
  const [fbAccounts, setFbAccounts] = useState<FacebookAdAccount[]>([]);
  const [selectedFbAccount, setSelectedFbAccount] = useState<string>("");
  const [selectedFbAccounts, setSelectedFbAccounts] = useState<string[]>([]);
  const [fbSearch, setFbSearch] = useState("");
  const [gaPropertyDialog, setGaPropertyDialog] = useState(false);
  const [gaProperties, setGaProperties] = useState<GA4Property[]>([]);
  const [selectedGaProperty, setSelectedGaProperty] = useState<string>("");
  const [gaSearch, setGaSearch] = useState("");
  const searchParams = useSearchParams();

  useEffect(() => {
    loadIntegrations();

    // Mostrar mensagens de sucesso/erro do OAuth callback
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const detail = searchParams.get("detail");

    if (success === "shopify") {
      toast.success("Shopify conectada com sucesso! Sincronizando pedidos...");
      // Auto-trigger sync after successful connection
      syncPlatform("SHOPIFY").then((result) => {
        if ("error" in result && result.error) {
          toast.error(`Erro ao sincronizar Shopify: ${result.error}`);
        } else {
          toast.success("Pedidos da Shopify sincronizados!");
          loadIntegrations();
        }
      });
    } else if (error === "shopify_oauth_failed") {
      toast.error(`Erro ao conectar Shopify${detail ? `: ${detail}` : ""}`, { duration: 10000 });
    } else if (error === "shopify_config_error") {
      toast.error(`Configuracao Shopify incorreta${detail ? `: ${detail}` : ""}`, { duration: 10000 });
    } else if (success === "facebook") {
      toast.success("Facebook Ads conectado com sucesso! Sincronizando metricas...");
      syncPlatform("FACEBOOK_ADS").then((result) => {
        if ("error" in result && result.error) {
          toast.error(`Erro ao sincronizar Facebook Ads: ${result.error}`);
        } else {
          toast.success("Metricas do Facebook Ads sincronizadas!");
          loadIntegrations();
        }
      });
    } else if (error === "facebook_oauth_failed") {
      toast.error(`Erro ao conectar Facebook Ads${detail ? `: ${detail}` : ""}`, { duration: 10000 });
    } else if (success === "google_analytics") {
      toast.success("Google Analytics conectado com sucesso! Sincronizando dados...");
      syncPlatform("GOOGLE_ANALYTICS").then((result) => {
        if ("error" in result && result.error) {
          toast.error(`Erro ao sincronizar Google Analytics: ${result.error}`);
        } else {
          toast.success("Dados do Google Analytics sincronizados!");
          loadIntegrations();
        }
      });
    } else if (error === "google_analytics_oauth_failed") {
      toast.error(`Erro ao conectar Google Analytics${detail ? `: ${detail}` : ""}`, { duration: 10000 });
    } else if (success === "nuvemshop") {
      toast.success("Nuvemshop conectada com sucesso! Sincronizando pedidos...");
      fetch("/api/sync/nuvemshop", { method: "POST" })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            toast.success("Pedidos da Nuvemshop sincronizados!");
            loadIntegrations();
          } else {
            toast.error(`Erro ao sincronizar Nuvemshop: ${data.error || "Erro desconhecido"}`);
          }
        })
        .catch(() => {
          toast.error("Erro ao sincronizar Nuvemshop");
        });
    } else if (error === "nuvemshop_oauth_failed") {
      toast.error(`Erro ao conectar Nuvemshop${detail ? `: ${detail}` : ""}`, { duration: 10000 });
    } else if (error === "missing_params") {
      toast.error("Erro no fluxo OAuth: parametros ausentes");
    } else if (error === "missing_shop") {
      toast.error("Dominio da loja nao informado");
    } else if (error === "unauthorized") {
      toast.error("Voce nao tem permissao para esta integracao");
    }

    // Handle account/property selection after OAuth
    const selectAccount = searchParams.get("select_account");
    if (selectAccount === "google_analytics") {
      getIntegrations().then((data) => {
        const gaIntegration = data.find((i) => i.platform === "GOOGLE_ANALYTICS");
        const properties = (gaIntegration?.metadata as { properties?: GA4Property[] })?.properties || [];
        if (properties.length > 0) {
          setGaProperties(properties);
          setSelectedGaProperty(properties[0]?.id || "");
          setGaPropertyDialog(true);
        }
        setIntegrations(data);
      });
      toast.info("Selecione a propriedade GA4 que deseja conectar.");
    } else if (selectAccount === "facebook") {
      getIntegrations().then((data) => {
        const fbIntegration = data.find((i) => i.platform === "FACEBOOK_ADS");
        const accounts = (fbIntegration?.metadata as { adAccounts?: FacebookAdAccount[] })?.adAccounts || [];
        const existing = (fbIntegration?.metadata as { selectedAccounts?: { id: string }[] })?.selectedAccounts || [];
        if (accounts.length > 0) {
          setFbAccounts(accounts);
          setSelectedFbAccount(accounts[0]?.id || "");
          setSelectedFbAccounts(existing.map((a) => a.id));
          setFbAccountDialog(true);
        }
        setIntegrations(data);
      });
      toast.info("Selecione as contas de anuncio que deseja conectar.");
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
      setShopifyClientId("");
      setShopifyClientSecret("");
      setMsg("");
      setShopifyDialog(true);
      return;
    }

    if (platform.authType === "oauth") {
      const oauthRoutes: Record<string, string> = {
        NUVEMSHOP: "/api/integrations/nuvemshop",
        FACEBOOK_ADS: "/api/integrations/facebook",
        GOOGLE_ADS: "/api/integrations/google",
        GOOGLE_ANALYTICS: "/api/integrations/google-analytics",
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
    const clientId = shopifyClientId.trim();
    const clientSecret = shopifyClientSecret.trim();
    if (!domain || !clientId || !clientSecret) return;

    setLoading(true);
    setMsg("");

    // Step 1: Save credentials to DB
    const result = await saveShopifyCredentials(domain, clientId, clientSecret);

    if (result.error) {
      setMsg(result.error);
      setLoading(false);
      return;
    }

    // Step 2: Redirect to OAuth flow
    const normalizedDomain = result.domain || domain;
    window.location.href = `/api/integrations/shopify?shop=${encodeURIComponent(normalizedDomain)}`;
  }

  async function handleSync(platform: Platform) {
    setSyncing(platform);

    // Use dedicated API route for Nuvemshop (needs longer timeout)
    if (platform === "NUVEMSHOP") {
      try {
        const res = await fetch("/api/sync/nuvemshop", { method: "POST" });
        const data = await res.json();
        if (data.success) {
          toast.success("Sincronizacao concluida!");
          loadIntegrations();
        } else {
          toast.error(`Erro ao sincronizar: ${data.error || "Erro desconhecido"}`);
        }
      } catch {
        toast.error("Erro ao sincronizar Nuvemshop");
      }
      setSyncing(null);
      return;
    }

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
      const connectedPlatform = connectDialog.platform;
      setConnectDialog(null);
      toast.success("Plataforma conectada com sucesso!");
      loadIntegrations();

      // Auto-sync after successful connection for order platforms
      const orderPlatforms: Platform[] = ["CARTPANDA", "YAMPI", "REPORTANA"];
      if (orderPlatforms.includes(connectedPlatform)) {
        toast.info("Sincronizando dados...");
        syncPlatform(connectedPlatform).then((syncResult) => {
          if ("error" in syncResult && syncResult.error) {
            toast.error(`Erro ao sincronizar: ${syncResult.error}`);
          } else {
            toast.success("Dados sincronizados com sucesso!");
            loadIntegrations();
          }
        });
      }
    }
    setLoading(false);
  }

  async function handleSelectFbAccount() {
    setLoading(true);

    // Use multi-select if multiple are selected, otherwise single
    if (selectedFbAccounts.length > 0) {
      const result = await selectMultipleFacebookAdAccounts(selectedFbAccounts);
      if (result.error) {
        toast.error(result.error);
      } else {
        setFbAccountDialog(false);
        toast.success(`${result.count} conta(s) conectada(s)! Sincronizando metricas...`);
        loadIntegrations();
        syncPlatform("FACEBOOK_ADS").then((syncResult) => {
          if ("error" in syncResult && syncResult.error) {
            toast.error(`Erro ao sincronizar Facebook Ads: ${syncResult.error}`);
          } else {
            toast.success("Metricas do Facebook Ads sincronizadas!");
            loadIntegrations();
          }
        });
      }
    } else if (selectedFbAccount) {
      const result = await selectFacebookAdAccount(selectedFbAccount);
      if (result.error) {
        toast.error(result.error);
      } else {
        setFbAccountDialog(false);
        toast.success(`Conta "${result.accountName}" conectada! Sincronizando metricas...`);
        loadIntegrations();
        syncPlatform("FACEBOOK_ADS").then((syncResult) => {
          if ("error" in syncResult && syncResult.error) {
            toast.error(`Erro ao sincronizar Facebook Ads: ${syncResult.error}`);
          } else {
            toast.success("Metricas do Facebook Ads sincronizadas!");
            loadIntegrations();
          }
        });
      }
    }
    setLoading(false);
  }

  async function handleSelectGaProperty() {
    if (!selectedGaProperty) return;
    setLoading(true);

    const result = await selectGoogleAnalyticsProperty(selectedGaProperty);
    if (result.error) {
      toast.error(result.error);
    } else {
      setGaPropertyDialog(false);
      toast.success(`Propriedade "${result.propertyName}" conectada! Sincronizando dados...`);
      loadIntegrations();
      syncPlatform("GOOGLE_ANALYTICS").then((syncResult) => {
        if ("error" in syncResult && syncResult.error) {
          toast.error(`Erro ao sincronizar Google Analytics: ${syncResult.error}`);
        } else {
          toast.success("Dados do Google Analytics sincronizados!");
          loadIntegrations();
        }
      });
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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Plataformas</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Conecte suas plataformas para centralizar os dados no dashboard.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {platforms.map((platform) => {
          const status = getStatus(platform.platform);
          const isConnected = status === "CONNECTED";

          return (
            <Card key={platform.platform} className="flex flex-col group border-border/20">
              <CardContent className="pt-6 flex flex-col flex-1">
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 bg-white shadow-sm border border-black/5 flex items-center justify-center transition-transform duration-300">
                    <Image
                      src={`/platforms/${platform.name.toLowerCase().replace(" ", "")}.png`}
                      alt={platform.name}
                      fill
                      className="object-cover"
                    />
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
                      className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-400" : status === "PENDING" ? "bg-amber-400" : "bg-muted-foreground"
                        }`}
                    />
                    {isConnected ? "Conectado" : status === "PENDING" ? "Pendente" : "Desconectado"}
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
                  ) : status === "PENDING" && (platform.platform === "FACEBOOK_ADS" || platform.platform === "GOOGLE_ANALYTICS") ? (
                    <Button size="sm" variant="outline" onClick={() => {
                      if (platform.platform === "FACEBOOK_ADS") {
                        const fbIntegration = integrations.find((i) => i.platform === "FACEBOOK_ADS");
                        const accounts = (fbIntegration?.metadata as { adAccounts?: FacebookAdAccount[] })?.adAccounts || [];
                        const existing = (fbIntegration?.metadata as { selectedAccounts?: { id: string }[] })?.selectedAccounts || [];
                        if (accounts.length > 0) {
                          setFbAccounts(accounts);
                          setSelectedFbAccount(accounts[0]?.id || "");
                          setSelectedFbAccounts(existing.map((a) => a.id));
                          setFbAccountDialog(true);
                        }
                      } else if (platform.platform === "GOOGLE_ANALYTICS") {
                        const gaIntegration = integrations.find((i) => i.platform === "GOOGLE_ANALYTICS");
                        const properties = (gaIntegration?.metadata as { properties?: GA4Property[] })?.properties || [];
                        if (properties.length > 0) {
                          setGaProperties(properties);
                          setSelectedGaProperty(properties[0]?.id || "");
                          setGaPropertyDialog(true);
                        }
                      }
                    }}>
                      <Link2 className="w-4 h-4 mr-1" />
                      {platform.platform === "FACEBOOK_ADS" ? "Selecionar Conta" : "Selecionar Propriedade"}
                    </Button>
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

      {/* Shopify Connect Dialog */}
      <Dialog open={shopifyDialog} onOpenChange={setShopifyDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Conectar Shopify</DialogTitle>
            <DialogDescription>
              Insira as credenciais do seu app no Dev Dashboard da Shopify.
            </DialogDescription>
          </DialogHeader>

          {msg && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3">
              {msg}
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-sm rounded-lg p-3 space-y-2">
            <div className="flex gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="text-xs font-semibold">Como obter as credenciais:</span>
            </div>
            <ol className="text-xs space-y-1 ml-6 list-decimal">
              <li>Acesse o <strong>Dev Dashboard</strong> da Shopify (dev.shopify.com)</li>
              <li>Selecione ou crie um app para a loja</li>
              <li>Va em <strong>Configuracoes</strong> do app</li>
              <li>Copie o <strong>ID do cliente</strong> e a <strong>Chave secreta</strong></li>
            </ol>
          </div>
          <form onSubmit={handleShopifyConnect} className="space-y-4">
            <div className="space-y-2">
              <Label>Dominio da loja</Label>
              <Input
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                placeholder="minha-loja.myshopify.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Client ID (ID do cliente)</Label>
              <Input
                value={shopifyClientId}
                onChange={(e) => setShopifyClientId(e.target.value)}
                placeholder="9617a8cf3979b4ffc5db7c699a8eb1b8"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Client Secret (Chave secreta)</Label>
              <Input
                value={shopifyClientSecret}
                onChange={(e) => setShopifyClientSecret(e.target.value)}
                placeholder="shpss_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                required
                type="password"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShopifyDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Conectando..." : "Conectar Shopify"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Facebook Ad Account Selection Dialog */}
      <Dialog open={fbAccountDialog} onOpenChange={(open) => { setFbAccountDialog(open); if (!open) setFbSearch(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selecione as Contas de Anuncio</DialogTitle>
            <DialogDescription>
              {fbAccounts.length} conta{fbAccounts.length !== 1 ? "s" : ""} encontrada{fbAccounts.length !== 1 ? "s" : ""}. Selecione uma ou mais contas para conectar.
            </DialogDescription>
          </DialogHeader>

          <Input
            placeholder="Pesquisar por nome ou ID..."
            value={fbSearch}
            onChange={(e) => setFbSearch(e.target.value)}
          />

          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {(() => {
              const query = fbSearch.toLowerCase().trim();
              const filtered = query
                ? fbAccounts.filter((a) =>
                  (a.name || "").toLowerCase().includes(query) ||
                  a.id.toLowerCase().includes(query)
                )
                : fbAccounts;

              if (filtered.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Nenhuma conta encontrada para &quot;{fbSearch}&quot;
                  </p>
                );
              }

              return filtered.map((account) => {
                const isActive = account.account_status === 1;
                const isChecked = selectedFbAccounts.includes(account.id);
                return (
                  <label
                    key={account.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isChecked
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                      }`}
                  >
                    <input
                      type="checkbox"
                      value={account.id}
                      checked={isChecked}
                      onChange={() => {
                        setSelectedFbAccounts((prev) =>
                          prev.includes(account.id)
                            ? prev.filter((id) => id !== account.id)
                            : [...prev, account.id]
                        );
                        if (!selectedFbAccount) setSelectedFbAccount(account.id);
                      }}
                      className="accent-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{account.name || account.id}</p>
                      <p className="text-xs text-muted-foreground">{account.id}</p>
                    </div>
                    {isActive !== undefined && (
                      <Badge variant={isActive ? "default" : "secondary"} className="shrink-0 text-xs">
                        {isActive ? "Ativa" : "Inativa"}
                      </Badge>
                    )}
                  </label>
                );
              });
            })()}
          </div>

          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setFbAccountDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSelectFbAccount} disabled={loading || (selectedFbAccounts.length === 0 && !selectedFbAccount)}>
              {loading ? "Conectando..." : selectedFbAccounts.length > 1 ? `Conectar ${selectedFbAccounts.length} Contas` : "Conectar Conta"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Google Analytics Property Selection Dialog */}
      <Dialog open={gaPropertyDialog} onOpenChange={(open) => { setGaPropertyDialog(open); if (!open) setGaSearch(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selecione a Propriedade GA4</DialogTitle>
            <DialogDescription>
              {gaProperties.length} propriedade{gaProperties.length !== 1 ? "s" : ""} encontrada{gaProperties.length !== 1 ? "s" : ""}. Escolha qual deseja conectar.
            </DialogDescription>
          </DialogHeader>

          <Input
            placeholder="Pesquisar por nome ou ID..."
            value={gaSearch}
            onChange={(e) => setGaSearch(e.target.value)}
          />

          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {(() => {
              const query = gaSearch.toLowerCase().trim();
              const filtered = query
                ? gaProperties.filter((p) =>
                  (p.name || "").toLowerCase().includes(query) ||
                  p.id.toLowerCase().includes(query)
                )
                : gaProperties;

              if (filtered.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Nenhuma propriedade encontrada para &quot;{gaSearch}&quot;
                  </p>
                );
              }

              return filtered.map((property) => (
                <label
                  key={property.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedGaProperty === property.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                    }`}
                >
                  <input
                    type="radio"
                    name="ga_property"
                    value={property.id}
                    checked={selectedGaProperty === property.id}
                    onChange={() => setSelectedGaProperty(property.id)}
                    className="accent-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{property.name}</p>
                    <p className="text-xs text-muted-foreground">ID: {property.id}</p>
                  </div>
                </label>
              ));
            })()}
          </div>

          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setGaPropertyDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSelectGaProperty} disabled={loading || !selectedGaProperty}>
              {loading ? "Conectando..." : "Conectar Propriedade"}
            </Button>
          </div>
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
