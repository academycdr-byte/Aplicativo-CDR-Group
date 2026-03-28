"use server";

import { prisma } from "@/lib/prisma";
import { getSessionWithOrg } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

// ─── Types ────────────────────────────────────────

export type ActionPlanSummary = {
  id: string;
  title: string;
  periodStart: Date;
  periodEnd: Date;
  status: "DRAFT" | "FINALIZED";
  publicToken: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { name: string | null; email: string };
};

export type PlanMetrics = {
  faturamento: number;
  investido: number;
  convertido: number;
  roas: number;
  cpa: number;
  ticketMedio: number;
  totalPedidos: number;
  totalConversoes: number;
};

export type TopProduct = {
  name: string;
  quantity: number;
  revenue: number;
};

export type TopCollection = {
  name: string;
  quantity: number;
  revenue: number;
};

export type TopCreative = {
  adId: string;
  name: string;
  thumbnailUrl: string | null;
  spend: number;
  sales: number;
  roas: number;
  score: number;
};

export type ActionPlanFull = {
  id: string;
  title: string;
  periodStart: Date;
  periodEnd: Date;
  status: "DRAFT" | "FINALIZED";
  publicToken: string;
  metrics: PlanMetrics | null;
  topProducts: TopProduct[] | null;
  topCollections: TopCollection[] | null;
  topCreatives: TopCreative[] | null;
  gaps: GapNode[];
  levers: LeverNode[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: { name: string | null; email: string };
};

export type TreeNode = {
  id: string;
  text: string;
  children: TreeNode[];
};

export type GapNode = {
  id: string;
  title: string;
  children: TreeNode[];
};

export type LeverNode = {
  id: string;
  title: string;
  children: TreeNode[];
};

// ─── List Action Plans ────────────────────────────

export async function getActionPlans() {
  const ctx = await getSessionWithOrg();
  if (!ctx) return [];

  const plans = await prisma.actionPlan.findMany({
    where: { organizationId: ctx.organization.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      periodStart: true,
      periodEnd: true,
      status: true,
      publicToken: true,
      createdAt: true,
      updatedAt: true,
      createdBy: {
        select: { name: true, email: true },
      },
    },
  });

  return plans as ActionPlanSummary[];
}

// ─── Get Single Action Plan ───────────────────────

export async function getActionPlan(planId: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return null;

  const plan = await prisma.actionPlan.findFirst({
    where: {
      id: planId,
      organizationId: ctx.organization.id,
    },
    include: {
      createdBy: {
        select: { name: true, email: true },
      },
    },
  });

  if (!plan) return null;

  return {
    ...plan,
    metrics: plan.metrics as PlanMetrics | null,
    topProducts: plan.topProducts as TopProduct[] | null,
    topCollections: plan.topCollections as TopCollection[] | null,
    topCreatives: plan.topCreatives as TopCreative[] | null,
    gaps: (plan.gaps as GapNode[]) || [],
    levers: (plan.levers as LeverNode[]) || [],
  } as ActionPlanFull;
}

// ─── Aggregate Metrics for Period ─────────────────

async function aggregateMetrics(
  orgId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<{
  metrics: PlanMetrics;
  topProducts: TopProduct[];
  topCreatives: TopCreative[];
}> {
  // 1. Order metrics (Faturamento, Ticket Médio)
  type OrderAgg = { paid_count: bigint; paid_revenue: number };
  const [orderAgg] = await prisma.$queryRaw<OrderAgg[]>`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('paid','partially_refunded')) as paid_count,
      COALESCE(SUM("totalAmount") FILTER (WHERE status IN ('paid','partially_refunded')), 0) as paid_revenue
    FROM orders
    WHERE "organizationId" = ${orgId}
      AND "orderDate" >= ${periodStart}
      AND "orderDate" <= ${periodEnd}
  `;

  // 2. Ad metrics (Investido, Convertido, ROAS, CPA)
  const periodStartDate = periodStart.toISOString().split("T")[0];
  const periodEndDate = periodEnd.toISOString().split("T")[0];

  type AdAgg = { total_spend: number; total_revenue: number; total_conversions: bigint };
  const [adAgg] = await prisma.$queryRaw<AdAgg[]>`
    SELECT
      COALESCE(SUM(spend), 0) as total_spend,
      COALESCE(SUM(revenue), 0) as total_revenue,
      COALESCE(SUM(conversions), 0) as total_conversions
    FROM ad_metrics
    WHERE "organizationId" = ${orgId}
      AND platform = 'FACEBOOK_ADS'
      AND date >= ${periodStartDate}::date
      AND date <= ${periodEndDate}::date
  `;

  const faturamento = Number(orderAgg?.paid_revenue || 0);
  const totalPedidos = Number(orderAgg?.paid_count || 0);
  const investido = Number(adAgg?.total_spend || 0);
  const convertido = Number(adAgg?.total_revenue || 0);
  const totalConversoes = Number(adAgg?.total_conversions || 0);

  const metrics: PlanMetrics = {
    faturamento,
    investido,
    convertido,
    roas: investido > 0 ? convertido / investido : 0,
    cpa: totalConversoes > 0 ? investido / totalConversoes : 0,
    ticketMedio: totalPedidos > 0 ? faturamento / totalPedidos : 0,
    totalPedidos,
    totalConversoes,
  };

  // 3. Top 5 Products from Order.rawData line_items
  const orders = await prisma.order.findMany({
    where: {
      organizationId: orgId,
      orderDate: { gte: periodStart, lte: periodEnd },
      status: { in: ["paid", "partially_refunded"] },
      rawData: { not: Prisma.DbNull },
    },
    select: { rawData: true },
  });

  const productMap = new Map<string, { quantity: number; revenue: number }>();

  for (const order of orders) {
    const raw = order.rawData as Record<string, unknown>;
    const lineItems =
      (raw?.line_items as Array<Record<string, unknown>>) ||
      (raw?.products as Array<Record<string, unknown>>) ||
      (raw?.items as Array<Record<string, unknown>>) ||
      [];

    for (const item of lineItems) {
      const name =
        (item.name as string) || (item.title as string) || "Produto sem nome";
      const qty = Number(item.quantity || 1);
      const price = Number(item.price || 0);
      const revenue = qty * price;

      const existing = productMap.get(name);
      if (existing) {
        existing.quantity += qty;
        existing.revenue += revenue;
      } else {
        productMap.set(name, { quantity: qty, revenue });
      }
    }
  }

  const topProducts = Array.from(productMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // 4. Top 5 Creatives with composite score
  type CreativeRow = {
    ad_id: string;
    ad_name: string | null;
    thumbnail_url: string | null;
    total_spend: number;
    total_conversions: bigint;
    total_revenue: number;
  };

  const creativeRows = await prisma.$queryRaw<CreativeRow[]>`
    SELECT
      "adId" as ad_id,
      MAX("adName") as ad_name,
      MAX("thumbnailUrl") as thumbnail_url,
      COALESCE(SUM(spend), 0) as total_spend,
      COALESCE(SUM(conversions), 0) as total_conversions,
      COALESCE(SUM(revenue), 0) as total_revenue
    FROM ad_metrics
    WHERE "organizationId" = ${orgId}
      AND platform = 'FACEBOOK_ADS'
      AND date >= ${periodStartDate}::date
      AND date <= ${periodEndDate}::date
      AND "adId" IS NOT NULL
    GROUP BY "adId"
    HAVING SUM(spend) > 0
    ORDER BY SUM(revenue) DESC
    LIMIT 50
  `;

  // Compute composite score with equal weights (min-max normalization)
  let topCreatives: TopCreative[] = [];

  if (creativeRows.length > 0) {
    const creatives = creativeRows.map((row) => {
      const spend = Number(row.total_spend);
      const sales = Number(row.total_conversions);
      const revenue = Number(row.total_revenue);
      const roas = spend > 0 ? revenue / spend : 0;
      return {
        adId: row.ad_id,
        name: row.ad_name || row.ad_id,
        thumbnailUrl: row.thumbnail_url,
        spend,
        sales,
        roas,
        score: 0,
      };
    });

    // Min-max normalization
    const maxRoas = Math.max(...creatives.map((c) => c.roas), 0.001);
    const minRoas = Math.min(...creatives.map((c) => c.roas));
    const maxSales = Math.max(...creatives.map((c) => c.sales), 0.001);
    const minSales = Math.min(...creatives.map((c) => c.sales));
    const maxSpend = Math.max(...creatives.map((c) => c.spend), 0.001);
    const minSpend = Math.min(...creatives.map((c) => c.spend));

    const normalize = (val: number, min: number, max: number) =>
      max === min ? 0.5 : (val - min) / (max - min);

    for (const c of creatives) {
      c.score =
        (normalize(c.roas, minRoas, maxRoas) +
          normalize(c.sales, minSales, maxSales) +
          normalize(c.spend, minSpend, maxSpend)) /
        3;
    }

    topCreatives = creatives
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  return { metrics, topProducts, topCreatives };
}

// ─── Create Action Plan (with auto-populate) ──────

export async function createActionPlan(data: {
  title: string;
  periodStart: string;
  periodEnd: string;
}) {
  const ctx = await getSessionWithOrg();
  if (!ctx) throw new Error("Não autenticado");

  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    throw new Error("Sem permissão para criar planos de ação");
  }

  const periodStart = new Date(data.periodStart);
  const periodEnd = new Date(data.periodEnd);

  // Auto-populate metrics
  const { metrics, topProducts, topCreatives } = await aggregateMetrics(
    ctx.organization.id,
    periodStart,
    periodEnd
  );

  const plan = await prisma.actionPlan.create({
    data: {
      title: data.title,
      periodStart,
      periodEnd,
      organizationId: ctx.organization.id,
      createdById: ctx.user.id,
      metrics: metrics as unknown as Prisma.JsonObject,
      topProducts: topProducts as unknown as Prisma.JsonArray,
      topCollections: [] as unknown as Prisma.JsonArray,
      topCreatives: topCreatives as unknown as Prisma.JsonArray,
    },
  });

  revalidatePath("/plano-de-acao");
  return plan;
}

// ─── Update Action Plan ───────────────────────────

export async function updateActionPlan(
  planId: string,
  data: {
    title?: string;
    metrics?: PlanMetrics;
    topProducts?: TopProduct[];
    topCollections?: TopCollection[];
    topCreatives?: TopCreative[];
    gaps?: GapNode[];
    levers?: LeverNode[];
    status?: "DRAFT" | "FINALIZED";
  }
) {
  const ctx = await getSessionWithOrg();
  if (!ctx) throw new Error("Não autenticado");

  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    throw new Error("Sem permissão para editar planos de ação");
  }

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.metrics !== undefined)
    updateData.metrics = data.metrics as unknown as Prisma.JsonObject;
  if (data.topProducts !== undefined)
    updateData.topProducts = data.topProducts as unknown as Prisma.JsonArray;
  if (data.topCollections !== undefined)
    updateData.topCollections = data.topCollections as unknown as Prisma.JsonArray;
  if (data.topCreatives !== undefined)
    updateData.topCreatives = data.topCreatives as unknown as Prisma.JsonArray;
  if (data.gaps !== undefined)
    updateData.gaps = data.gaps as unknown as Prisma.JsonArray;
  if (data.levers !== undefined)
    updateData.levers = data.levers as unknown as Prisma.JsonArray;

  const plan = await prisma.actionPlan.update({
    where: {
      id: planId,
      organizationId: ctx.organization.id,
    },
    data: updateData,
  });

  revalidatePath("/plano-de-acao");
  revalidatePath(`/plano-de-acao/${planId}`);
  return plan;
}

// ─── Delete Action Plan ───────────────────────────

export async function deleteActionPlan(planId: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) throw new Error("Não autenticado");

  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    throw new Error("Sem permissão para excluir planos de ação");
  }

  await prisma.actionPlan.delete({
    where: {
      id: planId,
      organizationId: ctx.organization.id,
    },
  });

  revalidatePath("/plano-de-acao");
}

