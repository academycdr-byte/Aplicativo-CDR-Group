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
  NextStep,
  PreviousStep,
  SectionNotes,
} from "@/actions/action-plan";
import { CreativesSection } from "./creatives-section";
import { GradientMesh, SectionGlow } from "./hero-effects";
import { ScrollReveal, StaggerChildren } from "./scroll-reveal";
import type { Metadata } from "next";

type PageProps = { params: Promise<{ token: string }> };

/* Strip "'s Organization" suffix from org names */
const cleanOrgName = (name: string) =>
  name.replace(/'s Organization$/i, "").replace(/\s+Organization$/i, "").trim();

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { token } = await params;
  const plan = await getActionPlanByToken(token);
  if (!plan) return { title: "Plano não encontrado" };
  return {
    title: `${plan.title} | ${cleanOrgName(plan.organization.name)}`,
    description: `Plano de Ação — ${cleanOrgName(plan.organization.name)}`,
  };
}

/* ══ CDR Brand Tokens (exact from cdrgroup.com.br) ══ */
const G = "#BEFF0A"; /* CDR Green — site exact */
const BG = "#000000";
const MUTED = "#B3B3B3";
const CLASH = '"Clash", "Inter", sans-serif';

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);
const fmtN = (v: number, d = 2) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(v);
const fmtD = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(date));

