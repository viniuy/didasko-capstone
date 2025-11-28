import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getBreakGlassSession, isBreakGlassActive } from "@/lib/breakGlass";
import { requireAdmin, handleAuthError } from "@/lib/authz";
import { withLogging } from "@/lib/withLogging";
import { prisma } from "@/lib/prisma";

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export const GET = withLogging(
  { action: "BREAK_GLASS_STATUS", module: "Security" },
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);

      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // For Academic Head and Admin, get all active break-glass sessions
      // For others, check specific user
      const { searchParams } = new URL(req.url);
      const userId = searchParams.get("userId");

      if (
        session.user.role === "ACADEMIC_HEAD" ||
        session.user.role === "ADMIN"
      ) {
        // Academic Head and Admin can see all active break-glass sessions
        // Optimized: Use select instead of include for better performance
        // Note: Only Academic Head can see promotionCodePlain, Admin cannot
        const activeSessions = await prisma.breakGlassSession.findMany({
          select: {
            id: true,
            userId: true,
            reason: true,
            activatedAt: true,
            expiresAt: true,
            activatedBy: true,
            originalRole: true,
            promotionCodePlain: true, // Always fetch, but remove for Admin below
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: {
            activatedAt: "desc",
          },
        });

        // Remove promotionCodePlain from response if requester is Admin
        // Only Academic Head can see promotion codes, Admin cannot
        const finalSessions =
          session.user.role === "ADMIN"
            ? activeSessions.map((session: any) => {
                const { promotionCodePlain, ...rest } = session;
                return rest;
              })
            : activeSessions;

        return NextResponse.json({
          isActive: activeSessions.length > 0,
          sessions: finalSessions,
          session: finalSessions[0] || null, // For backward compatibility
        });
      } else {
        // For other roles, check specific user
        const targetUserId = userId || session.user.id;

        // ADMIN can check any user, others can only check themselves
        if (targetUserId !== session.user.id) {
          requireAdmin(session.user);
        }

        const isActive = await isBreakGlassActive(targetUserId);
        const sessionData = await getBreakGlassSession(targetUserId);

        return NextResponse.json({
          isActive,
          session: sessionData,
        });
      }
    } catch (error) {
      return handleAuthError(error);
    }
  }
);
