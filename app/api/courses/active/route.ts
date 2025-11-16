import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getCourses } from "@/lib/services";
import { CourseResponse } from "@/shared/types/course";

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
      department: searchParams.get("department") || undefined,
      semester: searchParams.get("semester") || undefined,
      code: searchParams.get("code") || undefined,
      section: searchParams.get("section") || undefined,
      status: "ACTIVE" as const, // Filter for active courses only
    };

    const courses = await getCourses(filters);

    const response: CourseResponse = {
      courses,
      pagination: {
        total: courses.length,
        page: 1,
        limit: courses.length,
        totalPages: 1,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching courses:", error);
    return NextResponse.json(
      { error: "Failed to fetch courses" },
      { status: 500 }
    );
  }
}
