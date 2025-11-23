import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";


// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const facultyId = searchParams.get("facultyId");

    if (!facultyId) {
      return NextResponse.json(
        { error: "Faculty ID is required" },
        { status: 400 }
      );
    }

    // 1️⃣ Fetch all faculty courses
    const courses = await prisma.course.findMany({
      where: { facultyId },
      select: {
        id: true,
        code: true,
        title: true,
        slug: true,
        section: true,
        semester: true,
      },
    });

    if (courses.length === 0) {
      return NextResponse.json({ courses: [] });
    }

    // 2️⃣ Group attendance stats by courseId
    const attendanceStats = await prisma.attendance.groupBy({
      by: ["courseId"],
      _count: {
        _all: true,
        // we can count absents later via filter
      },
      _max: {
        date: true,
      },
    });

    // 3️⃣ Count only ABSENT status separately for accuracy
    const absentCounts = await prisma.attendance.groupBy({
      by: ["courseId"],
      where: {
        status: "ABSENT",
      },
      _count: {
        status: true,
      },
    });

    const absentsMap = Object.fromEntries(
      absentCounts.map((a) => [a.courseId, a._count.status])
    );

    const lastDateMap = Object.fromEntries(
      attendanceStats.map((a) => [a.courseId, a._max.date])
    );

    // 4️⃣ Merge the data into one response
    const coursesWithStats = courses.map((course) => ({
      ...course,
      attendanceStats: {
        totalAbsents: absentsMap[course.id] || 0,
        lastAttendanceDate: lastDateMap[course.id] || null,
      },
    }));

    return NextResponse.json({ courses: coursesWithStats });
  } catch (error) {
    console.error("Error fetching attendance stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch attendance stats" },
      { status: 500 }
    );
  }
}
