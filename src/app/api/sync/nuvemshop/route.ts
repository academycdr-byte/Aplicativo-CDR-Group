import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { syncNuvemshopOrders } from "@/lib/integrations/nuvemshop";

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
        // Orders-only sync — must complete within Vercel 10s timeout
        const ordersResult = await syncNuvemshopOrders(orgId);

        return NextResponse.json({
            success: !("error" in ordersResult && ordersResult.error),
            orders: ordersResult,
        });
    } catch (error: unknown) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        }, { status: 500 });
    }
}
