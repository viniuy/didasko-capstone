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
    async jwt({ token, user }) {
      // Only fetch from DB on initial login (when user is provided)
      // This prevents connection pool exhaustion from querying on every token refresh
      if (user) {
        try {
          // Fetch full user info from DB only on initial login
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email ?? "" },
            select: { id: true, name: true, role: true, email: true },
          });

          if (dbUser) {
            token.id = dbUser.id;
            token.name = dbUser.name;
            token.role = dbUser.role;
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
        session.user.role =
          (token.role as "ADMIN" | "ACADEMIC_HEAD" | "FACULTY") || "FACULTY";
      }
      return session;
    },
  },

  debug: process.env.NODE_ENV === "development",
};
