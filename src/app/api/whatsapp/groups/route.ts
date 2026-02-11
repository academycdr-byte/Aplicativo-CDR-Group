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

        // Z-API /groups returns a flat array:
        // [{ isGroup, name, phone, unread, lastMessageTime, isMuted, isMarkedSpam, archived, pinned }]
        // Handle both array and object wrapper formats for safety
        let rawGroups: any[];
        if (Array.isArray(data)) {
            rawGroups = data;
        } else if (data && typeof data === "object") {
            // Some Z-API versions may wrap in { groups: [...] } or similar
            rawGroups = data.groups || data.data || [];
            if (!Array.isArray(rawGroups)) {
                console.error("Z-API Groups: unexpected response structure:", JSON.stringify(data).substring(0, 500));
                rawGroups = [];
            }
        } else {
            rawGroups = [];
        }

        // Filter only actual groups and map to our format
        const formatted = rawGroups
            .filter((g: any) => g.isGroup !== false) // Keep groups (isGroup=true or undefined)
            .map((g: any) => ({
                id: g.phone || g.id || g.jid || "",
                name: g.name || g.subject || "Grupo sem nome",
                // Z-API /groups doesn't return participant count - only available via /group-metadata
                participants: g.size || (Array.isArray(g.participants) ? g.participants.length : 0),
            }))
            .filter((g: any) => g.id); // Remove entries without an ID

        return NextResponse.json({
            success: true,
            groups: formatted,
        });
    } catch (error: any) {
        console.error("Fetch groups error:", error);
        return NextResponse.json({
            success: false,
            error: error.message || "Erro desconhecido ao buscar grupos",
        }, { status: 500 });
    }
}
