import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = session.user.id;
    const sessionOrgId = session.user.organizationId;

    // 1. All memberships for this user
    const memberships = await prisma.membership.findMany({
        where: { userId },
        include: { organization: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
    });

    // 2. Active org (same logic as getSessionWithOrg)
    const activeMembership = memberships.find((m) => m.organizationId === sessionOrgId) || memberships[0];
    const orgId = activeMembership?.organizationId;

    if (!orgId) {
        return NextResponse.json({
            error: "No organization found",
            userId,
            sessionOrgId,
            memberships: memberships.map((m) => ({ orgId: m.organizationId, orgName: m.organization.name, role: m.role })),
        });
    }

    // 3. All integrations for this org
    const integrations = await prisma.integration.findMany({
        where: { organizationId: orgId },
        select: {
            platform: true,
            status: true,
            syncStatus: true,
            lastSyncAt: true,
            errorMessage: true,
            externalStoreId: true,
            externalAccountId: true,
            metadata: true,
            updatedAt: true,
        },
    });

    // 4. Recent sync logs
    const syncLogs = await prisma.syncLog.findMany({
        where: { organizationId: orgId },
        orderBy: { startedAt: "desc" },
        take: 10,
        select: {
            platform: true,
            status: true,
            recordsSynced: true,
            errorMessage: true,
            startedAt: true,
            completedAt: true,
        },
    });

    // 5. Data counts
    const [orderCount, adMetricCount, oldestOrder, newestOrder, oldestAdMetric, newestAdMetric] = await Promise.all([
        prisma.order.count({ where: { organizationId: orgId } }),
        prisma.adMetric.count({ where: { organizationId: orgId } }),
        prisma.order.findFirst({ where: { organizationId: orgId }, orderBy: { orderDate: "asc" }, select: { orderDate: true } }),
        prisma.order.findFirst({ where: { organizationId: orgId }, orderBy: { orderDate: "desc" }, select: { orderDate: true } }),
        prisma.adMetric.findFirst({ where: { organizationId: orgId }, orderBy: { date: "asc" }, select: { date: true } }),
        prisma.adMetric.findFirst({ where: { organizationId: orgId }, orderBy: { date: "desc" }, select: { date: true } }),
    ]);

    return NextResponse.json({
        session: {
            userId,
            email: session.user.email,
            sessionOrgId,
            resolvedOrgId: orgId,
            orgMatch: sessionOrgId === orgId,
        },
        organization: {
            id: orgId,
            name: activeMembership.organization.name,
        },
        memberships: memberships.map((m) => ({
            orgId: m.organizationId,
            orgName: m.organization.name,
            role: m.role,
        })),
        integrations: integrations.map((i) => ({
            platform: i.platform,
            status: i.status,
            syncStatus: i.syncStatus,
            lastSyncAt: i.lastSyncAt,
            errorMessage: i.errorMessage,
            externalStoreId: i.externalStoreId || null,
            externalAccountId: i.externalAccountId || null,
            hasSyncCursor: !!(i.metadata as Record<string, unknown>)?.syncCursor,
            updatedAt: i.updatedAt,
        })),
        syncLogs,
        dataCounts: {
            orders: orderCount,
            orderDateRange: orderCount > 0 ? { oldest: oldestOrder?.orderDate, newest: newestOrder?.orderDate } : null,
            adMetrics: adMetricCount,
            adMetricDateRange: adMetricCount > 0 ? { oldest: oldestAdMetric?.date, newest: newestAdMetric?.date } : null,
        },
    });
}
