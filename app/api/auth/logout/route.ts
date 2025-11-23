import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { logAction } from "@/lib/audit";


// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (session?.user) {
      // Log logout before session is destroyed
      await logAction({
        userId: session.user.id,
        action: "User Logout",
        module: "User",
        reason: `User logged out: ${session.user.name} (${session.user.email})`,
        status: "SUCCESS",
        before: {
          role: session.user.role,
        },
        metadata: {
          logoutType: "manual",
          sessionEnded: true,
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
