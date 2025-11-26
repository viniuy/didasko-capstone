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

    // 2️⃣ Get the most recent attendance date for each course
    const courseIds = courses.map((c) => c.id);

    // Get most recent attendance date per course
    const mostRecentDates = await prisma.attendance.groupBy({
      by: ["courseId"],
      _max: {
        date: true,
      },
      where: {
        courseId: { in: courseIds },
      },
    });

    const lastDateMap = Object.fromEntries(
      mostRecentDates.map((a) => [a.courseId, a._max.date])
    );

    // 3️⃣ Count ABSENT status only for the most recent attendance date per course
    // Build a query condition for all (courseId, date) pairs
    const dateConditions = mostRecentDates
      .filter((a) => a._max.date !== null)
      .map((a) => ({
        courseId: a.courseId,
        date: a._max.date!,
      }));

    // Count absents for the most recent date of each course in a single query
    const absentCounts = await Promise.all(
      dateConditions.map(async ({ courseId, date }) => {
        const count = await prisma.attendance.count({
          where: {
            courseId,
            date,
            status: "ABSENT",
          },
        });
        return { courseId, count };
      })
    );

    const absentsMap = Object.fromEntries(
      absentCounts.map((a) => [a.courseId, a.count])
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
