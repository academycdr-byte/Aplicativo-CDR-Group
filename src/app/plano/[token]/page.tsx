import { notFound } from "next/navigation";
import Image from "next/image";
import { getActionPlanByToken } from "@/actions/action-plan";
import type { PlanMetrics, TopProduct, TopCollection, TopCreative, GapNode, LeverNode, TreeNode } from "@/actions/action-plan";
import { CreativesSection } from "./creatives-section";
import { GradientMesh } from "./hero-effects";
import type { Metadata } from "next";

type PageProps = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const plan = await getActionPlanByToken(token);
  if (!plan) return { title: "Plano não encontrado" };
  return { title: `${plan.title} | ${plan.organization.name}`, description: `Plano de Ação — ${plan.organization.name}` };
}

/* CDR Brand Tokens */
const P = "#BEE000"; /* Primary — hsl(73 100% 50%) */
const BG = "#000000";
const CARD = "#141414";
const BORDER = "#1A1A1A";
const MUTED = "#B3B3B3";

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
    <div className="min-h-screen text-white antialiased" style={{ background: BG, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* ════ HERO ════ */}
      <header className="relative overflow-hidden pb-16 md:pb-24 pt-14 md:pt-20">
        <GradientMesh />
        <div className="relative z-10 max-w-[960px] mx-auto px-6">
          {/* Badge — CDR style pill */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[200px]" style={{ border: `1px solid ${P}33`, background: `${P}0A` }}>
              {plan.organization.logo && <Image src={plan.organization.logo} alt="" width={20} height={20} className="rounded-[8px]" unoptimized />}
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" as const, color: P }}>{plan.organization.name}</span>
            </div>
          </div>

          {/* Title — CDR heading-1: 32-56px, 600, -0.32px tracking */}
          <h1 className="text-center" style={{ fontSize: "clamp(32px, 6vw, 56px)", fontWeight: 600, lineHeight: 1.1, letterSpacing: "-1.12px" }}>
            {plan.title}
          </h1>
          <p className="text-center mt-4" style={{ fontSize: "14px", fontWeight: 400, color: `${MUTED}99` }}>
            {fmtD(plan.periodStart)} — {fmtD(plan.periodEnd)}
          </p>

          {/* Hero KPI Cards — CDR homepage style */}
          {m && (
            <div className="grid grid-cols-3 gap-4 max-w-[720px] mx-auto mt-12">
              <HeroKPI value={fmt(m.faturamento)} label="Faturamento Pago" />
              <HeroKPI value={`${fmtN(m.roas)}x`} label="ROAS" />
              <HeroKPI value={fmt(m.investido)} label="Investido" />
            </div>
          )}
        </div>
      </header>

      <main>
        {/* ════ METRICS ════ */}
        {m && (
          <section className="py-16 md:py-24 plan-section" style={{ background: CARD, animationDelay: "0s" }}>
            <div className="max-w-[960px] mx-auto px-6">
              <SL>Métricas do Período</SL>
              <div className="grid md:grid-cols-3 gap-4 mt-8">
                <MC label="Faturamento Pago" value={fmt(m.faturamento)} sub={`${m.totalPedidos} pedidos`} />
                <MC label="Valor Investido" value={fmt(m.investido)} sub="Meta Ads" />
                <MC label="Valor Convertido" value={fmt(m.convertido)} sub="Meta Ads" />
              </div>
              <div className="grid md:grid-cols-3 gap-4 mt-3">
                <MC label="ROAS" value={`${fmtN(m.roas)}x`} sub={m.roas >= 3 ? "Excelente" : m.roas >= 2 ? "Bom" : "Atenção"} accent={m.roas >= 3} />
                <MC label="CPA" value={fmt(m.cpa)} sub={`${m.totalConversoes} conversões`} />
                <MC label="Ticket Médio" value={fmt(m.ticketMedio)} />
              </div>
            </div>
          </section>
        )}

        <div className="plan-divider" />

        {/* ════ PRODUCTS ════ */}
        {products.length > 0 && (
          <section className="py-16 md:py-24 plan-section" style={{ background: BG, animationDelay: "50ms" }}>
            <div className="max-w-[960px] mx-auto px-6">
              <SL>Top 5 Produtos Mais Vendidos</SL>
              <div className="mt-8 rounded-[10px] overflow-hidden" style={{ border: `1px solid ${BORDER}66` }}>
                <table className="w-full">
                  <thead>
                    <tr style={{ background: `${CARD}` }}>
                      <th className="px-5 py-3.5 text-left w-10" style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" as const, color: `${MUTED}66` }}>#</th>
                      <th className="px-2 py-3.5 w-12" />
                      <th className="px-4 py-3.5 text-left" style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" as const, color: `${MUTED}66` }}>Produto</th>
                      <th className="px-4 py-3.5 text-right" style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" as const, color: `${MUTED}66` }}>Qtd</th>
                      <th className="px-5 py-3.5 text-right" style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" as const, color: `${MUTED}66` }}>Faturamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p: TopProduct, i: number) => (
                      <tr key={i} className="transition-colors" style={{ borderTop: `1px solid ${BORDER}66` }} onMouseEnter={undefined}>
                        <td className="px-5 py-4" style={{ fontSize: "14px", fontWeight: 700, color: P }}>{i + 1}</td>
                        <td className="px-2 py-3">
                          {p.imageUrl ? (
                            <div className="w-10 h-10 relative rounded-[8px] overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
                              <Image src={p.imageUrl} alt={p.name} fill className="object-cover" unoptimized sizes="40px" />
                            </div>
                          ) : <div className="w-10 h-10 rounded-[8px]" style={{ background: CARD }} />}
                        </td>
                        <td className="px-4 py-4" style={{ fontSize: "14px", fontWeight: 500, color: "white" }}>{p.name}</td>
                        <td className="px-4 py-4 text-right" style={{ fontSize: "14px", color: `${MUTED}99` }}>{p.quantity}</td>
                        <td className="px-5 py-4 text-right" style={{ fontSize: "14px", fontWeight: 600, color: "white" }}>{fmt(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ════ COLLECTIONS — green tinted section ════ */}
        {collections.length > 0 && (
          <section className="relative py-16 md:py-24 overflow-hidden plan-section" style={{ background: BG, animationDelay: "100ms" }}>
            <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${P}08 0%, transparent 70%)` }} />
            <div className="relative max-w-[960px] mx-auto px-6">
              <SL>Top Coleções com Mais Vendas</SL>
              <div className="grid md:grid-cols-3 gap-4 mt-8">
                {collections.map((c: TopCollection, i: number) => (
                  <div key={i} className="plan-glow-card p-6 text-center">
                    <span className="inline-flex w-8 h-8 rounded-[8px] items-center justify-center text-xs font-bold" style={{ background: P, color: BG }}>{i + 1}</span>
                    <h4 className="mt-4" style={{ fontSize: "16px", fontWeight: 600 }}>{c.name}</h4>
                    <p className="mt-2" style={{ fontSize: "30px", fontWeight: 700, letterSpacing: "-0.75px", color: P, fontVariantNumeric: "tabular-nums" }}>{c.quantity}</p>
                    <p className="mt-1" style={{ fontSize: "12px", color: `${MUTED}66` }}>vendas · {fmt(c.revenue)}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <div className="plan-divider" />

        {/* ════ CREATIVES ════ */}
        {creatives.length > 0 && (
          <section className="py-16 md:py-24 plan-section" style={{ background: CARD, animationDelay: "150ms" }}>
            <div className="max-w-[960px] mx-auto px-6">
              <SL>Top 5 Criativos — Melhor Performance</SL>
              <div className="mt-8"><CreativesSection creatives={creatives} /></div>
            </div>
          </section>
        )}

        <div className="plan-divider" />

        {/* ════ GAPS ════ */}
        {gaps.length > 0 && (
          <section className="py-16 md:py-24 plan-section" style={{ background: BG, animationDelay: "200ms" }}>
            <div className="max-w-[960px] mx-auto px-6">
              <SL>Gaps Identificados</SL>
              <p className="mt-1 mb-8" style={{ fontSize: "14px", color: `${MUTED}66` }}>Pontos de melhoria que precisam de atenção</p>
              <div className="grid md:grid-cols-2 gap-3">
                {gaps.map((g: GapNode, i: number) => <TC key={g.id} item={g} index={i} type="gap" />)}
              </div>
            </div>
          </section>
        )}

        {/* ════ LEVERS ════ */}
        {levers.length > 0 && (
          <>
            <div className="plan-divider" />
            <section className="relative py-16 md:py-24 overflow-hidden plan-section" style={{ background: BG, animationDelay: "250ms" }}>
              <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at bottom left, ${P}06 0%, transparent 60%)` }} />
              <div className="relative max-w-[960px] mx-auto px-6">
                <SL>Alavancas de Crescimento</SL>
                <p className="mt-1 mb-8" style={{ fontSize: "14px", color: `${MUTED}66` }}>Ações que vão gerar mais resultado</p>
                <div className="grid md:grid-cols-2 gap-3">
                  {levers.map((l: LeverNode, i: number) => <TC key={l.id} item={l} index={i} type="lever" />)}
                </div>
              </div>
            </section>
          </>
        )}

        {/* ════ FOOTER ════ */}
        <footer className="py-12" style={{ borderTop: `1px solid ${BORDER}66` }}>
          <div className="max-w-[960px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {plan.organization.logo && <Image src={plan.organization.logo} alt="" width={20} height={20} className="rounded-[8px]" unoptimized />}
              <span style={{ fontSize: "12px", fontWeight: 500, color: `${MUTED}66` }}>{plan.organization.name}</span>
            </div>
            <p style={{ fontSize: "12px", color: `${MUTED}33` }}>{plan.createdBy.name && `${plan.createdBy.name} · `}{fmtD(plan.createdAt)}</p>
          </div>
        </footer>
      </main>
    </div>
  );
}

