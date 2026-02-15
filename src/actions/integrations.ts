"use server";

import { prisma } from "@/lib/prisma";
import { getSessionWithOrg } from "@/lib/session";
import { encrypt, decrypt } from "@/lib/encryption";
import { Platform, Prisma } from "@prisma/client";
import { validateShopifyAccessToken } from "@/lib/integrations/shopify";
import { validateCartpandaCredentials } from "@/lib/integrations/cartpanda";

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
  if (!ctx) return { error: "Não autenticado." };

  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    return { error: "Você não tem permissão para gerenciar integrações." };
  }

  // Validate Cartpanda credentials before saving
  if (data.platform === "CARTPANDA" && data.apiKey && data.externalStoreId) {
    const validation = await validateCartpandaCredentials(data.apiKey, data.externalStoreId);
    if (!validation.valid) {
      return { error: validation.error || "Credenciais da Cartpanda inválidas." };
    }
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

export async function saveShopifyCredentials(shop: string, clientId: string, clientSecret: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { error: "Não autenticado." };

  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    return { error: "Você não tem permissão para gerenciar integrações." };
  }

  let domain = shop.trim().toLowerCase();
  if (!domain.includes(".myshopify.com")) {
    domain = `${domain}.myshopify.com`;
  }

  if (!clientId.trim() || !clientSecret.trim()) {
    return { error: "Client ID e Client Secret são obrigatórios." };
  }

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
      status: "PENDING",
      apiKey: encrypt(clientId.trim()),
      apiSecret: encrypt(clientSecret.trim()),
      externalStoreId: domain,
    },
    update: {
      status: "PENDING",
      apiKey: encrypt(clientId.trim()),
      apiSecret: encrypt(clientSecret.trim()),
      externalStoreId: domain,
      errorMessage: null,
    },
  });

  return { success: true, domain };
}

export async function connectShopifyDirect(shop: string, accessToken: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { error: "Não autenticado." };

  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    return { error: "Você não tem permissão para gerenciar integrações." };
  }

  // Normalizar domínio
  let domain = shop.trim().toLowerCase();
  if (!domain.includes(".myshopify.com")) {
    domain = `${domain}.myshopify.com`;
  }

  const token = accessToken.trim();
  if (!token) {
    return { error: "Access Token é obrigatório." };
  }

  try {
    // Validar token fazendo chamada de teste a API da Shopify
    const validation = await validateShopifyAccessToken(domain, token);

    if (!validation.valid) {
      return { error: validation.error || "Token inválido." };
    }

    // Salvar integração
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
  if (!ctx) return { error: "Não autenticado." };

  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    return { error: "Você não tem permissão para gerenciar integrações." };
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
    return { error: "Integração não encontrada." };
  }

  // Delete all data associated with this platform
  const orgId = ctx.organization.id;
  const isAdPlatform = ["FACEBOOK_ADS", "GOOGLE_ADS"].includes(platform);
  const isOrderPlatform = ["SHOPIFY", "CARTPANDA", "YAMPI", "NUVEMSHOP"].includes(platform);

  await prisma.$transaction([
    // Delete orders for order platforms
    ...(isOrderPlatform
      ? [prisma.order.deleteMany({ where: { organizationId: orgId, platform } })]
      : []),
    // Delete ad metrics for ad platforms
    ...(isAdPlatform
      ? [prisma.adMetric.deleteMany({ where: { organizationId: orgId, platform } })]
      : []),
    // Delete analytics metrics for Google Analytics
    ...(platform === "GOOGLE_ANALYTICS"
      ? [prisma.analyticsMetric.deleteMany({ where: { organizationId: orgId } })]
      : []),
    // Delete reportana events if applicable
    ...(platform === "REPORTANA"
      ? [prisma.reportanaEvent.deleteMany({ where: { organizationId: orgId } })]
      : []),
    // Delete sync logs for this platform
    prisma.syncLog.deleteMany({ where: { organizationId: orgId, platform } }),
    // Update integration status
    prisma.integration.update({
      where: { id: integration.id },
      data: {
        status: "DISCONNECTED",
        accessToken: null,
        refreshToken: null,
        apiKey: null,
        apiSecret: null,
        externalAccountId: null,
        externalStoreId: null,
        metadata: Prisma.JsonNull,
        lastSyncAt: null,
        syncStatus: "IDLE",
        errorMessage: null,
      },
    }),
  ]);

  return { success: true };
}

