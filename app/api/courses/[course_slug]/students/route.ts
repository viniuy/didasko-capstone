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
export async function POST(request: Request, { params }: { params }) {
  try {
    const { courseId } = await params;
    const body = await request.json();
    const { studentId } = body;

    console.log("Adding student to course:", {
      courseId: courseId,
      studentId: studentId,
    });

    // Check if student is already enrolled
    const existingEnrollment = await prisma.course.findFirst({
      where: {
        id: courseId,
        students: {
          some: {
            id: studentId,
          },
        },
      },
    });

    if (existingEnrollment) {
      return NextResponse.json(
        { error: "Student is already enrolled in this course" },
        { status: 400 }
      );
    }

    // Add student to course
    const updatedCourse = await prisma.course.update({
      where: {
        id: courseId,
      },
      data: {
        students: {
          connect: {
            id: studentId,
          },
        },
      },
      include: {
        students: true,
      },
    });

    console.log("Successfully added student to course");

    return NextResponse.json({
      message: "Student added successfully",
      course: updatedCourse,
    });
  } catch (error) {
    console.error("Error adding student to course:", error);
    return NextResponse.json(
      { error: "Failed to add student to course" },
      { status: 500 }
    );
  }
}
