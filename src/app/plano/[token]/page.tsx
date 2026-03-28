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
      <div className="flex items-start gap-2 py-1.5">
        {depth > 0 && (
          <div className="flex items-center gap-1.5 shrink-0 mt-1">
            <div className="w-4 h-px bg-white/20" />
            <div className="w-2 h-2 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shrink-0" />
          </div>
        )}
        <span className={`${depth === 0 ? "text-base font-semibold text-white" : "text-sm text-white/80"}`}>
          {node.text}
        </span>
      </div>
      {node.children.length > 0 && (
        <div className="border-l border-white/10 ml-1">
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
  const gradientFrom = isGap ? "from-red-500/20" : "from-emerald-500/20";
  const accentColor = isGap ? "text-red-400" : "text-emerald-400";
  const dotColor = isGap
    ? "bg-gradient-to-br from-red-400 to-red-600"
    : "bg-gradient-to-br from-emerald-400 to-emerald-600";

  return (
    <div
      className={`rounded-2xl bg-gradient-to-br ${gradientFrom} to-transparent border border-white/10 p-6 backdrop-blur-sm`}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-8 h-8 rounded-lg ${dotColor} flex items-center justify-center text-white font-bold text-sm`}>
          {index + 1}
        </div>
        <h4 className={`text-lg font-bold ${accentColor}`}>
          {item.title || `${isGap ? "Gap" : "Alavanca"} ${index + 1}`}
        </h4>
      </div>
      {item.children.length > 0 && (
        <div className="space-y-1">
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
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Hero Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />

        <div className="relative max-w-5xl mx-auto px-6 py-16 md:py-24 text-center">
          {plan.organization.logo ? (
            <Image
              src={plan.organization.logo}
              alt={plan.organization.name}
              width={64}
              height={64}
              className="mx-auto mb-6 rounded-xl"
              unoptimized
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl font-bold text-primary">
                {plan.organization.name.charAt(0)}
              </span>
            </div>
          )}

          <p className="text-sm font-medium text-primary/80 uppercase tracking-widest mb-3">
            {plan.organization.name}
          </p>

          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
            {plan.title}
          </h1>

          <p className="text-white/50 text-sm">
            {formatDate(plan.periodStart)} — {formatDate(plan.periodEnd)}
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 space-y-16 pb-24">
        {/* Metrics Section */}
        {metrics && (
          <section>
            <SectionTitle>Métricas do Período</SectionTitle>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <MetricDisplay
                label="Faturamento Pago"
                value={fmt(metrics.faturamento)}
                sublabel={`${metrics.totalPedidos} pedidos`}
              />
              <MetricDisplay
                label="Valor Investido"
                value={fmt(metrics.investido)}
                sublabel="Meta Ads"
              />
              <MetricDisplay
                label="Valor Convertido"
                value={fmt(metrics.convertido)}
                sublabel="Meta Ads"
              />
              <MetricDisplay
                label="ROAS"
                value={`${fmtNum(metrics.roas)}x`}
                sublabel={metrics.roas >= 3 ? "Excelente" : metrics.roas >= 2 ? "Bom" : "Atenção"}
                highlight={metrics.roas >= 3 ? "green" : metrics.roas >= 2 ? "amber" : "red"}
              />
              <MetricDisplay
                label="CPA"
                value={fmt(metrics.cpa)}
                sublabel={`${metrics.totalConversoes} conversões`}
              />
              <MetricDisplay
                label="Ticket Médio"
                value={fmt(metrics.ticketMedio)}
              />
            </div>
          </section>
        )}

        {/* Top Products */}
        {products.length > 0 && (
          <section>
            <SectionTitle>Top 5 Produtos Mais Vendidos</SectionTitle>
            <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/[0.02] backdrop-blur-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-6 py-4 text-left text-xs font-medium text-white/40 uppercase tracking-wider w-12">#</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-white/40 uppercase tracking-wider">Produto</th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-white/40 uppercase tracking-wider">Qtd</th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-white/40 uppercase tracking-wider">Faturamento</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p: TopProduct, i: number) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <span className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">{p.name}</td>
                      <td className="px-6 py-4 text-sm text-right text-white/70">{p.quantity}</td>
                      <td className="px-6 py-4 text-sm text-right font-medium">{fmt(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Top Collections */}
        {collections.length > 0 && (
          <section>
            <SectionTitle>Top 3 Coleções com Mais Vendas</SectionTitle>
            <div className="grid md:grid-cols-3 gap-4">
              {collections.map((c: TopCollection, i: number) => (
                <div
                  key={i}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-6 text-center"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center mx-auto mb-3 text-primary font-bold">
                    {i + 1}
                  </div>
                  <h4 className="font-semibold mb-2">{c.name}</h4>
                  <p className="text-2xl font-bold text-primary">{c.quantity}</p>
                  <p className="text-xs text-white/40 mt-1">vendas · {fmt(c.revenue)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Top Creatives */}
        {creatives.length > 0 && (
          <section>
            <SectionTitle>Top 5 Criativos — Melhor Performance</SectionTitle>
            <div className="grid md:grid-cols-5 gap-4">
              {creatives.map((c: TopCreative, i: number) => (
                <div
                  key={i}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm overflow-hidden"
                >
                  {c.thumbnailUrl ? (
                    <div className="aspect-square relative">
                      <Image
                        src={c.thumbnailUrl}
                        alt={c.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      <div className="absolute top-2 left-2">
                        <span className="px-2 py-1 rounded-lg bg-black/60 text-xs font-bold backdrop-blur-sm">
                          #{i + 1}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-square bg-white/5 flex items-center justify-center">
                      <span className="text-4xl font-bold text-white/10">
                        {i + 1}
                      </span>
                    </div>
                  )}
                  <div className="p-4 space-y-2">
                    <p className="text-xs font-medium truncate text-white/70">
                      {c.name}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-white/40">Gasto</p>
                        <p className="font-semibold">{fmt(c.spend)}</p>
                      </div>
                      <div>
                        <p className="text-white/40">Vendas</p>
                        <p className="font-semibold">{c.sales}</p>
                      </div>
                      <div>
                        <p className="text-white/40">ROAS</p>
                        <p className="font-semibold">{fmtNum(c.roas)}x</p>
                      </div>
                      <div>
                        <p className="text-white/40">Score</p>
                        <p className="font-semibold text-primary">
                          {fmtNum(c.score * 100, 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Gaps */}
        {gaps.length > 0 && (
          <section>
            <SectionTitle>Gaps Identificados</SectionTitle>
            <div className="grid md:grid-cols-2 gap-4">
              {gaps.map((gap: GapNode, i: number) => (
                <GapLeverCard key={gap.id} item={gap} index={i} type="gap" />
              ))}
            </div>
          </section>
        )}

        {/* Levers */}
        {levers.length > 0 && (
          <section>
            <SectionTitle>Alavancas de Crescimento</SectionTitle>
            <div className="grid md:grid-cols-2 gap-4">
              {levers.map((lever: LeverNode, i: number) => (
                <GapLeverCard
                  key={lever.id}
                  item={lever}
                  index={i}
                  type="lever"
                />
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="text-center pt-8 border-t border-white/10">
          <p className="text-xs text-white/30">
            Plano de Ação preparado por {plan.organization.name}
            {plan.createdBy.name && ` · ${plan.createdBy.name}`}
          </p>
        </footer>
      </main>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xl md:text-2xl font-bold mb-6 flex items-center gap-3">
      <div className="w-1 h-6 rounded-full bg-primary" />
      {children}
    </h2>
  );
}

function MetricDisplay({
  label,
  value,
  sublabel,
  highlight,
}: {
  label: string;
  value: string;
  sublabel?: string;
  highlight?: "green" | "amber" | "red";
}) {
  const highlightClasses = {
    green: "text-emerald-400",
    amber: "text-amber-400",
    red: "text-red-400",
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-5">
      <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
        {label}
      </p>
      <p className={`text-2xl md:text-3xl font-bold tracking-tight ${highlight ? highlightClasses[highlight] : ""}`}>
        {value}
      </p>
      {sublabel && (
        <p className={`text-xs mt-1 ${highlight ? highlightClasses[highlight] + "/60" : "text-white/30"}`}>
          {sublabel}
        </p>
      )}
    </div>
  );
}
