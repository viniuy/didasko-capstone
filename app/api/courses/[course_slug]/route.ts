import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getCourseBySlug, updateCourse, deleteCourse } from "@/lib/services";
import { CourseUpdateInput } from "@/shared/types/course";

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

//@ts-ignore
export async function GET(request: Request, { params }: { params }) {
  const { course_slug } = await params;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const course = await getCourseBySlug(course_slug);

  if (!course)
    return NextResponse.json({ error: "Course not found" }, { status: 404 });

  return NextResponse.json(course);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ course_slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { course_slug } = await params;
    const body = await request.json();
    const { code, title, room, semester, section, facultyId, academicYear } =
      body as CourseUpdateInput;

    // Validate required fields
    if (
      !code ||
      !title ||
      !facultyId ||
      !semester ||
      !section ||
      !academicYear
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    try {
      const course = await updateCourse(course_slug, {
        code,
        title,
        room,
        semester,
        section,
        facultyId,
        academicYear,
      });

      return NextResponse.json(course);
    } catch (error: any) {
      if (error.message.includes("already exists")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
  } catch (error: any) {
    console.error("Error updating course:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update course" },
      { status: 500 }
    );
  }
}
//@ts-ignore
export async function DELETE(request: Request, { params }: { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { course_slug } = await params;

    await deleteCourse(course_slug);

    return NextResponse.json({ message: "Course deleted successfully" });
  } catch (error) {
    console.error("Error deleting course:", error);
    return NextResponse.json(
      { error: "Failed to delete course" },
      { status: 500 }
    );
  }
}
