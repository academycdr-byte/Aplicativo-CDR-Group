import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getZApiGroups } from "@/lib/zapi";

async function requireAdmin() {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Não autenticado");

    const membership = await prisma.membership.findFirst({
        where: { userId: session.user.id },
    });

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
        throw new Error("Acesso negado");
    }

    return { organizationId: membership.organizationId };
}

// GET - Fetch WhatsApp groups from Z-API
export async function GET() {
    try {
        await requireAdmin();

        if (!process.env.ZAPI_INSTANCE_ID) {
            return NextResponse.json({
                success: false,
                error: "Z-API não configurada"
            }, { status: 500 });
        }

        const data = await getZApiGroups();

        // Z-API returns an array of groups or { groups: [...] }
        const groups = Array.isArray(data) ? data : (data.groups || data);

        const formatted = (Array.isArray(groups) ? groups : []).map((g: any) => ({
            id: g.phone || g.id || g.jid,
            name: g.name || g.subject || "Grupo sem nome",
            participants: g.size || g.participants?.length || 0,
        }));

        return NextResponse.json({
            success: true,
            groups: formatted,
        });
    } catch (error: any) {
        console.error("Fetch groups error:", error);
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 });
    }
}
