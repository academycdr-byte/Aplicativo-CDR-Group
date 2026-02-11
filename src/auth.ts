import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.sub = user.id;
        token.picture = undefined; // Prevent base64 image bloating the JWT cookie

        // Load user's first organization
        const membership = await prisma.membership.findFirst({
          where: { userId: user.id },
          include: { organization: true },
          orderBy: { createdAt: "asc" },
        });

        if (membership) {
          token.organizationId = membership.organizationId;
          token.role = membership.role;
        }

        // Check if user email is in the app admin list
        const adminEmails = (process.env.ADMIN_EMAILS || "academy.cdr@gmail.com")
          .split(",")
          .map((e) => e.trim().toLowerCase());
        token.isAppAdmin = adminEmails.includes((user.email || "").toLowerCase());
      }

      // Allow updating the token from session update
      if (trigger === "update" && session) {
        if (session.name) {
          token.name = session.name;
        }
        if (session.organizationId) {
          token.organizationId = session.organizationId;
        }
        if (session.role) {
          token.role = session.role;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      if (token.organizationId) {
        session.user.organizationId = token.organizationId as string;
      }
      if (token.role) {
        session.user.role = token.role as string;
      }
      session.user.isAppAdmin = (token.isAppAdmin as boolean) || false;
      return session;
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.hashedPassword) {
          return null;
        }

        const passwordMatch = await bcrypt.compare(password, user.hashedPassword);

        if (!passwordMatch) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
        };
      },
    }),
  ],
});
