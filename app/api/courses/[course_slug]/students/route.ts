import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
//@ts-ignore
export async function GET(request: Request, { params }: { params }) {
  try {
    console.log("Starting GET request for course");

    const session = await getServerSession(authOptions);
    console.log("Session:", session);

    if (!session?.user?.email) {
      console.log("No session found");
      return NextResponse.json(
        { error: "Unauthorized - No session" },
        { status: 401 }
      );
    }

    // Get user from database using session email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        role: true,
      },
    });

    console.log("User found:", user);

    if (!user) {
      console.log("No user found with session email");
      return NextResponse.json(
        { error: "Unauthorized - User not found" },
        { status: 401 }
      );
    }

    const { course_slug } = await params;
    console.log("Fetching course with slug:", course_slug);

    // Find the course by slug
    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
      select: { id: true, code: true, section: true, students: true },
    });

    if (!course) {
      console.log("Course not found in database");
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Get today's date in UTC
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log("Date range for attendance:", {
      start: today.toISOString(),
      end: tomorrow.toISOString(),
      localStart: today.toString(),
      localEnd: tomorrow.toString(),
    });

    // Now fetch the course with students using the course ID
    const courseWithStudents = await prisma.course.findUnique({
      where: { id: course.id },
      include: {
        students: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleInitial: true,
            image: true,
            attendance: {
              where: {
                courseId: course.id,
                date: {
                  gte: today,
                  lt: tomorrow,
                },
              },
              select: {
                id: true,
                status: true,
                date: true,
                courseId: true,
              },
              orderBy: {
                date: "desc",
              },
              take: 1,
            },
            quizScores: true,
          },
        },
      },
    });

    console.log(
      "Course fetch result:",
      courseWithStudents ? "Found" : "Not found"
    );

    if (!courseWithStudents) {
      console.log("Course not found in database");
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    console.log(
      "Number of students found:",
      courseWithStudents.students.length
    );

    // Transform the data to match the frontend interface
    const students = await Promise.all(
      courseWithStudents.students.map(async (student) => {
        // Fetch latest gradeScore for this student in this course
        const latestGradeScore = await prisma.gradeScore.findFirst({
          where: {
            studentId: student.id,
            courseId: course.id,
          },
          orderBy: { createdAt: "desc" },
        });

        return {
          id: student.id,
          name: `${student.firstName} ${student.lastName}`,
          firstName: student.firstName,
          lastName: student.lastName,
          middleInitial: student.middleInitial,
          image: student.image || undefined,
          status: student.attendance[0]?.status || "NOT_SET",
          attendanceRecords: student.attendance,
          reportingScore: latestGradeScore?.reportingScore ?? 0,
          recitationScore: latestGradeScore?.recitationScore ?? 0,
          quizScore: latestGradeScore?.quizScore ?? 0,
          totalScore: latestGradeScore?.totalScore ?? 0,
          remarks: latestGradeScore?.remarks ?? "",
          quizScores: student.quizScores,
        };
      })
    );

    console.log("Successfully processed all students");

    return NextResponse.json({
      course: {
        code: courseWithStudents.code,
        section: courseWithStudents.section,
      },
      students,
    });
  } catch (error) {
    console.error(
      "Detailed error in GET /api/courses/[courseId]/students:",
      error
    );
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
