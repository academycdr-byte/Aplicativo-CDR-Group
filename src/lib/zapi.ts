// Z-API base URL builder
function getBaseUrl() {
    const instanceId = process.env.ZAPI_INSTANCE_ID;
    const token = process.env.ZAPI_INSTANCE_TOKEN;
    const clientToken = process.env.ZAPI_CLIENT_TOKEN;

    if (!instanceId || !token || !clientToken) {
        throw new Error("Credenciais Z-API não configuradas");
    }

    return {
        baseUrl: `https://api.z-api.io/instances/${instanceId}/token/${token}`,
        clientToken,
    };
}

/**
 * Check connection status
 * Z-API returns: { connected: boolean, error: string | null, smartphoneConnected: boolean }
 */
export async function getZApiStatus() {
    const { baseUrl, clientToken } = getBaseUrl();

    const response = await fetch(`${baseUrl}/status`, {
        headers: {
            "Content-Type": "application/json",
            "Client-Token": clientToken,
        },
    });

    if (!response.ok) {
        const text = await response.text();
        console.error("Z-API Status Error:", response.status, text);
        throw new Error(`Erro ao verificar status Z-API: ${response.status} ${response.statusText}`);
    }

    return await response.json();
}

/**
 * Get device/phone info of the connected number
 * Z-API returns: { phone, imgUrl, about, name, device: { sessionName, device_model }, isBusiness }
 */
export async function getZApiDevice() {
    const { baseUrl, clientToken } = getBaseUrl();

    const response = await fetch(`${baseUrl}/device`, {
        headers: {
            "Content-Type": "application/json",
            "Client-Token": clientToken,
        },
    });

    if (!response.ok) {
        const text = await response.text();
        console.error("Z-API Device Error:", response.status, text);
        throw new Error(`Erro ao buscar dados do dispositivo Z-API: ${response.status}`);
    }

    return await response.json();
}

/**
 * Get QR Code as base64 image
 */
export async function getZApiQrCode() {
    const { baseUrl, clientToken } = getBaseUrl();

    const response = await fetch(`${baseUrl}/qr-code/image`, {
        headers: {
            "Client-Token": clientToken,
        },
    });

    if (!response.ok) {
        const text = await response.text();
        console.error("Z-API QR Error:", response.status, text);

        if (text.includes("Instance already connected") || text.includes("already connected")) {
            return { connected: true };
        }

        throw new Error(`Erro ao obter QR Code Z-API: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");

    return {
        connected: false,
        qrcode: `data:image/png;base64,${base64}`,
    };
}

/**
 * Send text message to phone or group
 * For groups, pass the group phone/id (e.g. "120263358412332916-group")
 */
export async function sendZApiText(phone: string, message: string) {
    const { baseUrl, clientToken } = getBaseUrl();

    const response = await fetch(`${baseUrl}/send-text`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Client-Token": clientToken,
        },
        body: JSON.stringify({ phone, message }),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error("Z-API Send Error:", response.status, error);
        throw new Error(`Erro ao enviar mensagem Z-API: ${error}`);
    }

    return await response.json();
}

/**
 * Fetch WhatsApp groups
 * Z-API returns array: [{ isGroup, name, phone, unread, lastMessageTime, ... }]
 * The "phone" field is the group ID used for sending messages
 */
export async function getZApiGroups() {
    const { baseUrl, clientToken } = getBaseUrl();

    const response = await fetch(`${baseUrl}/groups?page=1&pageSize=200`, {
        headers: {
            "Content-Type": "application/json",
            "Client-Token": clientToken,
        },
    });

    if (!response.ok) {
        const text = await response.text();
        console.error("Z-API Groups Error:", response.status, text);
        throw new Error(`Erro ao buscar grupos Z-API: ${response.status} - ${text}`);
    }

    const data = await response.json();
    console.log("Z-API Groups raw response type:", typeof data, Array.isArray(data) ? `array[${data.length}]` : "object");

    return data;
}

/**
 * Disconnect the Z-API instance
 */
export async function disconnectZApi() {
    const { baseUrl, clientToken } = getBaseUrl();

    const response = await fetch(`${baseUrl}/disconnect`, {
        headers: {
            "Client-Token": clientToken,
        },
    });

    if (!response.ok) {
        return { success: false };
    }

    return { success: true };
}
