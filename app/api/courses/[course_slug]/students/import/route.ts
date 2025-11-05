import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

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

        // Create or update student in database
        const savedStudent = await prisma.student.upsert({
          where: { studentId: studentId },
          update: {
            firstName: firstName,
            lastName: lastName,
            middleInitial: middleInitial,
          },
          create: {
            studentId: studentId,
            firstName: firstName,
            lastName: lastName,
            middleInitial: middleInitial,
          },
        });

        // Connect student to course
        await prisma.course.update({
          where: { id: courseId },
          data: {
            students: {
              connect: { id: savedStudent.id },
            },
          },
        });

        imported++;
        existingStudentIds.add(studentId); // Update the set

        detailedFeedback.push({
          row: rowNumber,
          studentId: studentId,
          status: "imported",
          message: "Successfully imported",
          id: savedStudent.id,
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
