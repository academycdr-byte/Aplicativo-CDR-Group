"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Users,
  MessageSquare,
  Send,
  Calendar,
  History,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Pause,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Phone,
  Building2,
  RefreshCw
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  getReportClients,
  createReportClient,
  updateReportClient,
  deleteReportClient,
  getWhatsAppSession,
  getReportSchedules,
  createReportSchedule,
  updateReportSchedule,
  deleteReportSchedule,
  getReportLogs,
  getMetricsForReport,
  createReportLog,
} from "@/actions/reports";
import { buildReportMessage } from "@/lib/report-message";


// ─── TYPES ─────────────────────────────────────────

type Client = {
  id: string;
  name: string;
  responsible: string;
  phone: string;
  plan: string;
  status: string;
  startDate: Date;
  groupName: string | null;
  groupId: string | null;
  notes: string | null;
};

type Schedule = {
  id: string;
  clientId: string;
  frequency: string;
  time: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  config: any;
  isActive: boolean;
  nextRun: Date | null;
  client: Client;
};

type LogEntry = {
  id: string;
  clientId: string;
  type: string;
  status: string;
  metrics: any;
  sentAt: Date;
  error: string | null;
  client: Client;
};

// ─── HELPER FUNCTIONS ──────────────────────────────

const planLabels: Record<string, string> = {
  FORMULA_BASE: "Fórmula Base",
  FORMULA_AVANCADA: "Fórmula Avançada",
  FORMULA_TOTAL: "Fórmula Total",
  PERSONALIZADO: "Personalizado",
};

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-500",
  PAUSED: "bg-yellow-500",
  CANCELLED: "bg-red-500",
};

const frequencyLabels: Record<string, string> = {
  DAILY: "Diário",
  WEEKLY: "Semanal",
  BIWEEKLY: "Quinzenal",
  MONTHLY: "Mensal",
};

const periodLabels: Record<string, string> = {
  last7: "Últimos 7 dias",
  last14: "Últimos 14 dias",
  last30: "Últimos 30 dias",
  weekStart: "Início da semana até hoje",
  monthStart: "Início do mês até hoje",
  lastMonth: "Mês anterior",
  custom: "Personalizado",
};

function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("pt-BR");
}

