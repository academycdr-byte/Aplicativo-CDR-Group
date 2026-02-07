import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "http://localhost:8080";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "";

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

// Format phone number for WhatsApp
function formatPhoneNumber(phone: string): string {
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, "");

    // Add Brazil country code if not present
    if (cleaned.length === 11) {
        cleaned = "55" + cleaned;
    } else if (cleaned.length === 10) {
        // Add 9 for mobile (old format)
        cleaned = "55" + cleaned.substring(0, 2) + "9" + cleaned.substring(2);
    }

    return cleaned;
}

// POST - Send message
export async function POST(request: NextRequest) {
    try {
        const { organizationId } = await requireAdmin();
        const { phone, message, groupId } = await request.json();
        const instanceName = `cdr-${organizationId}`;

        // Send to group or individual
        const endpoint = groupId
            ? `${EVOLUTION_API_URL}/message/sendText/${instanceName}`
            : `${EVOLUTION_API_URL}/message/sendText/${instanceName}`;

        const payload = groupId
            ? {
                number: groupId,
                text: message,
            }
            : {
                number: formatPhoneNumber(phone),
                text: message,
            };

        const sendRes = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "apikey": EVOLUTION_API_KEY,
            },
            body: JSON.stringify(payload),
        });

        if (!sendRes.ok) {
            const error = await sendRes.text();
            console.error("Send message error:", error);
            return NextResponse.json({
                success: false,
                error: "Erro ao enviar mensagem",
            }, { status: 400 });
        }

        const result = await sendRes.json();

        return NextResponse.json({
            success: true,
            messageId: result.key?.id,
        });
    } catch (error: any) {
        console.error("Send message error:", error);
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 });
    }
}
