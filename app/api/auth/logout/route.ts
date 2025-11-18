import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { logAction } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (session?.user) {
      // Log logout before session is destroyed
      await logAction({
        userId: session.user.id,
        action: "USER_LOGOUT",
        module: "Authentication",
        reason: `User logged out: ${session.user.name} (${session.user.email})`,
        before: {
          role: session.user.role,
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