export async function selectFacebookAdAccount(accountId: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { error: "Não autenticado." };

  const integration = await prisma.integration.findUnique({
    where: {
      organizationId_platform: {
        organizationId: ctx.organization.id,
        platform: "FACEBOOK_ADS",
      },
    },
  });

  if (!integration || !integration.accessToken) {
    return { error: "Facebook Ads não conectado. Faça login novamente." };
  }

  // Validate that the accountId is in the list of available accounts
  const metadata = integration.metadata as { adAccounts?: { id: string; name: string }[]; selectedAccounts?: { id: string; name: string }[] } | null;
  const accounts = metadata?.adAccounts || [];
  const selected = accounts.find((a) => a.id === accountId);

  if (!selected) {
    return { error: "Conta de anúncio não encontrada." };
  }

  // Update integration with selected account (primary account for backward compat)
  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      status: "CONNECTED",
      externalAccountId: accountId.replace("act_", ""),
      errorMessage: null,
      metadata: {
        ...(metadata || {}),
        selectedAccounts: [{ id: selected.id, name: selected.name }],
      },
    },
  });

  return { success: true, accountName: selected.name };
}

/**
 * Select multiple Facebook Ads accounts for an organization.
 */
export async function selectMultipleFacebookAdAccounts(accountIds: string[]) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { error: "Não autenticado." };

  const integration = await prisma.integration.findUnique({
    where: {
      organizationId_platform: {
        organizationId: ctx.organization.id,
        platform: "FACEBOOK_ADS",
      },
    },
  });

  if (!integration || !integration.accessToken) {
    return { error: "Facebook Ads não conectado. Faça login novamente." };
  }

  const metadata = integration.metadata as { adAccounts?: { id: string; name: string }[]; selectedAccounts?: { id: string; name: string }[] } | null;
  const allAccounts = metadata?.adAccounts || [];

  const selectedAccounts = accountIds
    .map((id) => allAccounts.find((a) => a.id === id))
    .filter((a): a is { id: string; name: string } => a !== undefined);

  if (selectedAccounts.length === 0) {
    return { error: "Nenhuma conta válida selecionada." };
  }

  // Primary account = first selected
  const primaryId = selectedAccounts[0].id.replace("act_", "");

  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      status: "CONNECTED",
      externalAccountId: primaryId,
      errorMessage: null,
      metadata: {
        ...(metadata || {}),
        selectedAccounts,
      },
    },
  });

  return { success: true, count: selectedAccounts.length };
}

/**
 * Get the list of selected Facebook Ads accounts for the current org.
 */
export async function getSelectedFacebookAccounts() {
  const ctx = await getSessionWithOrg();
  if (!ctx) return [];

  const integration = await prisma.integration.findUnique({
    where: {
      organizationId_platform: {
        organizationId: ctx.organization.id,
        platform: "FACEBOOK_ADS",
      },
    },
    select: { metadata: true, externalAccountId: true },
  });

  if (!integration) return [];

  const metadata = integration.metadata as { selectedAccounts?: { id: string; name: string }[] } | null;
  if (metadata?.selectedAccounts && metadata.selectedAccounts.length > 0) {
    return metadata.selectedAccounts;
  }

  // Fallback to single account
  if (integration.externalAccountId) {
    return [{ id: `act_${integration.externalAccountId}`, name: integration.externalAccountId }];
  }

  return [];
}

export async function selectGoogleAnalyticsProperty(propertyId: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { error: "Não autenticado." };

  const integration = await prisma.integration.findUnique({
    where: {
      organizationId_platform: {
        organizationId: ctx.organization.id,
        platform: "GOOGLE_ANALYTICS",
      },
    },
  });

  if (!integration || !integration.accessToken) {
    return { error: "Google Analytics não conectado. Faça login novamente." };
  }

  const metadata = integration.metadata as { properties?: { id: string; name: string }[] } | null;
  const properties = metadata?.properties || [];
  const selected = properties.find((p) => p.id === propertyId);

  if (!selected) {
    return { error: "Propriedade não encontrada." };
  }

  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      status: "CONNECTED",
      externalAccountId: propertyId,
      errorMessage: null,
    },
  });

  return { success: true, propertyName: selected.name };
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
