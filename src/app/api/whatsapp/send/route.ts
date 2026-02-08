import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendZApiText } from "@/lib/zapi"; // Import Z-API helper

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

// Format phone number for WhatsApp (Z-API prefers 55DDD9XXXXXXXX or 55DDDXXXXXXXX)
function formatPhoneNumber(phone: string): string {
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, "");

    // Add Brazil country code if not present
    if (cleaned.length === 11) {
        cleaned = "55" + cleaned;
    } else if (cleaned.length === 10) {
        // Add 9 for mobile (old format - though most gateways prefer clean numbers)
        // Z-API handles this well, but standardizing to 55 + 11 digits is safest
        cleaned = "55" + cleaned.substring(0, 2) + "9" + cleaned.substring(2);
    }

    return cleaned;
}

// POST - Send message
export async function POST(request: NextRequest) {
    try {
        const { organizationId } = await requireAdmin();
        const { phone, message, groupId } = await request.json(); // groupId not fully supported in this Z-API helper yet, strictly text for now

        // Check env vars
        if (!process.env.ZAPI_INSTANCE_ID) {
            return NextResponse.json({
                success: false,
                error: "Z-API não configurada"
            }, { status: 500 });
        }

        const targetPhone = groupId ? groupId : formatPhoneNumber(phone);

        // Use Z-API helper
        const result = await sendZApiText(targetPhone, message);

        return NextResponse.json({
            success: true,
            messageId: result.messageId || "sent",
        });
    } catch (error: any) {
        console.error("Send message error:", error);
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 });
    }
}
