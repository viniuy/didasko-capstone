import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

/**
 * GET /api/attendance/class
 * Query params:
 * - classId (string)
 * - date (optional, defaults to today)
 * - search (optional)
 * - page (optional)
 * - pageSize (optional)
 * - filters (optional: from query)
 */

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const search = searchParams.get("search") ?? "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

    if (!classId) {
      return NextResponse.json({ error: "Missing classId" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - User not found" },
        { status: 401 }
      );
    }

    // --- Date range for today (default) ---
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // --- Fetch course and students with attendance ---
    const course = await prisma.course.findUnique({
      where: { id: classId },
      select: {
        id: true,
        code: true,
        section: true,
        students: {
          where: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleInitial: true,
            image: true,
            attendance: {
              where: {
                courseId: classId,
                date: {
                  gte: today,
                  lt: tomorrow,
                },
              },
              select: { id: true, status: true, date: true, courseId: true },
              orderBy: { date: "desc" },
              take: 1,
            },
            quizScores: true,
          },
          skip: (page - 1) * pageSize,
          take: pageSize,
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // --- Map students into a simpler structure ---
    const students = course.students.map((student) => ({
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      image: student.image ?? undefined,
      status: student.attendance[0]?.status ?? "NOT_SET",
      attendanceRecords: student.attendance,
      quizScores: student.quizScores ?? [],
    }));

    // --- Optional: count for pagination ---
    const totalStudents = await prisma.student.count({
      where: {
        coursesEnrolled: {
          some: { id: classId },
        },
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
    });

    // --- Optional filter data (example: attendance stats) ---
    const filterData = {
      total: totalStudents,
      present: students.filter((s) => s.status === "PRESENT").length,
      absent: students.filter((s) => s.status === "ABSENT").length,
    };

    return NextResponse.json({
      students,
      filters: filterData,
      meta: {
        page,
        pageSize,
        total: totalStudents,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/attendance/class:", error);
    return NextResponse.json(
      { error: "Failed to fetch attendance data" },
      { status: 500 }
    );
  }
}
