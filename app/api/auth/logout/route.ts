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
    let userId = session?.user?.id;
    let userName = session?.user?.name;
    let userEmail = session?.user?.email;
    let userRoles = session?.user?.roles;
    let hasActiveBreakGlass = false;

    // If session is missing, try to get userId from request body (for robustness)
    if (!userId) {
      try {
        const body = await req.json();
        if (body && body.userId) {
          userId = body.userId;
        }
      } catch {}
    }

    if (userId) {
      // Check if user is a temporary admin (has active break-glass session)
      try {
        hasActiveBreakGlass = await isBreakGlassActive(userId);
        if (hasActiveBreakGlass) {
          // Automatically deactivate break-glass session on logout
          try {
            await deactivateBreakGlass(userId, userId);
            // The deactivation is already logged by deactivateBreakGlass function
          } catch (error) {
            console.error("Error deactivating break-glass on logout:", error);
            // Continue with logout even if deactivation fails
          }
        }
      } catch {}

      // Log logout before session is destroyed (if session info is available)
      try {
        await logAction({
          userId,
          action: "USER_LOGOUT",
          module: "User",
          reason:
            userName && userEmail
              ? `User logged out: ${userName} (${userEmail})`
              : `User logged out`,
          status: "SUCCESS",
          before: {
            roles: userRoles,
          },
          metadata: {
            logoutType: "manual",
            sessionEnded: true,
            breakGlassDeactivated: hasActiveBreakGlass,
          },
        });
      } catch {}
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout logging error:", error);
    // Don't fail logout if logging fails
    return NextResponse.json({ success: true });
  }
}
