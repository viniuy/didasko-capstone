import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { PrismaClient, Prisma } from "@prisma/client";
import { CourseResponse } from "@/shared/types/course";

const prisma = new PrismaClient();

// Helper function to generate slug
function generateSlug(code: string, section: string): string {
  return `${code.toLowerCase().replace(/\s+/g, "-")}-${section
    .toLowerCase()
    .replace(/\s+/g, "-")}`;
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const facultyId = searchParams.get("facultyId");
    const search = searchParams.get("search");
    const department = searchParams.get("department");
    const semester = searchParams.get("semester");
    const code = searchParams.get("code");
    const section = searchParams.get("section");
    const isCourseActive = searchParams.get("isCourseActive");

    // Build where clause based on filters
    const where: Prisma.CourseWhereInput = {
      status: "ACTIVE",
    };

    // Always filter for active courses if the query param is "true"
    if (isCourseActive === "true") {
      where.status = "ACTIVE";
    }

    if (facultyId) where.facultyId = facultyId;
    if (department) where.faculty = { department };
    if (semester) where.semester = semester;
    if (code) where.code = code;
    if (section) where.section = section;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { room: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get courses with related data + attendance
    const courses = await prisma.course.findMany({
      where,
      include: {
        faculty: {
          select: { id: true, name: true, email: true, department: true },
        },
        students: {
          select: {
            id: true,
            lastName: true,
            firstName: true,
            middleInitial: true,
          },
        },
        schedules: true,
        attendance: true,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    const response: CourseResponse = {
      courses: courses.map((course) => {
        const totalStudents = course.students.length;
        const totalPresent = course.attendance.filter(
          (a) => a.status === "PRESENT"
        ).length;
        const totalAbsents = course.attendance.filter(
          (a) => a.status === "ABSENT"
        ).length;
        const totalLate = course.attendance.filter(
          (a) => a.status === "LATE"
        ).length;
        const lastAttendanceDate = course.attendance.length
          ? course.attendance[course.attendance.length - 1].date
          : null;

        return {
          ...course,
          attendanceStats: {
            totalStudents,
            totalPresent,
            totalAbsents,
            totalLate,
            lastAttendanceDate,
            attendanceRate:
              totalStudents > 0 ? totalPresent / totalStudents : 0,
          },
          students: course.students.map((s) => ({
            ...s,
            middleInitial: s.middleInitial || undefined,
          })),
          schedules: course.schedules,
          attendance: undefined, // Remove attendance from response
        } as any;
      }),
      pagination: {
        total: courses.length,
        page: 1,
        limit: courses.length,
        totalPages: 1,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching courses:", error);
    return NextResponse.json(
      { error: "Failed to fetch courses" },
      { status: 500 }
    );
  }
}
