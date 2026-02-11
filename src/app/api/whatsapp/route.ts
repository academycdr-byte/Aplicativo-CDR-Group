import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getZApiStatus, getZApiDevice, getZApiQrCode, disconnectZApi } from "@/lib/zapi";

async function requireAdmin() {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Não autenticado");
    }

    const membership = await prisma.membership.findFirst({
        where: { userId: session.user.id },
    });

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
        throw new Error("Acesso negado");
    }

    return { userId: session.user.id, organizationId: membership.organizationId };
}

// GET - Check connection status and get info
export async function GET(request: NextRequest) {
    try {
        const { organizationId } = await requireAdmin();
        const instanceName = `cdr-${organizationId}`;

        if (!process.env.ZAPI_INSTANCE_ID || !process.env.ZAPI_INSTANCE_TOKEN || !process.env.ZAPI_CLIENT_TOKEN) {
            return NextResponse.json({
                status: "DISCONNECTED",
                error: "Z-API não configurada (Variáveis de Ambiente faltando)"
            });
        }

        try {
            // Z-API /status returns: { connected: boolean, error: string | null, smartphoneConnected: boolean }
            const statusData = await getZApiStatus();

            if (statusData.connected) {
                // Fetch device info for phone number and display name
                let phone = "Unknown";
                let pushName = "WhatsApp";
                try {
                    const deviceData = await getZApiDevice();
                    phone = deviceData.phone || "Unknown";
                    pushName = deviceData.name || "WhatsApp";
                } catch (deviceErr) {
                    console.error("Z-API Device info error (non-critical):", deviceErr);
                }

                return NextResponse.json({
                    status: "CONNECTED",
                    instanceName,
                    me: phone,
                    pushName,
                    profilePicUrl: null,
                });
            } else {
                return NextResponse.json({
                    status: "DISCONNECTED",
                    instanceName,
                });
            }
        } catch (error: any) {
            console.error("Z-API Status Error:", error);
            return NextResponse.json({
                status: "DISCONNECTED",
                error: "Erro ao conectar com Z-API: " + error.message
            });
        }
    } catch (error: any) {
        console.error("WhatsApp GET error:", error);
        return NextResponse.json({
            status: "ERROR",
            error: error.message
        }, { status: 500 });
    }
}

// POST - Connect (get QR) or Disconnect
export async function POST(request: NextRequest) {
    try {
        const { organizationId } = await requireAdmin();
        const { action } = await request.json();
        const instanceName = `cdr-${organizationId}`;

        if (action === "create" || action === "init" || action === "connect") {
            try {
                const qrData: any = await getZApiQrCode().catch(async (err) => {
                    const status = await getZApiStatus();
                    if (status.connected) return { connected: true };
                    throw err;
                });

                if (qrData.connected) {
                    return NextResponse.json({
                        success: true,
                        instanceName,
                        qrcode: null,
                        status: "CONNECTED",
                    });
                }

                return NextResponse.json({
                    success: true,
                    instanceName,
                    qrcode: qrData.qrcode,
                    status: "CONNECTING",
                });
            } catch (error: any) {
                console.error("Z-API Connect Error:", error);
                return NextResponse.json({
                    success: false,
                    error: "Erro Z-API: " + error.message
                }, { status: 400 });
            }
        }

        if (action === "disconnect" || action === "delete") {
            try {
                await disconnectZApi();
                return NextResponse.json({
                    success: true,
                    status: "DISCONNECTED",
                });
            } catch (error: any) {
                return NextResponse.json({
                    success: false,
                    error: "Erro ao desconectar Z-API: " + error.message
                }, { status: 400 });
            }
        }

        return NextResponse.json({
            success: false,
            error: "Ação inválida"
        }, { status: 400 });
    } catch (error: any) {
        console.error("WhatsApp POST error:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