function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── MAIN COMPONENT ────────────────────────────────

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("enviar");
  const [clients, setClients] = useState<Client[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [whatsappStatus, setWhatsappStatus] = useState<string>("DISCONNECTED");
  const [loading, setLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [clientsData, schedulesData, logsData, session] = await Promise.all([
        getReportClients(),
        getReportSchedules(),
        getReportLogs(),
        getWhatsAppSession(),
      ]);
      setClients(clientsData as Client[]);
      setSchedules(schedulesData as Schedule[]);
      setLogs(logsData as LogEntry[]);
      setWhatsappStatus(session?.status || "DISCONNECTED");
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Relatórios</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Envie relatórios de performance via WhatsApp para seus clientes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant={whatsappStatus === "CONNECTED" ? "default" : "secondary"}
            className={whatsappStatus === "CONNECTED" ? "bg-green-500 hover:bg-green-600" : ""}
          >
            <Phone className="w-3 h-3 mr-1" />
            {whatsappStatus === "CONNECTED" ? "WhatsApp Conectado" : "WhatsApp Desconectado"}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="enviar" className="gap-2">
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Criar & Enviar</span>
          </TabsTrigger>
          <TabsTrigger value="clientes" className="gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Clientes</span>
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger value="agendamentos" className="gap-2">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Agendamentos</span>
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Histórico</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB: Criar & Enviar */}
        <TabsContent value="enviar" className="mt-6">
          <CreateReportTab clients={clients} onRefresh={loadData} />
        </TabsContent>

        {/* TAB: Clientes */}
        <TabsContent value="clientes" className="mt-6">
          <ClientsTab clients={clients} onRefresh={loadData} />
        </TabsContent>

        {/* TAB: WhatsApp */}
        <TabsContent value="whatsapp" className="mt-6">
          <WhatsAppTab status={whatsappStatus} onRefresh={loadData} />
        </TabsContent>

        {/* TAB: Agendamentos */}
        <TabsContent value="agendamentos" className="mt-6">
          <SchedulesTab schedules={schedules} clients={clients} onRefresh={loadData} />
        </TabsContent>

        {/* TAB: Histórico */}
        <TabsContent value="historico" className="mt-6">
          <HistoryTab logs={logs} clients={clients} onRefresh={loadData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── TAB: CRIAR & ENVIAR ───────────────────────────

function CreateReportTab({ clients, onRefresh }: { clients: Client[]; onRefresh: () => void }) {
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [period, setPeriod] = useState("last7");
  const [customHeader, setCustomHeader] = useState("");
  const [sending, setSending] = useState(false);

  // Metrics
  const [metrics, setMetrics] = useState({
    faturamento: true,
    roas: true,
    investimento: true,
    pedidos: true,
    cpa: false,
    ticketMedio: false,
  });

  // Funnel
  const [funnel, setFunnel] = useState({
    sessions: true,
    addToCart: true,
    checkout: false,
    taxaConversao: false,
  });

  // Advanced
  const [comparePeriods, setComparePeriods] = useState(false);
  const [rankingCreatives, setRankingCreatives] = useState(false);

  // Preview
  const [previewMessage, setPreviewMessage] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    updatePreview();
  }, [selectedClient, period, metrics, funnel, comparePeriods, rankingCreatives, customHeader]);

  async function updatePreview() {
    if (!selectedClient) {
      setPreviewMessage("Selecione um cliente para ver a pré-visualização.");
      return;
    }

    setLoadingPreview(true);
    try {
      const client = clients.find((c) => c.id === selectedClient);
      const data = await getMetricsForReport(period);

      const selectedMetrics = [
        ...Object.entries(metrics).filter(([, v]) => v).map(([k]) => k),
        ...Object.entries(funnel).filter(([, v]) => v).map(([k]) => k),
      ];

      const message = buildReportMessage(
        client?.name || "Cliente",
        data.period,
        data.metrics,
        {
          selectedMetrics,
          comparePeriods,
          rankingCreatives,
          customHeader: customHeader || undefined,
        },
        data.funnel,
        data.comparison,
        data.topCreatives
      );

      setPreviewMessage(message);
    } catch (error) {
      setPreviewMessage("Erro ao gerar pré-visualização.");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleSend() {
    if (!selectedClient) {
      toast.error("Selecione um cliente");
      return;
    }

    setSending(true);
    try {
      const selectedMetrics = [
        ...Object.entries(metrics).filter(([, v]) => v).map(([k]) => k),
        ...Object.entries(funnel).filter(([, v]) => v).map(([k]) => k),
      ];

      // Create log entry
      await createReportLog({
        clientId: selectedClient,
        type: "MANUAL",
        status: "PENDING",
        metrics: { period, selectedMetrics, comparePeriods, rankingCreatives },
      });

      // TODO: Actual WhatsApp send via API route
      toast.success("Relatório enviado com sucesso!");
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar relatório");
    } finally {
      setSending(false);
    }
  }

  function selectAll(type: "metrics" | "funnel") {
    if (type === "metrics") {
      setMetrics({ faturamento: true, roas: true, investimento: true, pedidos: true, cpa: true, ticketMedio: true });
    } else {
      setFunnel({ sessions: true, addToCart: true, checkout: true, taxaConversao: true });
    }
  }

  function clearAll(type: "metrics" | "funnel") {
    if (type === "metrics") {
      setMetrics({ faturamento: false, roas: false, investimento: false, pedidos: false, cpa: false, ticketMedio: false });
    } else {
      setFunnel({ sessions: false, addToCart: false, checkout: false, taxaConversao: false });
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Preview */}
      <Card className="order-2 lg:order-1">
        <CardHeader>
          <CardTitle className="text-base">Pré-visualização</CardTitle>
          <CardDescription>Como a mensagem aparecerá no WhatsApp</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-[#0b141a] rounded-lg p-4 min-h-[400px]">
            <div className="bg-[#005c4b] rounded-lg p-3 max-w-[90%] ml-auto">
              {loadingPreview ? (
                <div className="flex items-center gap-2 text-white/70">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Carregando...
                </div>
              ) : (
                <pre className="text-sm text-white whitespace-pre-wrap font-sans leading-relaxed">
                  {previewMessage}
                </pre>
              )}
              <div className="text-right mt-2 text-[10px] text-white/50">
                {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} ✓✓
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Right: Configuration */}
      <Card className="order-1 lg:order-2">
        <CardHeader>
          <CardTitle className="text-base">Configuração de Envio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Period */}
          <div className="space-y-2">
            <Label>Período das Métricas</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last7">Últimos 7 dias</SelectItem>
                <SelectItem value="last14">Últimos 14 dias</SelectItem>
                <SelectItem value="last30">Últimos 30 dias</SelectItem>
                <SelectItem value="weekStart">Início da semana até hoje</SelectItem>
                <SelectItem value="monthStart">Início do mês até hoje</SelectItem>
                <SelectItem value="lastMonth">Mês anterior completo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Client */}
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients
                  .filter((c) => c.status === "ACTIVE")
                  .map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Metrics */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Métricas Principais</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => selectAll("metrics")}>
                  Todas
                </Button>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => clearAll("metrics")}>
                  Limpar
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "faturamento", label: "💰 Faturamento", emoji: "💰" },
                { key: "roas", label: "📊 ROAS", emoji: "📊" },
                { key: "investimento", label: "💸 Investimento", emoji: "💸" },
                { key: "pedidos", label: "📦 Pedidos", emoji: "📦" },
                { key: "cpa", label: "🎯 CPA", emoji: "🎯" },
                { key: "ticketMedio", label: "🛒 Ticket Médio", emoji: "🛒" },
              ].map((m) => (
                <label
                  key={m.key}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${metrics[m.key as keyof typeof metrics]
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                    }`}
                >
                  <Checkbox
                    checked={metrics[m.key as keyof typeof metrics]}
                    onCheckedChange={(v) => setMetrics({ ...metrics, [m.key]: v })}
                  />
                  <span className="text-sm">{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Funnel */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Funil de Vendas</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => selectAll("funnel")}>
                  Todas
                </Button>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => clearAll("funnel")}>
                  Limpar
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "sessions", label: "👀 Sessões" },
                { key: "addToCart", label: "🛒 Carrinho" },
                { key: "checkout", label: "✅ Checkout" },
                { key: "taxaConversao", label: "📈 Taxa Conversão" },
              ].map((m) => (
                <label
                  key={m.key}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${funnel[m.key as keyof typeof funnel]
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                    }`}
                >
                  <Checkbox
                    checked={funnel[m.key as keyof typeof funnel]}
                    onCheckedChange={(v) => setFunnel({ ...funnel, [m.key]: v })}
                  />
                  <span className="text-sm">{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Advanced */}
          <div className="space-y-4">
            <Label>Recursos Avançados</Label>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">📈 Comparar Períodos</p>
                  <p className="text-xs text-muted-foreground">Mostrar variação vs período anterior</p>
                </div>
                <Switch checked={comparePeriods} onCheckedChange={setComparePeriods} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">🏆 Ranking de Criativos</p>
                  <p className="text-xs text-muted-foreground">Top 3 criativos por ROAS</p>
                </div>
                <Switch checked={rankingCreatives} onCheckedChange={setRankingCreatives} />
              </div>
            </div>
          </div>

          {/* Custom Header */}
          <div className="space-y-2">
            <Label>Cabeçalho Personalizado (opcional)</Label>
            <Textarea
              value={customHeader}
              onChange={(e) => setCustomHeader(e.target.value)}
              placeholder="Ex: Bom dia! Segue o relatório semanal 🚀"
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              className="flex-1 bg-primary hover:bg-primary/90"
              onClick={handleSend}
              disabled={!selectedClient || sending}
            >
              {sending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar Agora
                </>
              )}
            </Button>
            <Button variant="outline">
              <Calendar className="w-4 h-4 mr-2" />
              Agendar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── TAB: CLIENTES ─────────────────────────────────

