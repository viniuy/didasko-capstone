import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET - Fetch all students or filter by query params
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const courseId = searchParams.get("courseId");

    const where: any = {};

    if (search) {
      where.OR = [
        { studentId: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
      ];
    }

    if (courseId) {
      where.coursesEnrolled = {
        some: { id: courseId },
      };
    }

    const students = await prisma.student.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        studentId: true,
        lastName: true,
        firstName: true,
        middleInitial: true,
        image: true,
        rfid_id: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ students });
  } catch (error) {
    console.error("Error fetching students:", error);
    return NextResponse.json(
      { error: "Failed to fetch students" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      studentId,
      lastName,
      firstName,
      middleInitial,
      image,
      courseId,
      rfid_id,
    } = body;

    // Validate required fields
    if (!studentId || !lastName || !firstName) {
      return NextResponse.json(
        { error: "Student ID, Last Name, and First Name are required" },
        { status: 400 }
      );
    }

    // Check if student ID already exists
    const existingStudent = await prisma.student.findUnique({
      where: { studentId },
    });

    if (existingStudent) {
      return NextResponse.json(
        { error: "Student ID already exists" },
        { status: 400 }
      );
    }

    // Check if RFID ID already exists (if provided)
    if (rfid_id) {
      const existingRfid = await prisma.student.findUnique({
        where: { rfid_id: parseInt(rfid_id) },
      });

      if (existingRfid) {
        return NextResponse.json(
          { error: "RFID ID already exists" },
          { status: 400 }
        );
      }
    }

    // Create student with optional course enrollment
    const studentData: any = {
      studentId,
      lastName,
      firstName,
      middleInitial: middleInitial || null,
      image: image || null,
      rfid_id: rfid_id ? parseInt(rfid_id) : null,
    };

    // If courseId is provided, connect the student to the course
    if (courseId) {
      studentData.coursesEnrolled = {
        connect: { slug: courseId },
      };
    }

    const newStudent = await prisma.student.create({
      data: studentData,
      include: {
        coursesEnrolled: {
          select: {
            id: true,
            code: true,
            title: true,
          },
        },
      },
    });

    return NextResponse.json(newStudent, { status: 201 });
  } catch (error) {
    console.error("Error creating student:", error);
    return NextResponse.json(
      { error: "Failed to create student" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
