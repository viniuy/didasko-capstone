import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { logAction } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { filter, count, exportedAt } = body;

    // Log course export
    await logAction({
      userId: session.user.id,
      action: "Course Export",
      module: "Course",
      reason: `Exported ${count} course(s) with filter: ${filter}`,
      status: "SUCCESS",
      metadata: {
        exportFilter: filter || "ALL",
        exportedCount: count || 0,
        exportedAt: exportedAt || new Date().toISOString(),
        exportType: "course_list",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error logging course export:", error);
    // Don't fail the request if logging fails
    return NextResponse.json({ success: true });
  }
}
