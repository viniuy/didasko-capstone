// app/api/attendance/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";


// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const facultyId = searchParams.get("facultyId") || session.user.id;
    const courseSlug = searchParams.get("courseSlug");

    // Build where clause
    const whereClause: any = {
      facultyId: facultyId,
      status: "ACTIVE",
    };

    // If courseSlug is provided, filter to that specific course
    if (courseSlug) {
      whereClause.slug = courseSlug;
    }

    // Fetch courses with students and attendance
    const courses = await prisma.course.findMany({
      where: whereClause,
      include: {
        students: true,
        attendance: {
          include: {
            student: true,
          },
        },
      },
    });

    // Aggregate attendance data by student
    const studentMap = new Map<
      string,
      {
        studentId: string;
        studentName: string;
        totalPresent: number;
        totalAbsent: number;
        totalLate: number;
        totalExcused: number;
      }
    >();

    courses.forEach((course) => {
      course.attendance.forEach((record) => {
        const key = record.studentId;

        if (!studentMap.has(key)) {
          studentMap.set(key, {
            studentId: record.studentId,
            studentName: `${record.student.firstName} ${record.student.lastName}`,
            totalPresent: 0,
            totalAbsent: 0,
            totalLate: 0,
            totalExcused: 0,
          });
        }

        const student = studentMap.get(key)!;

        if (record.status === "PRESENT") student.totalPresent++;
        else if (record.status === "ABSENT") student.totalAbsent++;
        else if (record.status === "LATE") student.totalLate++;
        else if (record.status === "EXCUSED") student.totalExcused++;
      });
    });

    // Calculate attendance rates and format data
    const leaderboard = Array.from(studentMap.values())
      .map((student) => {
        const totalSessions =
          student.totalPresent +
          student.totalAbsent +
          student.totalLate +
          student.totalExcused;

        const attendanceRate =
          totalSessions > 0 ? (student.totalPresent / totalSessions) * 100 : 0;

        return {
          studentId: student.studentId,
          studentName: student.studentName,
          totalPresent: student.totalPresent,
          totalAbsent: student.totalAbsent,
          totalLate: student.totalLate,
          totalSessions,
          attendanceRate,
        };
      })
      .sort((a, b) => b.attendanceRate - a.attendanceRate);

    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error("Error fetching attendance leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
