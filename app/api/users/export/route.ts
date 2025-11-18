import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { logAction, generateBatchId } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { count, filters } = body;

    // Generate batch ID for this export
    const batchId = generateBatchId();

    // Log export operation with metadata
    await logAction({
      userId: session.user.id,
      action: "USERS_EXPORTED",
      module: "User Management",
      reason: `Exported ${count || 0} user(s)${filters ? ` with filters` : ""}`,
      batchId,
      status: "SUCCESS",
      after: {
        exportType: "users",
        count: count || 0,
        fileFormat: "Excel",
      },
      metadata: {
        exportType: "users",
        fileFormat: "xlsx",
        recordCount: count || 0,
        filters: filters || null,
        exportedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error logging user export:", error);
    // Don't fail export if logging fails
    return NextResponse.json({ success: true });
  }
}
