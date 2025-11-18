import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { logAction } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { count, filters } = body;

    // Log export operation
    await logAction({
      userId: session.user.id,
      action: "USERS_EXPORTED",
      module: "User Management",
      reason: `Exported ${count || 0} user(s)${
        filters ? ` with filters: ${JSON.stringify(filters)}` : ""
      }`,
      after: {
        exportType: "users",
        count: count || 0,
        filters: filters || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error logging user export:", error);
    // Don't fail export if logging fails
    return NextResponse.json({ success: true });
  }
}
