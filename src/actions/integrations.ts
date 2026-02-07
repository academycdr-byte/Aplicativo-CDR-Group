"use server";

import { prisma } from "@/lib/prisma";
import { getSessionWithOrg } from "@/lib/session";
import { encrypt, decrypt } from "@/lib/encryption";
import { Platform } from "@prisma/client";
import { validateShopifyAccessToken } from "@/lib/integrations/shopify";

export async function getIntegrations() {
  const ctx = await getSessionWithOrg();
  if (!ctx) return [];

  const integrations = await prisma.integration.findMany({
    where: { organizationId: ctx.organization.id },
    orderBy: { createdAt: "desc" },
  });

  return integrations.map((i) => ({
    id: i.id,
    platform: i.platform,
    status: i.status,
    lastSyncAt: i.lastSyncAt,
    syncStatus: i.syncStatus,
    errorMessage: i.errorMessage,
    createdAt: i.createdAt,
    metadata: i.metadata as Record<string, unknown> | null,
  }));
}

export async function connectApiKeyIntegration(data: {
  platform: Platform;
  apiKey: string;
  apiSecret?: string;
  externalStoreId?: string;
}) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { error: "Nao autenticado." };

  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    return { error: "Voce nao tem permissao para gerenciar integracoes." };
  }

  // Check if integration already exists
  const existing = await prisma.integration.findUnique({
    where: {
      organizationId_platform: {
        organizationId: ctx.organization.id,
        platform: data.platform,
      },
    },
  });

  const encryptedKey = encrypt(data.apiKey);
  const encryptedSecret = data.apiSecret ? encrypt(data.apiSecret) : null;

  if (existing) {
    await prisma.integration.update({
      where: { id: existing.id },
      data: {
        apiKey: encryptedKey,
        apiSecret: encryptedSecret,
        externalStoreId: data.externalStoreId,
        status: "CONNECTED",
        errorMessage: null,
      },
    });
  } else {
    await prisma.integration.create({
      data: {
        organizationId: ctx.organization.id,
        platform: data.platform,
        apiKey: encryptedKey,
        apiSecret: encryptedSecret,
        externalStoreId: data.externalStoreId,
        status: "CONNECTED",
      },
    });
  }

  return { success: true };
}

export async function connectShopifyDirect(shop: string, accessToken: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { error: "Nao autenticado." };

  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    return { error: "Voce nao tem permissao para gerenciar integracoes." };
  }

  // Normalizar dominio
  let domain = shop.trim().toLowerCase();
  if (!domain.includes(".myshopify.com")) {
    domain = `${domain}.myshopify.com`;
  }

  const token = accessToken.trim();
  if (!token) {
    return { error: "Access Token e obrigatorio." };
  }

  try {
    // Validar token fazendo chamada de teste a API da Shopify
    const validation = await validateShopifyAccessToken(domain, token);

    if (!validation.valid) {
      return { error: validation.error || "Token invalido." };
    }

    // Salvar integracao
    await prisma.integration.upsert({
      where: {
        organizationId_platform: {
          organizationId: ctx.organization.id,
          platform: "SHOPIFY",
        },
      },
      create: {
        organizationId: ctx.organization.id,
        platform: "SHOPIFY",
        status: "CONNECTED",
        accessToken: encrypt(token),
        externalStoreId: domain,
      },
      update: {
        status: "CONNECTED",
        accessToken: encrypt(token),
        externalStoreId: domain,
        errorMessage: null,
      },
    });

    return { success: true, shopName: validation.shopName };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return { error: `Erro ao conectar Shopify: ${msg}` };
  }
}

export async function disconnectIntegration(platform: Platform) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { error: "Nao autenticado." };

  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    return { error: "Voce nao tem permissao para gerenciar integracoes." };
  }

  const integration = await prisma.integration.findUnique({
    where: {
      organizationId_platform: {
        organizationId: ctx.organization.id,
        platform,
      },
    },
  });

  if (!integration) {
    return { error: "Integracao nao encontrada." };
  }

  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      status: "DISCONNECTED",
      accessToken: null,
      refreshToken: null,
      apiKey: null,
      apiSecret: null,
    },
  });

  return { success: true };
}

export async function selectFacebookAdAccount(accountId: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { error: "Nao autenticado." };

  const integration = await prisma.integration.findUnique({
    where: {
      organizationId_platform: {
        organizationId: ctx.organization.id,
        platform: "FACEBOOK_ADS",
      },
    },
  });

  if (!integration || !integration.accessToken) {
    return { error: "Facebook Ads nao conectado. Faca login novamente." };
  }

  // Validate that the accountId is in the list of available accounts
  const metadata = integration.metadata as { adAccounts?: { id: string; name: string }[] } | null;
  const accounts = metadata?.adAccounts || [];
  const selected = accounts.find((a) => a.id === accountId);

  if (!selected) {
    return { error: "Conta de anuncio nao encontrada." };
  }

  // Update integration with selected account
  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      status: "CONNECTED",
      externalAccountId: accountId.replace("act_", ""),
      errorMessage: null,
    },
  });

  return { success: true, accountName: selected.name };
}

export async function getIntegrationCredentials(platform: Platform) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return null;

  const integration = await prisma.integration.findUnique({
    where: {
      organizationId_platform: {
        organizationId: ctx.organization.id,
        platform,
      },
    },
  });

  if (!integration) return null;

  return {
    apiKey: integration.apiKey ? decrypt(integration.apiKey) : null,
    apiSecret: integration.apiSecret ? decrypt(integration.apiSecret) : null,
    accessToken: integration.accessToken ? decrypt(integration.accessToken) : null,
    refreshToken: integration.refreshToken ? decrypt(integration.refreshToken) : null,
    externalStoreId: integration.externalStoreId,
    externalAccountId: integration.externalAccountId,
  };
}