// ─── Re-aggregate Metrics ─────────────────────────

export async function refreshActionPlanMetrics(planId: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) throw new Error("Não autenticado");

  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    throw new Error("Sem permissão");
  }

  const plan = await prisma.actionPlan.findFirst({
    where: { id: planId, organizationId: ctx.organization.id },
  });

  if (!plan) throw new Error("Plano não encontrado");

  const { metrics, topProducts, topCreatives } = await aggregateMetrics(
    ctx.organization.id,
    plan.periodStart,
    plan.periodEnd
  );

  await prisma.actionPlan.update({
    where: { id: planId },
    data: {
      metrics: metrics as unknown as Prisma.JsonObject,
      topProducts: topProducts as unknown as Prisma.JsonArray,
      topCreatives: topCreatives as unknown as Prisma.JsonArray,
    },
  });

  revalidatePath(`/plano-de-acao/${planId}`);
  return { metrics, topProducts, topCreatives };
}

// ─── Get Plan by Public Token (no auth) ───────────

export async function getActionPlanByToken(token: string) {
  const plan = await prisma.actionPlan.findFirst({
    where: {
      publicToken: token,
      status: "FINALIZED",
    },
    include: {
      organization: {
        select: { name: true, logo: true },
      },
      createdBy: {
        select: { name: true },
      },
    },
  });

  if (!plan) return null;

  return {
    id: plan.id,
    title: plan.title,
    periodStart: plan.periodStart,
    periodEnd: plan.periodEnd,
    metrics: plan.metrics as PlanMetrics | null,
    topProducts: plan.topProducts as TopProduct[] | null,
    topCollections: plan.topCollections as TopCollection[] | null,
    topCreatives: plan.topCreatives as TopCreative[] | null,
    gaps: (plan.gaps as GapNode[]) || [],
    levers: (plan.levers as LeverNode[]) || [],
    organization: plan.organization,
    createdBy: plan.createdBy,
    createdAt: plan.createdAt,
  };
}
