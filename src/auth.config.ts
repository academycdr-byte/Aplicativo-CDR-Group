import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard =
        nextUrl.pathname.startsWith("/dashboard") ||
        nextUrl.pathname.startsWith("/integrations") ||
        nextUrl.pathname.startsWith("/orders") ||
        nextUrl.pathname.startsWith("/sales") ||
        nextUrl.pathname.startsWith("/ads") ||
        nextUrl.pathname.startsWith("/reports") ||
        nextUrl.pathname.startsWith("/settings") ||
        nextUrl.pathname.startsWith("/admin");

      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false; // Redirect to /login
      } else if (isLoggedIn) {
        // If logged in and on auth pages, redirect to dashboard
        if (
          nextUrl.pathname === "/login" ||
          nextUrl.pathname === "/register"
        ) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
      }
      return true;
    },
    session({ session, token }) {
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
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.sub = user.id;
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
  },
  providers: [], // configured in auth.ts
} satisfies NextAuthConfig;
