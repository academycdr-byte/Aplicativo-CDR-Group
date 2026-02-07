"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileSpreadsheet, FileText, BarChart3, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getOrders } from "@/actions/orders";
import { getAdMetrics } from "@/actions/ads";
import { getReportanaData } from "@/actions/reportana";

type ReportanaReport = {
  id: string;
  name: string;
  type: string;
  createdAt: string;
};

export default function ReportsPage() {
  const [exporting, setExporting] = useState(false);
  const [period, setPeriod] = useState("30");
  const [reportanaReports, setReportanaReports] = useState<ReportanaReport[]>([]);
  const [reportanaConnected, setReportanaConnected] = useState(false);
  const [loadingReportana, setLoadingReportana] = useState(false);

  useEffect(() => {
    loadReportana();
  }, []);

  async function loadReportana() {
    setLoadingReportana(true);
    const result = await getReportanaData();
    if (result && !result.error) {
      setReportanaConnected(true);
      setReportanaReports(result.reports || []);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Relatorios</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Exporte seus dados em formato CSV para analise.
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 dias</SelectItem>
            <SelectItem value="30">30 dias</SelectItem>
            <SelectItem value="90">90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Orders Export */}
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

        {/* Ads Export */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Relatorio de Anuncios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Exporta metricas de anuncios (Facebook Ads, Google Ads e Reportana) dos ultimos {period} dias. Inclui gastos, cliques, conversoes e ROAS.
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
              Reportana
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
            reportanaReports.length > 0 ? (
              <div className="space-y-3">
                {reportanaReports.map((report) => (
                  <div key={report.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{report.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {report.type} &middot; {report.createdAt ? new Date(report.createdAt).toLocaleDateString("pt-BR") : ""}
                      </p>
                    </div>
                    <Badge variant="outline">Reportana</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                Reportana conectado. Os dados de metricas sao sincronizados automaticamente no dashboard de Anuncios.
              </div>
            )
          ) : (
            <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
              Conecte o Reportana nas{" "}
              <a href="/integrations" className="text-primary mx-1 hover:underline">
                Integracoes
              </a>{" "}
              para importar relatorios automaticamente.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
