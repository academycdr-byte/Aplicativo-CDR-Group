"use client";

import { useState, useEffect } from "react";
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
import { Link2, Unlink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getIntegrations, connectApiKeyIntegration, connectShopifyIntegration, disconnectIntegration } from "@/actions/integrations";
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
    description: "Conecte sua loja Shopify para sincronizar pedidos e produtos.",
    authType: "apikey",
    color: "#96BF48",
    fields: [
      { key: "shopDomain", label: "Dominio da loja", placeholder: "minha-loja.myshopify.com" },
    ],
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
  const [integrations, setIntegrations] = useState<IntegrationData[]>([]);
  const [connectDialog, setConnectDialog] = useState<PlatformConfig | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    loadIntegrations();
  }, []);

  async function loadIntegrations() {
    const data = await getIntegrations();
    setIntegrations(data);
  }

  function getStatus(platform: Platform) {
    const integration = integrations.find((i) => i.platform === platform);
    return integration?.status || "DISCONNECTED";
  }

  function openConnect(platform: PlatformConfig) {
    if (platform.authType === "oauth") {
      const oauthRoutes: Record<string, string> = {
        SHOPIFY: "/api/integrations/shopify",
        NUVEMSHOP: "/api/integrations/nuvemshop",
        FACEBOOK_ADS: "/api/integrations/facebook",
        GOOGLE_ADS: "/api/integrations/google",
      };
      const route = oauthRoutes[platform.platform];
      if (route) {
        if (platform.platform === "SHOPIFY") {
          const shop = prompt("Digite o dominio da sua loja Shopify (ex: minha-loja.myshopify.com):");
          if (shop) {
            window.location.href = `${route}?shop=${encodeURIComponent(shop)}`;
          }
        } else {
          window.location.href = route;
        }
      }
      return;
    }
    setFormData({});
    setMsg("");
    setConnectDialog(platform);
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

    let result: { error?: string; success?: boolean };

    if (connectDialog.platform === "SHOPIFY") {
      result = await connectShopifyIntegration(formData.shopDomain || "");
    } else {
      result = await connectApiKeyIntegration({
        platform: connectDialog.platform,
        apiKey: formData.apiKey || "",
        apiSecret: formData.apiSecret,
        externalStoreId: formData.externalStoreId,
      });
    }

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
