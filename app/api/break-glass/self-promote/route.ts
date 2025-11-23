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
  { action: "BREAK_GLASS_SELF_PROMOTE", module: "Security" },
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);

      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Verify the user is a temporary admin
      const isTempAdmin = await isTemporaryAdmin(session.user.id);
      if (!isTempAdmin) {
        return NextResponse.json(
          { error: "You are not a temporary admin" },
          { status: 403 }
        );
      }

      const body = await req.json();
      const { promotionCode } = body;

      if (!promotionCode) {
        return NextResponse.json(
          { error: "promotionCode is required" },
          { status: 400 }
        );
      }

      // Self-promote to permanent admin
      await promoteToPermanentAdmin(
        session.user.id,
        promotionCode,
        session.user.id
      );

      return NextResponse.json({
        success: true,
        message: "You have been promoted to permanent Admin",
      });
    } catch (error: any) {
      if (error.message) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return handleAuthError(error);
    }
  }
);