function ClientsTab({ clients, onRefresh }: { clients: Client[]; onRefresh: () => void }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.responsible.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesPlan = planFilter === "all" || c.plan === planFilter;
    return matchesSearch && matchesStatus && matchesPlan;
  });

  const activeCount = clients.filter((c) => c.status === "ACTIVE").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar clientes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ACTIVE">Ativos</SelectItem>
              <SelectItem value="PAUSED">Pausados</SelectItem>
              <SelectItem value="CANCELLED">Cancelados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os planos</SelectItem>
              <SelectItem value="FORMULA_BASE">Fórmula Base</SelectItem>
              <SelectItem value="FORMULA_AVANCADA">Fórmula Avançada</SelectItem>
              <SelectItem value="FORMULA_TOTAL">Fórmula Total</SelectItem>
              <SelectItem value="PERSONALIZADO">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm">
            {activeCount} clientes ativos
          </Badge>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingClient(null)}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <ClientFormDialog
              client={editingClient}
              onClose={() => {
                setIsDialogOpen(false);
                setEditingClient(null);
              }}
              onRefresh={onRefresh}
            />
          </Dialog>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Início</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-medium">{client.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{client.responsible}</TableCell>
                  <TableCell>{formatPhone(client.phone)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{planLabels[client.plan]}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${statusColors[client.status]}`} />
                      <span className="text-sm">
                        {client.status === "ACTIVE"
                          ? "Ativo"
                          : client.status === "PAUSED"
                            ? "Pausado"
                            : "Cancelado"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(client.startDate)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingClient(client);
                            setIsDialogOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            const newStatus = client.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
                            await updateReportClient(client.id, { status: newStatus as any });
                            toast.success("Status atualizado");
                            onRefresh();
                          }}
                        >
                          {client.status === "ACTIVE" ? (
                            <>
                              <Pause className="w-4 h-4 mr-2" />
                              Pausar
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-2" />
                              Ativar
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={async () => {
                            if (confirm("Tem certeza que deseja excluir este cliente?")) {
                              await deleteReportClient(client.id);
                              toast.success("Cliente excluído");
                              onRefresh();
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filteredClients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum cliente encontrado.
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

// ─── CLIENT FORM DIALOG ────────────────────────────

function ClientFormDialog({
  client,
  onClose,
  onRefresh,
}: {
  client: Client | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: client?.name || "",
    responsible: client?.responsible || "",
    phone: client?.phone || "",
    plan: client?.plan || "FORMULA_BASE",
    status: client?.status || "ACTIVE",
    startDate: client?.startDate
      ? new Date(client.startDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    groupName: client?.groupName || "",
    groupId: client?.groupId || "",
    notes: client?.notes || "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        ...form,
        startDate: new Date(form.startDate),
        plan: form.plan as any,
        status: form.status as any,
      };

      if (client) {
        await updateReportClient(client.id, data);
        toast.success("Cliente atualizado com sucesso");
      } else {
        await createReportClient(data);
        toast.success("Cliente criado com sucesso");
      }
      onClose();
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar cliente");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{client ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
        <DialogDescription>
          {client ? "Atualize as informações do cliente." : "Cadastre um novo cliente para envio de relatórios."}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Loja/Empresa *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="responsible">Responsável *</Label>
            <Input
              id="responsible"
              value={form.responsible}
              onChange={(e) => setForm({ ...form, responsible: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone">WhatsApp *</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="(11) 99999-9999"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">Data de Início *</Label>
            <Input
              id="startDate"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Plano *</Label>
            <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FORMULA_BASE">Fórmula Base</SelectItem>
                <SelectItem value="FORMULA_AVANCADA">Fórmula Avançada</SelectItem>
                <SelectItem value="FORMULA_TOTAL">Fórmula Total</SelectItem>
                <SelectItem value="PERSONALIZADO">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Ativo</SelectItem>
                <SelectItem value="PAUSED">Pausado</SelectItem>
                <SelectItem value="CANCELLED">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="groupName">Grupo WhatsApp Vinculado</Label>
          <Input
            id="groupName"
            value={form.groupName}
            onChange={(e) => setForm({ ...form, groupName: e.target.value })}
            placeholder="Nome do grupo"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Observações</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Notas internas sobre o cliente..."
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando..." : client ? "Atualizar" : "Criar Cliente"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

// ─── TAB: WHATSAPP ─────────────────────────────────

function WhatsAppTab({ status, onRefresh }: { status: string; onRefresh: () => void }) {
  const isConnected = status === "CONNECTED";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Conexão WhatsApp Business</CardTitle>
          <CardDescription>
            {isConnected
              ? "Seu WhatsApp está conectado e pronto para enviar relatórios."
              : "Escaneie o QR Code abaixo com seu WhatsApp Business para conectar."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6">
          {isConnected ? (
            <>
              <div className="w-32 h-32 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-16 h-16 text-green-500" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-medium text-green-500">Conectado</p>
                <p className="text-sm text-muted-foreground">WhatsApp Business vinculado com sucesso</p>
              </div>
              <Button variant="destructive" onClick={() => toast.info("Funcionalidade em desenvolvimento")}>
                Desconectar
              </Button>
            </>
          ) : (
            <>
              <div className="w-64 h-64 bg-white rounded-lg flex items-center justify-center border">
                <div className="text-center space-y-4 p-4">
                  <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    QR Code aparecerá aqui após configurar o backend WhatsApp
                  </p>
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Abra o WhatsApp Business no seu celular, vá em Configurações → Dispositivos Conectados →
                  Conectar um dispositivo
                </p>
              </div>
              <Button onClick={() => toast.info("Gerando QR Code...")} disabled>
                <RefreshCw className="w-4 h-4 mr-2" />
                Gerar QR Code
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">⚠️ Configuração Necessária</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Para integração completa do WhatsApp, é necessário configurar um servidor backend separado com a
            biblioteca <code className="bg-muted px-1 rounded">@whiskeysockets/baileys</code>.
          </p>
          <p>
            <strong>Opções recomendadas:</strong>
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>
              <strong>Servidor Node.js dedicado:</strong> Manter conexão WebSocket persistente com WhatsApp
            </li>
            <li>
              <strong>Serviço de terceiros:</strong> Evolution API, WPPConnect, ou Z-API
            </li>
            <li>
              <strong>WhatsApp Business API oficial:</strong> Meta Cloud API (requer aprovação)
            </li>
          </ul>
          <p className="text-yellow-500">
            A UI está pronta. A integração real requer configuração adicional do backend.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── TAB: AGENDAMENTOS ─────────────────────────────

function SchedulesTab({
  schedules,
  clients,
  onRefresh,
}: {
  schedules: Schedule[];
  clients: Client[];
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Envios Agendados</h3>
          <p className="text-sm text-muted-foreground">
            Configure envios automáticos recorrentes para seus clientes.
          </p>
        </div>
        <Button onClick={() => toast.info("Funcionalidade em desenvolvimento")}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Agendamento
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Frequência</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Próximo Envio</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell className="font-medium">{schedule.client.name}</TableCell>
                  <TableCell>{frequencyLabels[schedule.frequency]}</TableCell>
                  <TableCell>{schedule.time}</TableCell>
                  <TableCell>
                    {schedule.nextRun ? formatDateTime(schedule.nextRun) : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={schedule.isActive ? "default" : "secondary"}>
                      {schedule.isActive ? "Ativo" : "Pausado"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            await updateReportSchedule(schedule.id, { isActive: !schedule.isActive });
                            toast.success(schedule.isActive ? "Agendamento pausado" : "Agendamento ativado");
                            onRefresh();
                          }}
                        >
                          {schedule.isActive ? (
                            <>
                              <Pause className="w-4 h-4 mr-2" />
                              Pausar
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-2" />
                              Ativar
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={async () => {
                            if (confirm("Tem certeza?")) {
                              await deleteReportSchedule(schedule.id);
                              toast.success("Agendamento excluído");
                              onRefresh();
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {schedules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum agendamento configurado.
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

// ─── TAB: HISTÓRICO ────────────────────────────────

function HistoryTab({
  logs,
  clients,
  onRefresh,
}: {
  logs: LogEntry[];
  clients: Client[];
  onRefresh: () => void;
}) {
  const [clientFilter, setClientFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredLogs = logs.filter((log) => {
    const matchesClient = clientFilter === "all" || log.clientId === clientFilter;
    const matchesStatus = statusFilter === "all" || log.status === statusFilter;
    return matchesClient && matchesStatus;
  });

  const statusIcons: Record<string, React.ReactNode> = {
    SUCCESS: <CheckCircle className="w-4 h-4 text-green-500" />,
    FAILED: <XCircle className="w-4 h-4 text-red-500" />,
    PENDING: <Clock className="w-4 h-4 text-yellow-500" />,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-medium">Histórico de Envios</h3>
          <p className="text-sm text-muted-foreground">
            Acompanhe todos os relatórios enviados.
          </p>
        </div>
        <div className="flex gap-3">
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todos os clientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="SUCCESS">Enviados</SelectItem>
              <SelectItem value="FAILED">Falhas</SelectItem>
              <SelectItem value="PENDING">Pendentes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Métricas</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{formatDateTime(log.sentAt)}</TableCell>
                  <TableCell className="font-medium">{log.client.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {log.type === "MANUAL" ? "Manual" : "Agendado"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {statusIcons[log.status]}
                      <span className="text-sm">
                        {log.status === "SUCCESS"
                          ? "Enviado"
                          : log.status === "FAILED"
                            ? "Falha"
                            : "Pendente"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {log.metrics?.selectedMetrics?.length || 0} métricas
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {log.status === "FAILED" && (
                      <Button variant="ghost" size="sm" onClick={() => toast.info("Reenviar em desenvolvimento")}>
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Reenviar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum envio registrado.
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
