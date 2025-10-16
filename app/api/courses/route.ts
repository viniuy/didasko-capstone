import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { PrismaClient, Prisma } from "@prisma/client";
import { CourseResponse } from "@/shared/types/course";

const prisma = new PrismaClient();

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

    // Build where clause based on filters
    const where: Prisma.CourseWhereInput = {
      AND: [
        facultyId ? { facultyId } : {},
        department ? { faculty: { department } } : {},
        semester ? { semester } : {},
        code ? { code } : {},
        section ? { section } : {},
        search
          ? {
              OR: [
                {
                  title: {
                    contains: search,
                    mode: "insensitive" as Prisma.QueryMode,
                  },
                },
                {
                  code: {
                    contains: search,
                    mode: "insensitive" as Prisma.QueryMode,
                  },
                },
                {
                  room: {
                    contains: search,
                    mode: "insensitive" as Prisma.QueryMode,
                  },
                },
              ],
            }
          : {},
      ].filter((condition) => Object.keys(condition).length > 0),
    };

    // Get courses with include related data
    const courses = await prisma.course.findMany({
      where,
      include: {
        faculty: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
          },
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
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    const response: CourseResponse = {
      courses: courses.map((course) => ({
        ...course,
        students: course.students?.map((student) => ({
          ...student,
          middleInitial: student.middleInitial || undefined,
        })),
        schedules: course.schedules?.map((schedule) => ({
          ...schedule,
          day: new Date(schedule.day),
        })),
      })),
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
