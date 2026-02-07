"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileSpreadsheet, FileText, BarChart3, RefreshCw, ShoppingCart, CheckCircle, AlertTriangle, Copy } from "lucide-react";
import { toast } from "sonner";
import { getOrders } from "@/actions/orders";
import { getAdMetrics } from "@/actions/ads";
import { getReportanaData, getReportanaMetrics } from "@/actions/reportana";

type ReportanaMetrics = {
  abandonedTotal: number;
  abandonedCount: number;
  recoveredTotal: number;
  recoveredCount: number;
  recoveryRate: number;
};

type ReportanaEventItem = {
  id: string;
  referenceId: string;
  customerName: string | null;
  customerEmail: string | null;
  totalPrice: number;
  currency: string;
  eventDate: Date;
};

export default function ReportsPage() {
  const [exporting, setExporting] = useState(false);
  const [period, setPeriod] = useState("30");
  const [reportanaConnected, setReportanaConnected] = useState(false);
  const [loadingReportana, setLoadingReportana] = useState(false);
  const [metrics, setMetrics] = useState<ReportanaMetrics | null>(null);
  const [recentAbandoned, setRecentAbandoned] = useState<ReportanaEventItem[]>([]);
  const [recentRecovered, setRecentRecovered] = useState<ReportanaEventItem[]>([]);

  useEffect(() => {
    loadReportana();
  }, [period]);

  async function loadReportana() {
    setLoadingReportana(true);
    const statusResult = await getReportanaData();
    if (statusResult && !statusResult.error) {
      setReportanaConnected(true);
      const days = parseInt(period);
      const metricsResult = await getReportanaMetrics(days);
      if (metricsResult && "metrics" in metricsResult && metricsResult.metrics) {
        setMetrics(metricsResult.metrics);
        setRecentAbandoned(metricsResult.recentAbandoned || []);
        setRecentRecovered(metricsResult.recentRecovered || []);
      }
    }
    setLoadingReportana(false);
  }

  async function exportOrdersCSV() {
    setExporting(true);
    try {
      const data = await getOrders({ limit: 10000 });
      const headers = ["Pedido", "Plataforma", "Cliente", "Email", "Valor", "Moeda", "Status", "Data"];
      const rows = data.orders.map((o) => [
        o.externalOrderId,
        o.platform,
        o.customerName || "",
        o.customerEmail || "",
        o.totalAmount,
        o.currency,
        o.status,
        new Date(o.orderDate).toLocaleDateString("pt-BR"),
      ]);

      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      downloadFile(csv, "pedidos.csv", "text/csv");
      toast.success("Relatorio de pedidos exportado!");
    } finally {
      setExporting(false);
    }
  }

  async function exportAdsCSV() {
    setExporting(true);
    try {
      const days = parseInt(period);
      const data = await getAdMetrics({ days });
      const headers = ["Plataforma", "Campanha", "Ad Set", "Data", "Impressoes", "Cliques", "Gasto", "Conversoes", "Receita"];
      const rows = data.metrics.map((m) => [
        m.platform,
        m.campaignName || "",
        m.adSetName || "",
        new Date(m.date).toLocaleDateString("pt-BR"),
        m.impressions,
        m.clicks,
        m.spend,
        m.conversions,
        m.revenue,
      ]);

      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      downloadFile(csv, "anuncios.csv", "text/csv");
      toast.success("Relatorio de anuncios exportado!");
    } finally {
      setExporting(false);
    }
  }

  function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function fmt(amount: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
  }

  function formatDate(date: Date) {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(date));
  }

  function copyWebhookUrl() {
    navigator.clipboard.writeText("https://aplicativo-cdr-group.vercel.app/api/webhooks/reportana");
    toast.success("URL copiada!");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Relatorios</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Exporte seus dados e visualize metricas da Reportana.
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Hoje</SelectItem>
            <SelectItem value="7">7 dias</SelectItem>
            <SelectItem value="30">30 dias</SelectItem>
            <SelectItem value="90">90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Export Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Relatorio de Pedidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Exporta todos os pedidos de todas as plataformas conectadas em formato CSV. Inclui dados de cliente, valor, status e data.
            </p>
            <Button onClick={exportOrdersCSV} disabled={exporting} className="w-full">
              <Download className="w-4 h-4 mr-2" />
              {exporting ? "Exportando..." : "Exportar Pedidos (CSV)"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Relatorio de Anuncios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Exporta metricas de anuncios (Facebook Ads, Google Ads) dos ultimos {period} dias. Inclui gastos, cliques, conversoes e ROAS.
            </p>
            <Button onClick={exportAdsCSV} disabled={exporting} className="w-full">
              <Download className="w-4 h-4 mr-2" />
              {exporting ? "Exportando..." : "Exportar Anuncios (CSV)"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Reportana Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Reportana - Carrinhos Abandonados
            </CardTitle>
            {reportanaConnected && (
              <Button variant="outline" size="sm" onClick={loadReportana} disabled={loadingReportana}>
                <RefreshCw className={`w-4 h-4 mr-1 ${loadingReportana ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingReportana ? (
            <div className="h-32 flex items-center justify-center">
              <div className="animate-pulse space-y-3 w-full">
                <div className="h-4 w-48 bg-muted rounded" />
                <div className="h-4 w-64 bg-muted rounded" />
              </div>
            </div>
          ) : reportanaConnected ? (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ShoppingCart className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <span className="text-xs text-red-700 dark:text-red-300">Valor Abandonado</span>
                  </div>
                  <p className="text-xl font-bold text-red-700 dark:text-red-300">
                    {fmt(metrics?.abandonedTotal || 0)}
                  </p>
                  <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-0.5">
                    {metrics?.abandonedCount || 0} carrinhos
                  </p>
                </div>

                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-xs text-green-700 dark:text-green-300">Valor Recuperado</span>
                  </div>
                  <p className="text-xl font-bold text-green-700 dark:text-green-300">
                    {fmt(metrics?.recoveredTotal || 0)}
                  </p>
                  <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-0.5">
                    {metrics?.recoveredCount || 0} recuperados
                  </p>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs text-amber-700 dark:text-amber-300">Perda Liquida</span>
                  </div>
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
                    {fmt((metrics?.abandonedTotal || 0) - (metrics?.recoveredTotal || 0))}
                  </p>
                  <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-0.5">
                    nao recuperado
                  </p>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs text-blue-700 dark:text-blue-300">Taxa Recuperacao</span>
                  </div>
                  <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                    {metrics?.recoveryRate || 0}%
                  </p>
                  <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-0.5">
                    ultimos {period} dias
                  </p>
                </div>
              </div>

              {/* Recent Events Tables */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Abandoned */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-red-500" />
                    Ultimos Abandonos
                  </h4>
                  {recentAbandoned.length > 0 ? (
                    <div className="space-y-2">
                      {recentAbandoned.map((event) => (
                        <div key={event.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div>
                            <p className="text-sm font-medium">{event.customerName || event.customerEmail || "Anonimo"}</p>
                            <p className="text-xs text-muted-foreground">#{event.referenceId}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-red-600">{fmt(event.totalPrice)}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(event.eventDate)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Nenhum carrinho abandonado registrado.
                    </p>
                  )}
                </div>

                {/* Recovered */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Ultimas Recuperacoes
                  </h4>
                  {recentRecovered.length > 0 ? (
                    <div className="space-y-2">
                      {recentRecovered.map((event) => (
                        <div key={event.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div>
                            <p className="text-sm font-medium">{event.customerName || event.customerEmail || "Anonimo"}</p>
                            <p className="text-xs text-muted-foreground">#{event.referenceId}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-green-600">{fmt(event.totalPrice)}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(event.eventDate)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Nenhuma recuperacao registrada.
                    </p>
                  )}
                </div>
              </div>

              {/* Webhook Setup Instructions */}
              <div className="bg-muted/50 border rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-semibold">Configuracao do Webhook</h4>
                <p className="text-xs text-muted-foreground">
                  Para receber dados automaticamente da Reportana, configure uma automacao com o bloco
                  &quot;Executar JavaScript&quot; que envia POST para esta URL:
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-background border rounded px-2 py-1 flex-1 overflow-x-auto">
                    https://aplicativo-cdr-group.vercel.app/api/webhooks/reportana
                  </code>
                  <Button variant="outline" size="sm" onClick={copyWebhookUrl}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer font-medium text-foreground">
                    Ver exemplo de codigo JavaScript para a Reportana
                  </summary>
                  <pre className="mt-2 bg-background border rounded p-3 overflow-x-auto text-[11px] leading-5">{`// Carrinho Abandonado
const res = await axios.post(
  "https://aplicativo-cdr-group.vercel.app/api/webhooks/reportana",
  {
    event_type: "abandoned_checkout",
    reference_id: payload.number,
    customer_name: payload.name,
    customer_email: payload.email,
    customer_phone: payload.phone,
    total_price: payload.orders[0]?.order?.total_price || 0,
    currency: "BRL",
    event_date: new Date().toISOString()
  },
  {
    headers: {
      "Authorization": "Bearer SUA_API_KEY_AQUI",
      "Content-Type": "application/json"
    }
  }
);

// Carrinho Recuperado (usar em outra automacao)
// Trocar event_type para "checkout_recovered"`}</pre>
                </details>
              </div>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
              Conecte o Reportana nas{" "}
              <a href="/integrations" className="text-primary mx-1 hover:underline">
                Integracoes
              </a>{" "}
              para visualizar dados de carrinhos abandonados e recuperados.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
