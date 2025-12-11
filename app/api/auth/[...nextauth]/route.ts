import NextAuth from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { logAction } from "@/lib/audit";
import crypto from "crypto";

// Lazy initialization: only validate and create provider at runtime, not during build
// This prevents Next.js from trying to fetch OpenID config during build
const getProviders = () => {
  // During build phase, return empty array to prevent provider initialization
  // Next.js sets NEXT_PHASE during build, or we can check if env vars are missing
  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    !process.env.AZURE_AD_CLIENT_ID
  ) {
    return [];
  }

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

  // Ensure NEXTAUTH_URL is set for proper redirect URI construction
  // NextAuth automatically constructs: ${NEXTAUTH_URL}/api/auth/callback/azure-ad
  // This must match exactly with Azure AD app registration redirect URI
  if (!process.env.NEXTAUTH_URL) {
    console.warn(
      "NEXTAUTH_URL is not set. Azure AD OAuth may fail. Set it in Vercel environment variables."
    );
  }

  return [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: "common",
      // redirectUri is automatically constructed by NextAuth from NEXTAUTH_URL
      // Ensure NEXTAUTH_URL matches Azure AD app registration redirect URI exactly
      authorization: {
        params: {
          scope: "openid profile email offline_access",
          prompt: "login",
        },
      },
    }),
  ];
};

