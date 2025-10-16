import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth-options";
import { AttendanceStats } from "@/shared/types/attendance";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ course_slug: string }> }
) {
  const { course_slug } = await params;

  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const course = await prisma.course.findUnique({
    where: { slug: course_slug },
    include: { students: { select: { id: true } } },
  });

  if (!course)
    return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const mostRecentAttendance = await prisma.attendance.findFirst({
    where: { courseId: course.id },
    orderBy: { date: "desc" },
    select: { date: true },
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

  const attendanceRecords = await prisma.attendance.findMany({
    where: { courseId: course.id, date: mostRecentAttendance.date },
    select: { studentId: true, status: true },
  });

  const attendanceMap = new Map(
    attendanceRecords.map((r) => [r.studentId, r.status])
  );

  let totalPresent = 0;
  let totalAbsent = 0;
  let totalLate = 0;

  for (const { id } of course.students) {
    const status = attendanceMap.get(id);
    switch (status) {
      case "PRESENT":
        totalPresent++;
        break;
      case "LATE":
        totalLate++;
        break;
      default:
        totalAbsent++;
    }
  }

  const totalStudents = course.students.length;
  const attendanceRate =
    totalStudents > 0 ? ((totalPresent + totalLate) / totalStudents) * 100 : 0;

  const stats: AttendanceStats = {
    totalStudents,
    totalPresent,
    totalAbsent,
    totalLate,
    attendanceRate,
    lastAttendanceDate: mostRecentAttendance.date,
  };

  return NextResponse.json(stats);
}
