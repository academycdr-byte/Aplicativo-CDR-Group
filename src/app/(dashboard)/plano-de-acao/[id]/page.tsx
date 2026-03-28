"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Target,
  ArrowLeft,
  Save,
  RefreshCw,
  Eye,
  Link2,
  Check,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  BarChart3,
  CreditCard,
  Tag,
  Trophy,
  ImageIcon,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Pencil,
  Package,
} from "lucide-react";
import { VideoModal } from "@/components/ads/video-modal";
import { toast } from "sonner";
import {
  getActionPlan,
  updateActionPlan,
  refreshActionPlanMetrics,
  type ActionPlanFull,
  type PlanMetrics,
  type TopProduct,
  type TopCollection,
  type TopCreative,
  type GapNode,
  type LeverNode,
  type TreeNode,
} from "@/actions/action-plan";

// ─── Helpers ──────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);

const fmtNum = (v: number, decimals = 2) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v);

const genId = () => Math.random().toString(36).substring(2, 9);

// ─── Editable Metric Card ─────────────────────────

function MetricCard({
  label,
  value,
  icon: Icon,
  format = "currency",
  editable,
  onChange,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  format?: "currency" | "decimal" | "integer";
  editable: boolean;
  onChange: (val: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));

  const displayValue =
    format === "currency"
      ? fmt(value)
      : format === "decimal"
        ? fmtNum(value)
        : fmtNum(value, 0);

  const handleSave = () => {
    const parsed = parseFloat(editValue.replace(",", "."));
    if (!isNaN(parsed)) onChange(parsed);
    setEditing(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 group relative">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        {editable && !editing && (
          <button
            onClick={() => {
              setEditValue(String(value));
              setEditing(true);
            }}
            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="flex-1 px-2 py-1 rounded border border-border bg-background text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
            autoFocus
          />
          <button
            onClick={handleSave}
            className="p-1 rounded bg-primary text-primary-foreground"
          >
            <Check className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <p className="text-xl font-bold tracking-tight">{displayValue}</p>
      )}
    </div>
  );
}

// ─── Tree Node Editor ─────────────────────────────

function TreeNodeEditor({
  node,
  depth,
  onUpdate,
  onDelete,
  editable,
}: {
  node: TreeNode;
  depth: number;
  onUpdate: (updated: TreeNode) => void;
  onDelete: () => void;
  editable: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(node.text);

  const handleSave = () => {
    onUpdate({ ...node, text: editText });
    setEditing(false);
  };

  const addChild = () => {
    const newChild: TreeNode = { id: genId(), text: "", children: [] };
    onUpdate({ ...node, children: [...node.children, newChild] });
  };

  const updateChild = (index: number, updated: TreeNode) => {
    const newChildren = [...node.children];
    newChildren[index] = updated;
    onUpdate({ ...node, children: newChildren });
  };

  const deleteChild = (index: number) => {
    onUpdate({ ...node, children: node.children.filter((_, i) => i !== index) });
  };

  return (
    <div className={`${depth > 0 ? "ml-6 border-l border-border/50 pl-4" : ""}`}>
      <div className="flex items-center gap-2 py-1.5 group">
        {node.children.length > 0 ? (
          <button onClick={() => setExpanded(!expanded)} className="shrink-0">
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-4 h-4 flex items-center justify-center shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />
          </span>
        )}

        {editing ? (
          <div className="flex items-center gap-1.5 flex-1">
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setEditing(false);
              }}
              className="flex-1 px-2 py-1 rounded border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
            />
            <button onClick={handleSave} className="p-1 rounded bg-primary text-primary-foreground">
              <Check className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <span
            className={`text-sm flex-1 ${!node.text ? "text-muted-foreground italic" : ""}`}
            onDoubleClick={() => {
              if (editable) {
                setEditText(node.text);
                setEditing(true);
              }
            }}
          >
            {node.text || "Clique duas vezes para editar"}
          </span>
        )}

        {editable && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => {
                setEditText(node.text);
                setEditing(true);
              }}
              className="p-1 rounded hover:bg-muted"
              title="Editar"
            >
              <Pencil className="w-3 h-3 text-muted-foreground" />
            </button>
            <button onClick={addChild} className="p-1 rounded hover:bg-muted" title="Adicionar sub-item">
              <Plus className="w-3 h-3 text-muted-foreground" />
            </button>
            <button onClick={onDelete} className="p-1 rounded hover:bg-red-500/10" title="Remover">
              <Trash2 className="w-3 h-3 text-red-400" />
            </button>
          </div>
        )}
      </div>

      {expanded &&
        node.children.map((child, i) => (
          <TreeNodeEditor
            key={child.id}
            node={child}
            depth={depth + 1}
            onUpdate={(updated) => updateChild(i, updated)}
            onDelete={() => deleteChild(i)}
            editable={editable}
          />
        ))}
    </div>
  );
}

