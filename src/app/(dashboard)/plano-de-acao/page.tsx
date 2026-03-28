"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  Target,
  Plus,
  FileText,
  Link2,
  Trash2,
  Eye,
  Calendar,
  Search,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import {
  getActionPlans,
  createActionPlan,
  deleteActionPlan,
  type ActionPlanSummary,
} from "@/actions/action-plan";

// ─── Helpers ──────────────────────────────────────

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));

const formatDateRange = (start: Date, end: Date) =>
  `${formatDate(start)} — ${formatDate(end)}`;

// ─── Create Plan Modal ────────────────────────────

function CreatePlanModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (plan: { id: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  // Default: last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [periodStart, setPeriodStart] = useState(
    thirtyDaysAgo.toISOString().split("T")[0]
  );
  const [periodEnd, setPeriodEnd] = useState(
    today.toISOString().split("T")[0]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Informe o título do plano");
      return;
    }

    setLoading(true);
    try {
      const plan = await createActionPlan({
        title: title.trim(),
        periodStart,
        periodEnd,
      });
      toast.success("Plano de ação criado!");
      onCreated(plan);
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erro ao criar plano";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6"
      >
        <h2 className="text-lg font-semibold mb-4">Novo Plano de Ação</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              Título
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Plano de Ação — Março 2026"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Início do Período
              </label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Fim do Período
              </label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Criando..." : "Criar Plano"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────

function StatusBadge({ status }: { status: "DRAFT" | "FINALIZED" }) {
  if (status === "FINALIZED") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Finalizado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
      Rascunho
    </span>
  );
}

// ─── Main Page ────────────────────────────────────

export default function PlanoDeAcaoPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [plans, setPlans] = useState<ActionPlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "DRAFT" | "FINALIZED"
  >("ALL");

  const userRole = session?.user?.role;
  const canEdit = userRole === "OWNER" || userRole === "ADMIN";

  const loadPlans = useCallback(async () => {
    try {
      const data = await getActionPlans();
      setPlans(data);
    } catch {
      toast.error("Erro ao carregar planos de ação");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const filteredPlans = plans.filter((plan) => {
    if (statusFilter !== "ALL" && plan.status !== statusFilter) return false;
    if (
      search &&
      !plan.title.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    // Clients only see finalized plans
    if (!canEdit && plan.status !== "FINALIZED") return false;
    return true;
  });

  const handleDelete = async (planId: string, planTitle: string) => {
    if (!confirm(`Excluir o plano "${planTitle}"?`)) return;
    try {
      await deleteActionPlan(planId);
      setPlans((prev) => prev.filter((p) => p.id !== planId));
      toast.success("Plano excluído");
    } catch {
      toast.error("Erro ao excluir plano");
    }
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/plano/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const handleCreated = (plan: { id: string }) => {
    router.push(`/plano-de-acao/${plan.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" />
            Plano de Ação
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie e gerencie planos de ação para seus clientes
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Novo Plano de Ação
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar plano..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {canEdit && (
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "ALL" | "DRAFT" | "FINALIZED")
              }
              className="pl-9 pr-8 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none cursor-pointer"
            >
              <option value="ALL">Todos</option>
              <option value="DRAFT">Rascunho</option>
              <option value="FINALIZED">Finalizado</option>
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 rounded-xl border border-border bg-card animate-pulse"
            />
          ))}
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-primary/50" />
          </div>
          <h3 className="text-lg font-semibold mb-1">
            Nenhum plano de ação
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {canEdit
              ? "Crie seu primeiro plano de ação para começar a automatizar suas apresentações."
              : "Nenhum plano de ação disponível para visualização."}
          </p>
          {canEdit && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Criar Plano
            </button>
          )}
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.05 } },
          }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {filteredPlans.map((plan) => (
            <motion.div
              key={plan.id}
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0 },
              }}
              className="group relative rounded-xl border border-border bg-card hover:border-primary/30 transition-all duration-300 overflow-hidden"
            >
              {/* Card Body */}
              <div
                className="p-5 cursor-pointer"
                onClick={() =>
                  canEdit
                    ? router.push(`/plano-de-acao/${plan.id}`)
                    : handleCopyLink(plan.publicToken)
                }
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-sm leading-snug pr-2 line-clamp-2">
                    {plan.title}
                  </h3>
                  <StatusBadge status={plan.status} />
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formatDateRange(plan.periodStart, plan.periodEnd)}</span>
                </div>

                <p className="text-xs text-muted-foreground/60 mt-3">
                  Criado por {plan.createdBy.name || plan.createdBy.email} em{" "}
                  {formatDate(plan.createdAt)}
                </p>
              </div>

              {/* Card Actions */}
              <div className="flex items-center border-t border-border">
                <button
                  onClick={() =>
                    router.push(`/plano-de-acao/${plan.id}`)
                  }
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  title={canEdit ? "Editar" : "Visualizar"}
                >
                  <Eye className="w-3.5 h-3.5" />
                  {canEdit ? "Editar" : "Ver"}
                </button>

                {plan.status === "FINALIZED" && (
                  <button
                    onClick={() => handleCopyLink(plan.publicToken)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-l border-border"
                    title="Copiar link público"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Copiar Link
                  </button>
                )}

                {canEdit && (
                  <button
                    onClick={() => handleDelete(plan.id, plan.title)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-muted-foreground hover:text-red-400 hover:bg-red-500/5 transition-colors border-l border-border"
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Create Modal */}
      <CreatePlanModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
