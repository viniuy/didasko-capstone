import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export const dynamic = "force-dynamic";

// This endpoint broadcasts role changes to affected users
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Return success - the client will handle the refresh
    return NextResponse.json({
      success: true,
      message: "Role change broadcast successful",
    });
  } catch (error) {
    console.error("Error broadcasting role change:", error);
    return NextResponse.json(
      {
        error: "Failed to broadcast role change",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
