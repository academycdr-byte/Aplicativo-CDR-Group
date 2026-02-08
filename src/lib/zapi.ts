export async function getZApiStatus() {
    const instanceId = process.env.ZAPI_INSTANCE_ID;
    const token = process.env.ZAPI_INSTANCE_TOKEN;
    const clientToken = process.env.ZAPI_CLIENT_TOKEN;

    if (!instanceId || !token || !clientToken) {
        throw new Error("Credenciais Z-API não configuradas");
    }

    const response = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/status`, {
        headers: {
            "Content-Type": "application/json",
            "Client-Token": clientToken
        }
    });

    if (!response.ok) {
        throw new Error(`Erro ao verificar status Z-API: ${response.statusText}`);
    }

    const data = await response.json();
    return data; // { connected: boolean, smartphone: { ... } }
}

export async function getZApiQrCode() {
    const instanceId = process.env.ZAPI_INSTANCE_ID;
    const token = process.env.ZAPI_INSTANCE_TOKEN;
    const clientToken = process.env.ZAPI_CLIENT_TOKEN;

    if (!instanceId || !token || !clientToken) {
        throw new Error("Credenciais Z-API não configuradas");
    }

    // Get QR Code as Image
    const response = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/qr-code/image`, {
        headers: {
            "Client-Token": clientToken
        }
    });

    if (!response.ok) {
        // Log detailed error for debugging
        const text = await response.text();
        console.error("Z-API QR Error:", text);

        // Handle specific error: Instance already connected
        if (text.includes("Instance already connected")) {
            return { connected: true };
        }

        throw new Error(`Erro ao obter QR Code Z-API: ${response.statusText}`);
    }

    // Z-API returns raw image buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    return {
        connected: false,
        qrcode: `data:image/png;base64,${base64}`
    };
}

export async function sendZApiText(phone: string, message: string) {
    const instanceId = process.env.ZAPI_INSTANCE_ID;
    const token = process.env.ZAPI_INSTANCE_TOKEN;
    const clientToken = process.env.ZAPI_CLIENT_TOKEN;

    if (!instanceId || !token || !clientToken) {
        throw new Error("Credenciais Z-API não configuradas");
    }

    const response = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Client-Token": clientToken
        },
        body: JSON.stringify({
            phone: phone, // Z-API handles raw numbers usually, but we should ensure format
            message: message
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Erro ao enviar mensagem Z-API: ${error}`);
    }

    return await response.json();
}

export async function disconnectZApi() {
    const instanceId = process.env.ZAPI_INSTANCE_ID;
    const token = process.env.ZAPI_INSTANCE_TOKEN;
    const clientToken = process.env.ZAPI_CLIENT_TOKEN;

    if (!instanceId || !token || !clientToken) {
        throw new Error("Credenciais Z-API não configuradas");
    }

    const response = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/disconnect`, {
        headers: {
            "Client-Token": clientToken
        }
    });

    // Z-API usually returns empty body on success or 200
    if (!response.ok) {
        // Check if already disconnected
        return { success: false };
    }

    return { success: true };
}