/* ── CDR Components (exact brand tokens) ── */

function SL({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 600, lineHeight: 1.2, letterSpacing: "-0.32px" }}>{children}</h2>;
}

function HeroKPI({ value, label }: { value: string; label: string }) {
  return (
    <div className="plan-glow-card px-4 py-5 md:px-6 md:py-7 text-center">
      <p style={{ fontSize: "clamp(18px, 3vw, 30px)", fontWeight: 700, letterSpacing: "-0.75px", color: P, fontVariantNumeric: "tabular-nums" }}>{value}</p>
      <p className="mt-2" style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" as const, color: `${MUTED}66` }}>{label}</p>
    </div>
  );
}

function MC({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="p-5 rounded-[10px] transition-all" style={{ background: `rgba(255,255,255,0.08)`, border: `1px solid ${BORDER}66`, backdropFilter: "blur(12px) saturate(150%)" }}>
      <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" as const, color: `${MUTED}66` }}>{label}</p>
      <p className="mt-2" style={{ fontSize: "30px", fontWeight: 700, letterSpacing: "-0.75px", fontVariantNumeric: "tabular-nums", color: accent ? P : "white" }}>{value}</p>
      {sub && <p className="mt-1" style={{ fontSize: "12px", color: accent ? `${P}66` : `${MUTED}44` }}>{sub}</p>}
    </div>
  );
}

