import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { Course, CourseUpdateInput } from "@/shared/types/course";

export async function GET(request: Request, { params }: { params }) {
  const { course_slug } = await params;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const course = await prisma.course.findUnique({
    where: { slug: course_slug },
    include: {
      faculty: {
        select: { id: true, name: true, email: true, department: true },
      },
      students: {
        select: {
          id: true,
          lastName: true,
          firstName: true,
          middleInitial: true,
        },
      },
      schedules: true,
    },
  });

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

    // Generate new slug
    const newSlug = `${code}-${academicYear}-${section}`.toLowerCase();

    // Check if new slug already exists (excluding current course)
    const existingCourse = await prisma.course.findFirst({
      where: {
        slug: newSlug,
        NOT: { slug: course_slug },
      },
    });

    if (existingCourse) {
      return NextResponse.json(
        {
          error:
            "Course with this code, academic year, and section already exists",
        },
        { status: 400 }
      );
    }

    const course = await prisma.course.update({
      where: { slug: course_slug },
      data: {
        code,
        title,
        room,
        semester,
        section,
        facultyId,
        academicYear,
        slug: newSlug,
      },
      include: {
        faculty: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
          },
        },
        students: {
          select: {
            id: true,
            lastName: true,
            firstName: true,
            middleInitial: true,
          },
        },
        schedules: true,
      },
    });

    return NextResponse.json(course);
  } catch (error) {
    console.error("Error updating course:", error);
    return NextResponse.json(
      { error: "Failed to update course" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { course_slug } = await params;

    await prisma.course.delete({
      where: { slug: course_slug },
    });

    return NextResponse.json({ message: "Course deleted successfully" });
  } catch (error) {
    console.error("Error deleting course:", error);
    return NextResponse.json(
      { error: "Failed to delete course" },
      { status: 500 }
    );
  }
}
