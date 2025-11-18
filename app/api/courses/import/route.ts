// app/api/courses/import/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { PrismaClient, CourseStatus } from "@prisma/client";
import { logAction, generateBatchId } from "@/lib/audit";

const prisma = new PrismaClient();

interface ImportRow {
  "Course Code": string;
  "Course Title": string;
  Room: string;
  Semester: string;
  "Academic Year": string;
  "Class Number": string;
  Section: string;
  Status: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ code: string; message: string }>;
  total: number;
  detailedFeedback: Array<{
    row: number;
    code: string;
    status: string;
    message: string;
  }>;
  importedCourses: Array<{
    id: string;
    code: string;
    title: string;
    section: string;
    room: string;
    slug: string;
  }>;
}

// Helper function to generate unique slug
function generateSlug(code: string, section: string): string {
  const timestamp = Date.now();
  return `${code.toLowerCase()}-${section.toLowerCase()}-${timestamp}`;
}

// Helper function to validate and normalize status
function normalizeStatus(status: string): CourseStatus {
  const statusUpper = status.trim().toUpperCase();

  // Handle various input formats
  if (statusUpper === "ACTIVE" || statusUpper === "ACT") {
    return CourseStatus.ACTIVE;
  } else if (statusUpper === "INACTIVE" || statusUpper === "INACT") {
    return CourseStatus.INACTIVE;
  } else if (statusUpper === "ARCHIVED" || statusUpper === "ARCH") {
    return CourseStatus.ARCHIVED;
  }

  // Default to ACTIVE
  return CourseStatus.ACTIVE;
}