function TC({ item, index, type }: { item: GapNode | LeverNode; index: number; type: "gap" | "lever" }) {
  const isGap = type === "gap";
  const c = isGap ? "#FF4D4D" : P;
  return (
    <div className="rounded-[10px] p-5" style={{ border: `1px solid ${c}22`, background: `${c}08` }}>
      <div className="flex items-center gap-3 mb-4">
        <span className="w-7 h-7 rounded-[8px] flex items-center justify-center" style={{ fontSize: "10px", fontWeight: 700, background: c, color: isGap ? "#fff" : BG }}>{index + 1}</span>
        <h4 style={{ fontSize: "14px", fontWeight: 600, color: c }}>{item.title || `${isGap ? "Gap" : "Alavanca"} ${index + 1}`}</h4>
      </div>
      {item.children.length > 0 && item.children.map((ch) => <B key={ch.id} node={ch} depth={0} />)}
    </div>
  );
}

function B({ node, depth }: { node: TreeNode; depth: number }) {
  return (
    <div style={depth > 0 ? { marginLeft: "20px" } : undefined}>
      <div className="flex items-start gap-2 py-1.5">
        {depth > 0 && <div className="flex items-center gap-1.5 shrink-0 mt-1.5"><div style={{ width: "12px", height: "1px", background: `${BORDER}` }} /><div style={{ width: "5px", height: "5px", borderRadius: "50%", background: `${P}40` }} /></div>}
        <span style={{ fontSize: "14px", lineHeight: "1.5", fontWeight: depth === 0 ? 500 : 400, color: depth === 0 ? "rgba(255,255,255,0.7)" : `${MUTED}66` }}>{node.text}</span>
      </div>
      {node.children.length > 0 && <div style={{ borderLeft: `1px solid ${BORDER}`, marginLeft: "2px" }}>{node.children.map((ch) => <B key={ch.id} node={ch} depth={depth + 1} />)}</div>}
    </div>
  );
}
