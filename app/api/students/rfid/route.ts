import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RfidScanInput, RfidScanResponse } from "@/shared/types/student";
import { encryptResponse } from "@/lib/crypto-server";

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rfidId = searchParams.get("rfidId");

    if (!rfidId) {
      return NextResponse.json(
        { error: "RFID ID is required" },
        { status: 400 }
      );
    }

    const rfid_id = parseInt(rfidId, 10);
    if (isNaN(rfid_id)) {
      return NextResponse.json(
        { error: "Invalid RFID ID format" },
        { status: 400 }
      );
    }

    const student = await prisma.student.findUnique({
      where: { rfid_id },
      select: {
        id: true,
        studentId: true,
        lastName: true,
        firstName: true,
        middleInitial: true,
        image: true,
        rfid_id: true,
      },
    });

    if (student) {
      // Convert BigInt to string for JSON serialization
      const safeStudent = {
        ...student,
        rfid_id:
          student.rfid_id !== null && student.rfid_id !== undefined
            ? String(student.rfid_id)
            : null,
      };
      const response = { student: safeStudent };

      // Check if client requested encryption
      const wantsEncryption =
        request.headers.get("X-Encrypted-Response") === "true";

      if (wantsEncryption) {
        return NextResponse.json({
          encrypted: true,
          data: encryptResponse(response),
        });
      }

      return NextResponse.json(response);
    }

    return NextResponse.json(
      { error: "Student not found with this RFID" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Error fetching student by RFID:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch student by RFID",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

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
      const response = {
        found: true,
        assigned: true,
        student,
        message: `RFID "${rfidUid}" is already assigned to ${student.firstName} ${student.lastName}`,
      } as RfidScanResponse;

      // Check if client requested encryption
      const wantsEncryption =
        request.headers.get("X-Encrypted-Response") === "true";

      if (wantsEncryption) {
        return NextResponse.json({
          encrypted: true,
          data: encryptResponse(response),
        });
      }

      return NextResponse.json(response);
    }

    console.log("RFID not assigned:", rfidUid);
    const notFoundResponse = {
      found: false,
      assigned: false,
      message: `RFID "${rfidUid}" is not assigned to any student.`,
    } as RfidScanResponse;

    // Check if client requested encryption
    const wantsEncryption =
      request.headers.get("X-Encrypted-Response") === "true";

    if (wantsEncryption) {
      return NextResponse.json({
        encrypted: true,
        data: encryptResponse(notFoundResponse),
      });
    }

    return NextResponse.json(notFoundResponse);
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
