import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { encryptResponse } from "@/lib/crypto-server";

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(
  request: Request,
  { params }: { params: Promise<{ student_id: string }> }
) {
  try {
    const { student_id: studentId } = await params;

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

    // Check if client requested encryption
    const wantsEncryption =
      request.headers.get("X-Encrypted-Response") === "true";

    if (wantsEncryption) {
      return NextResponse.json({
        encrypted: true,
        data: encryptResponse(student),
      });
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

export async function PUT(request: Request, context: any) {
  try {
    // ✅ Extract studentId from params (the route parameter is 'student_id')
    const resolvedParams = await context.params;
    const studentId = resolvedParams?.student_id; // Changed from 'id' to 'student_id'

    if (!studentId) {
      return NextResponse.json(
        { error: "Missing student ID in route parameters" },
        { status: 400 }
      );
    }

    const body = await request.json();

    const {
      lastName,
      firstName,
      middleInitial,
      image,
      studentId: newStudentId,
      rfid_id,
    } = body;

    // ✅ Validate required fields
    if (!lastName || !firstName || !newStudentId) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: lastName, firstName, and studentId are required",
        },
        { status: 400 }
      );
    }

    // ✅ Make sure the student exists (use ID, not RFID)
    const currentStudent = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!currentStudent) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // ✅ Convert RFID safely
    const numericRfid = rfid_id ? Number(rfid_id) : null;

    // ✅ Check if new RFID belongs to someone else
    if (numericRfid && numericRfid !== currentStudent.rfid_id) {
      const existingRfid = await prisma.student.findFirst({
        where: {
          rfid_id: numericRfid,
          NOT: { id: studentId },
        },
      });

      if (existingRfid) {
        return NextResponse.json(
          { error: "RFID already assigned to another student" },
          { status: 409 }
        );
      }
    }

    // ✅ Check if the new studentId already exists for another student
    const existingStudentId = await prisma.student.findFirst({
      where: {
        studentId: newStudentId,
        NOT: { id: studentId },
      },
    });

    if (existingStudentId) {
      return NextResponse.json(
        { error: "Student ID already exists for another student" },
        { status: 409 }
      );
    }

    // ✅ Perform update
    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: {
        lastName,
        firstName,
        middleInitial: middleInitial || null,
        image: image || null,
        studentId: newStudentId,
        rfid_id: numericRfid,
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

    // Check if client requested encryption
    const wantsEncryption =
      request.headers.get("X-Encrypted-Response") === "true";

    if (wantsEncryption) {
      return NextResponse.json({
        encrypted: true,
        data: encryptResponse(updatedStudent),
      });
    }

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
          { error: "Unique constraint violation" },
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
