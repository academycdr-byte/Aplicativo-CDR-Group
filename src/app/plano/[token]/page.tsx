import { notFound } from "next/navigation";
import Image from "next/image";
import { getActionPlanByToken } from "@/actions/action-plan";
import type {
  PlanMetrics,
  TopProduct,
  TopCollection,
  TopCreative,
  GapNode,
  LeverNode,
  TreeNode,
} from "@/actions/action-plan";
import { CreativesSection } from "./creatives-section";
import { DataRain, MetricsCube } from "./hero-effects";
import type { Metadata } from "next";

// ─── Dynamic Metadata ─────────────────────────────

type PageProps = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const plan = await getActionPlanByToken(token);
  if (!plan) return { title: "Plano não encontrado" };

  return {
    title: `${plan.title} | ${plan.organization.name}`,
    description: `Plano de Ação — ${plan.organization.name}`,
  };
}

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

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(date));

// ─── Tree Renderer ────────────────────────────────

function TreeBranch({ node, depth }: { node: TreeNode; depth: number }) {
  return (
    <div className={`${depth > 0 ? "ml-6" : ""}`}>
      <div className="flex items-start gap-2.5 py-2">
        {depth > 0 && (
          <div className="flex items-center gap-2 shrink-0 mt-1.5">
            <div className="w-5 h-px bg-white/15" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/30 shrink-0" />
          </div>
        )}
        <span className={`${depth === 0 ? "text-[15px] font-medium text-white/90" : "text-sm text-white/60"} leading-relaxed`}>
          {node.text}
        </span>
      </div>
      {node.children.length > 0 && (
        <div className="border-l border-white/[0.06] ml-[3px]">
          {node.children.map((child) => (
            <TreeBranch key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function GapLeverCard({
  item,
  index,
  type,
}: {
  item: GapNode | LeverNode;
  index: number;
  type: "gap" | "lever";
}) {
  const isGap = type === "gap";
  const accentColor = isGap ? "text-red-400" : "text-emerald-400";
  const borderAccent = isGap ? "border-red-500/10" : "border-emerald-500/10";
  const numberBg = isGap ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400";

  return (
    <div className={`rounded-2xl border ${borderAccent} bg-white/[0.02] p-6`}>
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-8 h-8 rounded-lg ${numberBg} flex items-center justify-center font-bold text-sm`}>
          {index + 1}
        </div>
        <h4 className={`text-base font-semibold ${accentColor}`}>
          {item.title || `${isGap ? "Gap" : "Alavanca"} ${index + 1}`}
        </h4>
      </div>
      {item.children.length > 0 && (
        <div className="space-y-0.5">
          {item.children.map((child) => (
            <TreeBranch key={child.id} node={child} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page (Server Component) ─────────────────

export default async function PublicPlanPage({ params }: PageProps) {
  const { token } = await params;
  const plan = await getActionPlanByToken(token);

  if (!plan) notFound();

  const metrics = plan.metrics;
  const products = plan.topProducts || [];
  const collections = plan.topCollections || [];
  const creatives = plan.topCreatives || [];
  const gaps = plan.gaps || [];
  const levers = plan.levers || [];

  return (
    <div className="min-h-screen bg-[#050505] text-white antialiased">

      {/* ─── HERO ─── */}
      <header className="relative overflow-hidden min-h-[70vh] flex items-center justify-center">
        {/* Background effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.15),transparent)]" />
        <DataRain metrics={metrics} />

        {/* Content */}
        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center space-y-8">
          {/* Logo / Org */}
          <div className="flex items-center justify-center gap-3">
            {plan.organization.logo ? (
              <Image
                src={plan.organization.logo}
                alt={plan.organization.name}
                width={36}
                height={36}
                className="rounded-lg"
                unoptimized
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                <span className="text-sm font-bold text-white/70">
                  {plan.organization.name.charAt(0)}
                </span>
              </div>
            )}
            <span className="text-sm font-medium text-white/40">
              {plan.organization.name}
            </span>
          </div>

          {/* 3D Cube */}
          <div className="py-4">
            <MetricsCube metrics={metrics} />
          </div>

          {/* Title */}
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white">
              {plan.title}
            </h1>
            <p className="text-base text-white/30 font-medium">
              {formatDate(plan.periodStart)} — {formatDate(plan.periodEnd)}
            </p>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#050505] to-transparent" />
      </header>

      <main className="max-w-4xl mx-auto px-6 space-y-24 pb-32">

        {/* ─── METRICS ─── */}
        {metrics && (
          <section className="space-y-8">
            <SectionHeader
              title="Métricas do Período"
              subtitle="Dados consolidados dos últimos 30 dias"
            />

            {/* Primary metrics — big numbers */}
            <div className="grid md:grid-cols-3 gap-px bg-white/[0.06] rounded-2xl overflow-hidden">
              <MetricCell label="Faturamento Pago" value={fmt(metrics.faturamento)} sub={`${metrics.totalPedidos} pedidos`} />
              <MetricCell label="Valor Investido" value={fmt(metrics.investido)} sub="Meta Ads" />
              <MetricCell label="Valor Convertido" value={fmt(metrics.convertido)} sub="Meta Ads" />
            </div>

            {/* Secondary metrics */}
            <div className="grid md:grid-cols-3 gap-px bg-white/[0.06] rounded-2xl overflow-hidden">
              <MetricCell
                label="ROAS"
                value={`${fmtNum(metrics.roas)}x`}
                sub={metrics.roas >= 3 ? "Excelente" : metrics.roas >= 2 ? "Bom" : "Atenção"}
                accent={metrics.roas >= 3 ? "emerald" : metrics.roas >= 2 ? "amber" : "red"}
              />
              <MetricCell label="CPA" value={fmt(metrics.cpa)} sub={`${metrics.totalConversoes} conversões`} />
              <MetricCell label="Ticket Médio" value={fmt(metrics.ticketMedio)} />
            </div>
          </section>
        )}

        {/* ─── DIVIDER ─── */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* ─── TOP PRODUCTS ─── */}
        {products.length > 0 && (
          <section className="space-y-8">
            <SectionHeader title="Top 5 Produtos" subtitle="Mais vendidos no período" />
            <div className="space-y-3">
              {products.map((p: TopProduct, i: number) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors"
                >
                  {/* Rank */}
                  <span className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-xs font-bold text-white/50 shrink-0">
                    {i + 1}
                  </span>

                  {/* Image */}
                  {p.imageUrl ? (
                    <div className="w-12 h-12 relative rounded-lg overflow-hidden shrink-0 border border-white/[0.08]">
                      <Image src={p.imageUrl} alt={p.name} fill className="object-cover" unoptimized sizes="48px" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-white/[0.04] shrink-0 border border-white/[0.06]" />
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-white/30 mt-0.5">{p.quantity} vendas</p>
                  </div>

                  {/* Revenue */}
                  <p className="text-sm font-semibold text-white/80 shrink-0">{fmt(p.revenue)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── TOP COLLECTIONS ─── */}
        {collections.length > 0 && (
          <section className="space-y-8">
            <SectionHeader title="Top Coleções" subtitle="Categorias com mais vendas" />
            <div className="grid md:grid-cols-3 gap-4">
              {collections.map((c: TopCollection, i: number) => (
                <div
                  key={i}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center space-y-3"
                >
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.06] text-xs font-bold text-white/50">
                    {i + 1}
                  </span>
                  <h4 className="text-sm font-semibold">{c.name}</h4>
                  <p className="text-3xl font-bold tracking-tight">{c.quantity}</p>
                  <p className="text-xs text-white/30">{fmt(c.revenue)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── DIVIDER ─── */}
        {creatives.length > 0 && (
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        )}

        {/* ─── TOP CREATIVES ─── */}
        {creatives.length > 0 && (
          <section className="space-y-8">
            <SectionHeader title="Top 5 Criativos" subtitle="Melhor performance no período" />
            <CreativesSection creatives={creatives} />
          </section>
        )}

        {/* ─── DIVIDER ─── */}
        {(gaps.length > 0 || levers.length > 0) && (
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        )}

        {/* ─── GAPS ─── */}
        {gaps.length > 0 && (
          <section className="space-y-8">
            <SectionHeader
              title="Gaps Identificados"
              subtitle="Pontos de melhoria que precisam de atenção"
            />
            <div className="grid md:grid-cols-2 gap-4">
              {gaps.map((gap: GapNode, i: number) => (
                <GapLeverCard key={gap.id} item={gap} index={i} type="gap" />
              ))}
            </div>
          </section>
        )}

        {/* ─── LEVERS ─── */}
        {levers.length > 0 && (
          <section className="space-y-8">
            <SectionHeader
              title="Alavancas de Crescimento"
              subtitle="Ações que vão gerar mais resultado"
            />
            <div className="grid md:grid-cols-2 gap-4">
              {levers.map((lever: LeverNode, i: number) => (
                <GapLeverCard key={lever.id} item={lever} index={i} type="lever" />
              ))}
            </div>
          </section>
        )}

        {/* ─── FOOTER ─── */}
        <footer className="text-center pt-12 border-t border-white/[0.06] space-y-2">
          <p className="text-xs text-white/20">
            Plano de Ação preparado por {plan.organization.name}
            {plan.createdBy.name && ` · ${plan.createdBy.name}`}
          </p>
          <p className="text-[10px] text-white/10">
            {formatDate(plan.createdAt)}
          </p>
        </footer>
      </main>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h2>
      {subtitle && (
        <p className="text-sm text-white/30 mt-2">{subtitle}</p>
      )}
    </div>
  );
}

function MetricCell({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "emerald" | "amber" | "red";
}) {
  const accentClasses = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    red: "text-red-400",
  };

  return (
    <div className="bg-[#050505] p-6 md:p-8">
      <p className="text-[11px] font-medium text-white/30 uppercase tracking-wider mb-3">
        {label}
      </p>
      <p className={`text-2xl md:text-4xl font-bold tracking-tight ${accent ? accentClasses[accent] : "text-white"}`}>
        {value}
      </p>
      {sub && (
        <p className={`text-xs mt-2 ${accent ? accentClasses[accent] + "/50" : "text-white/20"}`}>
          {sub}
        </p>
      )}
    </div>
  );
}
