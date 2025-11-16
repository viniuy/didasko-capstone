// app/api/courses/[slug]/students/import/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface StudentImportRow {
  "Student Number": string;
  "Full Name": string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ studentNumber: string; message: string }>;
  total: number;
  detailedFeedback: Array<{
    row: number;
    studentNumber: string;
    fullName: string;
    status: "imported" | "skipped" | "error";
    message: string;
  }>;
}

// Helper function to parse full name
function parseFullName(fullName: string) {
  // Expected format: "Dela Cruz, Juan A." or "Santos, Maria B."
  const parts = fullName.split(",").map((p) => p.trim());

  if (parts.length < 2) {
    return null;
  }

  const lastName = parts[0];
  const firstAndMiddle = parts[1].split(" ");

  const firstName = firstAndMiddle[0];
  const middleInitial =
    firstAndMiddle.length > 1
      ? firstAndMiddle[firstAndMiddle.length - 1].replace(".", "")
      : "";

  return {
    lastName,
    firstName,
    middleInitial: middleInitial || undefined,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ course_slug: string }> }
) {
  try {
    const { course_slug } = await params;
    const body = await request.json();
    const { students } = body as { students: StudentImportRow[] };

    if (!students || !Array.isArray(students)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    // Find the course
    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
      include: {
        students: {
          select: { studentId: true },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Get already enrolled student IDs for this course
    const enrolledStudentIds = new Set(course.students.map((s) => s.studentId));

    const result: ImportResult = {
      imported: 0,
      skipped: 0,
      errors: [],
      total: students.length,
      detailedFeedback: [],
    };

    // Process each student
    for (let i = 0; i < students.length; i++) {
      const row = students[i];
      const rowNumber = i + 2; // +2 because Excel starts at 1 and has header row

      const studentNumber = row["Student Number"]?.toString().trim();
      const fullName = row["Full Name"]?.trim();

      // Validate required fields
      if (!studentNumber || !fullName) {
        result.errors.push({
          studentNumber: studentNumber || "N/A",
          message: "Missing required fields",
        });
        result.detailedFeedback.push({
          row: rowNumber,
          studentNumber: studentNumber || "N/A",
          fullName: fullName || "N/A",
          status: "error",
          message: "Missing Student Number or Full Name",
        });
        continue;
      }

      // Parse the full name
      const parsedName = parseFullName(fullName);
      if (!parsedName) {
        result.errors.push({
          studentNumber,
          message: "Invalid name format. Expected: 'Last Name, First Name M.'",
        });
        result.detailedFeedback.push({
          row: rowNumber,
          studentNumber,
          fullName,
          status: "error",
          message: "Invalid name format. Use: 'Last Name, First Name M.'",
        });
        continue;
      }

      try {
        // Check if student already enrolled in this course
        if (enrolledStudentIds.has(studentNumber)) {
          result.skipped++;
          result.detailedFeedback.push({
            row: rowNumber,
            studentNumber,
            fullName,
            status: "skipped",
            message: "Already enrolled in this course",
          });
          continue;
        }

        // Find student in database and check for RFID
        const existingStudent = await prisma.student.findUnique({
          where: { studentId: studentNumber },
          select: {
            id: true,
            studentId: true,
            rfid_id: true,
            firstName: true,
            lastName: true,
          },
        });

        if (!existingStudent) {
          // Student doesn't exist in database
          result.skipped++;
          result.detailedFeedback.push({
            row: rowNumber,
            studentNumber,
            fullName,
            status: "skipped",
            message: "Student not found in database",
          });
          continue;
        }

        if (!existingStudent.rfid_id) {
          // Student exists but has no RFID
          result.skipped++;
          result.detailedFeedback.push({
            row: rowNumber,
            studentNumber,
            fullName,
            status: "skipped",
            message: "No RFID card registered",
          });
          continue;
        }

        // Add student to course
        await prisma.course.update({
          where: { id: course.id },
          data: {
            students: {
              connect: { id: existingStudent.id },
            },
          },
        });

        result.imported++;
        result.detailedFeedback.push({
          row: rowNumber,
          studentNumber,
          fullName,
          status: "imported",
          message: `Successfully added (RFID: ${existingStudent.rfid_id})`,
        });
      } catch (error) {
        console.error(`Error processing student ${studentNumber}:`, error);
        result.errors.push({
          studentNumber,
          message: "Database error during import",
        });
        result.detailedFeedback.push({
          row: rowNumber,
          studentNumber,
          fullName,
          status: "error",
          message: "Failed to add to course",
        });
      }
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Failed to import students" },
      { status: 500 }
    );
  }
}
