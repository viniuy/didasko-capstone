import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getCourses, createCourse } from "@/lib/services";
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
      status: undefined, // Default to all courses
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

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      code,
      title,
      section,
      room,
      semester,
      academicYear,
      classNumber,
      status,
      facultyId,
      schedules,
    } = body;

    // Validate required fields
    if (!code || !title || !section || !semester || !academicYear) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    try {
      const course = await createCourse({
        code,
        title,
        section,
        room,
        semester,
        academicYear,
        classNumber,
        status,
        facultyId,
        schedules,
      });

      return NextResponse.json(course, { status: 201 });
    } catch (error: any) {
      if (error.message.includes("already exists")) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }
  } catch (error: any) {
    console.error("Error creating course:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create course" },
      { status: 500 }
    );
  }
}
