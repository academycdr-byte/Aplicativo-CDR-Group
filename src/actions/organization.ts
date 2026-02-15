"use server";

import { prisma } from "@/lib/prisma";
import { getSessionWithOrg } from "@/lib/session";
import { UserRole } from "@prisma/client";

export async function getOrganization() {
  const ctx = await getSessionWithOrg();
  if (!ctx) return null;

  return {
    ...ctx.organization,
    role: ctx.role,
  };
}

export async function updateOrganization(data: { name: string; slug: string }) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { error: "Não autenticado." };

  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    return { error: "Você não tem permissão para editar a organização." };
  }

  const slug = data.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const existingSlug = await prisma.organization.findFirst({
    where: { slug, NOT: { id: ctx.organization.id } },
  });

  if (existingSlug) {
    return { error: "Este slug já está em uso." };
  }

  await prisma.organization.update({
    where: { id: ctx.organization.id },
    data: { name: data.name, slug },
  });

  return { success: true };
}

export async function getMembers() {
  const ctx = await getSessionWithOrg();
  if (!ctx) return [];

  const members = await prisma.membership.findMany({
    where: { organizationId: ctx.organization.id },
    include: {
      user: {
        select: { id: true, name: true, email: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return members.map((m) => ({
    id: m.id,
    role: m.role,
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    joinedAt: m.createdAt,
  }));
}

export async function inviteMember(data: { email: string; role: UserRole }) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { error: "Não autenticado." };

  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    return { error: "Você não tem permissão para convidar membros." };
  }

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (!user) {
    return { error: "Usuário não encontrado. O usuário precisa criar uma conta primeiro." };
  }

  // Check if already a member
  const existingMembership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: ctx.organization.id,
      },
    },
  });

  if (existingMembership) {
    return { error: "Este usuário já é membro da organização." };
  }

  // Prevent assigning OWNER role
  if (data.role === "OWNER") {
    return { error: "Não é possível convidar como proprietário." };
  }

  await prisma.membership.create({
    data: {
      userId: user.id,
      organizationId: ctx.organization.id,
      role: data.role,
    },
  });

  return { success: true };
}

export async function updateMemberRole(data: { membershipId: string; role: UserRole }) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { error: "Não autenticado." };

  if (ctx.role !== "OWNER") {
    return { error: "Apenas o proprietário pode alterar funções." };
  }

  const membership = await prisma.membership.findUnique({
    where: { id: data.membershipId },
  });

  if (!membership || membership.organizationId !== ctx.organization.id) {
    return { error: "Membro não encontrado." };
  }

  if (membership.role === "OWNER") {
    return { error: "Não é possível alterar a função do proprietário." };
  }

  if (data.role === "OWNER") {
    return { error: "Não é possível promover a proprietário." };
  }

  await prisma.membership.update({
    where: { id: data.membershipId },
    data: { role: data.role },
  });

  return { success: true };
}

export async function removeMember(membershipId: string) {
  const ctx = await getSessionWithOrg();
  if (!ctx) return { error: "Não autenticado." };

  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    return { error: "Você não tem permissão para remover membros." };
  }

  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
  });

  if (!membership || membership.organizationId !== ctx.organization.id) {
    return { error: "Membro não encontrado." };
  }

  if (membership.role === "OWNER") {
    return { error: "Não é possível remover o proprietário." };
  }

  await prisma.membership.delete({
    where: { id: membershipId },
  });

  return { success: true };
}
