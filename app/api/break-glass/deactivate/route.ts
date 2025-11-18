import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { deactivateBreakGlass } from "@/lib/breakGlass";
import { getClientIp } from "@/lib/utils/ip";
import { requireAdmin, handleAuthError } from "@/lib/authz";
import { withLogging } from "@/lib/withLogging";

export const POST = withLogging(
  { action: "BREAK_GLASS_DEACTIVATE", module: "Security" },
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      const ip = getClientIp(req);

      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const body = await req.json();
      const userId = body?.userId || session.user.id; // Default to current user if not provided

      // ADMIN can deactivate for anyone
      // ACADEMIC_HEAD can only deactivate for themselves
      if (session.user.role === "ADMIN") {
        // Admin can deactivate for any user
        await deactivateBreakGlass(userId, session.user.id, ip);
      } else if (session.user.role === "ACADEMIC_HEAD") {
        // Academic Head can only deactivate for themselves
        if (userId !== session.user.id) {
          return NextResponse.json(
            {
              error:
                "Academic Head can only deactivate break-glass for themselves",
            },
            { status: 403 }
          );
        }
        await deactivateBreakGlass(userId, session.user.id, ip);
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
