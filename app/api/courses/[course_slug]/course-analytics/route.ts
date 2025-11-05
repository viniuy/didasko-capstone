import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { course_slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { course_slug } = await params;

    // Fetch course with all related data
    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
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
            studentId: true,
            lastName: true,
            firstName: true,
            middleInitial: true,
            image: true,
          },
        },
        schedules: true,
        attendance: {
          include: {
            student: {
              select: {
                id: true,
                studentId: true,
              },
            },
          },
        },
        termConfigs: {
          include: {
            termGrades: {
              include: {
                student: {
                  select: {
                    id: true,
                    studentId: true,
                  },
                },
              },
            },
            assessments: {
              include: {
                scores: {
                  include: {
                    student: {
                      select: {
                        id: true,
                        studentId: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        grades: {
          include: {
            student: {
              select: {
                id: true,
                studentId: true,
              },
            },
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Calculate student analytics
    const studentAnalytics = course.students.map((student) => {
      // Attendance calculations
      const studentAttendance = course.attendance.filter(
        (a) => a.student.id === student.id
      );
      const totalAttendanceRecords = studentAttendance.length;
      const totalPresent = studentAttendance.filter(
        (a) => a.status === "PRESENT"
      ).length;
      const totalAbsent = studentAttendance.filter(
        (a) => a.status === "ABSENT"
      ).length;
      const totalLate = studentAttendance.filter(
        (a) => a.status === "LATE"
      ).length;
      const totalExcused = studentAttendance.filter(
        (a) => a.status === "EXCUSED"
      ).length;
      const attendanceRate =
        totalAttendanceRecords > 0
          ? (totalPresent / totalAttendanceRecords) * 100
          : 0;

      // Grade calculations - using term grades
      const studentTermGrades = course.termConfigs.flatMap((config) =>
        config.termGrades.filter((tg) => tg.student.id === student.id)
      );

      let averageGrade = 0;
      let latestGrade = 0;

      if (studentTermGrades.length > 0) {
        // Calculate average from numeric grades
        const numericGrades = studentTermGrades
          .map((tg) => tg.numericGrade)
          .filter((grade): grade is number => grade !== null);

        if (numericGrades.length > 0) {
          averageGrade =
            numericGrades.reduce((sum, grade) => sum + grade, 0) /
            numericGrades.length;
          latestGrade = numericGrades[numericGrades.length - 1];
        }
      } else {
        // Fallback to regular grades if no term grades
        const studentGrades = course.grades.filter(
          (g) => g.student.id === student.id
        );

        if (studentGrades.length > 0) {
          averageGrade =
            studentGrades.reduce((sum, grade) => sum + grade.value, 0) /
            studentGrades.length;
          latestGrade = studentGrades[studentGrades.length - 1]?.value || 0;
        }
      }

      return {
        id: student.id,
        studentId: student.studentId,
        lastName: student.lastName,
        firstName: student.firstName,
        middleInitial: student.middleInitial || undefined,
        image: student.image || undefined,
        attendanceRate: Math.round(attendanceRate * 10) / 10,
        totalPresent,
        totalAbsent,
        totalLate,
        totalExcused,
        averageGrade: Math.round(averageGrade * 10) / 10,
        latestGrade: Math.round(latestGrade * 10) / 10,
      };
    });

    // Calculate course-wide statistics
    const totalStudents = course.students.length;
    const totalAttendanceRecords = course.attendance.length;
    const totalPresent = course.attendance.filter(
      (a) => a.status === "PRESENT"
    ).length;
    const totalAbsents = course.attendance.filter(
      (a) => a.status === "ABSENT"
    ).length;
    const totalLate = course.attendance.filter(
      (a) => a.status === "LATE"
    ).length;
    const totalExcused = course.attendance.filter(
      (a) => a.status === "EXCUSED"
    ).length;

    // Overall attendance rate
    const overallAttendanceRate =
      totalAttendanceRecords > 0
        ? (totalPresent / totalAttendanceRecords) * 100
        : 0;

    // Calculate average grade across all students
    const allGrades = studentAnalytics
      .map((s) => s.averageGrade)
      .filter((grade) => grade > 0);
    const courseAverageGrade =
      allGrades.length > 0
        ? allGrades.reduce((sum, grade) => sum + grade, 0) / allGrades.length
        : 0;

    // Calculate passing rate (assuming 75 is passing)
    const passingStudents = allGrades.filter((grade) => grade >= 75).length;
    const passingRate =
      allGrades.length > 0 ? (passingStudents / allGrades.length) * 100 : 0;

    const stats = {
      totalStudents,
      attendanceRate: Math.round(overallAttendanceRate * 10) / 10,
      averageGrade: Math.round(courseAverageGrade * 10) / 10,
      totalAbsents,
      totalLate,
      totalExcused,
      passingRate: Math.round(passingRate * 10) / 10,
    };

    // Course info
    const courseInfo = {
      id: course.id,
      code: course.code,
      title: course.title,
      section: course.section,
      room: course.room,
      semester: course.semester,
      academicYear: course.academicYear,
      slug: course.slug,
      status: course.status,
      faculty: course.faculty,
      schedules: course.schedules,
    };

    return NextResponse.json({
      course: courseInfo,
      stats,
      students: studentAnalytics,
    });
  } catch (error) {
    console.error("Error fetching course analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch course analytics" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
