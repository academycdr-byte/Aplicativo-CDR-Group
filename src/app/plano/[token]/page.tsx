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
import { GradientMesh } from "./hero-effects";
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
    <div className="min-h-screen bg-white text-[#0a2540]" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

      {/* ════════ HERO — Stripe-style with gradient mesh ════════ */}
      <header className="relative min-h-[85vh] flex items-end overflow-hidden">
        <GradientMesh />

        <div className="relative z-10 w-full max-w-[1080px] mx-auto px-6 md:px-10 pb-20 md:pb-28">
          {/* Org badge */}
          <div className="flex items-center gap-2.5 mb-8">
            {plan.organization.logo ? (
              <Image src={plan.organization.logo} alt="" width={28} height={28} className="rounded-md" unoptimized />
            ) : (
              <div className="w-7 h-7 rounded-md bg-emerald-500 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">{plan.organization.name.charAt(0)}</span>
              </div>
            )}
            <span className="text-sm font-medium text-[#0a2540]/50">{plan.organization.name}</span>
            <span className="text-sm text-[#0a2540]/25 mx-1">·</span>
            <span className="text-sm text-[#0a2540]/30">{fmtDate(plan.periodStart)} — {fmtDate(plan.periodEnd)}</span>
          </div>

          {/* Title — Stripe-style large headline */}
          <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] font-bold leading-[1.05] tracking-[-0.03em] max-w-[800px]">
            <span className="text-[#0a2540]">{plan.title.split(" ").slice(0, 3).join(" ")} </span>
            <span className="text-[#0a2540]/40">{plan.title.split(" ").slice(3).join(" ")}</span>
          </h1>

          {/* ROAS highlight — like Stripe's PIB counter */}
          {m && (
            <div className="mt-8 flex items-baseline gap-3">
              <span className="text-sm font-medium text-[#0a2540]/40">ROAS do período:</span>
              <span className="text-2xl font-bold text-emerald-600">{fmtNum(m.roas)}x</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-[1080px] mx-auto px-6 md:px-10">

        {/* ════════ METRICS ════════ */}
        {m && (
          <section className="py-20 md:py-28 plan-section" style={{ animationDelay: "0.1s" }}>
            <SectionLabel>Métricas do Período</SectionLabel>

            <div className="grid md:grid-cols-3 gap-8 md:gap-12 mt-10">
              <MetricBlock label="Faturamento Pago" value={fmt(m.faturamento)} sub={`${m.totalPedidos} pedidos`} />
              <MetricBlock label="Valor Investido" value={fmt(m.investido)} sub="Meta Ads" />
              <MetricBlock label="Valor Convertido" value={fmt(m.convertido)} sub="Meta Ads" />
            </div>

            <div className="h-px bg-[#0a2540]/[0.06] my-8" />

            <div className="grid md:grid-cols-3 gap-8 md:gap-12">
              <MetricBlock
                label="ROAS"
                value={`${fmtNum(m.roas)}x`}
                sub={m.roas >= 3 ? "Excelente" : m.roas >= 2 ? "Bom" : "Atenção"}
                accent={m.roas >= 3 ? "#10b981" : m.roas >= 2 ? "#f59e0b" : "#ef4444"}
              />
              <MetricBlock label="CPA" value={fmt(m.cpa)} sub={`${m.totalConversoes} conversões`} />
              <MetricBlock label="Ticket Médio" value={fmt(m.ticketMedio)} />
            </div>
          </section>
        )}

        {/* ════════ TOP PRODUCTS ════════ */}
        {products.length > 0 && (
          <section className="py-20 md:py-28 border-t border-[#0a2540]/[0.06] plan-section" style={{ animationDelay: "0.15s" }}>
            <SectionLabel>Top 5 Produtos Mais Vendidos</SectionLabel>

            <div className="mt-10 rounded-2xl border border-[#0a2540]/[0.08] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f6f9fc]">
                    <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider text-[#0a2540]/40 w-12">#</th>
                    <th className="px-4 py-4 w-16" />
                    <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider text-[#0a2540]/40">Produto</th>
                    <th className="px-6 py-4 text-right text-[11px] font-semibold uppercase tracking-wider text-[#0a2540]/40">Qtd</th>
                    <th className="px-6 py-4 text-right text-[11px] font-semibold uppercase tracking-wider text-[#0a2540]/40">Faturamento</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p: TopProduct, i: number) => (
                    <tr key={i} className="border-t border-[#0a2540]/[0.05] hover:bg-[#f6f9fc]/50 transition-colors">
                      <td className="px-6 py-5 text-sm font-medium text-[#0a2540]/30">{i + 1}</td>
                      <td className="px-4 py-4">
                        {p.imageUrl ? (
                          <div className="w-11 h-11 relative rounded-lg overflow-hidden bg-[#f6f9fc]">
                            <Image src={p.imageUrl} alt={p.name} fill className="object-cover" unoptimized sizes="44px" />
                          </div>
                        ) : (
                          <div className="w-11 h-11 rounded-lg bg-[#f6f9fc]" />
                        )}
                      </td>
                      <td className="px-6 py-5 text-sm font-medium text-[#0a2540]">{p.name}</td>
                      <td className="px-6 py-5 text-sm text-right text-[#0a2540]/50">{p.quantity}</td>
                      <td className="px-6 py-5 text-sm text-right font-semibold text-[#0a2540]">{fmt(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ════════ TOP COLLECTIONS ════════ */}
        {collections.length > 0 && (
          <section className="py-20 md:py-28 border-t border-[#0a2540]/[0.06] plan-section" style={{ animationDelay: "0.2s" }}>
            <SectionLabel>Top Coleções com Mais Vendas</SectionLabel>

            <div className="grid md:grid-cols-3 gap-6 mt-10">
              {collections.map((c: TopCollection, i: number) => (
                <div key={i} className="rounded-2xl border border-[#0a2540]/[0.08] p-8 text-center hover:shadow-lg hover:shadow-emerald-500/5 transition-shadow duration-300">
                  <span className="inline-flex w-8 h-8 rounded-full bg-emerald-50 items-center justify-center text-xs font-bold text-emerald-600">{i + 1}</span>
                  <h4 className="text-base font-semibold mt-4">{c.name}</h4>
                  <p className="text-4xl font-bold tracking-tight mt-2 text-emerald-600">{c.quantity}</p>
                  <p className="text-sm text-[#0a2540]/30 mt-2">vendas · {fmt(c.revenue)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ════════ TOP CREATIVES (dark section like Stripe's "O líder de comércio global") ════════ */}
        {creatives.length > 0 && (
          <section className="py-20 md:py-28 -mx-6 md:-mx-10 px-6 md:px-10 bg-[#0a2540] rounded-3xl my-12 plan-section" style={{ animationDelay: "0.25s" }}>
            <SectionLabel dark>Top 5 Criativos — Melhor Performance</SectionLabel>
            <div className="mt-10">
              <CreativesSection creatives={creatives} />
            </div>
          </section>
        )}

        {/* ════════ GAPS ════════ */}
        {gaps.length > 0 && (
          <section className="py-20 md:py-28 border-t border-[#0a2540]/[0.06] plan-section" style={{ animationDelay: "0.3s" }}>
            <SectionLabel>Gaps Identificados</SectionLabel>
            <p className="text-base text-[#0a2540]/40 mt-2 mb-10">Pontos de melhoria que precisam de atenção</p>

            <div className="grid md:grid-cols-2 gap-5">
              {gaps.map((gap: GapNode, i: number) => (
                <TreeCard key={gap.id} item={gap} index={i} type="gap" />
              ))}
            </div>
          </section>
        )}

        {/* ════════ LEVERS ════════ */}
        {levers.length > 0 && (
          <section className="py-20 md:py-28 border-t border-[#0a2540]/[0.06] plan-section" style={{ animationDelay: "0.35s" }}>
            <SectionLabel>Alavancas de Crescimento</SectionLabel>
            <p className="text-base text-[#0a2540]/40 mt-2 mb-10">Ações que vão gerar mais resultado</p>

            <div className="grid md:grid-cols-2 gap-5">
              {levers.map((lever: LeverNode, i: number) => (
                <TreeCard key={lever.id} item={lever} index={i} type="lever" />
              ))}
            </div>
          </section>
        )}

        {/* ════════ FOOTER ════════ */}
        <footer className="py-16 border-t border-[#0a2540]/[0.06] text-center">
          <p className="text-xs text-[#0a2540]/25">
            {plan.organization.name}{plan.createdBy.name && ` · ${plan.createdBy.name}`} · {fmtDate(plan.createdAt)}
          </p>
        </footer>
      </main>
    </div>
  );
}

// ─── Components ───────────────────────────────────

function SectionLabel({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <h2 className={`text-[clamp(1.8rem,4vw,2.8rem)] font-bold tracking-[-0.02em] leading-tight ${dark ? "text-white" : "text-[#0a2540]"}`}>
      {children}
    </h2>
  );
}

function MetricBlock({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0a2540]/30 mb-3">{label}</p>
      <p className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold tracking-tight" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
      {sub && (
        <p className="text-sm mt-1.5" style={{ color: accent ? `${accent}99` : "rgba(10,37,64,0.3)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function TreeCard({ item, index, type }: { item: GapNode | LeverNode; index: number; type: "gap" | "lever" }) {
  const isGap = type === "gap";
  const color = isGap ? "#ef4444" : "#10b981";
  const bgTint = isGap ? "bg-red-50" : "bg-emerald-50";
  const borderTint = isGap ? "border-red-100" : "border-emerald-100";

  return (
    <div className={`rounded-2xl border ${borderTint} ${bgTint}/50 p-6`}>
      <div className="flex items-center gap-3 mb-4">
        <span className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-white" style={{ background: color }}>
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
            <div className="w-3 h-px bg-[#0a2540]/10" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#0a2540]/15" />
          </div>
        )}
        <span className={`text-sm leading-relaxed ${depth === 0 ? "font-medium text-[#0a2540]/80" : "text-[#0a2540]/45"}`}>
          {node.text}
        </span>
      </div>
      {node.children.length > 0 && (
        <div className="border-l border-[#0a2540]/[0.06] ml-[3px]">
          {node.children.map((child) => (
            <Branch key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
