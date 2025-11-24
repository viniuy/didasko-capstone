import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getArchivedCourses } from "@/lib/services";

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filters = {
      facultyId: searchParams.get("facultyId") || undefined,
      search: searchParams.get("search") || undefined,
    };

    const courses = await getArchivedCourses(filters);

    return NextResponse.json(courses);
  } catch (error) {
    console.error("Error fetching archived courses:", error);
    return NextResponse.json(
      { error: "Failed to fetch archived courses" },
      { status: 500 }
    );
  }
}
