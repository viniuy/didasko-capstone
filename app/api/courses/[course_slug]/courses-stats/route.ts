// app/api/courses/[course_slug]/stats/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  context: { params: { course_slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { course_slug } = await context.params;

    if (!course_slug || typeof course_slug !== "string") {
      return NextResponse.json(
        { error: "Invalid course_slug parameter" },
        { status: 400 }
      );
    }

    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
      include: { students: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const totalStudents = course.students.length;

    if (totalStudents === 0) {
      return NextResponse.json({
        passingRate: 0,
        attendanceRate: 0,
        totalStudents: 0,
      });
    }

    const termConfigs = await prisma.termConfiguration.findMany({
      where: { courseId: course.id },
      include: {
        termGrades: {
          where: {
            studentId: {
              in: course.students.map((s) => s.id),
            },
          },
        },
      },
    });

    const studentsWithGrades = new Set<string>();
    const passingStudents = new Set<string>();

    termConfigs.forEach((config) => {
      config.termGrades.forEach((grade) => {
        studentsWithGrades.add(grade.studentId);
        if (grade.remarks === "PASSED") {
          passingStudents.add(grade.studentId);
        }
      });
    });

    const passingRate =
      studentsWithGrades.size > 0
        ? Math.round((passingStudents.size / studentsWithGrades.size) * 100)
        : 0;

    const attendanceRecords = await prisma.attendance.findMany({
      where: { courseId: course.id },
    });

    const attendanceRate =
      attendanceRecords.length === 0
        ? 0
        : Math.round(
            (attendanceRecords.filter(
              (record) =>
                record.status === "PRESENT" || record.status === "LATE"
            ).length /
              attendanceRecords.length) *
              100
          );

    return NextResponse.json({
      passingRate,
      attendanceRate,
      totalStudents,
      studentsWithGrades: studentsWithGrades.size,
      passingStudents: passingStudents.size,
      totalAttendanceRecords: attendanceRecords.length,
      presentCount: attendanceRecords.filter(
        (r) => r.status === "PRESENT" || r.status === "LATE"
      ).length,
    });
  } catch (error) {
    console.error("Error fetching course stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch course statistics" },
      { status: 500 }
    );
  }
}
