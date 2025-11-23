import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RfidScanInput, RfidScanResponse } from "@/shared/types/student";


// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rfidUid } = body as RfidScanInput;

    if (!rfidUid) {
      return NextResponse.json(
        { error: "RFID UID is required" },
        { status: 400 }
      );
    }

    const rfid_id = parseInt(rfidUid, 10);
    if (isNaN(rfid_id)) {
      return NextResponse.json(
        { error: "Invalid RFID UID format" },
        { status: 400 }
      );
    }

    const student = await prisma.student.findUnique({
      where: { rfid_id },
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
      console.log(
        "RFID already assigned to:",
        student.firstName,
        student.lastName
      );
      return NextResponse.json({
        found: true,
        assigned: true,
        student,
        message: `RFID "${rfidUid}" is already assigned to ${student.firstName} ${student.lastName}`,
      } as RfidScanResponse);
    }

    console.log("RFID not assigned:", rfidUid);
    return NextResponse.json({
      found: false,
      assigned: false,
      message: `RFID "${rfidUid}" is not assigned to any student.`,
    } as RfidScanResponse);
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
