// app/api/attendance/leaderboard/all/route.ts
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
    const courseSlug = searchParams.get("courseSlug"); // Optional: for single course

    const whereClause: any = {
      facultyId: facultyId,
      status: "ACTIVE",
    };

    if (courseSlug) {
      whereClause.slug = courseSlug;
    }

    // Fetch all courses with attendance data
    const courses = await prisma.course.findMany({
      where: whereClause,
      include: {
        attendance: {
          include: {
            student: true,
          },
        },
      },
    });

    // Build leaderboards grouped by course slug
    const leaderboards: Record<string, any[]> = {};

    courses.forEach((course) => {
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

      // Calculate leaderboard for this course
      const leaderboard = Array.from(studentMap.values())
        .map((student) => {
          const totalSessions =
            student.totalPresent +
            student.totalAbsent +
            student.totalLate +
            student.totalExcused;
          const attendanceRate =
            totalSessions > 0
              ? (student.totalPresent / totalSessions) * 100
              : 0;

          return {
            studentId: student.studentId,
            studentName: student.studentName,
            totalPresent: student.totalPresent,
            totalAbsent: student.totalAbsent,
            totalLate: student.totalLate,
            totalExcused: student.totalExcused, // ✅ Now included!
            totalSessions,
            attendanceRate,
          };
        })
        .sort((a, b) => b.attendanceRate - a.attendanceRate);

      leaderboards[course.slug] = leaderboard;
    });

    return NextResponse.json({ leaderboards });
  } catch (error) {
    console.error("Error fetching attendance leaderboards:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboards" },
      { status: 500 }
    );
  }
}
