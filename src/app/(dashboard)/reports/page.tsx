"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { getOrders } from "@/actions/orders";
import { getAdMetrics } from "@/actions/ads";

export default function ReportsPage() {
  const [exporting, setExporting] = useState(false);
  const [period, setPeriod] = useState("30");

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
              Exporta metricas de anuncios (Facebook Ads e Google Ads) dos ultimos {period} dias. Inclui gastos, cliques, conversoes e ROAS.
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
          <CardTitle className="text-base">Reportana</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            Conecte o Reportana nas{" "}
            <a href="/integrations" className="text-primary mx-1 hover:underline">
              Integracoes
            </a>{" "}
            para importar relatorios automaticamente.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
