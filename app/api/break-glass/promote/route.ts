import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { promoteToPermanentAdmin, isTemporaryAdmin } from "@/lib/breakGlass";
import { withLogging } from "@/lib/withLogging";
import { handleAuthError } from "@/lib/authz";

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export const POST = withLogging(
  { action: "BREAK_GLASS_PROMOTE", module: "Security" },
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);

      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Only permanent admins can promote temporary admins
      // Check if current user is a permanent admin (not temporary)
      const isCurrentUserTempAdmin = await isTemporaryAdmin(session.user.id);

      if (isCurrentUserTempAdmin) {
        return NextResponse.json(
          {
            error:
              "Temporary admins cannot promote other users to permanent admin",
          },
          { status: 403 }
        );
      }

      // Check if user is actually an admin
      const userRoles = session.user.roles || [];
      if (!userRoles.includes("ADMIN")) {
        return NextResponse.json(
          { error: "Only permanent admins can promote temporary admins" },
          { status: 403 }
        );
      }

      const body = await req.json();
      const { userId, promotionCode } = body;

      if (!userId || !promotionCode) {
        return NextResponse.json(
          { error: "userId and promotionCode are required" },
          { status: 400 }
        );
      }

      // Verify the target user is a temporary admin
      const isTargetTempAdmin = await isTemporaryAdmin(userId);
      if (!isTargetTempAdmin) {
        return NextResponse.json(
          { error: "User is not a temporary admin" },
          { status: 400 }
        );
      }

      // Promote to permanent admin
      await promoteToPermanentAdmin(userId, promotionCode, session.user.id);

      return NextResponse.json({
        success: true,
        message: "User has been promoted to permanent Admin",
      });
    } catch (error: any) {
      if (error.message) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return handleAuthError(error);
    }
  }
);
