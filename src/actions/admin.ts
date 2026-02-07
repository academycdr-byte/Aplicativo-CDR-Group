"use server";

import { prisma } from "@/lib/prisma";
import { getSessionWithOrg } from "@/lib/session";

export async function getAdminStats() {
  const ctx = await getSessionWithOrg();
  if (!ctx || ctx.role !== "OWNER") return null;

  const [
    totalUsers,
    totalOrganizations,
    totalOrders,
    totalIntegrations,
    connectedIntegrations,
    recentSyncLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.order.count(),
    prisma.integration.count(),
    prisma.integration.count({ where: { status: "CONNECTED" } }),
    prisma.syncLog.findMany({
      orderBy: { startedAt: "desc" },
      take: 20,
      include: { organization: { select: { name: true } } },
    }),
  ]);

  return {
    totalUsers,
    totalOrganizations,
    totalOrders,
    totalIntegrations,
    connectedIntegrations,
    recentSyncLogs: recentSyncLogs.map((log) => ({
      id: log.id,
      organizationName: log.organization.name,
      platform: log.platform,
      status: log.status,
      recordsSynced: log.recordsSynced,
      errorMessage: log.errorMessage,
      startedAt: log.startedAt,
      completedAt: log.completedAt,
    })),
  };
}

export async function getAdminOrganizations() {
  const ctx = await getSessionWithOrg();
  if (!ctx || ctx.role !== "OWNER") return [];

  const organizations = await prisma.organization.findMany({
    include: {
      _count: {
        select: {
          memberships: true,
          integrations: true,
          orders: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return organizations.map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    createdAt: org.createdAt,
    memberCount: org._count.memberships,
    integrationCount: org._count.integrations,
    orderCount: org._count.orders,
  }));
}

export async function getFailedSyncs() {
  const ctx = await getSessionWithOrg();
  if (!ctx || ctx.role !== "OWNER") return [];

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const failedSyncs = await prisma.syncLog.findMany({
    where: {
      status: "FAILED",
      startedAt: { gte: twentyFourHoursAgo },
    },
    include: { organization: { select: { name: true } } },
    orderBy: { startedAt: "desc" },
  });

  return failedSyncs.map((log) => ({
    id: log.id,
    organizationName: log.organization.name,
    platform: log.platform,
    errorMessage: log.errorMessage,
    startedAt: log.startedAt,
  }));
}
