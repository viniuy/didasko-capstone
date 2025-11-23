// app/api/courses/[slug]/students/import/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { logAction, generateBatchId } from "@/lib/audit";

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

// Helper function to find student by ID, handling leading zeros
// Excel often strips leading zeros, so we try both exact match and normalized match
async function findStudentByFlexibleId(studentId: string) {
  // Try exact match first
  let student = await prisma.student.findUnique({
    where: { studentId: studentId },
    select: {
      id: true,
      studentId: true,
      rfid_id: true,
      firstName: true,
      lastName: true,
      middleInitial: true,
    },
  });

  if (student) {
    return student;
  }

  // If not found, try removing leading zeros from the search ID
  const normalizedSearchId = studentId.replace(/^0+/, "");
  if (normalizedSearchId !== studentId) {
    student = await prisma.student.findUnique({
      where: { studentId: normalizedSearchId },
      select: {
        id: true,
        studentId: true,
        rfid_id: true,
        firstName: true,
        lastName: true,
        middleInitial: true,
      },
    });
    if (student) {
      return student;
    }
  }

  // If still not found, try adding leading zeros to match common patterns
  // Common student ID lengths: 11 digits (e.g., 02000284909)
  const targetLength = 11;
  if (studentId.length < targetLength && /^\d+$/.test(studentId)) {
    const paddedId = studentId.padStart(targetLength, "0");
    student = await prisma.student.findUnique({
      where: { studentId: paddedId },
      select: {
        id: true,
        studentId: true,
        rfid_id: true,
        firstName: true,
        lastName: true,
        middleInitial: true,
      },
    });
    if (student) {
      return student;
    }
  }

  // Try finding by removing leading zeros from database IDs
  // This is a fallback - search all students and compare normalized IDs
  // Note: This is less efficient, so we only do it if other methods fail
  const allStudents = await prisma.student.findMany({
    where: {
      studentId: {
        startsWith: normalizedSearchId,
      },
    },
    select: {
      id: true,
      studentId: true,
      rfid_id: true,
      firstName: true,
      lastName: true,
      middleInitial: true,
    },
  });

  // Find student where normalized IDs match
  for (const s of allStudents) {
    const normalizedDbId = s.studentId.replace(/^0+/, "");
    if (normalizedDbId === normalizedSearchId || normalizedDbId === studentId) {
      return s;
    }
  }

  return null;
}

// Helper function to parse full name
// Expected format: "First Name M." or "First Name" (last name comes from database)
function parseFullName(fullName: string) {
  if (!fullName || !fullName.trim()) {
    return null;
  }

  const trimmed = fullName.trim();
  const parts = trimmed.split(" ");

  // If only one part, it's just the first name
  if (parts.length === 1) {
    return {
      firstName: parts[0],
      middleInitial: undefined,
    };
  }

  // If multiple parts, last part is likely the middle initial
  // Handle cases like "Juan A." or "Maria B" or "John Michael"
  const firstName = parts.slice(0, -1).join(" "); // All parts except the last
  const lastPart = parts[parts.length - 1];

  // Check if last part looks like a middle initial (single letter, possibly with period)
  const middleInitialMatch = lastPart.replace(".", "").trim();
  const isMiddleInitial = middleInitialMatch.length === 1;

  if (isMiddleInitial) {
    return {
      firstName: firstName,
      middleInitial: middleInitialMatch,
    };
  } else {
    // Last part is part of the first name (e.g., "John Michael")
    return {
      firstName: trimmed,
      middleInitial: undefined,
    };
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ course_slug: string }> }
) {
  let course_slug: string = "";
  let body: { students?: StudentImportRow[] } = {};
  const batchId = generateBatchId();
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const paramsData = await params;
    course_slug = paramsData.course_slug;
    body = await request.json();
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

      // Parse the full name (first name and optional middle initial)
      const parsedName = parseFullName(fullName);
      if (!parsedName) {
        result.errors.push({
          studentNumber,
          message:
            "Invalid name format. Expected: 'First Name' or 'First Name M.'",
        });
        result.detailedFeedback.push({
          row: rowNumber,
          studentNumber,
          fullName,
          status: "error",
          message: "Invalid name format. Use: 'First Name' or 'First Name M.'",
        });
        continue;
      }

      try {
        // Check if student already enrolled in this course
        // Use flexible matching to handle leading zeros
        const normalizedStudentNumber = studentNumber.replace(/^0+/, "");
        const isEnrolled = Array.from(enrolledStudentIds).some((enrolledId) => {
          const normalizedEnrolledId = enrolledId.replace(/^0+/, "");
          return (
            enrolledId === studentNumber ||
            normalizedEnrolledId === normalizedStudentNumber ||
            normalizedEnrolledId === studentNumber ||
            enrolledId === normalizedStudentNumber
          );
        });

        if (isEnrolled) {
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
        // Last name comes from the database record
        // Use flexible ID matching to handle leading zeros from Excel
        const existingStudent = await findStudentByFlexibleId(studentNumber);

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

        // Optional: Verify that the first name matches (case-insensitive)
        // This helps catch data entry errors
        const dbFirstName = existingStudent.firstName?.toLowerCase().trim();
        const importFirstName = parsedName.firstName.toLowerCase().trim();
        if (dbFirstName && dbFirstName !== importFirstName) {
          // Names don't match, but we'll still proceed with a warning
          // You can uncomment the continue below to skip mismatched names
          // result.skipped++;
          // result.detailedFeedback.push({
          //   row: rowNumber,
          //   studentNumber,
          //   fullName,
          //   status: "skipped",
          //   message: `Name mismatch: Database has "${existingStudent.firstName}" but import has "${parsedName.firstName}"`,
          // });
          // continue;
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

    // Log import operation with batch tracking
    try {
      await logAction({
        userId: session.user.id,
        action: "Student Import",
        module: "Student",
        reason: `Imported ${result.imported} student(s) to course ${course.code}. Skipped: ${result.skipped}, Errors: ${result.errors.length}`,
        batchId,
        status: result.errors.length > 0 ? "FAILED" : "SUCCESS",
        after: {
          courseId: course.id,
          courseCode: course.code,
          imported: result.imported,
          skipped: result.skipped,
          errors: result.errors.length,
          total: result.total,
          source: "import",
        },
        metadata: {
          importType: "students",
          courseSlug: course_slug,
          recordCount: result.total,
          successCount: result.imported,
          errorCount: result.errors.length,
          skippedCount: result.skipped,
        },
      });
    } catch (error) {
      console.error("Error logging import:", error);
      // Don't fail import if logging fails
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Import error:", error);

    // Log failure
    try {
      const session = await getServerSession(authOptions);
      if (session?.user) {
        await logAction({
          userId: session.user.id,
          action: "Student Import",
          module: "Student",
          reason: `Failed to import students to course`,
          status: "FAILED",
          batchId,
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
          metadata: {
            courseSlug: course_slug,
            attemptedCount: body?.students?.length || 0,
          },
        });
      }
    } catch (logError) {
      console.error("Error logging student import failure:", logError);
    }

    return NextResponse.json(
      { error: "Failed to import students" },
      { status: 500 }
    );
  }
}
