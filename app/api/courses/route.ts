import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getCourses, createCourse } from "@/lib/services";
import { CourseResponse } from "@/shared/types/course";
import { logAction } from "@/lib/audit";

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
  let body: any = {};
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    body = await request.json();
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
      // Log validation failure
      try {
        await logAction({
          userId: session.user.id,
          action: "Course Create",
          module: "Course",
          reason: `Failed to create course: Missing required fields`,
          status: "FAILED",
          errorMessage: "Missing required fields",
          metadata: {
            attemptedData: { code, title, section, semester, academicYear },
          },
        });
      } catch (logError) {
        console.error("Error logging validation failure:", logError);
      }

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

      // Log successful course creation
      try {
        await logAction({
          userId: session.user.id,
          action: "Course Create",
          module: "Course",
          reason: `Course created: ${course.code} - ${course.title}`,
          status: "SUCCESS",
          after: {
            id: course.id,
            code: course.code,
            title: course.title,
            section: course.section,
            semester: course.semester,
            academicYear: course.academicYear,
            status: course.status,
            facultyId: course.facultyId,
            source: "manual",
          },
          metadata: {
            entityType: "Course",
            entityId: course.id,
            entityName: `${course.code} - ${course.title}`,
            source: "manual",
            scheduleCount: course.schedules?.length || 0,
          },
        });
      } catch (logError) {
        console.error("Error logging course creation:", logError);
        // Don't fail course creation if logging fails
      }

      return NextResponse.json(course, { status: 201 });
    } catch (error: any) {
      // Log failure for duplicate/conflict errors
      try {
        await logAction({
          userId: session.user.id,
          action: "Course Create",
          module: "Course",
          reason: `Failed to create course: ${code} - ${title}`,
          status: "FAILED",
          errorMessage: error.message || "Unknown error",
          metadata: {
            attemptedData: {
              code,
              title,
              section,
              semester,
              academicYear,
            },
            errorType: error.message.includes("already exists")
              ? "duplicate"
              : "unknown",
          },
        });
      } catch (logError) {
        console.error("Error logging course creation failure:", logError);
      }

      if (error.message.includes("already exists")) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }
  } catch (error: any) {
    console.error("Error creating course:", error);

    // Log general failure
    try {
      const session = await getServerSession(authOptions);
      if (session?.user) {
        await logAction({
          userId: session.user.id,
          action: "Course Create",
          module: "Course",
          reason: `Failed to create course`,
          status: "FAILED",
          errorMessage: error.message || "Unknown error",
          metadata: {
            attemptedData: body,
          },
        });
      }
    } catch (logError) {
      console.error("Error logging course creation failure:", logError);
    }

    return NextResponse.json(
      { error: error.message || "Failed to create course" },
      { status: 500 }
    );
  }
}
