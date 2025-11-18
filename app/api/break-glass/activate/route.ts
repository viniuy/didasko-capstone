import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { activateBreakGlass } from "@/lib/breakGlass";
import { getClientIp } from "@/lib/utils/ip";
import { requireAdmin, requirePermission, handleAuthError } from "@/lib/authz";
import { Permission } from "@/lib/roles";
import { withLogging } from "@/lib/withLogging";

export const POST = withLogging(
  { action: "BREAK_GLASS_ACTIVATE", module: "Security" },
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      const ip = getClientIp(req);

      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const body = await req.json();
      const { userId, reason } = body;

      if (!userId || !reason) {
        return NextResponse.json(
          { error: "userId and reason are required" },
          { status: 400 }
        );
      }

      // ADMIN can activate for anyone
      // ACADEMIC_HEAD can only activate for themselves
      if (session.user.role === "ADMIN") {
        // Admin can activate for any user
        await activateBreakGlass(userId, reason, session.user.id, ip);
      } else if (session.user.role === "ACADEMIC_HEAD") {
        // Academic Head can only activate for themselves
        if (userId !== session.user.id) {
          return NextResponse.json(
            {
              error:
                "Academic Head can only activate break-glass for themselves",
            },
            { status: 403 }
          );
        }
        await activateBreakGlass(userId, reason, session.user.id, ip);
      } else {
        return NextResponse.json(
          { error: "Only Admin and Academic Head can activate break-glass" },
          { status: 403 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Break-glass override activated",
      });
    } catch (error) {
      return handleAuthError(error);
    }
  }
);
