import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { AttendanceStats } from "@/shared/types/attendance";
//@ts-ignore

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(request: Request, context: { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await Promise.resolve(context.params);
    const { course_slug } = params;

    // Get the course ID first (lightweight query)
    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
      select: { id: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Get student count and most recent attendance date in parallel
    const [studentCount, mostRecentAttendance] = await Promise.all([
      prisma.student.count({
        where: {
          coursesEnrolled: {
            some: { id: course.id },
          },
        },
      }),
      prisma.attendance.findFirst({
        where: {
          courseId: course.id,
        },
        orderBy: {
          date: "desc",
        },
        select: {
          date: true,
        },
      }),
    ]);

    if (!mostRecentAttendance) {
      const stats: AttendanceStats = {
        totalStudents: studentCount,
        totalPresent: 0,
        totalAbsent: 0,
        totalLate: 0,
        attendanceRate: 0,
        lastAttendanceDate: null,
      };
      return NextResponse.json(stats);
    }

    // Use groupBy for efficient aggregation instead of fetching all records
    const statusCounts = await prisma.attendance.groupBy({
      by: ["status"],
      where: {
        courseId: course.id,
        date: mostRecentAttendance.date,
      },
      _count: {
        status: true,
      },
    });

    // Convert to map for easy lookup
    const countsMap = new Map(
      statusCounts.map((item) => [item.status, item._count.status])
    );

    const totalPresent = countsMap.get("PRESENT") || 0;
    const totalAbsents = countsMap.get("ABSENT") || 0;
    const totalLate = countsMap.get("LATE") || 0;
    const totalStudents = studentCount;
    const attendanceRate =
      totalStudents > 0
        ? ((totalPresent + totalLate) / totalStudents) * 100
        : 0;

    const stats: AttendanceStats = {
      totalStudents,
      totalPresent,
      totalAbsent: totalAbsents,
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
