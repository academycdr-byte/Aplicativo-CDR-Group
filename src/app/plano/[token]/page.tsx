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
import { DataParticles, HeroBackground } from "./hero-effects";
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

// CDR neon green
const CDR_GREEN = "#c4ff00";

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
    <div className="min-h-screen bg-[#050505] text-white antialiased" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ══════════════════════════════════════════════
          HERO — Dark + Grid Pattern + Green Glow
          Like CDR homepage but for Action Plan
          ══════════════════════════════════════════════ */}
      <header className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        <HeroBackground />
        <DataParticles metrics={m} />

        <div className="relative z-10 max-w-[1000px] mx-auto px-6 text-center space-y-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#c4ff00]/20 bg-[#c4ff00]/5">
            {plan.organization.logo ? (
              <Image src={plan.organization.logo} alt="" width={20} height={20} className="rounded" unoptimized />
            ) : null}
            <span className="text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: CDR_GREEN }}>
              {plan.organization.name}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-[-0.03em] leading-[1.05]">
            <span className="text-white">{plan.title}</span>
          </h1>

          {/* Period */}
          <p className="text-base text-white/30">
            {fmtDate(plan.periodStart)} — {fmtDate(plan.periodEnd)}
          </p>

          {/* Hero KPI Cards — like CDR homepage R$25M / 25+ / 8.2x */}
          {m && (
            <div className="grid grid-cols-3 gap-4 md:gap-6 max-w-[700px] mx-auto pt-6">
              <div className="plan-glow-card px-4 py-5 md:px-6 md:py-7 text-center">
                <p className="text-2xl md:text-3xl font-bold plan-counter" style={{ color: CDR_GREEN, animationDelay: "0.2s" }}>
                  {fmt(m.faturamento)}
                </p>
                <p className="text-[10px] md:text-xs font-medium uppercase tracking-wider text-white/35 mt-2">
                  Faturamento Pago
                </p>
              </div>
              <div className="plan-glow-card px-4 py-5 md:px-6 md:py-7 text-center">
                <p className="text-2xl md:text-3xl font-bold plan-counter" style={{ color: CDR_GREEN, animationDelay: "0.4s" }}>
                  {fmtNum(m.roas)}x
                </p>
                <p className="text-[10px] md:text-xs font-medium uppercase tracking-wider text-white/35 mt-2">
                  ROAS
                </p>
              </div>
              <div className="plan-glow-card px-4 py-5 md:px-6 md:py-7 text-center">
                <p className="text-2xl md:text-3xl font-bold plan-counter" style={{ color: CDR_GREEN, animationDelay: "0.6s" }}>
                  {fmt(m.investido)}
                </p>
                <p className="text-[10px] md:text-xs font-medium uppercase tracking-wider text-white/35 mt-2">
                  Investido
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#050505] to-transparent" />
      </header>

      <main>

        {/* ══════════════════════════════════════════════
            METRICS — All 6 KPIs, dark section
            ══════════════════════════════════════════════ */}
        {m && (
          <section className="bg-[#0a0a0a] py-24 md:py-32 plan-section" style={{ animationDelay: "0.1s" }}>
            <div className="max-w-[1000px] mx-auto px-6">
              <SectionLabel>Métricas do Período</SectionLabel>

              <div className="grid md:grid-cols-3 gap-6 mt-12">
                <MetricCard label="Faturamento Pago" value={fmt(m.faturamento)} sub={`${m.totalPedidos} pedidos`} />
                <MetricCard label="Valor Investido" value={fmt(m.investido)} sub="Meta Ads" />
                <MetricCard label="Valor Convertido" value={fmt(m.convertido)} sub="Meta Ads" />
              </div>

              <div className="grid md:grid-cols-3 gap-6 mt-4">
                <MetricCard
                  label="ROAS"
                  value={`${fmtNum(m.roas)}x`}
                  sub={m.roas >= 3 ? "Excelente" : m.roas >= 2 ? "Bom" : "Atenção"}
                  highlight={m.roas >= 3}
                />
                <MetricCard label="CPA" value={fmt(m.cpa)} sub={`${m.totalConversoes} conversões`} />
                <MetricCard label="Ticket Médio" value={fmt(m.ticketMedio)} />
              </div>
            </div>
          </section>
        )}

        {/* Green divider */}
        <div className="plan-divider-green" />

        {/* ══════════════════════════════════════════════
            TOP PRODUCTS — Slightly lighter dark
            ══════════════════════════════════════════════ */}
        {products.length > 0 && (
          <section className="bg-[#080808] py-24 md:py-32 plan-section" style={{ animationDelay: "0.15s" }}>
            <div className="max-w-[1000px] mx-auto px-6">
              <SectionLabel>Top 5 Produtos Mais Vendidos</SectionLabel>

              <div className="mt-12 rounded-2xl border border-white/[0.06] overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-white/[0.02]">
                      <th className="px-6 py-4 text-left text-[10px] font-semibold uppercase tracking-widest text-white/25 w-12">#</th>
                      <th className="px-3 py-4 w-14" />
                      <th className="px-5 py-4 text-left text-[10px] font-semibold uppercase tracking-widest text-white/25">Produto</th>
                      <th className="px-5 py-4 text-right text-[10px] font-semibold uppercase tracking-widest text-white/25">Qtd</th>
                      <th className="px-6 py-4 text-right text-[10px] font-semibold uppercase tracking-widest text-white/25">Faturamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p: TopProduct, i: number) => (
                      <tr key={i} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-5 text-sm font-bold" style={{ color: CDR_GREEN }}>{i + 1}</td>
                        <td className="px-3 py-4">
                          {p.imageUrl ? (
                            <div className="w-11 h-11 relative rounded-lg overflow-hidden bg-white/5 border border-white/[0.06]">
                              <Image src={p.imageUrl} alt={p.name} fill className="object-cover" unoptimized sizes="44px" />
                            </div>
                          ) : (
                            <div className="w-11 h-11 rounded-lg bg-white/[0.03] border border-white/[0.04]" />
                          )}
                        </td>
                        <td className="px-5 py-5 text-sm font-medium text-white/80">{p.name}</td>
                        <td className="px-5 py-5 text-sm text-right text-white/40">{p.quantity}</td>
                        <td className="px-6 py-5 text-sm text-right font-semibold text-white">{fmt(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════════
            TOP COLLECTIONS — Green accent section
            ══════════════════════════════════════════════ */}
        {collections.length > 0 && (
          <section className="relative bg-[#050505] py-24 md:py-32 overflow-hidden plan-section" style={{ animationDelay: "0.2s" }}>
            {/* Subtle green glow background */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(196,255,0,0.03)_0%,transparent_70%)]" />

            <div className="relative max-w-[1000px] mx-auto px-6">
              <SectionLabel>Top Coleções com Mais Vendas</SectionLabel>

              <div className="grid md:grid-cols-3 gap-6 mt-12">
                {collections.map((c: TopCollection, i: number) => (
                  <div key={i} className="plan-glow-card p-8 text-center">
                    <span className="inline-flex w-9 h-9 rounded-lg items-center justify-center text-xs font-bold text-black" style={{ background: CDR_GREEN }}>
                      {i + 1}
                    </span>
                    <h4 className="text-base font-semibold mt-5 text-white">{c.name}</h4>
                    <p className="text-4xl font-bold tracking-tight mt-3" style={{ color: CDR_GREEN }}>{c.quantity}</p>
                    <p className="text-xs text-white/25 mt-2">vendas · {fmt(c.revenue)}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <div className="plan-divider-green" />

        {/* ══════════════════════════════════════════════
            TOP CREATIVES — Dark section
            ══════════════════════════════════════════════ */}
        {creatives.length > 0 && (
          <section className="bg-[#0a0a0a] py-24 md:py-32 plan-section" style={{ animationDelay: "0.25s" }}>
            <div className="max-w-[1000px] mx-auto px-6">
              <SectionLabel>Top 5 Criativos — Melhor Performance</SectionLabel>
              <div className="mt-12">
                <CreativesSection creatives={creatives} />
              </div>
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════════
            GAPS — Dark with red accent
            ══════════════════════════════════════════════ */}
        {gaps.length > 0 && (
          <>
            <div className="plan-divider-green" />
            <section className="bg-[#080808] py-24 md:py-32 plan-section" style={{ animationDelay: "0.3s" }}>
              <div className="max-w-[1000px] mx-auto px-6">
                <SectionLabel>Gaps Identificados</SectionLabel>
                <p className="text-sm text-white/25 mt-3 mb-12">Pontos de melhoria que precisam de atenção</p>

                <div className="grid md:grid-cols-2 gap-5">
                  {gaps.map((gap: GapNode, i: number) => (
                    <TreeCard key={gap.id} item={gap} index={i} type="gap" />
                  ))}
                </div>
              </div>
            </section>
          </>
        )}

        {/* ══════════════════════════════════════════════
            LEVERS — Dark with green accent
            ══════════════════════════════════════════════ */}
        {levers.length > 0 && (
          <>
            <div className="plan-divider-green" />
            <section className="bg-[#050505] py-24 md:py-32 plan-section" style={{ animationDelay: "0.35s" }}>
              <div className="max-w-[1000px] mx-auto px-6">
                <SectionLabel>Alavancas de Crescimento</SectionLabel>
                <p className="text-sm text-white/25 mt-3 mb-12">Ações que vão gerar mais resultado</p>

                <div className="grid md:grid-cols-2 gap-5">
                  {levers.map((lever: LeverNode, i: number) => (
                    <TreeCard key={lever.id} item={lever} index={i} type="lever" />
                  ))}
                </div>
              </div>
            </section>
          </>
        )}

        {/* ══════════════════════════════════════════════
            FOOTER
            ══════════════════════════════════════════════ */}
        <footer className="bg-[#050505] py-16 border-t border-white/[0.04]">
          <div className="max-w-[1000px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {plan.organization.logo ? (
                <Image src={plan.organization.logo} alt="" width={24} height={24} className="rounded" unoptimized />
              ) : null}
              <span className="text-sm font-semibold text-white/40">{plan.organization.name}</span>
            </div>
            <p className="text-xs text-white/15">
              {plan.createdBy.name && `${plan.createdBy.name} · `}{fmtDate(plan.createdAt)}
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-white">
      {children}
    </h2>
  );
}

function MetricCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 md:p-7">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/25 mb-3">{label}</p>
      <p
        className="text-2xl md:text-3xl font-bold tracking-tight"
        style={highlight ? { color: CDR_GREEN } : undefined}
      >
        {value}
      </p>
      {sub && (
        <p className="text-xs mt-2" style={highlight ? { color: `${CDR_GREEN}66` } : { color: "rgba(255,255,255,0.2)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function TreeCard({ item, index, type }: { item: GapNode | LeverNode; index: number; type: "gap" | "lever" }) {
  const isGap = type === "gap";
  const color = isGap ? "#ef4444" : CDR_GREEN;
  const borderColor = isGap ? "rgba(239,68,68,0.15)" : "rgba(196,255,0,0.15)";
  const bgColor = isGap ? "rgba(239,68,68,0.03)" : "rgba(196,255,0,0.03)";

  return (
    <div className="rounded-xl p-6" style={{ border: `1px solid ${borderColor}`, background: bgColor }}>
      <div className="flex items-center gap-3 mb-5">
        <span className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold" style={{ background: color, color: isGap ? "#fff" : "#000" }}>
          {index + 1}
        </span>
        <h4 className="text-sm font-bold" style={{ color }}>
          {item.title || `${isGap ? "Gap" : "Alavanca"} ${index + 1}`}
        </h4>
      </div>
      {item.children.length > 0 && (
        <div className="space-y-0.5">
          {item.children.map((child) => (
            <Branch key={child.id} node={child} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
}

function Branch({ node, depth }: { node: TreeNode; depth: number }) {
  return (
    <div className={depth > 0 ? "ml-5" : ""}>
      <div className="flex items-start gap-2 py-1.5">
        {depth > 0 && (
          <div className="flex items-center gap-1.5 shrink-0 mt-1.5">
            <div className="w-3 h-px bg-white/10" />
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: `${CDR_GREEN}40` }} />
          </div>
        )}
        <span className={`text-sm leading-relaxed ${depth === 0 ? "font-medium text-white/70" : "text-white/40"}`}>
          {node.text}
        </span>
      </div>
      {node.children.length > 0 && (
        <div className="border-l border-white/[0.06] ml-[3px]">
          {node.children.map((child) => (
            <Branch key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