const handler = NextAuth({
  providers: getProviders(),

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
            roles: true,
            status: true,
            department: true,
            image: true,
            userSessions: {
              where: {
                expiresAt: { gt: new Date() },
              },
            },
          },
        });

        if (!dbUser) {
          console.warn(`User not found in DB: ${user.email}`);
          // Log failed login
          try {
            await logAction({
              userId: null,
              action: "USER_FAILED_LOGIN",
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
              action: "USER_FAILED_LOGIN",
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
        user.roles = dbUser.roles;
        user.name = dbUser.name;

        // Invalidate all existing sessions for this user (single session enforcement)
        if (dbUser.userSessions.length > 0) {
          await prisma.userSession.deleteMany({
            where: { userId: dbUser.id },
          });
          console.log(
            `🔄 Invalidated ${dbUser.userSessions.length} existing session(s) for user ${dbUser.id}`
          );
        }

        // Link Azure AD account with idempotency protection and transaction
        if (account?.provider === "azure-ad" && account.providerAccountId) {
          // Use transaction to prevent race conditions and ensure atomicity
          await prisma.$transaction(
            async (tx) => {
              // Check if account exists with this provider and providerAccountId (unique constraint)
              // This acts as an idempotency check - if already processed, skip
              const existingAccount = await tx.account.findUnique({
                where: {
                  provider_providerAccountId: {
                    provider: "azure-ad",
                    providerAccountId: account.providerAccountId,
                  },
                },
                select: {
                  userId: true,
                  access_token: true,
                },
              });

              if (existingAccount) {
                // Account already exists - check if this is a duplicate callback
                // If tokens are recent (within last 5 seconds), this might be a duplicate
                // Only update if userId changed or if tokens are significantly different
                if (existingAccount.userId !== dbUser.id) {
                  // Account is linked to a different user - update to current user
                  await tx.account.update({
                    where: {
                      provider_providerAccountId: {
                        provider: "azure-ad",
                        providerAccountId: account.providerAccountId,
                      },
                    },
                    data: {
                      userId: dbUser.id,
                      access_token: account.access_token,
                      refresh_token: account.refresh_token,
                      expires_at: account.expires_at,
                      token_type: account.token_type,
                      scope: account.scope,
                      id_token: account.id_token,
                      session_state: account.session_state,
                    },
                  });
                  console.info(
                    `Updated Azure AD account link for ${user.email} (was linked to different user)`
                  );
                } else if (
                  existingAccount.access_token !== account.access_token
                ) {
                  // Same user, but tokens changed - update tokens
                  await tx.account.update({
                    where: {
                      provider_providerAccountId: {
                        provider: "azure-ad",
                        providerAccountId: account.providerAccountId,
                      },
                    },
                    data: {
                      access_token: account.access_token,
                      refresh_token: account.refresh_token,
                      expires_at: account.expires_at,
                      token_type: account.token_type,
                      scope: account.scope,
                      id_token: account.id_token,
                      session_state: account.session_state,
                    },
                  });
                } else {
                  // Duplicate callback - tokens are the same, skip update
                  console.info(
                    `Skipping duplicate Azure AD callback for ${user.email} (tokens unchanged)`
                  );
                }
              } else {
                // Account doesn't exist - create it (idempotent via unique constraint)
                try {
                  await tx.account.create({
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
                } catch (createError: any) {
                  // If account was created between check and create (race condition),
                  // the unique constraint will prevent duplicate
                  if (
                    createError.code === "P2002" &&
                    createError.meta?.target?.includes("providerAccountId")
                  ) {
                    console.info(
                      `Azure AD account already exists for ${user.email} (race condition handled)`
                    );
                  } else {
                    throw createError;
                  }
                }
              }
            },
            {
              maxWait: 5000, // Maximum time to wait for a transaction slot (5 seconds)
              timeout: 10000, // Maximum time the transaction can run (10 seconds)
            }
          );
        }

        console.info(`Sign-in success for ${user.email}`);

        // Log login
        await logAction({
          userId: dbUser.id,
          action: "USER_LOGIN",
          module: "User",
          reason: `User logged in: ${dbUser.name} (${dbUser.email})`,
          status: "SUCCESS",
          after: {
            roles: dbUser.roles,
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
            action: "USER_FAILED_LOGIN",
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

    /** JWT callback - attach roles and department */
    async jwt({ token, user, trigger, session }) {
      // Initial login - create new session token and store it
      if (user) {
        token.id = user.id;
        token.roles = user.roles as Role[];
        token.email = user.email;
        token.name = user.name;

        // Generate unique session token
        const sessionToken = crypto.randomBytes(32).toString("hex");
        token.sessionToken = sessionToken;

        // Store session in database
        try {
          await prisma.userSession.create({
            data: {
              userId: user.id,
              sessionToken: sessionToken,
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            },
          });
          console.log(`✅ New session created for user ${user.id}`);
        } catch (error) {
          console.error("Error creating session:", error);
        }
      }

      // Verify session is still valid on every request
      if (token.sessionToken && token.id && !user) {
        try {
          const validSession = await prisma.userSession.findUnique({
            where: { sessionToken: token.sessionToken as string },
          });

          // If session doesn't exist or expired, mark for redirect
          if (!validSession || validSession.expiresAt < new Date()) {
            console.log(`❌ Session invalidated for user ${token.id}`);
            token.sessionExpired = true;
            return token; // Return token with expired flag
          }
        } catch (error) {
          console.error("Error verifying session:", error);
        }
      }

      // Allow session.update() to override selectedRole
      if (trigger === "update" && session?.selectedRole) {
        token.selectedRole = session.selectedRole;
      }

      // ALWAYS fetch fresh data on each session access (page load, API call)
      // This ensures role/status changes are reflected immediately for all users
      if (!user && token.id) {
        try {
          const freshUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: {
              id: true,
              roles: true,
              name: true,
              image: true,
              department: true,
              status: true,
            },
          });

          if (freshUser) {
            token.roles = freshUser.roles as Role[];
            token.name = freshUser.name;
            token.image = freshUser.image;
            token.department = freshUser.department;
            token.status = freshUser.status;
          }
        } catch (err) {
          console.error("JWT DB fetch error:", err);
        }
      }

      return token;
    },

    /** Session callback - include all user data */
    async session({ session, token }) {
      // Check if session was invalidated (logged in elsewhere)
      if (token.sessionExpired) {
        // Return null session to trigger client-side redirect
        return {
          ...session,
          error: "SessionExpired",
        } as any;
      }

      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.roles = (token.roles as Role[]) || [];
        session.user.name = token.name;
        session.user.image =
          typeof token.image === "string" ? token.image : null;
        session.user.email = token.email;
        session.user.department =
          typeof token.department === "string" ? token.department : null;
        session.user.status =
          typeof token.status === "string" ? token.status : null;
        session.user.sessionToken =
          typeof token.sessionToken === "string" ? token.sessionToken : null;

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

  events: {
    async signOut({ token }) {
      // Delete session from database on sign out
      if (token?.sessionToken) {
        try {
          await prisma.userSession.deleteMany({
            where: { sessionToken: token.sessionToken as string },
          });
          console.log(`🚪 Session deleted on sign out`);
        } catch (error) {
          console.error("Error deleting session on signout:", error);
        }
      }
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

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export { handler as GET, handler as POST };
