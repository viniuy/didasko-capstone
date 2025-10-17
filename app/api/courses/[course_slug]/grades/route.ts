import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
//@ts-ignore
export async function GET(request: Request, { params }: { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const criteriaId = searchParams.get("criteriaId");
    const courseCode = searchParams.get("courseCode");
    const courseSection = searchParams.get("courseSection");

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    if (!courseCode || !courseSection) {
      return NextResponse.json(
        { error: "Course code and section are required" },
        { status: 400 }
      );
    }

    // First find the course by code and section
    const course = await prisma.course.findFirst({
      where: {
        code: courseCode,
        section: courseSection,
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // If criteriaId is provided, fetch specific grades
    if (criteriaId) {
      const grades = await prisma.grade.findMany({
        where: {
          courseId: course.id,
          criteriaId: criteriaId,
          date: {
            gte: new Date(date + "T00:00:00.000Z"),
            lt: new Date(date + "T23:59:59.999Z"),
          },
        },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleInitial: true,
              image: true,
            },
          },
        },
      });

      console.log("Found grades:", grades);
      return NextResponse.json(grades);
    }

    // If no criteriaId, fetch all grades for the date to check existing criteria
    const grades = await prisma.grade.findMany({
      where: {
        courseId: course.id,
        date: {
          gte: new Date(date + "T00:00:00.000Z"),
          lt: new Date(date + "T23:59:59.999Z"),
        },
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleInitial: true,
            image: true,
          },
        },
      },
    });

    console.log("Found grades:", grades);
    return NextResponse.json(grades);
  } catch (error) {
    console.error("Error fetching grades:", error);
    return NextResponse.json(
      { error: "Failed to fetch grades" },
      { status: 500 }
    );
  }
}
//@ts-ignore
export async function POST(request: NextRequest, { params }: { params }) {
  try {
    const {
      date,
      criteriaId,
      grades,
      courseCode,
      courseSection,
      isRecitationCriteria,
    } = await request.json();
    const authCookie = getAuthCookie();

    console.log("POST grades request:", {
      courseId: params.courseId,
      date,
      criteriaId,
      gradesCount: grades?.length,
      isRecitationCriteria,
    });

    if (!authCookie) {
      console.log("No auth cookie found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !date ||
      !criteriaId ||
      !grades ||
      !Array.isArray(grades) ||
      !courseCode ||
      !courseSection
    ) {
      console.log("Invalid request data");
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 }
      );
    }

    // First find the course by code and section
    const course = await prisma.course.findFirst({
      where: {
        code: courseCode,
        section: courseSection,
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Get all student IDs from the grades array
    const studentIds = grades.map((grade) => grade.studentId);

    // Delete existing grades for these students on this date
    console.log("Deleting existing grades");
    await prisma.grade.deleteMany({
      where: {
        courseId: course.id,
        studentId: {
          in: studentIds,
        },
        criteriaId: criteriaId,
        date: {
          gte: new Date(date + "T00:00:00.000Z"),
          lt: new Date(date + "T23:59:59.999Z"),
        },
      },
    });

    // Create new grades
    console.log("Creating new grades");
    const createdGrades = await prisma.grade.createMany({
      data: grades.map(
        (grade: {
          studentId: string;
          scores: number[];
          total: number;
          reportingScore?: boolean;
          recitationScore?: boolean;
        }) => ({
          courseId: course.id,
          criteriaId: criteriaId,
          studentId: grade.studentId,
          value: grade.total,
          scores: grade.scores,
          total: grade.total,
          reportingScore: !isRecitationCriteria,
          recitationScore: isRecitationCriteria,
          date: new Date(date + "T00:00:00.000Z"),
        })
      ),
    });

    console.log("Created grades:", createdGrades);
    return NextResponse.json(createdGrades);
  } catch (error) {
    console.error("Error saving grades:", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      details: error instanceof Error ? error : JSON.stringify(error, null, 2),
    });
    return NextResponse.json(
      {
        error: "Failed to save grades",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
//@ts-ignore
export async function DELETE(request: Request, { params }: { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const criteriaId = searchParams.get("criteriaId");
    const date = searchParams.get("date");

    if (!criteriaId || !date) {
      return NextResponse.json(
        { error: "Criteria ID and date are required" },
        { status: 400 }
      );
    }

    // First find the course by slug
    const course = await prisma.course.findUnique({
      where: { slug: params.course_slug },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Delete grades for the specified criteria and date
    await prisma.grade.deleteMany({
      where: {
        courseId: course.id,
        criteriaId: criteriaId,
        date: {
          gte: new Date(date + "T00:00:00.000Z"),
          lt: new Date(date + "T23:59:59.999Z"),
        },
      },
    });

    return NextResponse.json({ message: "Grades deleted successfully" });
  } catch (error) {
    console.error("Error deleting grades:", error);
    return NextResponse.json(
      { error: "Failed to delete grades" },
      { status: 500 }
    );
  }
}
