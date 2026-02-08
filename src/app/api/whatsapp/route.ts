import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Evolution API Configuration
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "http://localhost:8080";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "";

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

// GET - Check connection status and get QR code
export async function GET(request: NextRequest) {
    try {
        const { organizationId } = await requireAdmin();
        const instanceName = `cdr-${organizationId}`;

        // Check if environment variables are set
        if (!process.env.EVOLUTION_API_URL) {
            return NextResponse.json({
                status: "DISCONNECTED",
                error: "URL da Evolution API não configurada"
            });
        }

        // Check if instance exists
        const instanceRes = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
            headers: {
                "apikey": EVOLUTION_API_KEY,
            },
        });

        if (!instanceRes.ok) {
            const errorText = await instanceRes.text();
            console.error("Evolution API fetchInstances error:", errorText);
            return NextResponse.json({
                status: "DISCONNECTED",
                error: "Evolution API não disponível ou chave inválida"
            });
        }

        const instances = await instanceRes.json();
        const instance = instances.find((i: any) => i.instance?.instanceName === instanceName);

        if (!instance) {
            return NextResponse.json({
                status: "NOT_CREATED",
                instanceName
            });
        }

        // Get connection state
        const stateRes = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
            headers: {
                "apikey": EVOLUTION_API_KEY,
            },
        });

        if (stateRes.ok) {
            const state = await stateRes.json();

            return NextResponse.json({
                status: state.instance?.state || "DISCONNECTED",
                instanceName,
                me: instance.instance?.owner,
                pushName: instance.instance?.profileName,
                profilePicUrl: instance.instance?.profilePictureUrl,
            });
        }

        return NextResponse.json({
            status: "DISCONNECTED",
            instanceName
        });
    } catch (error: any) {
        console.error("WhatsApp GET error:", error);
        return NextResponse.json({
            status: "ERROR",
            error: error.message
        }, { status: 500 });
    }
}

// POST - Create instance and connect (generate QR)
export async function POST(request: NextRequest) {
    try {
        const { organizationId } = await requireAdmin();
        const { action } = await request.json();
        const instanceName = `cdr-${organizationId}`;

        if (action === "create" || action === "init") {
            // Check if instance exists first to avoid error
            const checkRes = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
                headers: { "apikey": EVOLUTION_API_KEY },
            });

            let instanceExists = false;
            if (checkRes.ok) {
                const instances = await checkRes.json();
                instanceExists = instances.some((i: any) => i.instance?.instanceName === instanceName);
            }

            if (!instanceExists) {
                // Create new instance
                const createRes = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "apikey": EVOLUTION_API_KEY,
                    },
                    body: JSON.stringify({
                        instanceName,
                        qrcode: true,
                        integration: "WHATSAPP-BAILEYS",
                    }),
                });

                if (!createRes.ok) {
                    const error = await createRes.text();
                    console.error("Create instance error:", error);
                    return NextResponse.json({
                        success: false,
                        error: "Erro ao criar instância: " + error
                    }, { status: 400 });
                }

                const data = await createRes.json();

                return NextResponse.json({
                    success: true,
                    instanceName,
                    qrcode: data.qrcode?.base64 || null,
                    status: "CONNECTING",
                });
            } else {
                // Instance forces exist, so connect
                // Fall through to connect logic if action was 'init'
                // Or just return error if action was explicitly 'create'
                if (action === "create") {
                    return NextResponse.json({
                        success: false,
                        error: "Instância já existe"
                    }, { status: 400 });
                }
            }
        }

        if (action === "connect" || action === "init") {
            // Connect existing instance (get new QR)
            const connectRes = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
                headers: {
                    "apikey": EVOLUTION_API_KEY,
                },
            });

            if (!connectRes.ok) {
                const errorText = await connectRes.text();
                // Check if error is specifically about instance not existing
                if (errorText.includes("Instance not found") || errorText.includes("does not exist")) {
                    // If init, try to create (recursive call via separate logic, simpler to just error here for now as UI handles it via 'init' logic above)
                    // Actually, if we are here via 'init', it means instance check PASSED (it existed).
                    // So this error is unexpected.
                    return NextResponse.json({
                        success: false,
                        error: "Erro ao conectar: Instância não encontrada"
                    }, { status: 400 });
                }

                return NextResponse.json({
                    success: false,
                    error: "Erro ao conectar: " + errorText
                }, { status: 400 });
            }

            const data = await connectRes.json();

            return NextResponse.json({
                success: true,
                instanceName,
                qrcode: data.base64 || null,
                status: "CONNECTING",
            });
        }

        if (action === "disconnect") {
            // Logout from WhatsApp
            const logoutRes = await fetch(`${EVOLUTION_API_URL}/instance/logout/${instanceName}`, {
                method: "DELETE",
                headers: {
                    "apikey": EVOLUTION_API_KEY,
                },
            });

            return NextResponse.json({
                success: true,
                status: "DISCONNECTED",
            });
        }

        if (action === "delete") {
            // Delete instance completely
            await fetch(`${EVOLUTION_API_URL}/instance/delete/${instanceName}`, {
                method: "DELETE",
                headers: {
                    "apikey": EVOLUTION_API_KEY,
                },
            });

            return NextResponse.json({
                success: true,
                status: "DELETED",
            });
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
