import { notFound } from "next/navigation";
import Image from "next/image";
import { getActionPlanByToken } from "@/actions/action-plan";
import type {
  PlanMetrics, TopProduct, TopCollection, TopCreative,
  GapNode, LeverNode, TreeNode,
} from "@/actions/action-plan";
import { CreativesSection } from "./creatives-section";
import { GradientMesh } from "./hero-effects";
import type { Metadata } from "next";

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

const G = "#c4ff00";
const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtN = (v: number, d = 2) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
const fmtD = (date: Date) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(date));

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
    <div className="min-h-screen bg-[#050505] text-white antialiased" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ════ HERO — Gradient mesh + KPI cards ════ */}
      <header className="relative overflow-hidden pb-20 md:pb-28 pt-16 md:pt-24">
        <GradientMesh />

        <div className="relative z-10 max-w-[1000px] mx-auto px-6">
          {/* Org badge */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {plan.organization.logo && (
              <Image src={plan.organization.logo} alt="" width={22} height={22} className="rounded" unoptimized />
            )}
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: `${G}99` }}>
              {plan.organization.name}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-center text-4xl md:text-6xl lg:text-7xl font-bold tracking-[-0.04em] leading-[1.05] mb-4">
            {plan.title}
          </h1>

          <p className="text-center text-sm text-white/25 mb-14">
            {fmtD(plan.periodStart)} — {fmtD(plan.periodEnd)}
          </p>

          {/* Hero KPI Cards */}
          {m && (
            <div className="grid grid-cols-3 gap-4 md:gap-5 max-w-[780px] mx-auto">
              <div className="plan-glow-card px-5 py-6 md:px-8 md:py-9 text-center">
                <p className="text-xl md:text-3xl lg:text-4xl font-bold tracking-tight" style={{ color: G }}>{fmt(m.faturamento)}</p>
                <p className="text-[10px] md:text-xs font-medium uppercase tracking-[0.15em] text-white/30 mt-3">Faturamento</p>
              </div>
              <div className="plan-glow-card px-5 py-6 md:px-8 md:py-9 text-center">
                <p className="text-xl md:text-3xl lg:text-4xl font-bold tracking-tight" style={{ color: G }}>{fmtN(m.roas)}x</p>
                <p className="text-[10px] md:text-xs font-medium uppercase tracking-[0.15em] text-white/30 mt-3">ROAS</p>
              </div>
              <div className="plan-glow-card px-5 py-6 md:px-8 md:py-9 text-center">
                <p className="text-xl md:text-3xl lg:text-4xl font-bold tracking-tight" style={{ color: G }}>{fmt(m.investido)}</p>
                <p className="text-[10px] md:text-xs font-medium uppercase tracking-[0.15em] text-white/30 mt-3">Investido</p>
              </div>
            </div>
          )}
        </div>
      </header>

      <main>
        {/* ════ METRICS ════ */}
        {m && (
          <section className="bg-[#0a0a0a] py-20 md:py-28 plan-section" style={{ animationDelay: "0.1s" }}>
            <div className="max-w-[1000px] mx-auto px-6">
              <H2>Métricas do Período</H2>
              <div className="grid md:grid-cols-3 gap-5 mt-10">
                <MC label="Faturamento Pago" value={fmt(m.faturamento)} sub={`${m.totalPedidos} pedidos`} />
                <MC label="Valor Investido" value={fmt(m.investido)} sub="Meta Ads" />
                <MC label="Valor Convertido" value={fmt(m.convertido)} sub="Meta Ads" />
              </div>
              <div className="grid md:grid-cols-3 gap-5 mt-4">
                <MC label="ROAS" value={`${fmtN(m.roas)}x`} sub={m.roas >= 3 ? "Excelente" : m.roas >= 2 ? "Bom" : "Atenção"} highlight={m.roas >= 3} />
                <MC label="CPA" value={fmt(m.cpa)} sub={`${m.totalConversoes} conversões`} />
                <MC label="Ticket Médio" value={fmt(m.ticketMedio)} />
              </div>
            </div>
          </section>
        )}

        <div className="plan-divider-green" />

        {/* ════ PRODUCTS — Green accent section ════ */}
        {products.length > 0 && (
          <section className="relative bg-[#050505] py-20 md:py-28 overflow-hidden plan-section" style={{ animationDelay: "0.15s" }}>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(196,255,0,0.04)_0%,transparent_60%)]" />
            <div className="relative max-w-[1000px] mx-auto px-6">
              <H2>Top 5 Produtos Mais Vendidos</H2>
              <div className="mt-10 rounded-2xl border border-white/[0.06] overflow-hidden bg-white/[0.01]">
                <table className="w-full">
                  <thead>
                    <tr className="bg-white/[0.03]">
                      <th className="px-5 py-4 text-left text-[10px] font-semibold uppercase tracking-widest text-white/20 w-12">#</th>
                      <th className="px-3 py-4 w-14" />
                      <th className="px-4 py-4 text-left text-[10px] font-semibold uppercase tracking-widest text-white/20">Produto</th>
                      <th className="px-4 py-4 text-right text-[10px] font-semibold uppercase tracking-widest text-white/20">Qtd</th>
                      <th className="px-5 py-4 text-right text-[10px] font-semibold uppercase tracking-widest text-white/20">Faturamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p: TopProduct, i: number) => (
                      <tr key={i} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-4 text-sm font-bold" style={{ color: G }}>{i + 1}</td>
                        <td className="px-3 py-3">
                          {p.imageUrl ? (
                            <div className="w-10 h-10 relative rounded-lg overflow-hidden bg-white/5 border border-white/[0.06]">
                              <Image src={p.imageUrl} alt={p.name} fill className="object-cover" unoptimized sizes="40px" />
                            </div>
                          ) : <div className="w-10 h-10 rounded-lg bg-white/[0.03]" />}
                        </td>
                        <td className="px-4 py-4 text-sm font-medium text-white/80">{p.name}</td>
                        <td className="px-4 py-4 text-sm text-right text-white/35">{p.quantity}</td>
                        <td className="px-5 py-4 text-sm text-right font-semibold">{fmt(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ════ COLLECTIONS — CDR Green section ════ */}
        {collections.length > 0 && (
          <section className="relative py-20 md:py-28 overflow-hidden plan-section" style={{ animationDelay: "0.2s", background: "linear-gradient(180deg, rgba(196,255,0,0.06) 0%, #050505 100%)" }}>
            <div className="max-w-[1000px] mx-auto px-6">
              <H2>Top Coleções com Mais Vendas</H2>
              <div className="grid md:grid-cols-3 gap-5 mt-10">
                {collections.map((c: TopCollection, i: number) => (
                  <div key={i} className="plan-glow-card p-8 text-center">
                    <span className="inline-flex w-9 h-9 rounded-lg items-center justify-center text-xs font-bold text-black" style={{ background: G }}>{i + 1}</span>
                    <h4 className="text-base font-semibold mt-5">{c.name}</h4>
                    <p className="text-4xl font-bold tracking-tight mt-3" style={{ color: G }}>{c.quantity}</p>
                    <p className="text-xs text-white/20 mt-2">vendas · {fmt(c.revenue)}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <div className="plan-divider-green" />

        {/* ════ CREATIVES ════ */}
        {creatives.length > 0 && (
          <section className="bg-[#080808] py-20 md:py-28 plan-section" style={{ animationDelay: "0.25s" }}>
            <div className="max-w-[1000px] mx-auto px-6">
              <H2>Top 5 Criativos — Melhor Performance</H2>
              <div className="mt-10"><CreativesSection creatives={creatives} /></div>
            </div>
          </section>
        )}

        {/* ════ GAPS ════ */}
        {gaps.length > 0 && (
          <>
            <div className="plan-divider-green" />
            <section className="bg-[#050505] py-20 md:py-28 plan-section" style={{ animationDelay: "0.3s" }}>
              <div className="max-w-[1000px] mx-auto px-6">
                <H2>Gaps Identificados</H2>
                <p className="text-sm text-white/25 mt-2 mb-10">Pontos de melhoria que precisam de atenção</p>
                <div className="grid md:grid-cols-2 gap-4">
                  {gaps.map((g: GapNode, i: number) => <TC key={g.id} item={g} index={i} type="gap" />)}
                </div>
              </div>
            </section>
          </>
        )}

        {/* ════ LEVERS ════ */}
        {levers.length > 0 && (
          <>
            <div className="plan-divider-green" />
            <section className="relative bg-[#050505] py-20 md:py-28 overflow-hidden plan-section" style={{ animationDelay: "0.35s" }}>
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(196,255,0,0.04)_0%,transparent_60%)]" />
              <div className="relative max-w-[1000px] mx-auto px-6">
                <H2>Alavancas de Crescimento</H2>
                <p className="text-sm text-white/25 mt-2 mb-10">Ações que vão gerar mais resultado</p>
                <div className="grid md:grid-cols-2 gap-4">
                  {levers.map((l: LeverNode, i: number) => <TC key={l.id} item={l} index={i} type="lever" />)}
                </div>
              </div>
            </section>
          </>
        )}

        {/* ════ FOOTER ════ */}
        <footer className="py-14 border-t border-white/[0.04]">
          <div className="max-w-[1000px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {plan.organization.logo && <Image src={plan.organization.logo} alt="" width={20} height={20} className="rounded" unoptimized />}
              <span className="text-xs font-semibold text-white/30">{plan.organization.name}</span>
            </div>
            <p className="text-[11px] text-white/15">{plan.createdBy.name && `${plan.createdBy.name} · `}{fmtD(plan.createdAt)}</p>
          </div>
        </footer>
      </main>
    </div>
  );
}

// ─── Components ───────────────────────────────────

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-2xl md:text-4xl font-bold tracking-tight">{children}</h2>;
}

function MC({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/25 mb-3">{label}</p>
      <p className="text-2xl md:text-3xl font-bold tracking-tight" style={highlight ? { color: G } : undefined}>{value}</p>
      {sub && <p className="text-xs mt-2" style={highlight ? { color: `${G}66` } : { color: "rgba(255,255,255,0.18)" }}>{sub}</p>}
    </div>
  );
}

function TC({ item, index, type }: { item: GapNode | LeverNode; index: number; type: "gap" | "lever" }) {
  const isGap = type === "gap";
  const c = isGap ? "#ef4444" : G;
  return (
    <div className="rounded-xl p-6" style={{ border: `1px solid ${c}22`, background: `${c}06` }}>
      <div className="flex items-center gap-3 mb-5">
        <span className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold" style={{ background: c, color: isGap ? "#fff" : "#000" }}>{index + 1}</span>
        <h4 className="text-sm font-bold" style={{ color: c }}>{item.title || `${isGap ? "Gap" : "Alavanca"} ${index + 1}`}</h4>
      </div>
      {item.children.length > 0 && item.children.map((ch) => <B key={ch.id} node={ch} depth={0} />)}
    </div>
  );
}

function B({ node, depth }: { node: TreeNode; depth: number }) {
  return (
    <div className={depth > 0 ? "ml-5" : ""}>
      <div className="flex items-start gap-2 py-1.5">
        {depth > 0 && <div className="flex items-center gap-1.5 shrink-0 mt-1.5"><div className="w-3 h-px bg-white/10" /><div className="w-1.5 h-1.5 rounded-full" style={{ background: `${G}40` }} /></div>}
        <span className={`text-sm leading-relaxed ${depth === 0 ? "font-medium text-white/70" : "text-white/40"}`}>{node.text}</span>
      </div>
      {node.children.length > 0 && <div className="border-l border-white/[0.06] ml-[3px]">{node.children.map((ch) => <B key={ch.id} node={ch} depth={depth + 1} />)}</div>}
    </div>
  );
}
