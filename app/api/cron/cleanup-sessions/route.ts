import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (optional but recommended for security)
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete expired sessions
    const result = await prisma.userSession.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    console.log(`🧹 Cleaned up ${result.count} expired sessions`);

    return NextResponse.json({
      success: true,
      deletedSessions: result.count,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error cleaning up sessions:", error);
    return NextResponse.json(
      {
        error: "Failed to cleanup sessions",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
