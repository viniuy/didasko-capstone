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

      const { searchParams } = new URL(req.url);
      const userId = searchParams.get("userId") || session.user.id;

      // ADMIN can check any user, others can only check themselves
      if (userId !== session.user.id) {
        requireAdmin(session.user);
      }

      const isActive = await isBreakGlassActive(userId);
      const sessionData = await getBreakGlassSession(userId);

      return NextResponse.json({
        isActive,
        session: sessionData,
      });
    } catch (error) {
      return handleAuthError(error);
    }
  }
);
