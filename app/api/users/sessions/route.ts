import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all active sessions for the user
    const sessions = await prisma.userSession.findMany({
      where: {
        userId: session.user.id,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        sessionToken: true,
        createdAt: true,
        expiresAt: true,
        deviceInfo: true,
        ipAddress: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        deviceInfo: s.deviceInfo,
        ipAddress: s.ipAddress,
        isCurrent: s.sessionToken === session.user.sessionToken ? true : false,
      })),
      totalActive: sessions.length,
    });
  } catch (error) {
    console.error("Error fetching user sessions:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch sessions",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
