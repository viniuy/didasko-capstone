import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getFacultyStats } from "@/lib/services";


// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stats = await getFacultyStats(session.user.id);

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching faculty stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch faculty stats" },
      { status: 500 }
    );
  }
}
