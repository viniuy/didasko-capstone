import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { AttendanceStats } from "@/shared/types/attendance";

export async function GET(
  request: Request,
  context: { params: { course_slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await Promise.resolve(context.params);
    const { course_slug } = params;

    // Get the course with its students
    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
      include: {
        students: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Get the most recent attendance date for this course
    const mostRecentAttendance = await prisma.attendance.findFirst({
      where: {
        courseId: course.id,
      },
      orderBy: {
        date: "desc",
      },
      select: {
        date: true,
      },
    });

    if (!mostRecentAttendance) {
      const stats: AttendanceStats = {
        totalStudents: course.students.length,
        totalPresent: 0,
        totalAbsent: 0,
        totalLate: 0,
        attendanceRate: 0,
        lastAttendanceDate: null,
      };
      return NextResponse.json(stats);
    }

    // Get all attendance records for the most recent date
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        courseId: course.id,
        date: mostRecentAttendance.date,
      },
      select: {
        studentId: true,
        status: true,
      },
    });

    // Create a map of student IDs to their attendance status
    const attendanceMap = new Map(
      attendanceRecords.map((record) => [record.studentId, record.status])
    );

    // Count attendance statuses
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLate = 0;

    course.students.forEach((student: { id: string }) => {
      const status = attendanceMap.get(student.id);
      switch (status) {
        case "PRESENT":
          totalPresent++;
          break;
        case "ABSENT":
          totalAbsent++;
          break;
        case "LATE":
          totalLate++;
          break;
        default:
          totalAbsent++; // Count NOT_SET as absent
      }
    });

    const totalStudents = course.students.length;
    const attendanceRate =
      totalStudents > 0
        ? ((totalPresent + totalLate) / totalStudents) * 100
        : 0;

    const stats: AttendanceStats = {
      totalStudents,
      totalPresent,
      totalAbsent,
      totalLate,
      attendanceRate,
      lastAttendanceDate: mostRecentAttendance.date,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching attendance stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch attendance statistics" },
      { status: 500 }
    );
  }
}
