import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { Student, StudentCreateInput } from "@/shared/types/student";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const courseId = searchParams.get("courseId");

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { studentId: { contains: search, mode: "insensitive" } },
        { id: { contains: search, mode: "insensitive" } },
      ];
    }

    if (courseId) {
      where.coursesEnrolled = {
        some: {
          id: courseId,
        },
      };
    }

    // Get total count
    const total = await prisma.student.count({ where });

    // Get students with pagination
    const students = await prisma.student.findMany({
      where,
      skip,
      take: limit,
      include: {
        coursesEnrolled: {
          select: {
            id: true,
            code: true,
            title: true,
            section: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      students,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching students:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch students",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      lastName,
      firstName,
      middleInitial,
      image,
      studentId,
      id, // Custom ID for RFID
      courseId,
    } = body as StudentCreateInput & { id?: string };

    console.log("Creating student:", {
      lastName,
      firstName,
      studentId,
      id,
      courseId,
    });

    // Validate required fields
    if (!lastName || !firstName || !studentId) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: lastName, firstName, and studentId are required",
        },
        { status: 400 }
      );
    }

    // Check if studentId already exists
    const existingStudent = await prisma.student.findUnique({
      where: { studentId },
    });

    if (existingStudent) {
      return NextResponse.json(
        { error: "Student ID already exists" },
        { status: 409 }
      );
    }

    // Check if custom ID already exists (if provided)
    if (id) {
      const existingCustomId = await prisma.student.findUnique({
        where: { id },
      });

      if (existingCustomId) {
        return NextResponse.json(
          { error: "RFID UID already registered to another student" },
          { status: 409 }
        );
      }
    }

    // Create the student
    const studentData: any = {
      lastName,
      firstName,
      middleInitial,
      image: image || null,
      studentId,
    };

    // If custom ID is provided, use it
    if (id) {
      studentData.id = id;
    }

    // If courseId is provided, connect the student to the course
    if (courseId) {
      // Check if course exists
      const course = await prisma.course.findUnique({
        where: { id: courseId },
      });

      if (!course) {
        return NextResponse.json(
          { error: "Course not found" },
          { status: 404 }
        );
      }

      studentData.coursesEnrolled = {
        connect: {
          id: courseId,
        },
      };
    }

    const student = await prisma.student.create({
      data: studentData,
      include: {
        coursesEnrolled: {
          select: {
            id: true,
            code: true,
            title: true,
            section: true,
          },
        },
      },
    });

    console.log("Created student:", student);

    return NextResponse.json(student as Student);
  } catch (error) {
    console.error("Error creating student:", error);

    // Check for specific Prisma errors
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Course not found or invalid course ID" },
          { status: 404 }
        );
      }
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Student ID or RFID UID already exists" },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      {
        error: "Failed to create student",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
