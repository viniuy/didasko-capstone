import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { PrismaClient, CourseStatus } from "@prisma/client";

const prisma = new PrismaClient();

interface CourseWithSchedule {
  tempId: string;
  code: string;
  title: string;
  section: string;
  room: string;
  semester: string;
  academicYear: string;
  classNumber: string;
  status: string;
  schedules: Array<{
    day: string;
    fromTime: string;
    toTime: string;
  }>;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ code: string; message: string }>;
  detailedFeedback: Array<{
    code: string;
    status: string;
    message: string;
  }>;
}

// Helper function to normalize status
function normalizeStatus(status: string): CourseStatus {
  const statusUpper = status.trim().toUpperCase();

  if (statusUpper === "INACTIVE" || statusUpper === "INACT") {
    return CourseStatus.INACTIVE;
  } else if (statusUpper === "ARCHIVED" || statusUpper === "ARCH") {
    return CourseStatus.ARCHIVED;
  }

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

// Helper function to generate unique slug
function generateSlug(code: string, section: string): string {
  const timestamp = Date.now();
  return `${code.toLowerCase()}-${section.toLowerCase()}-${timestamp}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { courses } = body;

    console.log("Received courses:", courses); // Debug log

    if (!courses || !Array.isArray(courses) || courses.length === 0) {
      return NextResponse.json(
        { error: "No courses provided" },
        { status: 400 }
      );
    }

    const results: ImportResult = {
      success: 0,
      failed: 0,
      errors: [],
      detailedFeedback: [],
    };

    // Process each course with its schedules
    for (const courseData of courses as CourseWithSchedule[]) {
      try {
        // CRITICAL: Validate that course has schedules
        if (!courseData.schedules || courseData.schedules.length === 0) {
          results.failed++;
          results.errors.push({
            code: courseData.code,
            message: "Course must have at least one schedule",
          });
          results.detailedFeedback.push({
            code: courseData.code,
            status: "failed",
            message: "Missing required schedules",
          });
          continue;
        }

        // Validate required fields
        if (!courseData.code?.trim() || !courseData.title?.trim()) {
          results.failed++;
          results.errors.push({
            code: courseData.code || "N/A",
            message: "Course code and title are required",
          });
          results.detailedFeedback.push({
            code: courseData.code || "N/A",
            status: "failed",
            message: "Missing required fields",
          });
          continue;
        }

        // Prepare course data
        const code = courseData.code.trim().toUpperCase();
        const title = courseData.title.trim();
        const section = courseData.section?.trim().toUpperCase() || "A";
        const room = courseData.room?.trim().toUpperCase() || "TBA";
        const semester = normalizeSemester(
          courseData.semester || "1st Semester"
        );
        const academicYear =
          courseData.academicYear?.trim() ||
          new Date().getFullYear().toString();
        const status = normalizeStatus(courseData.status || "ACTIVE");

        // Parse class number
        const classNumber = parseInt(courseData.classNumber) || 1;
        if (isNaN(classNumber) || classNumber < 1) {
          results.failed++;
          results.errors.push({
            code,
            message: "Invalid class number",
          });
          results.detailedFeedback.push({
            code,
            status: "failed",
            message: "Class number must be a positive integer",
          });
          continue;
        }

        // Check if course already exists (using code, section, academicYear, semester)
        const existingCourse = await prisma.course.findFirst({
          where: {
            code,
            section,
            academicYear,
            semester,
          },
        });

        if (existingCourse) {
          results.failed++;
          results.errors.push({
            code,
            message: `Course ${code}-${section} already exists for ${academicYear} ${semester}`,
          });
          results.detailedFeedback.push({
            code,
            status: "failed",
            message: "Course already exists",
          });
          continue;
        }

        // Generate unique slug
        const slug = generateSlug(code, section);

        // Validate schedules have all required fields
        const validSchedules = courseData.schedules.filter(
          (s) => s.day && s.fromTime && s.toTime
        );

        if (validSchedules.length === 0) {
          results.failed++;
          results.errors.push({
            code,
            message: "No valid schedules provided",
          });
          results.detailedFeedback.push({
            code,
            status: "failed",
            message: "All schedules are incomplete",
          });
          continue;
        }

        // Create course WITH schedules in a single transaction
        await prisma.course.create({
          data: {
            code,
            title,
            section,
            room,
            semester,
            academicYear,
            classNumber,
            status,
            slug,
            facultyId: session.user.id, // Assign to current user
            schedules: {
              create: validSchedules.map((schedule) => ({
                day: schedule.day,
                fromTime: schedule.fromTime,
                toTime: schedule.toTime,
              })),
            },
          },
        });

        results.success++;
        results.detailedFeedback.push({
          code,
          status: "success",
          message: `Course created with ${validSchedules.length} schedule(s)`,
        });
      } catch (error: any) {
        console.error(`Error creating course ${courseData.code}:`, error);

        results.failed++;
        results.errors.push({
          code: courseData.code || "N/A",
          message: error.message || "Failed to create course",
        });
        results.detailedFeedback.push({
          code: courseData.code || "N/A",
          status: "error",
          message: error.message || "Database error",
        });
      }
    }

    // Return results
    return NextResponse.json({
      message: `Import completed: ${results.success} successful, ${results.failed} failed`,
      results,
    });
  } catch (error: any) {
    console.error("Import with schedules error:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to import courses with schedules",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
