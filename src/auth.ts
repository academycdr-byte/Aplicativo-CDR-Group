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

        // Load user's first organization
        const membership = await prisma.membership.findFirst({
          where: { userId: user.id },
          include: { organization: true },
          orderBy: { createdAt: "asc" },
        });

        if (membership) {
          token.organizationId = membership.organizationId;
          // If logged in as CLIENT, force CLIENT role regardless of DB role
          const loginType = (user as Record<string, unknown>).loginType as string;
          if (loginType === "CLIENT") {
            token.role = "CLIENT";
          } else {
            token.role = membership.role;
          }
        }
      }

      // Allow updating the token from session update
      if (trigger === "update" && session) {
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
      return session;
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
        loginType: { label: "Login Type", type: "text" },
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
          image: user.image,
          loginType: credentials.loginType && credentials.loginType !== "" ? (credentials.loginType as string) : "CLIENT",
        };
      },
    }),
  ],
});
