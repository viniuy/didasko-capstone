import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

export async function POST(request: Request) {
  try {
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
