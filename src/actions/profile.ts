"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import bcrypt from "bcryptjs";

export async function updateProfile(data: {
  name: string;
  email: string;
}) {
  const session = await getSession();
  if (!session) return { error: "Não autenticado." };

  const existing = await prisma.user.findFirst({
    where: { email: data.email, NOT: { id: session.user.id } },
  });

  if (existing) {
    return { error: "Este email já está em uso por outro usuário." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: data.name, email: data.email },
  });

  return { success: true };
}

export async function updatePassword(data: {
  currentPassword: string;
  newPassword: string;
}) {
  const session = await getSession();
  if (!session) return { error: "Não autenticado." };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user || !user.hashedPassword) {
    return { error: "Usuário não encontrado." };
  }

  const passwordMatch = await bcrypt.compare(data.currentPassword, user.hashedPassword);
  if (!passwordMatch) {
    return { error: "Senha atual incorreta." };
  }

  const hashedPassword = await bcrypt.hash(data.newPassword, 10);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { hashedPassword },
  });

  return { success: true };
}

export async function getProfile() {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  return user;
}
