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

    // Build where clause based on filters
    const where: Prisma.CourseWhereInput = {};

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
        } as any; // Type assertion to bypass mismatch
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

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      code,
      title,
      section,
      room,
      semester,
      academicYear,
      classNumber,
      status,
      facultyId,
      schedules,
    } = body;

    // Validate required fields
    if (!code || !title || !section || !semester || !academicYear) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Generate unique slug
    const baseSlug = generateSlug(code, section);
    let slug = baseSlug;
    let counter = 1;

    // Check for slug uniqueness
    while (await prisma.course.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Check if course already exists (same code, section, semester, and academic year)
    const existingCourse = await prisma.course.findFirst({
      where: {
        code,
        section,
        semester,
        academicYear,
      },
    });

    if (existingCourse) {
      return NextResponse.json(
        {
          error:
            "Course with this code and section already exists for this semester",
        },
        { status: 409 }
      );
    }

    // Parse classNumber as integer
    const parsedClassNumber = classNumber
      ? parseInt(String(classNumber), 10)
      : 0;
    if (isNaN(parsedClassNumber)) {
      return NextResponse.json(
        { error: "classNumber must be a valid number" },
        { status: 400 }
      );
    }

    // Create course with schedules in a transaction
    const course = await prisma.course.create({
      data: {
        code,
        title,
        section,
        room: room || "",
        semester,
        academicYear,
        slug,
        classNumber: parsedClassNumber,
        status: status || "ACTIVE",
        facultyId: facultyId || null,
        schedules: schedules?.length
          ? {
              create: schedules.map((s: any) => ({
                day: s.day,
                fromTime: s.fromTime,
                toTime: s.toTime,
              })),
            }
          : undefined,
      },
      include: {
        schedules: true,
        faculty: {
          select: { id: true, name: true, email: true, department: true },
        },
      },
    });

    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    console.error("Error creating course:", error);
    return NextResponse.json(
      { error: "Failed to create course" },
      { status: 500 }
    );
  }
}
