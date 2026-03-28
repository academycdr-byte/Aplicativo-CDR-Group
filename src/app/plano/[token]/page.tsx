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
import { FloatingParticles, MetricsCube } from "./hero-effects";
import type { Metadata } from "next";

// ─── Metadata ─────────────────────────────────────

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

// ─── Formatters ───────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtNum = (v: number, d = 2) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

const fmtDate = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(date));

// ─── Page ─────────────────────────────────────────

export default async function PublicPlanPage({ params }: PageProps) {
  const { token } = await params;
  const plan = await getActionPlanByToken(token);
  if (!plan) notFound();

  const m = plan.metrics;
  const products = plan.topProducts || [];
  const collections = plan.topCollections || [];
  const creatives = plan.topCreatives || [];
  const gaps = plan.gaps || [];
  const levers = plan.levers || [];

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: "var(--font-sans, 'Inter', system-ui, sans-serif)" }}>

      {/* ════════ HERO ════════ */}
      <header className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        <FloatingParticles metrics={m} />

        <div className="relative z-10 flex flex-col items-center gap-10 px-6">
          {/* Organization */}
          <div className="flex items-center gap-2.5 opacity-40">
            {plan.organization.logo ? (
              <Image src={plan.organization.logo} alt="" width={24} height={24} className="rounded-md" unoptimized />
            ) : null}
            <span className="text-xs font-medium tracking-wide">{plan.organization.name}</span>
          </div>

          {/* 3D Cube */}
          <MetricsCube metrics={m} />

          {/* Title */}
          <div className="text-center max-w-2xl space-y-4">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-[-0.04em] leading-[0.95]">
              {plan.title}
            </h1>
            <p className="text-sm text-white/25">
              {fmtDate(plan.periodStart)} — {fmtDate(plan.periodEnd)}
            </p>
          </div>

          {/* Scroll indicator */}
          <div className="mt-8 opacity-20">
            <div className="w-5 h-8 rounded-full border border-white/30 flex justify-center pt-1.5">
              <div className="w-1 h-2 rounded-full bg-white/50" style={{ animation: "plan-float 2s ease-in-out infinite alternate" }} />
            </div>
          </div>
        </div>
      </header>

      {/* ════════ CONTENT ════════ */}
      <main className="max-w-[880px] mx-auto px-6">

        {/* ──── METRICS ──── */}
        {m && (
          <section className="py-24 md:py-32 plan-section" style={{ animationDelay: "0.1s" }}>
            <Label>Métricas do Período</Label>

            {/* Big 3 */}
            <div className="grid md:grid-cols-3 mt-10">
              <Metric label="Faturamento Pago" value={fmt(m.faturamento)} note={`${m.totalPedidos} pedidos`} />
              <Metric label="Valor Investido" value={fmt(m.investido)} note="Meta Ads" border />
              <Metric label="Valor Convertido" value={fmt(m.convertido)} note="Meta Ads" border />
            </div>

            {/* Small 3 */}
            <div className="grid md:grid-cols-3 border-t border-white/[0.05] mt-0">
              <Metric
                label="ROAS"
                value={`${fmtNum(m.roas)}x`}
                note={m.roas >= 3 ? "Excelente" : m.roas >= 2 ? "Bom" : "Atenção"}
                accent={m.roas >= 3 ? "#10b981" : m.roas >= 2 ? "#f59e0b" : "#ef4444"}
              />
              <Metric label="CPA" value={fmt(m.cpa)} note={`${m.totalConversoes} conversões`} border />
              <Metric label="Ticket Médio" value={fmt(m.ticketMedio)} border />
            </div>
          </section>
        )}

        <Hr />

        {/* ──── TOP PRODUCTS ──── */}
        {products.length > 0 && (
          <section className="py-24 md:py-32 plan-section" style={{ animationDelay: "0.2s" }}>
            <Label>Top 5 Produtos</Label>
            <p className="text-sm text-white/25 mt-2 mb-10">Mais vendidos no período</p>

            <div className="space-y-2">
              {products.map((p: TopProduct, i: number) => (
                <div key={i} className="flex items-center gap-4 py-4 px-1 border-b border-white/[0.04] last:border-0">
                  <span className="text-xs font-bold text-white/20 w-5 text-right shrink-0">{i + 1}</span>
                  {p.imageUrl ? (
                    <div className="w-11 h-11 relative rounded-lg overflow-hidden shrink-0 bg-white/5">
                      <Image src={p.imageUrl} alt={p.name} fill className="object-cover" unoptimized sizes="44px" />
                    </div>
                  ) : (
                    <div className="w-11 h-11 rounded-lg bg-white/[0.03] shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-white/20 mt-0.5">{p.quantity} un.</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums shrink-0">{fmt(p.revenue)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ──── TOP COLLECTIONS ──── */}
        {collections.length > 0 && (
          <section className="py-24 md:py-32 plan-section" style={{ animationDelay: "0.25s" }}>
            <Label>Top Coleções</Label>
            <p className="text-sm text-white/25 mt-2 mb-10">Categorias com mais vendas</p>

            <div className="grid md:grid-cols-3 gap-6">
              {collections.map((c: TopCollection, i: number) => (
                <div key={i} className="text-center py-8">
                  <span className="text-xs font-bold text-white/15">{i + 1}</span>
                  <p className="text-sm font-semibold mt-3">{c.name}</p>
                  <p className="text-4xl font-bold tracking-tight mt-2">{c.quantity}</p>
                  <p className="text-xs text-white/20 mt-2">{fmt(c.revenue)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <Hr />

        {/* ──── TOP CREATIVES ──── */}
        {creatives.length > 0 && (
          <section className="py-24 md:py-32 plan-section" style={{ animationDelay: "0.3s" }}>
            <Label>Top 5 Criativos</Label>
            <p className="text-sm text-white/25 mt-2 mb-10">Melhor performance no período</p>
            <CreativesSection creatives={creatives} />
          </section>
        )}

        {/* ──── GAPS ──── */}
        {gaps.length > 0 && (
          <>
            <Hr />
            <section className="py-24 md:py-32 plan-section" style={{ animationDelay: "0.35s" }}>
              <Label>Gaps Identificados</Label>
              <p className="text-sm text-white/25 mt-2 mb-10">Pontos de melhoria</p>
              <div className="grid md:grid-cols-2 gap-4">
                {gaps.map((gap: GapNode, i: number) => (
                  <TreeCard key={gap.id} item={gap} index={i} type="gap" />
                ))}
              </div>
            </section>
          </>
        )}

        {/* ──── LEVERS ──── */}
        {levers.length > 0 && (
          <>
            <Hr />
            <section className="py-24 md:py-32 plan-section" style={{ animationDelay: "0.4s" }}>
              <Label>Alavancas de Crescimento</Label>
              <p className="text-sm text-white/25 mt-2 mb-10">Ações de alto impacto</p>
              <div className="grid md:grid-cols-2 gap-4">
                {levers.map((lever: LeverNode, i: number) => (
                  <TreeCard key={lever.id} item={lever} index={i} type="lever" />
                ))}
              </div>
            </section>
          </>
        )}

        {/* ──── FOOTER ──── */}
        <footer className="py-16 text-center border-t border-white/[0.04]">
          <p className="text-[11px] text-white/15">
            {plan.organization.name}{plan.createdBy.name && ` · ${plan.createdBy.name}`} · {fmtDate(plan.createdAt)}
          </p>
        </footer>
      </main>
    </div>
  );
}

// ─── Primitives ───────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
      {children}
    </h2>
  );
}

function Hr() {
  return <div className="h-px bg-white/[0.04]" />;
}

function Metric({
  label,
  value,
  note,
  accent,
  border,
}: {
  label: string;
  value: string;
  note?: string;
  accent?: string;
  border?: boolean;
}) {
  return (
    <div className={`py-8 md:py-10 ${border ? "md:border-l md:border-white/[0.05] md:pl-8" : ""}`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/25 mb-3">{label}</p>
      <p className="text-3xl md:text-4xl font-bold tracking-tight" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
      {note && (
        <p className="text-xs mt-2" style={{ color: accent ? `${accent}80` : "rgba(255,255,255,0.15)" }}>
          {note}
        </p>
      )}
    </div>
  );
}

// ─── Tree Card (Gaps / Levers) ────────────────────

function TreeCard({ item, index, type }: { item: GapNode | LeverNode; index: number; type: "gap" | "lever" }) {
  const color = type === "gap" ? "#ef4444" : "#10b981";

  return (
    <div className="rounded-xl border border-white/[0.05] p-5 bg-white/[0.01]">
      <div className="flex items-center gap-3 mb-4">
        <span
          className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold"
          style={{ background: `${color}15`, color }}
        >
          {index + 1}
        </span>
        <h4 className="text-sm font-semibold" style={{ color }}>
          {item.title || `${type === "gap" ? "Gap" : "Alavanca"} ${index + 1}`}
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

function TreeBranch({ node, depth }: { node: TreeNode; depth: number }) {
  return (
    <div className={depth > 0 ? "ml-5" : ""}>
      <div className="flex items-start gap-2 py-1.5">
        {depth > 0 && (
          <div className="flex items-center gap-1.5 shrink-0 mt-1.5">
            <div className="w-3 h-px bg-white/10" />
            <div className="w-1 h-1 rounded-full bg-white/20" />
          </div>
        )}
        <span className={`text-sm leading-relaxed ${depth === 0 ? "font-medium text-white/70" : "text-white/40"}`}>
          {node.text}
        </span>
      </div>
      {node.children.length > 0 && (
        <div className="border-l border-white/[0.04] ml-0.5">
          {node.children.map((child) => (
            <TreeBranch key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
