import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getCourseStats } from "@/lib/services";

export async function GET(
  req: NextRequest,
  context: { params: { course_slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { course_slug } = await context.params;

    if (!course_slug || typeof course_slug !== "string") {
      return NextResponse.json(
        { error: "Invalid course_slug parameter" },
        { status: 400 }
      );
    }

    const stats = await getCourseStats(course_slug);

    if (!stats) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching course stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch course statistics" },
      { status: 500 }
    );
  }
}
