import NextAuth from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { logAction } from "@/lib/audit";

const requiredEnv = [
  "AZURE_AD_CLIENT_ID",
  "AZURE_AD_CLIENT_SECRET",
  "NEXTAUTH_SECRET",
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing environment variable: ${key}`);
  }
}

const handler = NextAuth({
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: "common",
      authorization: {
        params: {
          scope: "openid profile email offline_access",
          prompt: "login",
        },
      },
    }),
  ],

  callbacks: {
    /** Validate sign-in */
    async signIn({ user, account }) {
      if (!user.email) return false;

      const allowedDomain = "@alabang.sti.edu.ph";
      if (!user.email.endsWith(allowedDomain)) {
        console.warn(`Unauthorized domain: ${user.email}`);
        return false;
      }

      try {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
            department: true,
            image: true,
          },
        });

        if (!dbUser) {
          console.warn(`User not found in DB: ${user.email}`);
          // Log failed login
          try {
            await logAction({
              userId: null,
              action: "User Failed Login",
              module: "User",
              reason: `User not found in database: ${user.email}`,
              status: "FAILED",
              errorMessage: "User not found in database",
              metadata: {
                attemptedEmail: user.email,
                loginMethod: account?.provider || "unknown",
              },
            });
          } catch (logError) {
            console.error("Error logging failed login:", logError);
          }
          return false;
        }

        if (dbUser.status !== "ACTIVE") {
          console.warn(`User is archived for user: ${user.email}`);
          // Log failed login
          try {
            await logAction({
              userId: dbUser.id,
              action: "User Failed Login",
              module: "User",
              reason: `User account is archived: ${user.email}`,
              status: "FAILED",
              errorMessage: "User account is archived",
              metadata: {
                attemptedEmail: user.email,
                loginMethod: account?.provider || "unknown",
                userStatus: dbUser.status,
              },
            });
          } catch (logError) {
            console.error("Error logging failed login:", logError);
          }
          return false;
        }

        user.id = dbUser.id;
        user.role = dbUser.role;
        user.name = dbUser.name;

        // Link Azure AD account
        if (account?.provider === "azure-ad") {
          const existing = await prisma.account.findFirst({
            where: { userId: dbUser.id, provider: "azure-ad" },
          });

          if (!existing) {
            await prisma.account.create({
              data: {
                userId: dbUser.id,
                type: "oauth",
                provider: "azure-ad",
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                session_state: account.session_state,
              },
            });
            console.info(`Linked Azure AD account for ${user.email}`);
          }
        }

        console.info(`Sign-in success for ${user.email}`);

        // Log login
        await logAction({
          userId: dbUser.id,
          action: "User Login",
          module: "User",
          reason: `User logged in: ${dbUser.name} (${dbUser.email})`,
          status: "SUCCESS",
          after: {
            role: dbUser.role,
            department: dbUser.department,
            loginMethod: account?.provider || "unknown",
          },
          metadata: {
            loginMethod: account?.provider || "unknown",
            sessionCreated: true,
          },
        });

        return true;
      } catch (err) {
        console.error("Sign-in error:", err);
        // Log failed login
        try {
          await logAction({
            userId: null,
            action: "User Failed Login",
            module: "User",
            reason: `Sign-in error: ${user.email}`,
            status: "FAILED",
            errorMessage: err instanceof Error ? err.message : "Unknown error",
            metadata: {
              attemptedEmail: user.email,
              loginMethod: account?.provider || "unknown",
            },
          });
        } catch (logError) {
          console.error("Error logging failed login:", logError);
        }
        return false;
      }
    },

    /** JWT callback - attach role and department */
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role as Role;
        token.email = user.email;
        token.name = user.name;
      }

      // Allow session.update() to override selectedRole
      if (trigger === "update" && session?.selectedRole) {
        token.selectedRole = session.selectedRole;
      }

      // Fallback sync from DB if missing
      if (token?.email && !token?.role) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email },
            select: {
              id: true,
              role: true,
              name: true,
              image: true,
              department: true,
            },
          });

          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role as Role;
            token.name = dbUser.name;
            token.image = dbUser.image;
            token.department = dbUser.department;
          }
        } catch (err) {
          console.error("JWT DB fetch error:", err);
        }
      }

      return token;
    },

    /** Session callback - include all user data */
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.role = token.role as "ADMIN" | "ACADEMIC_HEAD" | "FACULTY";
        session.user.name = token.name;
        session.user.image =
          typeof token.image === "string" ? token.image : null;
        session.user.email = token.email;
        session.user.department =
          typeof token.department === "string" ? token.department : null;

        if (token.selectedRole) {
          session.user.selectedRole = token.selectedRole;
        }
      }
      return session;
    },

    /** Safe redirect handling */
    async redirect({ url, baseUrl }) {
      const safeUrls = [
        baseUrl,
        `${baseUrl}/dashboard`,
        `${baseUrl}/redirecting`,
      ];
      return safeUrls.includes(url) ? url : `${baseUrl}/redirecting`;
    },
  },

  pages: {
    signIn: "/",
    error: "/?error=true",
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  debug: process.env.NODE_ENV === "development",
});

export { handler as GET, handler as POST };
