import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

export async function GET(request: Request, { params }: { params: any }) {
  try {
    const rfidId = Number(params.rfid_id);

    if (isNaN(rfidId)) {
      return NextResponse.json(
        { error: "Invalid RFID ID format" },
        { status: 400 }
      );
    }

    // If rfid_id is not unique, use findFirst
    const student = await prisma.student.findFirst({
      where: { rfid_id: rfidId },
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

// ✅ PUT /api/students/[rfid_id]
export async function PUT(request: Request, { params }: { params: any }) {
  try {
    const currentRfidId = Number(params.rfid_id);

    if (isNaN(currentRfidId)) {
      return NextResponse.json(
        { error: "Invalid RFID ID format" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      lastName,
      firstName,
      middleInitial,
      image,
      rfid_id: newRfidId,
    } = body;

    if (!lastName || !firstName || !newRfidId) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: lastName, firstName, and rfid_id are required",
        },
        { status: 400 }
      );
    }

    const numericNewRfid = Number(newRfidId);
    if (isNaN(numericNewRfid)) {
      return NextResponse.json(
        { error: "New RFID ID must be an integer" },
        { status: 400 }
      );
    }

    // Check if the new RFID already exists for another student
    if (numericNewRfid !== currentRfidId) {
      const existingStudent = await prisma.student.findFirst({
        where: { rfid_id: numericNewRfid },
      });

      if (existingStudent) {
        return NextResponse.json(
          { error: "RFID ID already exists for another student" },
          { status: 409 }
        );
      }
    }

    // Update the student (updateMany allows updating by non-unique fields)
    const updatedStudent = await prisma.student.updateMany({
      where: { rfid_id: currentRfidId },
      data: {
        lastName,
        firstName,
        middleInitial,
        image: image || null,
        rfid_id: numericNewRfid,
      },
    });

    if (updatedStudent.count === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Fetch and return the updated record
    const refreshedStudent = await prisma.student.findFirst({
      where: { rfid_id: numericNewRfid },
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

    return NextResponse.json(refreshedStudent);
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
          { error: "RFID ID already exists" },
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