// ─── Gap/Lever Section ────────────────────────────

function GapLeverSection({
  title,
  icon: Icon,
  items,
  onChange,
  editable,
  colorClass,
}: {
  title: string;
  icon: React.ElementType;
  items: (GapNode | LeverNode)[];
  onChange: (items: (GapNode | LeverNode)[]) => void;
  editable: boolean;
  colorClass: string;
}) {
  const addItem = () => {
    onChange([
      ...items,
      { id: genId(), title: "", children: [] },
    ]);
  };

  const updateItem = (index: number, updated: GapNode | LeverNode) => {
    const newItems = [...items];
    newItems[index] = updated;
    onChange(newItems);
  };

  const deleteItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const updateItemTitle = (index: number, newTitle: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], title: newTitle };
    onChange(newItems);
  };

  const addRootToItem = (index: number) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      children: [
        ...newItems[index].children,
        { id: genId(), text: "", children: [] },
      ],
    };
    onChange(newItems);
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className={`flex items-center justify-between px-5 py-4 border-b border-border ${colorClass}`}>
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5" />
          <h3 className="font-semibold">{title}</h3>
          <span className="text-xs text-muted-foreground ml-1">
            ({items.length})
          </span>
        </div>
        {editable && (
          <button
            onClick={addItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar
          </button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum item adicionado
          </p>
        ) : (
          items.map((item, i) => (
            <div key={item.id} className="rounded-lg border border-border/50 p-4">
              <div className="flex items-center gap-2 mb-3 group">
                {editable && (
                  <GripVertical className="w-4 h-4 text-muted-foreground/30 shrink-0" />
                )}
                <EditableTitle
                  value={item.title}
                  placeholder={`${title.slice(0, -1)} ${i + 1}`}
                  onChange={(val) => updateItemTitle(i, val)}
                  editable={editable}
                />
                {editable && (
                  <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => addRootToItem(i)}
                      className="p-1 rounded hover:bg-muted"
                      title="Adicionar raiz"
                    >
                      <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => deleteItem(i)}
                      className="p-1 rounded hover:bg-red-500/10"
                      title="Remover"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                )}
              </div>

              {/* Metrics fields */}
              {editable && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                  <input
                    type="text"
                    value={(item as GapNode).currentMetric || ""}
                    onChange={(e) => updateItem(i, { ...item, currentMetric: e.target.value })}
                    placeholder="Métrica atual (ex: CTR 1.2%)"
                    className="px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground/50"
                  />
                  <input
                    type="text"
                    value={(item as GapNode).targetMetric || ""}
                    onChange={(e) => updateItem(i, { ...item, targetMetric: e.target.value })}
                    placeholder="Meta (ex: CTR 2.5%)"
                    className="px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground/50"
                  />
                  <input
                    type="text"
                    value={(item as GapNode).financialImpact || ""}
                    onChange={(e) => updateItem(i, { ...item, financialImpact: e.target.value })}
                    placeholder="Impacto (ex: +R$ 15k/mês)"
                    className="px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground/50"
                  />
                </div>
              )}
              {editable && (
                <ImageUploadField
                  value={(item as GapNode).imageUrl || ""}
                  onChange={(url) => updateItem(i, { ...item, imageUrl: url })}
                />
              )}
              {!editable && ((item as GapNode).currentMetric || (item as GapNode).targetMetric) && (
                <div className="flex items-center gap-3 mb-3 text-sm text-muted-foreground">
                  {(item as GapNode).currentMetric && <span>Atual: {(item as GapNode).currentMetric}</span>}
                  {(item as GapNode).targetMetric && <span>→ Meta: {(item as GapNode).targetMetric}</span>}
                  {(item as GapNode).financialImpact && <span className="text-primary font-medium">| {(item as GapNode).financialImpact}</span>}
                </div>
              )}

              {item.children.map((child, j) => (
                <TreeNodeEditor
                  key={child.id}
                  node={child}
                  depth={0}
                  onUpdate={(updated) => {
                    const newChildren = [...item.children];
                    newChildren[j] = updated;
                    updateItem(i, { ...item, children: newChildren });
                  }}
                  onDelete={() => {
                    updateItem(i, {
                      ...item,
                      children: item.children.filter((_, k) => k !== j),
                    });
                  }}
                  editable={editable}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Image Upload Field ──────────────────────────

function ImageUploadField({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/image", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) onChange(data.url);
    } catch {
      // silently fail
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="mb-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />
      {value ? (
        <div className="relative rounded-lg overflow-hidden border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Referência" className="w-full max-h-48 object-cover" />
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              onClick={() => fileRef.current?.click()}
              className="p-1.5 rounded-lg bg-background/80 backdrop-blur border border-border text-xs hover:bg-muted transition-colors"
            >
              Trocar
            </button>
            <button
              onClick={() => onChange("")}
              className="p-1.5 rounded-lg bg-background/80 backdrop-blur border border-border text-xs text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Remover
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:bg-muted/50 hover:border-muted-foreground/30 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            "Enviando..."
          ) : (
            <>
              <ImageIcon className="w-4 h-4" />
              Adicionar imagem de referência
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ─── Editable Title ───────────────────────────────

function EditableTitle({
  value,
  placeholder,
  onChange,
  editable,
}: {
  value: string;
  placeholder: string;
  onChange: (val: string) => void;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(!value);
  const [editVal, setEditVal] = useState(value);

  const handleSave = () => {
    onChange(editVal);
    setEditing(false);
  };

  if (editing && editable) {
    return (
      <input
        type="text"
        value={editVal}
        onChange={(e) => setEditVal(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
        placeholder={placeholder}
        className="flex-1 px-2 py-1 rounded border border-border bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30"
        autoFocus
      />
    );
  }

  return (
    <h4
      className={`text-sm font-semibold flex-1 ${!value ? "text-muted-foreground italic" : ""} ${editable ? "cursor-pointer hover:text-primary transition-colors" : ""}`}
      onClick={() => editable && setEditing(true)}
    >
      {value || placeholder}
    </h4>
  );
}

// ─── Top Items Table ──────────────────────────────

function TopItemsTable<T extends Record<string, unknown>>({
  title,
  icon: Icon,
  items,
  columns,
  onChange,
  editable,
  onAdd,
  emptyText,
  renderRow,
}: {
  title: string;
  icon: React.ElementType;
  items: T[];
  columns: { key: string; label: string }[];
  onChange: (items: T[]) => void;
  editable: boolean;
  onAdd: () => void;
  emptyText: string;
  renderRow: (
    item: T,
    index: number,
    onUpdate: (updated: T) => void,
    onDelete: () => void,
    editable: boolean
  ) => React.ReactNode;
}) {
  const updateItem = (index: number, updated: T) => {
    const newItems = [...items];
    newItems[index] = updated;
    onChange(newItems);
  };

  const deleteItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        {editable && (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {emptyText}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground w-8">
                  #
                </th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground"
                  >
                    {col.label}
                  </th>
                ))}
                {editable && (
                  <th className="px-5 py-2.5 text-right text-xs font-medium text-muted-foreground w-12" />
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) =>
                renderRow(
                  item,
                  i,
                  (updated) => updateItem(i, updated),
                  () => deleteItem(i),
                  editable
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Editor Page ─────────────────────────────

export default function ActionPlanEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const planId = params.id as string;

  const [plan, setPlan] = useState<ActionPlanFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Video modal for creatives
  const [selectedCreative, setSelectedCreative] = useState<TopCreative | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const userRole = session?.user?.role;
  const canEdit =
    (userRole === "OWNER" || userRole === "ADMIN") &&
    plan?.status !== "FINALIZED";

  const loadPlan = useCallback(async () => {
    try {
      const data = await getActionPlan(planId);
      if (!data) {
        toast.error("Plano não encontrado");
        router.push("/plano-de-acao");
        return;
      }
      setPlan(data);
    } catch {
      toast.error("Erro ao carregar plano");
    } finally {
      setLoading(false);
    }
  }, [planId, router]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const handleSave = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      await updateActionPlan(planId, {
        title: plan.title,
        metrics: plan.metrics ?? undefined,
        topProducts: plan.topProducts ?? undefined,
        topCollections: plan.topCollections ?? undefined,
        topCreatives: plan.topCreatives ?? undefined,
        gaps: plan.gaps,
        levers: plan.levers,
      });
      setHasChanges(false);
      toast.success("Plano salvo!");
    } catch {
      toast.error("Erro ao salvar plano");
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshMetrics = async () => {
    setRefreshing(true);
    try {
      const result = await refreshActionPlanMetrics(planId);
      setPlan((prev) =>
        prev
          ? {
              ...prev,
              metrics: result.metrics,
              topProducts: result.topProducts,
              topCollections: result.topCollections,
              topCreatives: result.topCreatives,
            }
          : prev
      );
      toast.success("Métricas atualizadas!");
    } catch {
      toast.error("Erro ao atualizar métricas");
    } finally {
      setRefreshing(false);
    }
  };

  const handleFinalize = async () => {
    if (!plan) return;
    if (!confirm("Finalizar o plano? O link público será ativado.")) return;

    // Save current state first, then finalize
    setSaving(true);
    try {
      await updateActionPlan(planId, {
        title: plan.title,
        metrics: plan.metrics ?? undefined,
        topProducts: plan.topProducts ?? undefined,
        topCollections: plan.topCollections ?? undefined,
        topCreatives: plan.topCreatives ?? undefined,
        gaps: plan.gaps,
        levers: plan.levers,
        status: "FINALIZED",
      });
      setPlan((prev) => (prev ? { ...prev, status: "FINALIZED" } : prev));
      setHasChanges(false);
      toast.success("Plano finalizado! Link público ativado.");
    } catch {
      toast.error("Erro ao finalizar plano");
    } finally {
      setSaving(false);
    }
  };

  const handleRevertToDraft = async () => {
    if (!confirm("Voltar para rascunho? O link público será desativado."))
      return;
    setSaving(true);
    try {
      await updateActionPlan(planId, { status: "DRAFT" });
      setPlan((prev) => (prev ? { ...prev, status: "DRAFT" } : prev));
      toast.success("Plano voltou para rascunho");
    } catch {
      toast.error("Erro ao reverter plano");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = () => {
    if (!plan) return;
    const url = `${window.location.origin}/plano/${plan.publicToken}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const update = <K extends keyof ActionPlanFull>(
    key: K,
    value: ActionPlanFull[K]
  ) => {
    setPlan((prev) => (prev ? { ...prev, [key]: value } : prev));
    setHasChanges(true);
  };

  const updateMetric = (key: keyof PlanMetrics, value: number) => {
    if (!plan?.metrics) return;
    const newMetrics = { ...plan.metrics, [key]: value };
    // Recalculate derived metrics
    if (key === "investido" || key === "convertido") {
      newMetrics.roas =
        newMetrics.investido > 0
          ? newMetrics.convertido / newMetrics.investido
          : 0;
    }
    if (key === "investido" || key === "totalConversoes") {
      newMetrics.cpa =
        newMetrics.totalConversoes > 0
          ? newMetrics.investido / newMetrics.totalConversoes
          : 0;
    }
    if (key === "faturamento" || key === "totalPedidos") {
      newMetrics.ticketMedio =
        newMetrics.totalPedidos > 0
          ? newMetrics.faturamento / newMetrics.totalPedidos
          : 0;
    }
    update("metrics", newMetrics);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 bg-muted animate-pulse rounded-lg" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!plan) return null;

  const metrics = plan.metrics;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/plano-de-acao")}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              {plan.title}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Período:{" "}
              {new Intl.DateTimeFormat("pt-BR").format(
                new Date(plan.periodStart)
              )}{" "}
              —{" "}
              {new Intl.DateTimeFormat("pt-BR").format(
                new Date(plan.periodEnd)
              )}
              {" · "}
              {plan.status === "FINALIZED" ? (
                <span className="text-emerald-400">Finalizado</span>
              ) : (
                <span className="text-amber-400">Rascunho</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && (
            <>
              <button
                onClick={handleRefreshMetrics}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
                />
                Atualizar Métricas
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </>
          )}

          {plan.status === "DRAFT" && canEdit && (
            <button
              onClick={handleFinalize}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              Finalizar
            </button>
          )}

          {plan.status === "FINALIZED" && (
            <>
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-colors"
              >
                <Link2 className="w-3.5 h-3.5" />
                Copiar Link
              </button>
              <button
                onClick={() =>
                  window.open(`/plano/${plan.publicToken}`, "_blank")
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                Ver Apresentação
              </button>
              {(userRole === "OWNER" || userRole === "ADMIN") && (
                <button
                  onClick={handleRevertToDraft}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                >
                  Voltar para Rascunho
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      {metrics && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
            Métricas do Período
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard
              label="Faturamento Pago"
              value={metrics.faturamento}
              icon={DollarSign}
              editable={!!canEdit}
              onChange={(v) => updateMetric("faturamento", v)}
            />
            <MetricCard
              label="Valor Investido"
              value={metrics.investido}
              icon={CreditCard}
              editable={!!canEdit}
              onChange={(v) => updateMetric("investido", v)}
            />
            <MetricCard
              label="Valor Convertido"
              value={metrics.convertido}
              icon={ShoppingCart}
              editable={!!canEdit}
              onChange={(v) => updateMetric("convertido", v)}
            />
            <MetricCard
              label="ROAS"
              value={metrics.roas}
              icon={TrendingUp}
              format="decimal"
              editable={!!canEdit}
              onChange={(v) => updateMetric("roas", v)}
            />
            <MetricCard
              label="CPA"
              value={metrics.cpa}
              icon={BarChart3}
              editable={!!canEdit}
              onChange={(v) => updateMetric("cpa", v)}
            />
            <MetricCard
              label="Ticket Médio"
              value={metrics.ticketMedio}
              icon={Tag}
              editable={!!canEdit}
              onChange={(v) => updateMetric("ticketMedio", v)}
            />
          </div>
        </motion.div>
      )}

      {/* Top Products */}
      <TopItemsTable<TopProduct>
        title="Top 5 Produtos Mais Vendidos"
        icon={ShoppingCart}
        items={plan.topProducts || []}
        columns={[
          { key: "img", label: "" },
          { key: "name", label: "Produto" },
          { key: "quantity", label: "Qtd" },
          { key: "revenue", label: "Faturamento" },
        ]}
        onChange={(items) => update("topProducts", items)}
        editable={!!canEdit}
        onAdd={() =>
          update("topProducts", [
            ...(plan.topProducts || []),
            { name: "", quantity: 0, revenue: 0 },
          ])
        }
        emptyText="Nenhum produto encontrado no período"
        renderRow={(item, index, onUpdate, onDelete, editable) => (
          <tr key={index} className="border-b border-border/50 group">
            <td className="px-5 py-3 text-sm text-muted-foreground">
              {index + 1}
            </td>
            <td className="px-3 py-2 w-14">
              {item.imageUrl ? (
                <div className="w-10 h-10 relative rounded overflow-hidden">
                  <Image src={item.imageUrl} alt={item.name} fill className="object-cover" unoptimized sizes="40px" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                  <Package className="w-4 h-4 text-muted-foreground/30" />
                </div>
              )}
            </td>
            <td className="px-5 py-3">
              {editable ? (
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => onUpdate({ ...item, name: e.target.value })}
                  className="w-full bg-transparent text-sm focus:outline-none border-b border-transparent focus:border-primary"
                  placeholder="Nome do produto"
                />
              ) : (
                <span className="text-sm">{item.name}</span>
              )}
            </td>
            <td className="px-5 py-3">
              {editable ? (
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) =>
                    onUpdate({ ...item, quantity: Number(e.target.value) })
                  }
                  className="w-20 bg-transparent text-sm focus:outline-none border-b border-transparent focus:border-primary"
                />
              ) : (
                <span className="text-sm">{item.quantity}</span>
              )}
            </td>
            <td className="px-5 py-3">
              {editable ? (
                <input
                  type="number"
                  value={item.revenue}
                  onChange={(e) =>
                    onUpdate({ ...item, revenue: Number(e.target.value) })
                  }
                  className="w-28 bg-transparent text-sm focus:outline-none border-b border-transparent focus:border-primary"
                  step="0.01"
                />
              ) : (
                <span className="text-sm">{fmt(item.revenue)}</span>
              )}
            </td>
            {editable && (
              <td className="px-5 py-3 text-right">
                <button
                  onClick={onDelete}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </td>
            )}
          </tr>
        )}
      />

      {/* Top Collections */}
      <TopItemsTable<TopCollection>
        title="Top 3 Coleções com Mais Vendas"
        icon={Tag}
        items={plan.topCollections || []}
        columns={[
          { key: "name", label: "Coleção" },
          { key: "quantity", label: "Qtd" },
          { key: "revenue", label: "Faturamento" },
        ]}
        onChange={(items) => update("topCollections", items)}
        editable={!!canEdit}
        onAdd={() =>
          update("topCollections", [
            ...(plan.topCollections || []),
            { name: "", quantity: 0, revenue: 0 },
          ])
        }
        emptyText="Adicione as coleções manualmente"
        renderRow={(item, index, onUpdate, onDelete, editable) => (
          <tr key={index} className="border-b border-border/50 group">
            <td className="px-5 py-3 text-sm text-muted-foreground">
              {index + 1}
            </td>
            <td className="px-5 py-3">
              {editable ? (
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => onUpdate({ ...item, name: e.target.value })}
                  className="w-full bg-transparent text-sm focus:outline-none border-b border-transparent focus:border-primary"
                  placeholder="Nome da coleção"
                />
              ) : (
                <span className="text-sm">{item.name}</span>
              )}
            </td>
            <td className="px-5 py-3">
              {editable ? (
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) =>
                    onUpdate({ ...item, quantity: Number(e.target.value) })
                  }
                  className="w-20 bg-transparent text-sm focus:outline-none border-b border-transparent focus:border-primary"
                />
              ) : (
                <span className="text-sm">{item.quantity}</span>
              )}
            </td>
            <td className="px-5 py-3">
              {editable ? (
                <input
                  type="number"
                  value={item.revenue}
                  onChange={(e) =>
                    onUpdate({ ...item, revenue: Number(e.target.value) })
                  }
                  className="w-28 bg-transparent text-sm focus:outline-none border-b border-transparent focus:border-primary"
                  step="0.01"
                />
              ) : (
                <span className="text-sm">{fmt(item.revenue)}</span>
              )}
            </td>
            {editable && (
              <td className="px-5 py-3 text-right">
                <button
                  onClick={onDelete}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </td>
            )}
          </tr>
        )}
      />

      {/* Top Creatives */}
      <TopItemsTable<TopCreative>
        title="Top 5 Criativos — Melhor Performance"
        icon={Trophy}
        items={plan.topCreatives || []}
        columns={[
          { key: "thumb", label: "" },
          { key: "name", label: "Criativo" },
          { key: "spend", label: "Gasto" },
          { key: "sales", label: "Vendas" },
          { key: "roas", label: "ROAS" },
          { key: "score", label: "Score" },
        ]}
        onChange={(items) => update("topCreatives", items)}
        editable={!!canEdit}
        onAdd={() =>
          update("topCreatives", [
            ...(plan.topCreatives || []),
            {
              adId: genId(),
              name: "",
              thumbnailUrl: null,
              videoUrl: null,
              spend: 0,
              sales: 0,
              roas: 0,
              score: 0,
            },
          ])
        }
        emptyText="Nenhum criativo encontrado no período"
        renderRow={(item, index, onUpdate, onDelete, editable) => (
          <tr
            key={index}
            className="border-b border-border/50 group cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => {
              setSelectedCreative(item);
              setIsModalOpen(true);
            }}
          >
            <td className="px-5 py-3 text-sm text-muted-foreground">
              {index + 1}
            </td>
            <td className="px-3 py-2 w-12">
              {item.thumbnailUrl ? (
                <Image
                  src={item.thumbnailUrl}
                  alt={item.name}
                  width={40}
                  height={40}
                  className="rounded object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </td>
            <td className="px-5 py-3">
              {editable ? (
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => {
                    e.stopPropagation();
                    onUpdate({ ...item, name: e.target.value });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-transparent text-sm focus:outline-none border-b border-transparent focus:border-primary"
                  placeholder="Nome do criativo"
                />
              ) : (
                <span className="text-sm">{item.name}</span>
              )}
            </td>
            <td className="px-5 py-3 text-sm">{fmt(item.spend)}</td>
            <td className="px-5 py-3 text-sm">{item.sales}</td>
            <td className="px-5 py-3 text-sm font-medium">
              {fmtNum(item.roas)}x
            </td>
            <td className="px-5 py-3">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                {fmtNum(item.score * 100, 0)}
              </span>
            </td>
            {editable && (
              <td className="px-5 py-3 text-right">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </td>
            )}
          </tr>
        )}
      />

      {/* Video Modal for Creatives */}
      {isModalOpen && selectedCreative && (
        <VideoModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          creative={{
            adId: selectedCreative.adId,
            adName: selectedCreative.name,
            platform: "FACEBOOK_ADS",
            thumbnailUrl: selectedCreative.thumbnailUrl,
            videoUrl: selectedCreative.videoUrl,
            impressions: 0,
            clicks: 0,
            spend: selectedCreative.spend,
            conversions: selectedCreative.sales,
            revenue: selectedCreative.spend * selectedCreative.roas,
            ctr: 0,
            roas: selectedCreative.roas,
            cpc: 0,
            cpm: 0,
            campaignName: null,
          }}
        />
      )}

      {/* Gaps */}
      <GapLeverSection
        title="Gaps"
        icon={Target}
        items={plan.gaps}
        onChange={(items) => update("gaps", items as GapNode[])}
        editable={!!canEdit}
        colorClass="bg-red-500/5"
      />

      {/* Levers */}
      <GapLeverSection
        title="Alavancas"
        icon={TrendingUp}
        items={plan.levers}
        onChange={(items) => update("levers", items as LeverNode[])}
        editable={!!canEdit}
        colorClass="bg-emerald-500/5"
      />
    </div>
  );
}