/* ══ Page ══ */
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
  const nextSteps = plan.nextSteps || [];
  const previousSteps = (plan.previousSteps || []) as PreviousStep[];
  const sectionNotes = plan.sectionNotes || {};

  let sectionNum = 0;

  return (
    <div
      className="min-h-screen text-white antialiased"
      style={{
        background: BG,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* ════════════════════════════════════════
          HERO — Compact, logo destaque, sem KPIs duplicados
          ════════════════════════════════════════ */}
      <header className="relative overflow-hidden pt-24 pb-10 md:pt-28 md:pb-14">
        <GradientMesh />

        {/* CDR Logo — top left */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 md:px-10 py-5">
          <Image
            src="/logo-cdr.png"
            alt="CDR Group"
            width={100}
            height={28}
            className="opacity-90"
            unoptimized
          />
          <div />
        </div>

        <div className="relative z-10 max-w-[960px] mx-auto px-6 text-center plan-hero-stagger">
          {/* Client Logo — grande e em destaque */}
          {(() => {
            const heroAvatar = plan.organization.logo || plan.createdBy.image;
            return heroAvatar ? (
              <div className="flex justify-center mb-7">
                <div
                  className="w-20 h-20 md:w-24 md:h-24 relative rounded-2xl overflow-hidden"
                  style={{
                    border: `2px solid ${G}33`,
                    boxShadow: `0 0 40px ${G}15, 0 0 80px ${G}08`,
                  }}
                >
                  <Image
                    src={heroAvatar}
                    alt={cleanOrgName(plan.organization.name)}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              </div>
            ) : null;
          })()}

          {/* Org name badge */}
          <div className="flex justify-center mb-6">
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "1.5px",
                textTransform: "uppercase" as const,
                color: G,
              }}
            >
              Plano de Ação {cleanOrgName(plan.organization.name)}
            </span>
          </div>

          {/* Title — Clash Display */}
          <h1
            style={{
              fontFamily: CLASH,
              fontSize: "clamp(32px, 6vw, 64px)",
              fontWeight: 400,
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
              color: "rgba(255, 255, 255, 0.92)",
            }}
          >
            {plan.title}
          </h1>

          {/* Period — card com ícone de calendário */}
          <div className="flex flex-col items-center mt-6 gap-2">
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "1.5px",
                textTransform: "uppercase" as const,
                color: `${MUTED}AA`,
              }}
            >
              Período Analisado
            </span>
            <div
              className="inline-flex items-center gap-3 px-5 py-3 rounded-xl"
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                backdropFilter: "blur(12px)",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke={`${G}88`}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "rgba(255, 255, 255, 0.7)",
                  letterSpacing: "0.3px",
                }}
              >
                {fmtD(plan.periodStart)} — {fmtD(plan.periodEnd)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* ════════════════════════════════════════
            SECTION — Métricas do Período
            ════════════════════════════════════════ */}
        {m && (
          <>
            <ScrollReveal>
              <section className="pt-10 pb-20 md:pt-14 md:pb-28 relative overflow-hidden">
                <SectionGlow position="right" intensity={0.05} />
                <div className="relative max-w-[960px] mx-auto px-6">
                  <SectionHead num={`0${++sectionNum}`} title="Métricas do Período" />
                  <div className="grid md:grid-cols-3 gap-4 mt-10">
                    <MC
                      label="Faturamento Pago"
                      value={fmt(m.faturamento)}
                      sub={`${m.totalPedidos} pedidos`}
                      change={m.changes?.faturamento}
                      icon="revenue"
                    />
                    <MC
                      label="Valor Investido"
                      value={fmt(m.investido)}
                      sub="Meta Ads"
                      change={m.changes?.investido}
                      icon="spend"
                    />
                    <MC
                      label="Valor Convertido"
                      value={fmt(m.convertido)}
                      sub="Meta Ads"
                      change={m.changes?.convertido}
                      icon="conversion"
                    />
                  </div>
                  <div className="grid md:grid-cols-4 gap-4 mt-4">
                    <MC
                      label="ROAS"
                      value={`${fmtN(m.roas)}x`}
                      sub={
                        m.roas >= 3
                          ? "Excelente"
                          : m.roas >= 2
                            ? "Bom"
                            : "Atenção"
                      }
                      accent={m.roas >= 3}
                      pointChange={m.changes?.roas != null ? m.roas - m.roas / (1 + m.changes.roas / 100) : null}
                      pointSuffix="x"
                      icon="target"
                    />
                    <MC
                      label="CPA"
                      value={fmt(m.cpa)}
                      sub={`${m.totalConversoes} conversões`}
                      change={m.changes?.cpa}
                      icon="cpa"
                      invertChange
                    />
                    <MC
                      label="Ticket Médio"
                      value={fmt(m.ticketMedio)}
                      change={m.changes?.ticketMedio}
                      icon="ticket"
                    />
                    <MC
                      label="Taxa de Pagamento"
                      value={`${fmtN(m.taxaPagamento ?? 0, 1)}%`}
                      sub={`${m.totalPedidos ?? 0} de ${m.totalPedidosGerados ?? 0} pedidos`}
                      accent={(m.taxaPagamento ?? 0) >= 70}
                      pointChange={m.changes?.taxaPagamento != null ? (m.taxaPagamento ?? 0) - (m.taxaPagamento ?? 0) / (1 + m.changes.taxaPagamento / 100) : null}
                      pointSuffix="pp"
                      icon="payment"
                    />
                  </div>
                </div>
              </section>
            </ScrollReveal>
            <div className="plan-divider" />
          </>
        )}

        {/* ════════════════════════════════════════
            SECTION — Top 5 Produtos
            ════════════════════════════════════════ */}
        {products.length > 0 && (
          <>
            <ScrollReveal>
              <section className="py-20 md:py-28">
                <div className="max-w-[960px] mx-auto px-6">
                  <SectionHead
                    num={`0${++sectionNum}`}
                    title="Top 5 Produtos Mais Vendidos"
                  />
                  <div className="mt-10">
                    <table className="plan-table">
                      <thead>
                        <tr>
                          <th className="text-left w-12">#</th>
                          <th className="w-14" />
                          <th className="text-left">Produto</th>
                          <th className="text-right">Qtd</th>
                          <th className="text-right">Ticket Médio</th>
                          <th className="text-right">Faturamento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((p: TopProduct, i: number) => (
                          <tr key={i}>
                            <td>
                              <span
                                style={{
                                  fontFamily: CLASH,
                                  fontWeight: 700,
                                  fontSize: "16px",
                                  color: G,
                                }}
                              >
                                {String(i + 1).padStart(2, "0")}
                              </span>
                            </td>
                            <td>
                              {p.imageUrl ? (
                                <div
                                  className="w-11 h-11 relative rounded-xl overflow-hidden"
                                  style={{
                                    border: `1px solid rgba(255,255,255,0.06)`,
                                  }}
                                >
                                  <Image
                                    src={p.imageUrl}
                                    alt={p.name}
                                    fill
                                    className="object-cover"
                                    unoptimized
                                    sizes="44px"
                                  />
                                </div>
                              ) : (
                                <div
                                  className="w-11 h-11 rounded-xl"
                                  style={{
                                    background: "rgba(255,255,255,0.04)",
                                  }}
                                />
                              )}
                            </td>
                            <td
                              style={{
                                fontWeight: 500,
                                color: "rgba(255,255,255,0.85)",
                              }}
                            >
                              {p.name}
                            </td>
                            <td
                              className="text-right"
                              style={{ color: `${MUTED}88` }}
                            >
                              {p.quantity}
                            </td>
                            <td
                              className="text-right"
                              style={{ color: `${MUTED}88` }}
                            >
                              {p.quantity > 0 ? fmt(p.revenue / p.quantity) : "—"}
                            </td>
                            <td
                              className="text-right"
                              style={{
                                fontWeight: 600,
                                color: "rgba(255,255,255,0.9)",
                              }}
                            >
                              {fmt(p.revenue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {sectionNotes.products && (
                    <NoteBlock text={sectionNotes.products} />
                  )}
                </div>
              </section>
            </ScrollReveal>
            <div className="plan-divider" />
          </>
        )}

        {/* ════════════════════════════════════════
            SECTION — Top Coleções
            ════════════════════════════════════════ */}
        {collections.length > 0 && (
          <>
            <ScrollReveal>
              <section className="relative py-20 md:py-28 overflow-hidden">
                <SectionGlow position="center" intensity={0.06} />
                <div className="relative max-w-[960px] mx-auto px-6">
                  <SectionHead
                    num={`0${++sectionNum}`}
                    title="Top Coleções com Mais Vendas"
                  />
                  <StaggerChildren
                    className="grid md:grid-cols-3 gap-5 mt-10"
                    stagger={100}
                  >
                    {collections.map((c: TopCollection, i: number) => (
                      <div
                        key={i}
                        data-stagger
                        className="plan-reveal"
                      >
                        <div className="plan-glow-card p-7 text-center">
                          {/* Big rank number */}
                          <span
                            style={{
                              fontFamily: CLASH,
                              fontSize: "48px",
                              fontWeight: 700,
                              lineHeight: 1,
                              color: `${G}25`,
                            }}
                          >
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <h4
                            className="mt-3"
                            style={{
                              fontFamily: CLASH,
                              fontSize: "18px",
                              fontWeight: 500,
                              color: "rgba(255,255,255,0.9)",
                            }}
                          >
                            {c.name}
                          </h4>
                          <p
                            className="mt-3"
                            style={{
                              fontFamily: CLASH,
                              fontSize: "36px",
                              fontWeight: 700,
                              letterSpacing: "-1px",
                              color: G,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {c.quantity}
                          </p>
                          <p
                            className="mt-1"
                            style={{
                              fontSize: "12px",
                              color: `${MUTED}55`,
                            }}
                          >
                            vendas · {fmt(c.revenue)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </StaggerChildren>
                  {sectionNotes.collections && (
                    <NoteBlock text={sectionNotes.collections} />
                  )}
                </div>
              </section>
            </ScrollReveal>
            <div className="plan-divider" />
          </>
        )}

        {/* ════════════════════════════════════════
            SECTION — Top 5 Criativos
            ════════════════════════════════════════ */}
        {creatives.length > 0 && (
          <>
            <ScrollReveal>
              <section className="py-20 md:py-28 relative overflow-hidden">
                <SectionGlow position="left" intensity={0.04} />
                <div className="relative max-w-[960px] mx-auto px-6">
                  <SectionHead
                    num={`0${++sectionNum}`}
                    title="Top 5 Criativos"
                  />
                  <p
                    className="-mt-4 mb-10"
                    style={{ fontSize: "15px", color: `${MUTED}55` }}
                  >
                    Melhor performance no período
                  </p>
                  <CreativesSection creatives={creatives} />
                  {sectionNotes.creatives && (
                    <NoteBlock text={sectionNotes.creatives} />
                  )}
                </div>
              </section>
            </ScrollReveal>
            <div className="plan-divider" />
          </>
        )}

        {/* ════════════════════════════════════════
            SECTION — Gaps Identificados
            ════════════════════════════════════════ */}
        {gaps.length > 0 && (
          <>
            <ScrollReveal>
              <section className="py-20 md:py-28">
                <div className="max-w-[960px] mx-auto px-6">
                  <SectionHead
                    num={`0${++sectionNum}`}
                    title="Gaps Identificados"
                  />
                  <p
                    className="-mt-4 mb-10"
                    style={{ fontSize: "15px", color: `${MUTED}55` }}
                  >
                    Pontos de melhoria que precisam de atenção
                  </p>
                  <div className="grid gap-5">
                    {gaps.map((g: GapNode, i: number) => (
                      <TC key={g.id} item={g} index={i} type="gap" />
                    ))}
                  </div>
                </div>
              </section>
            </ScrollReveal>
            <div className="plan-divider" />
          </>
        )}

        {/* ════════════════════════════════════════
            SECTION — Alavancas de Crescimento
            ════════════════════════════════════════ */}
        {levers.length > 0 && (
          <ScrollReveal>
            <section className="relative py-20 md:py-28 overflow-hidden">
              <SectionGlow position="bottom-left" intensity={0.05} />
              <div className="relative max-w-[960px] mx-auto px-6">
                <SectionHead
                  num={`0${++sectionNum}`}
                  title="Alavancas de Crescimento"
                />
                <p
                  className="-mt-4 mb-10"
                  style={{ fontSize: "15px", color: `${MUTED}55` }}
                >
                  Ações que vão gerar mais resultado
                </p>
                <div className="grid gap-5">
                  {levers.map((l: LeverNode, i: number) => (
                    <TC key={l.id} item={l} index={i} type="lever" />
                  ))}
                </div>
              </div>
            </section>
          </ScrollReveal>
        )}

        {/* ════════════════════════════════════════
            SECTION — Revisão do Plano Anterior
            ════════════════════════════════════════ */}
        {previousSteps.length > 0 && (
          <>
            <div className="plan-divider" />
            <ScrollReveal>
              <section className="py-20 md:py-28 relative overflow-hidden">
                <SectionGlow position="center" intensity={0.04} />
                <div className="relative max-w-[960px] mx-auto px-6">
                  <SectionHead
                    num={`0${++sectionNum}`}
                    title="Revisão do Plano Anterior"
                  />
                  <p
                    className="-mt-4 mb-10"
                    style={{ fontSize: "15px", color: `${MUTED}55` }}
                  >
                    Acompanhamento das ações definidas no último plano
                  </p>

                  {/* Progress bar */}
                  {(() => {
                    const completedCount = previousSteps.filter((s) => s.completed).length;
                    const pct = Math.round((completedCount / previousSteps.length) * 100);
                    return (
                      <div className="mb-8">
                        <div className="flex items-center justify-between mb-3">
                          <span style={{ fontSize: "12px", fontWeight: 600, color: `${MUTED}66`, letterSpacing: "0.5px" }}>
                            {completedCount} de {previousSteps.length} concluídos
                          </span>
                          <span
                            style={{
                              fontSize: "20px",
                              fontWeight: 700,
                              fontFamily: CLASH,
                              color: pct >= 80 ? "#4ade80" : pct >= 50 ? "#fbbf24" : "#f87171",
                            }}
                          >
                            {pct}%
                          </span>
                        </div>
                        <div
                          className="h-2 rounded-full overflow-hidden"
                          style={{ background: "rgba(255,255,255,0.06)" }}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              background: pct >= 80 ? "#4ade80" : pct >= 50 ? "#fbbf24" : "#f87171",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  <div className="space-y-4">
                    {previousSteps.map((step: PreviousStep, i: number) => (
                      <div
                        key={step.id || i}
                        className="plan-glow-card p-6"
                        style={{
                          borderLeft: `3px solid ${step.completed ? "#4ade80" : "#f87171"}`,
                        }}
                      >
                        <div className="flex items-start gap-4">
                          {step.completed ? (
                            <svg className="w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="15" y1="9" x2="9" y2="15" />
                              <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                          )}
                          <div className="flex-1 min-w-0">
                            <p style={{
                              fontSize: "15px",
                              fontWeight: 500,
                              color: step.completed ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.6)",
                              fontFamily: CLASH,
                            }}>
                              {step.action}
                            </p>
                            <div className="flex flex-wrap items-center gap-4 mt-2">
                              {step.responsible && (
                                <span style={{ fontSize: "12px", color: `${MUTED}66` }}>
                                  👤 {step.responsible}
                                </span>
                              )}
                              {step.deadline && (
                                <span style={{ fontSize: "12px", color: `${MUTED}66` }}>
                                  📅 {new Date(step.deadline + "T12:00:00").toLocaleDateString("pt-BR")}
                                </span>
                              )}
                              <span
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full"
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  letterSpacing: "0.5px",
                                  textTransform: "uppercase" as const,
                                  background: step.completed ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)",
                                  color: step.completed ? "#4ade80" : "#f87171",
                                  border: `1px solid ${step.completed ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
                                }}
                              >
                                {step.completed ? "Concluído" : "Pendente"}
                              </span>
                            </div>
                            {step.comment && (
                              <div
                                className="mt-3 p-3 rounded-lg"
                                style={{
                                  background: "rgba(255,255,255,0.03)",
                                  border: "1px solid rgba(255,255,255,0.06)",
                                }}
                              >
                                <div className="flex items-start gap-2">
                                  <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke={`${MUTED}55`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                  </svg>
                                  <p style={{ fontSize: "13px", color: `${MUTED}77`, lineHeight: "1.5", fontStyle: "italic" }}>
                                    {step.comment}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </ScrollReveal>
          </>
        )}

        {/* ════════════════════════════════════════
            SECTION — Próximos Passos
            ════════════════════════════════════════ */}
        {nextSteps.length > 0 && (
          <>
            <div className="plan-divider" />
            <ScrollReveal>
              <section className="py-20 md:py-28 relative overflow-hidden">
                <SectionGlow position="right" intensity={0.05} />
                <div className="relative max-w-[960px] mx-auto px-6">
                  <SectionHead
                    num={`0${++sectionNum}`}
                    title="Próximos Passos"
                  />
                  <p
                    className="-mt-4 mb-10"
                    style={{ fontSize: "15px", color: `${MUTED}55` }}
                  >
                    Plano de execução para o próximo período
                  </p>
                  <div className="space-y-4">
                    {nextSteps.map((step: NextStep, i: number) => (
                      <div
                        key={step.id || i}
                        className="plan-glow-card p-6"
                        style={{
                          borderLeft: `3px solid ${step.priority === "alta" ? "#f87171" : step.priority === "media" ? "#fbbf24" : "#60a5fa"}`,
                          opacity: step.done ? 0.5 : 1,
                        }}
                      >
                        <div className="flex items-start gap-4">
                          {step.done ? (
                            <svg className="w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <span
                              className="w-5 h-5 rounded-full border-2 shrink-0 mt-0.5"
                              style={{
                                borderColor: step.priority === "alta" ? "#f87171" : step.priority === "media" ? "#fbbf24" : "#60a5fa",
                              }}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p style={{
                              fontSize: "15px",
                              fontWeight: 500,
                              color: step.done ? `${MUTED}66` : "rgba(255,255,255,0.85)",
                              textDecoration: step.done ? "line-through" : "none",
                              fontFamily: CLASH,
                            }}>
                              {step.action}
                            </p>
                            <div className="flex flex-wrap items-center gap-4 mt-2">
                              {step.responsible && (
                                <span style={{ fontSize: "12px", color: `${MUTED}66` }}>
                                  👤 {step.responsible}
                                </span>
                              )}
                              {step.deadline && (
                                <span style={{ fontSize: "12px", color: `${MUTED}66` }}>
                                  📅 {new Date(step.deadline + "T12:00:00").toLocaleDateString("pt-BR")}
                                </span>
                              )}
                              <span
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full"
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  letterSpacing: "0.5px",
                                  textTransform: "uppercase" as const,
                                  background: step.priority === "alta" ? "rgba(248,113,113,0.12)" : step.priority === "media" ? "rgba(251,191,36,0.12)" : "rgba(96,165,250,0.12)",
                                  color: step.priority === "alta" ? "#f87171" : step.priority === "media" ? "#fbbf24" : "#60a5fa",
                                  border: `1px solid ${step.priority === "alta" ? "rgba(248,113,113,0.2)" : step.priority === "media" ? "rgba(251,191,36,0.2)" : "rgba(96,165,250,0.2)"}`,
                                }}
                              >
                                {step.priority === "alta" ? "Alta" : step.priority === "media" ? "Média" : "Baixa"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </ScrollReveal>
          </>
        )}

        {/* ════════════════════════════════════════
            FOOTER — CDR Premium
            ════════════════════════════════════════ */}
        <footer
          className="py-16 relative overflow-hidden"
          style={{
            borderTop: `1px solid rgba(190, 255, 10, 0.08)`,
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center bottom, rgba(190, 255, 10, 0.03) 0%, transparent 60%)",
            }}
          />
          <div className="relative max-w-[960px] mx-auto px-6 flex flex-col items-center gap-6">
            <Image
              src="/logo-cdr.png"
              alt="CDR Group"
              width={120}
              height={34}
              className="opacity-40"
              unoptimized
            />
            <div className="flex flex-col md:flex-row items-center gap-2 text-center">
              {plan.organization.logo && (
                <Image
                  src={plan.organization.logo}
                  alt=""
                  width={18}
                  height={18}
                  className="rounded-lg"
                  unoptimized
                />
              )}
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: `${MUTED}55`,
                }}
              >
                {cleanOrgName(plan.organization.name)}
              </span>
            </div>
            <p style={{ fontSize: "12px", color: `${MUTED}33` }}>
              {plan.createdBy.name && `${plan.createdBy.name} · `}
              {fmtD(plan.createdAt)}
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CDR Components — exact brand language from cdrgroup.com.br
   ══════════════════════════════════════════════════════════════ */

function SectionHead({ num, title }: { num: string; title: string }) {
  return (
    <div className="flex items-center gap-5 mb-10">
      <span className="plan-section-num">{num}</span>
      <h2
        style={{
          fontFamily: CLASH,
          fontSize: "clamp(28px, 4vw, 42px)",
          fontWeight: 400,
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h2>
    </div>
  );
}

const METRIC_ICONS: Record<string, React.ReactNode> = {
  revenue: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  spend: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  conversion: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
  target: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  cpa: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  ticket: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  payment: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
};

function MC({
  label,
  value,
  sub,
  accent,
  change,
  icon,
  invertChange,
  pointChange,
  pointSuffix,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  change?: number | null;
  icon?: string;
  invertChange?: boolean;
  /** Absolute point change (e.g. +3.34 for ROAS, -10.7 for Taxa de Pagamento). When provided, shows this instead of % change. */
  pointChange?: number | null;
  /** Suffix for point change display (e.g. "x" for ROAS, "pp" for percentage points) */
  pointSuffix?: string;
}) {
  /* Use pointChange if provided, otherwise fall back to % change */
  const displayChange = pointChange ?? change;
  const hasChange = displayChange !== undefined && displayChange !== null;
  const wentUp = hasChange && displayChange > 0;
  const wentDown = hasChange && displayChange < 0;
  /* Color: for CPA, going UP is bad (red), going DOWN is good (green) */
  const isGood = invertChange ? wentDown : wentUp;
  const isBad = invertChange ? wentUp : wentDown;

  /* Format the badge text */
  const usePoints = pointChange !== undefined && pointChange !== null;
  const badgeText = hasChange
    ? usePoints
      ? `${Math.abs(displayChange).toFixed(2)}${pointSuffix || ""}`
      : `${Math.abs(displayChange).toFixed(1)}%`
    : "";

  return (
    <div className="plan-metric">
      {/* Header: icon + label + change badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && METRIC_ICONS[icon] && (
            <span style={{ color: `${G}66` }}>{METRIC_ICONS[icon]}</span>
          )}
          <p
            style={{
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "1px",
              textTransform: "uppercase" as const,
              color: `${MUTED}77`,
            }}
          >
            {label}
          </p>
        </div>
        {hasChange && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{
              fontSize: "11px",
              fontWeight: 600,
              background: isGood ? "rgba(74, 222, 128, 0.1)" : isBad ? "rgba(248, 113, 113, 0.1)" : "rgba(255,255,255,0.05)",
              color: isGood ? "#4ade80" : isBad ? "#f87171" : `${MUTED}66`,
              border: `1px solid ${isGood ? "rgba(74, 222, 128, 0.2)" : isBad ? "rgba(248, 113, 113, 0.2)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            {wentUp ? "↑" : wentDown ? "↓" : "–"}
            {badgeText}
          </span>
        )}
      </div>
      <p
        className="mt-2"
        style={{
          fontFamily: CLASH,
          fontSize: "30px",
          fontWeight: 700,
          letterSpacing: "-0.75px",
          fontVariantNumeric: "tabular-nums",
          color: accent ? G : "white",
        }}
      >
        {value}
      </p>
      {sub && (
        <p
          className="mt-0.5"
          style={{
            fontSize: "12px",
            color: accent ? `${G}66` : `${MUTED}44`,
          }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

function TC({
  item,
  index,
  type,
}: {
  item: GapNode | LeverNode;
  index: number;
  type: "gap" | "lever";
}) {
  const isGap = type === "gap";
  const c = isGap ? "#FF4D4D" : G;
  const medal = MEDALS[index];
  const hasMetrics = item.currentMetric || item.targetMetric || item.financialImpact;
  const hasSolutions = (item.solutions || []).filter(Boolean).length > 0;

  return (
    <div
      className="plan-step-card"
      style={{
        border: `1px solid ${c}22`,
        background: `${c}06`,
      }}
    >
      {/* Header: medal/number + title + funnel badge */}
      <div className="flex items-center gap-4 mb-3">
        {medal ? (
          <span className="text-2xl shrink-0">{medal}</span>
        ) : (
          <span
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              fontSize: "12px",
              fontWeight: 700,
              fontFamily: CLASH,
              background: c,
              color: isGap ? "#fff" : BG,
            }}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <h4
            style={{
              fontFamily: CLASH,
              fontSize: "16px",
              fontWeight: 500,
              color: c,
            }}
          >
            {item.title || `${isGap ? "Gap" : "Alavanca"} ${index + 1}`}
          </h4>
        </div>
        {item.funnelStage && (
          <span
            className="inline-flex items-center px-3 py-1 rounded-full shrink-0"
            style={{
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.5px",
              textTransform: "uppercase" as const,
              background: `${c}12`,
              color: `${c}CC`,
              border: `1px solid ${c}25`,
            }}
          >
            {item.funnelStage}
          </span>
        )}
      </div>

      {/* Financial impact highlight */}
      {item.financialImpact && (
        <div
          className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-lg"
          style={{
            background: isGap ? "rgba(248,113,113,0.08)" : "rgba(74,222,128,0.08)",
            border: `1px solid ${isGap ? "rgba(248,113,113,0.15)" : "rgba(74,222,128,0.15)"}`,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isGap ? "#f87171" : "#4ade80"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" as const, color: `${MUTED}66` }}>
            {isGap ? "Custando" : "Gerando a mais"}
          </span>
          <span style={{ fontSize: "16px", fontWeight: 700, color: isGap ? "#f87171" : "#4ade80", fontFamily: CLASH, marginLeft: "auto" }}>
            {item.financialImpact}
          </span>
        </div>
      )}

      {/* Description */}
      {item.description && (
        <p className="mb-4" style={{ fontSize: "14px", lineHeight: "1.6", color: "rgba(255,255,255,0.65)" }}>
          {item.description}
        </p>
      )}

      {/* Metrics bar: atual → meta */}
      {(item.currentMetric || item.targetMetric) && (
        <div
          className="flex items-center gap-3 mb-5 p-4 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${c}15`,
          }}
        >
          {item.currentMetric && (
            <div className="text-center flex-1">
              <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" as const, color: `${MUTED}55` }}>Atual</p>
              <p className="mt-1" style={{ fontSize: "15px", fontWeight: 600, color: "rgba(255,255,255,0.85)", fontFamily: CLASH }}>{item.currentMetric}</p>
            </div>
          )}
          {item.currentMetric && item.targetMetric && (
            <div className="flex items-center justify-center px-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={`${c}66`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
          )}
          {item.targetMetric && (
            <div className="text-center flex-1">
              <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" as const, color: `${c}88` }}>Meta</p>
              <p className="mt-1" style={{ fontSize: "15px", fontWeight: 700, color: c, fontFamily: CLASH }}>{item.targetMetric}</p>
            </div>
          )}
        </div>
      )}

      {/* Solutions (both gaps and levers) */}
      {hasSolutions && (
        <div
          className="mb-5 p-4 rounded-xl"
          style={{
            background: "rgba(251,191,36,0.04)",
            border: "1px solid rgba(251,191,36,0.12)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
              <path d="M9 18h6" /><path d="M10 22h4" />
            </svg>
            <p style={{
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "1.5px",
              textTransform: "uppercase" as const,
              color: "#fbbf24",
              fontFamily: CLASH,
            }}>
              Soluções Propostas
            </p>
          </div>
          <div className="space-y-2">
            {(item.solutions || []).filter(Boolean).map((sol, si) => (
              <div key={si} className="flex items-start gap-3">
                <svg className="shrink-0 mt-1" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <p style={{
                  fontSize: "13px",
                  fontWeight: 400,
                  color: "rgba(255,255,255,0.75)",
                  lineHeight: "1.5",
                }}>
                  {sol}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-items */}
      {item.children.length > 0 &&
        item.children.map((ch) => <B key={ch.id} node={ch} depth={0} />)}

      {/* Reference image */}
      {item.imageUrl && (
        <div className="mt-5 rounded-xl overflow-hidden" style={{ border: `1px solid ${c}15` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl}
            alt={item.title || "Referência"}
            className="w-full h-auto object-cover"
          />
        </div>
      )}

      {/* Bottom accent line */}
      <style
        dangerouslySetInnerHTML={{
          __html: `.plan-step-card:nth-child(${index + 1})::after { background: ${c}; }`,
        }}
      />
    </div>
  );
}

function NoteBlock({ text }: { text: string }) {
  return (
    <div
      className="mt-8 p-5 rounded-xl"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-start gap-3">
        <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke={`${MUTED}55`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <p style={{ fontSize: "13px", color: `${MUTED}77`, lineHeight: "1.6", fontStyle: "italic" }}>
          {text}
        </p>
      </div>
    </div>
  );
}

function B({ node, depth }: { node: TreeNode; depth: number }) {
  return (
    <div style={depth > 0 ? { marginLeft: "22px" } : undefined}>
      <div className="flex items-start gap-2.5 py-1.5">
        {depth > 0 && (
          <div className="flex items-center gap-1.5 shrink-0 mt-2">
            <div
              style={{
                width: "14px",
                height: "1px",
                background: "rgba(255,255,255,0.08)",
              }}
            />
            <div
              style={{
                width: "5px",
                height: "5px",
                borderRadius: "50%",
                background: `${G}40`,
              }}
            />
          </div>
        )}
        <span
          style={{
            fontSize: "14px",
            lineHeight: "1.6",
            fontWeight: depth === 0 ? 500 : 400,
            color:
              depth === 0 ? "rgba(255,255,255,0.7)" : `${MUTED}55`,
          }}
        >
          {node.text}
        </span>
      </div>
      {node.children.length > 0 && (
        <div
          style={{
            borderLeft: "1px solid rgba(255,255,255,0.06)",
            marginLeft: "2px",
          }}
        >
          {node.children.map((ch) => (
            <B key={ch.id} node={ch} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