// Helper function to normalize semester
function normalizeSemester(semester: string): string {
  const semesterLower = semester.trim().toLowerCase();

  if (
    semesterLower.includes("1st") ||
    semesterLower.includes("first") ||
    semesterLower === "1"
  ) {
    return "1st Semester";
  } else if (
    semesterLower.includes("2nd") ||
    semesterLower.includes("second") ||
    semesterLower === "2"
  ) {
    return "2nd Semester";
  }

  return semester.trim();
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    if (!Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid data format. Expected an array of course data." },
        { status: 400 }
      );
    }

    const coursesData: ImportRow[] = body;

    const results: ImportResult = {
      imported: 0,
      skipped: 0,
      errors: [],
      total: coursesData.length,
      detailedFeedback: [],
      importedCourses: [],
    };

    // Process each course
    for (let i = 0; i < coursesData.length; i++) {
      const row = coursesData[i];
      const rowNumber = i + 1;

      try {
        // Validate required fields
        if (!row["Course Code"]?.trim()) {
          results.skipped++;
          results.errors.push({
            code: "N/A",
            message: `Row ${rowNumber}: Course Code is required`,
          });
          results.detailedFeedback.push({
            row: rowNumber,
            code: "N/A",
            status: "skipped",
            message: "Course Code is required",
          });
          continue;
        }

        if (!row["Course Title"]?.trim()) {
          results.skipped++;
          results.errors.push({
            code: row["Course Code"],
            message: `Row ${rowNumber}: Course Title is required`,
          });
          results.detailedFeedback.push({
            row: rowNumber,
            code: row["Course Code"],
            status: "skipped",
            message: "Course Title is required",
          });
          continue;
        }

        // Prepare course data
        const code = row["Course Code"].trim().toUpperCase();
        const title = row["Course Title"].trim();
        const room = row["Room"]?.trim().toUpperCase() || "TBA";
        const semester = normalizeSemester(row["Semester"] || "1st Semester");
        const academicYear =
          row["Academic Year"]?.trim() || new Date().getFullYear().toString();
        const section = row["Section"]?.trim().toUpperCase() || "A";
        const status = normalizeStatus(row["Status"] || "ACTIVE");

        // Parse and validate class number
        let classNumber = 1;
        if (row["Class Number"]) {
          const parsed = parseInt(row["Class Number"].toString().trim());
          if (isNaN(parsed) || parsed < 1) {
            results.skipped++;
            results.errors.push({
              code,
              message: `Row ${rowNumber}: Invalid Class Number. Must be a positive integer.`,
            });
            results.detailedFeedback.push({
              row: rowNumber,
              code,
              status: "skipped",
              message: "Invalid Class Number",
            });
            continue;
          }
          classNumber = parsed;
        }

        // Check if course already exists
        const existingCourse = await prisma.course.findFirst({
          where: {
            code,
            section,
            academicYear,
            semester,
          },
        });

        if (existingCourse) {
          results.skipped++;
          results.errors.push({
            code,
            message: `Row ${rowNumber}: Course ${code}-${section} already exists for ${academicYear} ${semester}`,
          });
          results.detailedFeedback.push({
            row: rowNumber,
            code,
            status: "skipped",
            message: "Course already exists",
          });
          continue;
        }

        // Generate unique slug
        const slug = generateSlug(code, section);

        // Create the course (WITHOUT schedules)
        const newCourse = await prisma.course.create({
          data: {
            code,
            title,
            room,
            semester,
            academicYear,
            classNumber,
            section,
            status,
            slug,
            facultyId: session.user.id, // Assign to current user
          },
          include: {
            faculty: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });

        // Success!
        results.imported++;
        results.importedCourses.push({
          id: newCourse.id,
          code: newCourse.code,
          title: newCourse.title,
          section: newCourse.section,
          room: newCourse.room,
          slug: newCourse.slug,
        });

        results.detailedFeedback.push({
          row: rowNumber,
          code: newCourse.code,
          status: "success",
          message: "Course imported successfully (schedules pending)",
        });
      } catch (error) {
        console.error(`Error importing course at row ${rowNumber}:`, error);

        results.skipped++;
        results.errors.push({
          code: row["Course Code"] || "N/A",
          message: `Row ${rowNumber}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        });
        results.detailedFeedback.push({
          row: rowNumber,
          code: row["Course Code"] || "N/A",
          status: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      {
        error: "Failed to import courses",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Optional: GET endpoint to get import template or validation rules
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Return import template structure
    return NextResponse.json({
      requiredFields: [
        "Course Code",
        "Course Title",
        "Room",
        "Semester",
        "Academic Year",
        "Class Number",
        "Section",
        "Status",
      ],
      validStatuses: ["ACTIVE", "INACTIVE", "ARCHIVED"],
      validSemesters: ["1st Semester", "2nd Semester"],
      example: {
        "Course Code": "CS101",
        "Course Title": "Introduction to Programming",
        Room: "A101",
        Semester: "1st Semester",
        "Academic Year": "2024-2025",
        "Class Number": "1",
        Section: "A",
        Status: "Active",
      },
    });
  } catch (error) {
    console.error("Error fetching import info:", error);
    return NextResponse.json(
      { error: "Failed to fetch import information" },
      { status: 500 }
    );
  }
}

export async function POST_IMPORT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generate batch ID for this import operation
    const batchId = generateBatchId();

    const body = await request.json();
    const coursesData = body; // Array of course data from Excel

    if (!Array.isArray(coursesData)) {
      return NextResponse.json(
        { error: "Invalid data format" },
        { status: 400 }
      );
    }

    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as any[],
      total: coursesData.length,
      detailedFeedback: [] as any[],
      importedCourses: [] as any[], // NEW: Return imported courses for schedule assignment
    };

    for (let i = 0; i < coursesData.length; i++) {
      const row = coursesData[i];
      const rowNumber = i + 1;

      try {
        // Validate required fields
        if (!row["Course Code"] || !row["Course Title"]) {
          results.skipped++;
          results.errors.push({
            code: row["Course Code"] || "N/A",
            message: "Missing required fields",
          });
          results.detailedFeedback.push({
            row: rowNumber,
            code: row["Course Code"] || "N/A",
            status: "skipped",
            message: "Missing required fields",
          });
          continue;
        }

        // Check if course already exists
        const existingCourse = await prisma.course.findFirst({
          where: {
            code: row["Course Code"].trim().toUpperCase(),
            section: row["Section"]?.trim().toUpperCase() || "A",
            academicYear:
              row["Academic Year"]?.trim() ||
              new Date().getFullYear().toString(),
          },
        });

        if (existingCourse) {
          results.skipped++;
          results.errors.push({
            code: row["Course Code"],
            message: "Course already exists",
          });
          results.detailedFeedback.push({
            row: rowNumber,
            code: row["Course Code"],
            status: "skipped",
            message: "Course already exists",
          });
          continue;
        }

        // Parse status
        let status = "ACTIVE";
        if (row["Status"]) {
          const statusStr = row["Status"].toString().toUpperCase();
          if (["ACTIVE", "INACTIVE", "ARCHIVED"].includes(statusStr)) {
            status = statusStr;
          }
        }

        // Create course WITHOUT schedules
        const newCourse = await prisma.course.create({
          data: {
            code: row["Course Code"].trim().toUpperCase(),
            title: row["Course Title"].trim(),
            room: row["Room"]?.trim().toUpperCase() || "TBA",
            semester: row["Semester"]?.trim() || "1st Semester",
            academicYear:
              row["Academic Year"]?.trim() ||
              new Date().getFullYear().toString(),
            classNumber: parseInt(row["Class Number"]) || 1,
            section: row["Section"]?.trim().toUpperCase() || "A",
            status: status as any,
            facultyId: session.user.id,
            slug: `${row["Course Code"].trim().toLowerCase()}-${
              row["Section"]?.trim().toLowerCase() || "a"
            }-${Date.now()}`,
          },
          include: {
            faculty: {
              select: { name: true, email: true },
            },
          },
        });

        results.imported++;
        results.importedCourses.push({
          id: newCourse.id,
          code: newCourse.code,
          title: newCourse.title,
          section: newCourse.section,
          room: newCourse.room,
          slug: newCourse.slug,
        });

        results.detailedFeedback.push({
          row: rowNumber,
          code: newCourse.code,
          status: "success",
          message: "Course imported successfully (schedules pending)",
        });
      } catch (error) {
        results.skipped++;
        results.errors.push({
          code: row["Course Code"] || "N/A",
          message: error instanceof Error ? error.message : "Unknown error",
        });
        results.detailedFeedback.push({
          row: rowNumber,
          code: row["Course Code"] || "N/A",
          status: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Log import operation with batch tracking
    try {
      await logAction({
        userId: session.user.id,
        action: "COURSES_IMPORTED",
        module: "Course Management",
        reason: `Imported ${results.imported} course(s). Skipped: ${results.skipped}, Errors: ${results.errors.length}`,
        batchId,
        status: results.errors.length > 0 ? "FAILED" : "SUCCESS",
        after: {
          imported: results.imported,
          skipped: results.skipped,
          errors: results.errors.length,
          total: results.total,
          source: "import",
        },
        metadata: {
          importType: "courses",
          recordCount: results.total,
          successCount: results.imported,
          errorCount: results.errors.length,
          skippedCount: results.skipped,
          importedCourses: results.importedCourses.map((c: any) => ({
            code: c.code,
            title: c.title,
            section: c.section,
          })),
        },
      });
    } catch (error) {
      console.error("Error logging import:", error);
      // Don't fail import if logging fails
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Failed to import courses" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
