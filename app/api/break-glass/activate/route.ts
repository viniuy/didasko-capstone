import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { activateBreakGlass } from "@/lib/breakGlass";
import { requireAdmin, requirePermission, handleAuthError } from "@/lib/authz";
import { Permission } from "@/lib/roles";
import { withLogging } from "@/lib/withLogging";

export const POST = withLogging(
  { action: "BreakGlass Activated", module: "Security" },
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);

      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Only Academic Head can activate break-glass
      if (session.user.role !== "ACADEMIC_HEAD") {
        return NextResponse.json(
          { error: "Only Academic Head can activate break-glass override" },
          { status: 403 }
        );
      }

      const body = await req.json();
      const { facultyUserId, reason } = body;

      if (!facultyUserId || !reason) {
        return NextResponse.json(
          { error: "facultyUserId and reason are required" },
          { status: 400 }
        );
      }

      // Academic Head cannot promote themselves
      if (facultyUserId === session.user.id) {
        return NextResponse.json(
          { error: "Academic Head cannot promote themselves to Admin" },
          { status: 403 }
        );
      }

      // Verify the selected user is a Faculty member
      const { prisma } = await import("@/lib/prisma");
      const facultyUser = await prisma.user.findUnique({
        where: { id: facultyUserId },
        select: { id: true, role: true, name: true, email: true },
      });

      if (!facultyUser) {
        return NextResponse.json(
          { error: "Faculty user not found" },
          { status: 404 }
        );
      }

      if (facultyUser.role !== "FACULTY") {
        return NextResponse.json(
          { error: "Break-glass can only be activated for Faculty members" },
          { status: 400 }
        );
      }

      // Activate break-glass (promotes Faculty to Admin)
      await activateBreakGlass(facultyUserId, reason, session.user.id);

      return NextResponse.json({
        success: true,
        message: `Faculty member ${facultyUser.name} has been temporarily promoted to Admin`,
      });
    } catch (error: any) {
      if (error.message) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return handleAuthError(error);
    }
  }
);
