import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RfidScanInput, RfidScanResponse } from "@/shared/types/student";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rfidUid } = body as RfidScanInput;
    const rfid_id = parseInt(rfidUid, 10);

    if (!rfidUid) {
      return NextResponse.json(
        { error: "RFID UID is required" },
        { status: 400 }
      );
    }

    // Find student by ID (which serves as RFID UID)
    const student = await prisma.student.findUnique({
      where: { rfid_id: rfid_id },
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

    if (student) {
      console.log("Student found:", student);
      return NextResponse.json({
        found: true,
        student,
        message: "Student found successfully",
      } as RfidScanResponse);
    } else {
      console.log("No student found for RFID:", rfidUid);
      return NextResponse.json({
        found: false,
        message: "No student found with this RFID UID",
      } as RfidScanResponse);
    }
  } catch (error) {
    console.error("Error scanning RFID:", error);
    return NextResponse.json(
      {
        error: "Failed to scan RFID",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
