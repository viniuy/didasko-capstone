import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

// Extend NextAuth types
declare module "next-auth" {
  interface User {
    id: string;
    role?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  }
  interface Session {
    user: {
      id: string;
      role?: string;
      selectedRole?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    selectedRole?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  }
}

// Ensure required env vars exist
const requiredEnv = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "NEXTAUTH_SECRET",
];
for (const key of requiredEnv) {
  if (!process.env[key])
    throw new Error(`Missing environment variable: ${key}`);
}

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid profile email",
          prompt: "select_account",
        },
      },
    }),
  ],

  callbacks: {
    /** 🔹 Validate sign-in */
    async signIn({ user, account }) {
      if (!user.email) return false;

      const allowedDomain = "@gmail.com"; // temporary, allow any gmail
      if (!user.email.endsWith(allowedDomain)) {
        console.warn(`Unauthorized domain: ${user.email}`);
        return false;
      }

      try {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (!dbUser) {
          console.warn(`User not found in DB: ${user.email}`);
          return false;
        }

        if (dbUser.permission !== "GRANTED") {
          console.warn(`Permission denied for user: ${user.email}`);
          return false;
        }

        user.id = dbUser.id;
        user.role = dbUser.role;
        user.name = dbUser.name;

        // 🔗 Link Google account
        if (account?.provider === "google") {
          const existing = await prisma.account.findFirst({
            where: { userId: dbUser.id, provider: "google" },
          });

          if (!existing) {
            await prisma.account.create({
              data: {
                userId: dbUser.id,
                type: "oauth",
                provider: "google",
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
            console.info(`🔗 Linked Google account for ${user.email}`);
          }
        }

        console.info(`Sign-in success for ${user.email}`);
        return true;
      } catch (err) {
        console.error("Sign-in error:", err);
        return false;
      }
    },

    /** 🔹 JWT callback — attach role, handle selectedRole */
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.email = user.email;
        token.name = user.name;
      }

      if (trigger === "update" && session?.selectedRole) {
        token.selectedRole = session.selectedRole;
      }

      if (token?.email && !token?.role) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email },
            select: { id: true, role: true, name: true, image: true },
          });
          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role;
            token.name = dbUser.name;
            token.image = dbUser.image;
          }
        } catch (err) {
          console.error("JWT DB fetch error:", err);
        }
      }

      return token;
    },

    /** Session callback — include selectedRole */
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.selectedRole = token.selectedRole as string;
        session.user.name = token.name;
        session.user.image =
          typeof token.image === "string" ? token.image : null;
        session.user.email = token.email;
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
