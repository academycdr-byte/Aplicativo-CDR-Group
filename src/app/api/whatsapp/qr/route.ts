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

// GET - Fetch current QR code
export async function GET(request: NextRequest) {
    try {
        const { organizationId } = await requireAdmin();
        const instanceName = `cdr-${organizationId}`;

        // First check connection state
        const stateRes = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
            headers: { "apikey": EVOLUTION_API_KEY },
        });

        if (stateRes.ok) {
            const state = await stateRes.json();

            // If connected, no need for QR
            if (state.instance?.state === "open") {
                return NextResponse.json({
                    status: "CONNECTED",
                    qrcode: null,
                });
            }
        }

        // Get QR code
        const qrRes = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
            headers: { "apikey": EVOLUTION_API_KEY },
        });

        if (!qrRes.ok) {
            return NextResponse.json({
                status: "ERROR",
                error: "Não foi possível obter QR Code",
            }, { status: 400 });
        }

        const data = await qrRes.json();

        return NextResponse.json({
            status: "CONNECTING",
            qrcode: data.base64 || null,
            pairingCode: data.pairingCode || null,
        });
    } catch (error: any) {
        console.error("QR GET error:", error);
        return NextResponse.json({
            status: "ERROR",
            error: error.message
        }, { status: 500 });
    }
}
