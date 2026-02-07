"use server";

import { signIn, signOut, auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { validateName, validateEmail, validatePassword } from "@/lib/validation";

export async function registerUser(formData: {
  name: string;
  email: string;
  password: string;
}) {
  const { name, email, password } = formData;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return { error: "Este email ja esta em uso." };
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user
  const user = await prisma.user.create({
    data: {
      name,
      email,
      hashedPassword,
    },
  });

  // Create a default organization for the user
  const slug = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-");
  const organization = await prisma.organization.create({
    data: {
      name: name ? `${name}'s Organization` : "Minha Organizacao",
      slug: `${slug}-${user.id.slice(0, 6)}`,
    },
  });

  // Add user as OWNER of the organization
  await prisma.membership.create({
    data: {
      userId: user.id,
      organizationId: organization.id,
      role: "OWNER",
    },
  });

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

export async function getProfile() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  return user;
}

export async function updateProfile(data: { name: string; email: string }) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Nao autenticado." };

  const nameError = validateName(data.name);
  if (nameError) return { error: nameError };
  const emailError = validateEmail(data.email);
  if (emailError) return { error: emailError };

  if (data.email !== session.user.email) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) return { error: "Este email ja esta em uso." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: data.name.trim(), email: data.email.trim() },
  });

  return { success: true };
}

export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Nao autenticado." };

  const passwordError = validatePassword(data.newPassword);
  if (passwordError) return { error: passwordError };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.hashedPassword) {
    return { error: "Conta nao possui senha configurada." };
  }

  const isValid = await bcrypt.compare(data.currentPassword, user.hashedPassword);
  if (!isValid) {
    return { error: "Senha atual incorreta." };
  }

  if (data.currentPassword === data.newPassword) {
    return { error: "A nova senha deve ser diferente da atual." };
  }

  const hashedPassword = await bcrypt.hash(data.newPassword, 10);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { hashedPassword },
  });

  return { success: true };
}
