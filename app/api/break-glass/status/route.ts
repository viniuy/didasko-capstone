import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getBreakGlassSession, isBreakGlassActive } from "@/lib/breakGlass";
import { requireAdmin, handleAuthError } from "@/lib/authz";
import { withLogging } from "@/lib/withLogging";

export const GET = withLogging(
  { action: "BREAK_GLASS_STATUS", module: "Security" },
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);

      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // For Academic Head, get all active break-glass sessions
      // For others, check specific user
      const { searchParams } = new URL(req.url);
      const userId = searchParams.get("userId");

      if (session.user.role === "ACADEMIC_HEAD") {
        // Academic Head can see all active break-glass sessions
        const { prisma } = await import("@/lib/prisma");
        const activeSessions = await prisma.breakGlassSession.findMany({
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        });

        return NextResponse.json({
          isActive: activeSessions.length > 0,
          sessions: activeSessions,
          session: activeSessions[0] || null, // For backward compatibility
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
