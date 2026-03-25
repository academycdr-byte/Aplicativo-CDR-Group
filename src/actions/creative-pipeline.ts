"use server";

import { prisma } from "@/lib/prisma";
import { getSessionWithOrg } from "@/lib/session";
import { CreativeStatus } from "@prisma/client";
import { classifyCreativesForOrg } from "@/lib/creative-pipeline-engine";

// ─── TYPES ────────────────────────────────────────

type ClassifiedCreative = {
  id: string;
  creativeName: string;
  status: CreativeStatus;
  previousStatus: CreativeStatus | null;
  roas: number;
  purchases: number;
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
  thumbnailUrl: string | null;
  lastClassifiedAt: Date;
};

type PipelineSummary = {
  total: number;
  byStatus: Record<CreativeStatus, number>;
};

// ─── BENCHMARK CONFIG ─────────────────────────────

export async function getBenchmarkConfig() {
  const ctx = await getSessionWithOrg();
  if (!ctx) return null;

  const benchmark = await prisma.creativeBenchmark.findUnique({
    where: { organizationId: ctx.organization.id },
  });

  if (!benchmark) {
    return {
      roasBreakeven: 1.5,
      roasIdeal: 2.5,
      minPurchases: 5,
      lookbackDays: 7,
      isDefault: true,
    };
  }

  return {
    roasBreakeven: Number(benchmark.roasBreakeven),
    roasIdeal: Number(benchmark.roasIdeal),
    minPurchases: benchmark.minPurchases,
    lookbackDays: benchmark.lookbackDays,
    isDefault: false,
  };
}

export async function saveBenchmarkConfig(data: {
  roasBreakeven: number;
  roasIdeal: number;
  minPurchases: number;
  lookbackDays: number;
}) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { success: false, error: "Não autenticado" };

  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    return { success: false, error: "Sem permissão" };
  }

  await prisma.creativeBenchmark.upsert({
    where: { organizationId: ctx.organization.id },
    create: {
      organizationId: ctx.organization.id,
      roasBreakeven: data.roasBreakeven,
      roasIdeal: data.roasIdeal,
      minPurchases: data.minPurchases,
      lookbackDays: data.lookbackDays,
    },
    update: {
      roasBreakeven: data.roasBreakeven,
      roasIdeal: data.roasIdeal,
      minPurchases: data.minPurchases,
      lookbackDays: data.lookbackDays,
    },
  });

  return { success: true };
}

// ─── RUN CLASSIFICATION (via shared engine) ───────

export async function runClassification() {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { success: false, error: "Não autenticado" };

  try {
    const result = await classifyCreativesForOrg(ctx.organization.id);
    return {
      success: true,
      classified: result.classified,
      transitions: [] as { name: string; from: CreativeStatus | null; to: CreativeStatus }[],
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Erro desconhecido",
    };
  }
}

// ─── DATA LOADERS ─────────────────────────────────

export async function getCreativePipeline(): Promise<{
  creatives: ClassifiedCreative[];
  summary: PipelineSummary;
} | null> {
  const ctx = await getSessionWithOrg();
  if (!ctx) return null;

  const creatives = await prisma.creativeClassification.findMany({
    where: { organizationId: ctx.organization.id },
    orderBy: [{ status: "asc" }, { revenue: "desc" }],
  });

  const byStatus: Record<CreativeStatus, number> = {
    EM_TESTE: 0,
    CAMPEOES_ATIVOS: 0,
    RECICLAGEM: 0,
    DESATIVADOS: 0,
    CAMPEOES_INATIVOS: 0,
  };

  const mapped: ClassifiedCreative[] = creatives.map((c) => {
    byStatus[c.status]++;
    return {
      id: c.id,
      creativeName: c.creativeName,
      status: c.status,
      previousStatus: c.previousStatus,
      roas: Number(c.roas),
      purchases: c.purchases,
      spend: Number(c.spend),
      revenue: Number(c.revenue),
      impressions: c.impressions,
      clicks: c.clicks,
      thumbnailUrl: c.thumbnailUrl,
      lastClassifiedAt: c.lastClassifiedAt,
    };
  });

  return {
    creatives: mapped,
    summary: {
      total: mapped.length,
      byStatus,
    },
  };
}
