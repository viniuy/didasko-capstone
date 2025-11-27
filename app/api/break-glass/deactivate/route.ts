import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { deactivateBreakGlass } from "@/lib/breakGlass";
import { requireAdmin, handleAuthError } from "@/lib/authz";
import { withLogging } from "@/lib/withLogging";
import { prisma } from "@/lib/prisma";

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export const POST = withLogging(
  { action: "BreakGlass Deactivate", module: "Security" },
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);

      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const body = await req.json();
      const userId = body?.userId;

      if (!userId) {
        return NextResponse.json(
          { error: "userId is required" },
          { status: 400 }
        );
      }

      // ADMIN can deactivate for anyone
      // ACADEMIC_HEAD can deactivate any active break-glass session (they activated it)
      if (session.user.role === "ADMIN") {
        // Admin can deactivate for any user
        await deactivateBreakGlass(userId, session.user.id);
      } else if (session.user.role === "ACADEMIC_HEAD") {
        // Academic Head can deactivate any break-glass session they activated
        const sessionData = await prisma.breakGlassSession.findUnique({
          where: { userId },
        });

        if (!sessionData) {
          return NextResponse.json(
            { error: "Break-glass session not found" },
            { status: 404 }
          );
        }

        // Verify Academic Head activated this session
        if (sessionData.activatedBy !== session.user.id) {
          return NextResponse.json(
            {
              error:
                "You can only deactivate break-glass sessions you activated",
            },
            { status: 403 }
          );
        }

        await deactivateBreakGlass(userId, session.user.id);
      } else {
        return NextResponse.json(
          { error: "Only Admin and Academic Head can deactivate break-glass" },
          { status: 403 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Break-glass override deactivated",
      });
    } catch (error) {
      return handleAuthError(error);
    }
  }
);
