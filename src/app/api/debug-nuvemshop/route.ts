import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { parseOrderDate } from "@/lib/date-utils";

export const maxDuration = 60;

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const membership = await prisma.membership.findFirst({
        where: { userId: session.user.id },
    });

    if (!membership) {
        return NextResponse.json({ error: "No membership" }, { status: 400 });
    }

    const orgId = membership.organizationId;

    // 1. Get integration
    const integration = await prisma.integration.findUnique({
        where: { organizationId_platform: { organizationId: orgId, platform: "NUVEMSHOP" } },
    });

    if (!integration || !integration.accessToken) {
        return NextResponse.json({ error: "No integration" });
    }

    // 2. Decrypt + fetch 3 orders
    const accessToken = decrypt(integration.accessToken);
    const storeId = integration.externalStoreId || "";

    const res = await fetch(
        `https://api.nuvemshop.com.br/v1/${storeId}/orders?per_page=3&page=1`,
        {
            headers: {
                Authentication: `bearer ${accessToken}`,
                "User-Agent": "CDR Group Hub (cdrgroup.com)",
                "Content-Type": "application/json",
            },
        }
    );

    if (!res.ok) {
        return NextResponse.json({ error: `API ${res.status}`, body: await res.text() });
    }

    const orders = await res.json();
    if (!Array.isArray(orders) || orders.length === 0) {
        return NextResponse.json({ result: "0 orders from API" });
    }

    // 3. Try writing each order
    const results: Record<string, unknown>[] = [];
    for (const raw of orders) {
        const customer = raw.customer as Record<string, unknown> | null;
        const products = raw.products as Array<Record<string, unknown>> | undefined;
        const lineItems = (products || []).map((p: Record<string, unknown>) => ({
            product_id: String(p.product_id ?? ""),
            variant_id: String(p.variant_id ?? ""),
            name: String(p.name ?? ""),
            quantity: Number(p.quantity ?? 0),
            price: String(p.price ?? "0"),
            sku: String(p.sku ?? ""),
        }));

        try {
            const written = await prisma.order.upsert({
                where: {
                    organizationId_platform_externalOrderId: {
                        organizationId: orgId,
                        platform: "NUVEMSHOP",
                        externalOrderId: String(raw.id),
                    },
                },
                create: {
                    organizationId: orgId,
                    platform: "NUVEMSHOP",
                    externalOrderId: String(raw.id),
                    status: raw.payment_status || "pending",
                    customerName: (customer?.name as string) || null,
                    customerEmail: (customer?.email as string) || null,
                    totalAmount: parseFloat(String(raw.total || "0")),
                    currency: raw.currency || "BRL",
                    itemCount: products?.length || 0,
                    orderDate: parseOrderDate(String(raw.created_at)),
                    rawData: { ...raw, line_items: lineItems } as object,
                },
                update: {
                    status: raw.payment_status || "pending",
                    totalAmount: parseFloat(String(raw.total || "0")),
                },
            });
            results.push({ id: raw.id, dbId: written.id, ok: true });
        } catch (err: unknown) {
            results.push({
                id: raw.id,
                ok: false,
                error: err instanceof Error ? err.message : "unknown",
            });
        }
    }

    // 4. Count
    const count = await prisma.order.count({
        where: { organizationId: orgId, platform: "NUVEMSHOP" },
    });

    return NextResponse.json({ ordersFromApi: orders.length, writeResults: results, totalInDb: count });
}
