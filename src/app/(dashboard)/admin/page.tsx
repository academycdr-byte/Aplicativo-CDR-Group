"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Building2, ShoppingBag, Link2, AlertTriangle } from "lucide-react";
import { getAdminStats, getFailedSyncs } from "@/actions/admin";

type AdminStats = {
  totalUsers: number;
  totalOrganizations: number;
  totalOrders: number;
  totalIntegrations: number;
  connectedIntegrations: number;
  recentSyncLogs: {
    id: string;
    organizationName: string;
    platform: string;
    status: string;
    recordsSynced: number;
    errorMessage: string | null;
    startedAt: Date;
    completedAt: Date | null;
  }[];
};

type FailedSync = {
  id: string;
  organizationName: string;
  platform: string;
  errorMessage: string | null;
  startedAt: Date;
};

const platformLabels: Record<string, string> = {
  SHOPIFY: "Shopify",
  CARTPANDA: "Cartpanda",
  YAMPI: "Yampi",
  NUVEMSHOP: "Nuvemshop",
  FACEBOOK_ADS: "Facebook Ads",
  GOOGLE_ADS: "Google Ads",
  REPORTANA: "Reportana",
};

const syncStatusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  SUCCESS: "default",
  SYNCING: "secondary",
  FAILED: "destructive",
  IDLE: "outline",
};

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [failedSyncs, setFailedSyncs] = useState<FailedSync[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [s, failed] = await Promise.all([
      getAdminStats(),
      getFailedSyncs(),
    ]);
    setStats(s);
    setFailedSyncs(failed);
    setLoading(false);
  }

  function formatDate(date: Date) {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold">Administracao</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-5">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-8 w-16 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold">Administracao</h2>
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">
              Voce nao tem permissao para acessar esta pagina.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Administracao</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Visao geral do sistema e monitoramento de sincronizacoes.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Usuarios</p>
              <Users className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{stats.totalUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Organizacoes</p>
              <Building2 className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{stats.totalOrganizations}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Pedidos Totais</p>
              <ShoppingBag className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{stats.totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Integracoes Ativas</p>
              <Link2 className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">
              {stats.connectedIntegrations}/{stats.totalIntegrations}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Failed Syncs Alert */}
      {failedSyncs.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Sincronizacoes com falha (ultimas 24h)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organizacao</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Erro</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failedSyncs.map((sync) => (
                  <TableRow key={sync.id}>
                    <TableCell className="font-medium">{sync.organizationName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {platformLabels[sync.platform] || sync.platform}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                      {sync.errorMessage || "Erro desconhecido"}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(sync.startedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Sync Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historico de sincronizacoes recentes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organizacao</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Registros</TableHead>
                <TableHead>Inicio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.recentSyncLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{log.organizationName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {platformLabels[log.platform] || log.platform}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={syncStatusVariant[log.status] || "outline"}>
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{log.recordsSynced}</TableCell>
                  <TableCell className="text-sm">{formatDate(log.startedAt)}</TableCell>
                </TableRow>
              ))}
              {stats.recentSyncLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhuma sincronizacao registrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
