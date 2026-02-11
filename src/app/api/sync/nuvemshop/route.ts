import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { syncNuvemshopOrders, syncNuvemshopFunnel } from "@/lib/integrations/nuvemshop";

export const maxDuration = 60;

export async function POST() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const membership = await prisma.membership.findFirst({
        where: { userId: session.user.id },
    });

    if (!membership) {
        return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const orgId = membership.organizationId;

    try {
        // Run orders sync FIRST (priority) — sequential to avoid doubling time
        const ordersResult = await syncNuvemshopOrders(orgId);

        // Only run funnel if orders succeeded (and we have time left)
        let funnelResult: unknown = { skipped: true };
        if ("success" in ordersResult && ordersResult.success) {
            try {
                funnelResult = await syncNuvemshopFunnel(orgId);
            } catch {
                funnelResult = { error: "funnel sync failed" };
            }
        }

        return NextResponse.json({
            success: !("error" in ordersResult && ordersResult.error),
            orders: ordersResult,
            funnel: funnelResult,
        });
    } catch (error: unknown) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        }, { status: 500 });
    }
}
