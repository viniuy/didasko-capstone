import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getCourseStudentsWithAttendance } from "@/lib/services";
import { prisma } from "@/lib/prisma";
//@ts-ignore

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(request: Request, { params }: { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized - No session" },
        { status: 401 }
      );
    }

    const { course_slug } = await params;
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const date = dateParam ? new Date(dateParam) : undefined;

    const result = await getCourseStudentsWithAttendance(course_slug, date);

    if (!result) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching students:", error);
    return NextResponse.json(
      { error: "Failed to fetch students" },
      { status: 500 }
    );
  }
}
//@ts-ignore
export async function POST(
  request: Request,
  { params }: { params: Promise<{ course_slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized - No session" },
        { status: 401 }
      );
    }

    // Await params
    const { course_slug } = await params;
    const body = await request.json();

    if (!Array.isArray(body) || body.length === 0) {
      return NextResponse.json(
        { error: "Invalid input data - must be an array" },
        { status: 400 }
      );
    }

    // Find course using slug
    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
      select: {
        id: true,
        students: {
          select: { id: true, studentId: true },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const courseId = course.id;
    const existingStudentIds = new Set(course.students.map((s) => s.studentId));

    let imported = 0;
    let skipped = 0;
    const errors: Array<{ studentId: string; message: string }> = [];
    const detailedFeedback: Array<{
      row: number;
      studentId: string;
      status: string;
      message: string;
      id?: string;
    }> = [];

    // Process each student
    for (let index = 0; index < body.length; index++) {
      const studentData = body[index];
      const rowNumber = index + 1;

      try {
        // Map the frontend field names to backend field names
        const studentId = studentData["Student ID"]?.toString().trim();
        const firstName = studentData["First Name"]?.toString().trim();
        const lastName = studentData["Last Name"]?.toString().trim();
        const middleInitial =
          studentData["Middle Initial"]?.toString().trim() || null;

        // Validate required fields
        if (!studentId || !firstName || !lastName) {
          skipped++;
          const missingFields = [];
          if (!studentId) missingFields.push("Student ID");
          if (!firstName) missingFields.push("First Name");
          if (!lastName) missingFields.push("Last Name");

          errors.push({
            studentId: studentId || "N/A",
            message: `Missing required fields: ${missingFields.join(", ")}`,
          });

          detailedFeedback.push({
            row: rowNumber,
            studentId: studentId || "N/A",
            status: "error",
            message: `Missing required fields: ${missingFields.join(", ")}`,
          });
          continue;
        }

        // Check if student is already enrolled in this course
        if (existingStudentIds.has(studentId)) {
          skipped++;
          detailedFeedback.push({
            row: rowNumber,
            studentId: studentId,
            status: "skipped",
            message: "Already enrolled in this course",
          });
          continue;
        }

        // Check if student exists in database with RFID
        const existingStudent = await prisma.student.findUnique({
          where: { studentId: studentId },
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
            middleInitial: true,
            rfid_id: true,
          },
        });

        // If student doesn't exist OR doesn't have RFID, skip
        if (!existingStudent) {
          skipped++;
          detailedFeedback.push({
            row: rowNumber,
            studentId: studentId,
            status: "skipped",
            message: "Student not found in database",
          });
          continue;
        }

        if (!existingStudent.rfid_id) {
          skipped++;
          detailedFeedback.push({
            row: rowNumber,
            studentId: studentId,
            status: "skipped",
            message: "Student does not have RFID registration",
          });
          continue;
        }

        // Connect existing student to course
        await prisma.course.update({
          where: { id: courseId },
          data: {
            students: {
              connect: { id: existingStudent.id },
            },
          },
        });

        imported++;
        existingStudentIds.add(studentId); // Update the set

        detailedFeedback.push({
          row: rowNumber,
          studentId: studentId,
          status: "imported",
          message: "Successfully added to course",
          id: existingStudent.id,
        });
      } catch (err: any) {
        const studentId = studentData["Student ID"]?.toString() || "N/A";
        const errorMessage = err?.message || "Unknown error occurred";

        errors.push({
          studentId: studentId,
          message: errorMessage,
        });

        detailedFeedback.push({
          row: rowNumber,
          studentId: studentId,
          status: "error",
          message: errorMessage,
        });
      }
    }

    return NextResponse.json({
      total: body.length,
      imported,
      skipped,
      errors,
      detailedFeedback,
    });
  } catch (error: any) {
    console.error("Import failed:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to import students",
        details: error?.toString(),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ course_slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized - No session" },
        { status: 401 }
      );
    }

    const { course_slug } = await params;
    const body = await request.json();
    const { studentIds } = body;

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json(
        { error: "Invalid student IDs" },
        { status: 400 }
      );
    }

    // Find the course
    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
      select: { id: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Remove students from course (disconnect relationship)
    await prisma.course.update({
      where: { id: course.id },
      data: {
        students: {
          disconnect: studentIds.map((id) => ({ id })),
        },
      },
    });

    // Optionally: Delete related records (attendance, grades, etc.)
    // WARNING: This will permanently delete data
    await Promise.all([
      // Delete attendance records
      prisma.attendance.deleteMany({
        where: {
          courseId: course.id,
          studentId: { in: studentIds },
        },
      }),
      // Delete term grades
      prisma.termGrade.deleteMany({
        where: {
          termConfig: { courseId: course.id },
          studentId: { in: studentIds },
        },
      }),
      // Delete assessment scores
      prisma.assessmentScore.deleteMany({
        where: {
          assessment: {
            termConfig: { courseId: course.id },
          },
          studentId: { in: studentIds },
        },
      }),
      // Delete quiz scores
      prisma.quizScore.deleteMany({
        where: {
          quiz: { courseId: course.id },
          studentId: { in: studentIds },
        },
      }),
      // Delete grade scores
      prisma.gradeScore.deleteMany({
        where: {
          courseId: course.id,
          studentId: { in: studentIds },
        },
      }),
      // Delete grades
      prisma.grade.deleteMany({
        where: {
          courseId: course.id,
          studentId: { in: studentIds },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: `Successfully removed ${studentIds.length} student${
        studentIds.length > 1 ? "s" : ""
      }`,
    });
  } catch (error: any) {
    console.error("Error removing students:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to remove students",
        details: error?.toString(),
      },
      { status: 500 }
    );
  }
}
