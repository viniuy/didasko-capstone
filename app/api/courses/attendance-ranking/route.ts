import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";


// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(request: Request) {
  try {
    console.log("GET /courses/attendance-ranking - Starting request");
    const session = await getServerSession(authOptions);

    if (!session) {
      console.log("Unauthorized access");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const facultyId = searchParams.get("facultyId");
    const semester = searchParams.get("semester");

    console.log("Params:", { facultyId, semester });

    if (!facultyId) {
      return NextResponse.json(
        { error: "Faculty ID is required" },
        { status: 400 }
      );
    }

    // Verify faculty
    const faculty = await prisma.user.findUnique({
      where: { id: facultyId },
      select: { id: true, name: true, role: true },
    });

    if (!faculty) {
      return NextResponse.json({ error: "Faculty not found" }, { status: 404 });
    }

    // Get all courses for this faculty
    const courses = await prisma.course.findMany({
      where: {
        facultyId,
        ...(semester ? { semester } : {}),
      },
      select: {
        id: true,
        title: true,
        section: true,
      },
    });

    if (courses.length === 0) {
      return NextResponse.json({
        message: "No courses found",
        classes: [],
      });
    }

    // Get all attendance records for these courses
    const attendances = await prisma.attendance.findMany({
      where: {
        course: {
          facultyId,
          ...(semester ? { semester } : {}),
        },
      },
      select: {
        courseId: true,
        status: true,
      },
    });

    if (attendances.length === 0) {
      return NextResponse.json({
        message: "No attendance data found",
        classes: courses.map((course) => ({
          id: course.id,
          title: course.title,
          section: course.section,
          attendanceRate: 0,
        })),
      });
    }

    // Aggregate attendance by course
    const courseMap = new Map<
      string,
      {
        id: string;
        title: string;
        section: string;
        present: number;
        late: number;
        total: number;
      }
    >();

    // Initialize course map
    courses.forEach((course) => {
      courseMap.set(course.id, {
        id: course.id,
        title: course.title,
        section: course.section,
        present: 0,
        late: 0,
        total: 0,
      });
    });

    // Count attendance records per course
    attendances.forEach((att) => {
      const courseData = courseMap.get(att.courseId);
      if (courseData) {
        courseData.total += 1;
        if (att.status === "PRESENT") courseData.present += 1;
        if (att.status === "LATE") courseData.late += 1;
      }
    });

    // Compute attendance rate for each course
    const rankings = Array.from(courseMap.values())
      .map((c) => ({
        id: c.id,
        title: c.title,
        section: c.section,
        attendanceRate:
          c.total > 0
            ? Math.round(((c.present + c.late * 0.5) / c.total) * 100)
            : 0,
      }))
      .sort((a, b) => b.attendanceRate - a.attendanceRate);

    console.log(`Computed ${rankings.length} course rankings`);

    return NextResponse.json(rankings);
  } catch (error) {
    console.error("Error in GET /courses/attendance-ranking:", error);
    return NextResponse.json(
      { error: "Failed to compute course attendance rankings" },
      { status: 500 }
    );
  }
}
