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

    async jwt({ token, user, trigger }) {
      // Initial login - fetch from DB
      if (user) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email ?? "" },
            select: {
              id: true,
              name: true,
              roles: true,
              email: true,
              status: true,
            },
          });

          if (dbUser) {
            token.id = dbUser.id;
            token.name = dbUser.name;
            token.roles = dbUser.roles;
            token.email = dbUser.email;
            token.status = dbUser.status;
          } else {
            token.id = user.id;
            token.name = user.name;
            token.email = user.email;
          }
        } catch (error) {
          console.error("JWT callback error:", error);
          token.id = user.id;
          token.name = user.name;
          token.email = user.email;
        }
      }

      // ALWAYS fetch fresh data on each session access (page load, API call)
      // This ensures role/status changes are reflected immediately
      if (!user && token.id) {
        try {
          const freshUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: {
              id: true,
              name: true,
              email: true,
              roles: true,
              status: true,
            },
          });

          if (freshUser) {
            token.name = freshUser.name;
            token.email = freshUser.email;
            // Start with DB roles
            let effectiveRoles = Array.isArray(freshUser.roles)
              ? [...freshUser.roles]
              : [];

            // If there is an approved, unexpired FacultyAssignmentRequest for this user,
            // treat them as FACULTY for the duration (do not mutate DB roles here).
            try {
              const approved = await prisma.facultyAssignmentRequest.findFirst({
                where: {
                  adminId: freshUser.id,
                  status: "APPROVED",
                  expiresAt: { gt: new Date() },
                },
                orderBy: { decisionAt: "desc" },
              });

              if (approved && !effectiveRoles.includes("FACULTY")) {
                effectiveRoles.push("FACULTY");
              }
            } catch (e) {
              // If checking the request fails, fall back to DB roles
              console.error("Error checking faculty assignment requests:", e);
            }

            token.roles = effectiveRoles;
            token.status = freshUser.status;
          }
        } catch (error) {
          // Keep existing token on error
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.roles = (token.roles as Role[]) || [];
        session.user.status = token.status as string;
      }
      return session;
    },
  },

  debug: process.env.NODE_ENV === "development",
};
