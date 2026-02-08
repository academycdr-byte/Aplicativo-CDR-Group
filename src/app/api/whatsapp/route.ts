import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getZApiStatus, getZApiQrCode, disconnectZApi } from "@/lib/zapi"; // Import Z-API helpers

// Z-API Configuration
// These are now handled inside lib/zapi.ts using process.env directly
// But we still need requireAdmin for security

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
        const instanceName = `cdr-${organizationId}`; // Keep this for logging/context even if unused by Z-API

        // Check env vars
        if (!process.env.ZAPI_INSTANCE_ID || !process.env.ZAPI_INSTANCE_TOKEN || !process.env.ZAPI_CLIENT_TOKEN) {
            return NextResponse.json({
                status: "DISCONNECTED",
                error: "Z-API não configurada (Variáveis de Ambiente faltando)"
            });
        }

        try {
            const statusData = await getZApiStatus();

            if (statusData.connected) {
                return NextResponse.json({
                    status: "CONNECTED",
                    instanceName,
                    me: statusData.smartphone?.phone || "Unknown",
                    pushName: statusData.smartphone?.pushName || "WhatsApp Business",
                    profilePicUrl: null, // Z-API might not return profile pic URL easily in status
                });
            } else {
                return NextResponse.json({
                    status: "DISCONNECTED",
                    instanceName
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
            // In Z-API, "create" and "connect" are the same: Get the QR Code image
            try {
                // First check status to avoid generating QR if already connected
                // Actually getZApiQrCode handles this check internally in our helper or just returns QR

                const qrData: any = await getZApiQrCode().catch(async (err) => {
                    // If error, check if it's because already connected
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

                // If not connected, we have QR base64
                // Z-API returns image buffer which we converted to base64 in lib/zapi.ts
                return NextResponse.json({
                    success: true,
                    instanceName,
                    qrcode: qrData.qrcode, // Base64 image string
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
            // Disconnect Z-API
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
