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
        const [ordersResult, funnelResult] = await Promise.allSettled([
            syncNuvemshopOrders(orgId),
            syncNuvemshopFunnel(orgId),
        ]);

        const orders = ordersResult.status === "fulfilled" ? ordersResult.value : { error: String(ordersResult.reason) };
        const funnel = funnelResult.status === "fulfilled" ? funnelResult.value : { error: String(funnelResult.reason) };

        return NextResponse.json({ success: true, orders, funnel });
    } catch (error: unknown) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        }, { status: 500 });
    }
}
