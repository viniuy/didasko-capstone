import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
// import AzureADProvider from "next-auth/providers/azure-ad";
import { prisma } from "./db";
import type { Role } from "@prisma/client";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // AzureADProvider({
    //   clientId: process.env.AZURE_AD_CLIENT_ID!,
    //   clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
    //   tenantId: process.env.AZURE_AD_TENANT_ID!,
    // }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: "/auth/signin",
  },

  callbacks: {
    async signIn({ user }) {
      try {
        // Check if user exists and verify their status
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email ?? "" },
          select: { status: true },
        });

        // User not found in database
        if (!dbUser) {
          throw new Error("AccountNotFound");
        }

        // User account is archived
        if (dbUser.status === "ARCHIVED") {
          throw new Error("AccountArchived");
        }

        // User is active, allow sign in
        return true;
      } catch (error) {
        // Re-throw our custom errors
        if (
          error instanceof Error &&
          (error.message === "AccountNotFound" ||
            error.message === "AccountArchived")
        ) {
          throw error;
        }
        // For other errors, log and deny access
        console.error("SignIn callback error:", error);
        throw new Error("AccessDenied");
      }
    },

    async jwt({ token, user }) {
      // Only fetch from DB on initial login (when user is provided)
      // This prevents connection pool exhaustion from querying on every token refresh
      if (user) {
        try {
          // Fetch full user info from DB only on initial login
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email ?? "" },
            select: { id: true, name: true, roles: true, email: true },
          });

          if (dbUser) {
            token.id = dbUser.id;
            token.name = dbUser.name;
            token.roles = dbUser.roles;
            token.email = dbUser.email;
          } else {
            // Fallback to user data from OAuth provider
            token.id = user.id;
            token.name = user.name;
            token.email = user.email;
          }
        } catch (error) {
          console.error("JWT callback error:", error);
          // Fallback to user data from OAuth provider on error
          token.id = user.id;
          token.name = user.name;
          token.email = user.email;
        }
      }
      // On subsequent token refreshes, use cached token data (no DB query)
      // This prevents connection pool timeouts

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.roles = (token.roles as Role[]) || [];
      }
      return session;
    },
  },

  debug: process.env.NODE_ENV === "development",
};
