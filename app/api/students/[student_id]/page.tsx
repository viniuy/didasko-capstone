import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
//@ts-ignore
export async function GET(request: Request, { params }: { params }) {
  try {
    const { studentId } = params;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
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

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json(student);
  } catch (error) {
    console.error("Error fetching student:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch student",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
//@ts-ignore
export async function PUT(request: Request, { params }: { params }) {
  try {
    const { studentId } = params;
    const body = await request.json();
    const {
      lastName,
      firstName,
      middleInitial,
      image,
      studentId: newStudentId,
    } = body;

    // Validate required fields
    if (!lastName || !firstName || !newStudentId) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: lastName, firstName, and studentId are required",
        },
        { status: 400 }
      );
    }

    // Check if the new studentId already exists for a different student
    if (newStudentId !== studentId) {
      const existingStudent = await prisma.student.findUnique({
        where: { studentId: newStudentId },
      });

      if (existingStudent) {
        return NextResponse.json(
          { error: "Student ID already exists" },
          { status: 409 }
        );
      }
    }

    // Update the student
    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: {
        lastName,
        firstName,
        middleInitial,
        image: image || null,
        studentId: newStudentId,
      },
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

    console.log("Updated student:", updatedStudent);
    return NextResponse.json(updatedStudent);
  } catch (error) {
    console.error("Error updating student:", error);

    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Student not found" },
          { status: 404 }
        );
      }
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Student ID already exists" },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      {
        error: "Failed to update student",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
