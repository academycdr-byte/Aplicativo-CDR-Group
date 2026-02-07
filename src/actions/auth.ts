"use server";

import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";

export async function registerUser(formData: {
  name: string;
  email: string;
  password: string;
}) {
  const { name, email, password } = formData;

  // Validação de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { error: "Email inválido." };
  }

  // Validação de senha
  if (password.length < 8) {
    return { error: "A senha deve ter pelo menos 8 caracteres." };
  }

  // Validação de nome
  if (!name || name.trim().length < 2) {
    return { error: "O nome deve ter pelo menos 2 caracteres." };
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return { error: "Este email ja esta em uso." };
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Criar user, organization e membership em uma transação atômica
  const slug = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-");

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: name.trim(),
          email,
          hashedPassword,
        },
      });

      const organization = await tx.organization.create({
        data: {
          name: name ? `${name.trim()}'s Organization` : "Minha Organizacao",
          slug: `${slug}-${user.id.slice(0, 6)}`,
        },
      });

      await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: "OWNER",
        },
      });
    });
  } catch {
    return { error: "Erro ao criar conta. Tente novamente." };
  }

  // Sign in the user
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Erro ao fazer login apos registro." };
    }
    throw error;
  }
}

export async function loginUser(formData: {
  email: string;
  password: string;
}) {
  try {
    await signIn("credentials", {
      email: formData.email,
      password: formData.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email ou senha incorretos." };
    }
    throw error;
  }
}

export async function logoutUser() {
  await signOut({ redirectTo: "/login" });
}
