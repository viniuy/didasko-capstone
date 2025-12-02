import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { logAction } from "@/lib/audit";
import { isBreakGlassActive, deactivateBreakGlass } from "@/lib/breakGlass";

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (session?.user) {
      // Check if user is a temporary admin (has active break-glass session)
      const hasActiveBreakGlass = await isBreakGlassActive(session.user.id);

      if (hasActiveBreakGlass) {
        // Automatically deactivate break-glass session on logout
        try {
          await deactivateBreakGlass(session.user.id, session.user.id);
          // The deactivation is already logged by deactivateBreakGlass function
        } catch (error) {
          console.error("Error deactivating break-glass on logout:", error);
          // Continue with logout even if deactivation fails
        }
      }

      // Log logout before session is destroyed
      await logAction({
        userId: session.user.id,
        action: "USER_LOGOUT",
        module: "User",
        reason: `User logged out: ${session.user.name} (${session.user.email})`,
        status: "SUCCESS",
        before: {
          roles: session.user.roles,
        },
        metadata: {
          logoutType: "manual",
          sessionEnded: true,
          breakGlassDeactivated: hasActiveBreakGlass, // Track if break-glass was deactivated
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout logging error:", error);
    // Don't fail logout if logging fails
    return NextResponse.json({ success: true });
  }
}
