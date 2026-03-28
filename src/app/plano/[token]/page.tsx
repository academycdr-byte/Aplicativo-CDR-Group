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

        <div className="relative z-10 max-w-[960px] mx-auto px-6 text-center">
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
                color: `${G}99`,
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

          {/* Period */}
          <p
            className="mt-4"
            style={{
              fontSize: "15px",
              fontWeight: 400,
              color: `${MUTED}88`,
              letterSpacing: "0.3px",
            }}
          >
            {fmtD(plan.periodStart)} — {fmtD(plan.periodEnd)}
          </p>
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
                    />
                    <MC
                      label="Valor Investido"
                      value={fmt(m.investido)}
                      sub="Meta Ads"
                    />
                    <MC
                      label="Valor Convertido"
                      value={fmt(m.convertido)}
                      sub="Meta Ads"
                    />
                  </div>
                  <div className="grid md:grid-cols-3 gap-4 mt-4">
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
                    />
                    <MC
                      label="CPA"
                      value={fmt(m.cpa)}
                      sub={`${m.totalConversoes} conversões`}
                    />
                    <MC label="Ticket Médio" value={fmt(m.ticketMedio)} />
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
                  <div className="grid md:grid-cols-2 gap-4">
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
                <div className="grid md:grid-cols-2 gap-4">
                  {levers.map((l: LeverNode, i: number) => (
                    <TC key={l.id} item={l} index={i} type="lever" />
                  ))}
                </div>
              </div>
            </section>
          </ScrollReveal>
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
    <div className="flex items-baseline gap-4 mb-10">
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

function MC({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="plan-metric">
      <p
        style={{
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "1px",
          textTransform: "uppercase" as const,
          color: `${MUTED}55`,
        }}
      >
        {label}
      </p>
      <p
        className="mt-1"
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
  return (
    <div
      className="plan-step-card"
      style={{
        border: `1px solid ${c}22`,
        background: `${c}06`,
      }}
    >
      <div className="flex items-center gap-4 mb-5">
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
      {item.children.length > 0 &&
        item.children.map((ch) => <B key={ch.id} node={ch} depth={0} />)}
      {/* Bottom accent line */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .plan-step-card:nth-child(${index + 1})::after {
          background: ${c};
        }
      `,
        }}
      />
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
