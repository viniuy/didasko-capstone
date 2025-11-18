import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { logAction } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rfid, studentId } = await request.json();

    if (!rfid || !studentId) {
      return NextResponse.json(
        { error: "Missing RFID or student ID." },
        { status: 400 }
      );
    }

    // Convert RFID to integer
    const rfidInt = parseInt(rfid, 10);

    if (isNaN(rfidInt)) {
      return NextResponse.json(
        { error: "RFID must be a valid integer." },
        { status: 400 }
      );
    }

    // Get student before update for logging
    const studentBefore = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        rfid_id: true,
      },
    });

    if (!studentBefore) {
      return NextResponse.json(
        { error: "Student not found." },
        { status: 404 }
      );
    }

    // Check if RFID already exists
    const existing = await prisma.student.findFirst({
      where: { rfid_id: rfidInt },
    });

    if (existing) {
      return NextResponse.json(
        { error: "RFID already assigned to another student." },
        { status: 409 }
      );
    }

    // Assign RFID to the selected student
    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: { rfid_id: rfidInt },
    });

    // Log RFID assignment
    try {
      await logAction({
        userId: session.user.id,
        action: "STUDENT_RFID_ASSIGNED",
        module: "Student Management",
        reason: `RFID ${rfidInt} assigned to student: ${updatedStudent.firstName} ${updatedStudent.lastName} (${updatedStudent.studentId})`,
        before: {
          studentId: studentBefore.studentId,
          name: `${studentBefore.firstName} ${studentBefore.lastName}`,
          rfid_id: studentBefore.rfid_id,
        },
        after: {
          studentId: updatedStudent.studentId,
          name: `${updatedStudent.firstName} ${updatedStudent.lastName}`,
          rfid_id: updatedStudent.rfid_id,
        },
      });
    } catch (error) {
      console.error("Error logging RFID assignment:", error);
      // Don't fail RFID assignment if logging fails
    }

    return NextResponse.json(
      { message: "RFID successfully assigned.", student: updatedStudent },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error assigning RFID:", error);

    if (error instanceof PrismaClientKnownRequestError) {
      return NextResponse.json(
        { error: "Database error: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
