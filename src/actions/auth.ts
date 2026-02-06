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
