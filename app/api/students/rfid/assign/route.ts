import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { logAction } from "@/lib/audit";
import { encryptResponse } from "@/lib/crypto-server";

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  let body: { rfid?: string; studentId?: string } = {};
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    body = await request.json();
    const { rfid, studentId } = body;

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

    // Prisma may return BigInt for `rfid_id`. JSON serialization of BigInt
    // will throw, so create safe (stringified) copies for logging and
    // response payloads.
    const studentBeforeSafe = studentBefore
      ? {
          ...studentBefore,
          rfid_id:
            studentBefore.rfid_id === null
              ? null
              : String(studentBefore.rfid_id),
        }
      : null;

    const updatedStudentSafe = {
      ...updatedStudent,
      rfid_id:
        updatedStudent.rfid_id === null ? null : String(updatedStudent.rfid_id),
    };

    // Log RFID assignment (fire-and-forget to avoid blocking response)
    const isReassignment = studentBefore?.rfid_id !== null;
    logAction({
      userId: session.user.id,
      action: isReassignment
        ? "STUDENT_RFID_REASSIGNED"
        : "STUDENT_RFID_ASSIGNED",
      module: "Student",
      reason: `RFID ${rfidInt} ${
        isReassignment ? "reassigned" : "assigned"
      } to student: ${updatedStudent.firstName} ${updatedStudent.lastName} (${
        updatedStudent.studentId
      })`,
      status: "SUCCESS",
      before: studentBeforeSafe
        ? {
            studentId: studentBeforeSafe.studentId,
            name: `${studentBeforeSafe.firstName} ${studentBeforeSafe.lastName}`,
            rfid_id: studentBeforeSafe.rfid_id,
          }
        : undefined,
      after: {
        studentId: updatedStudentSafe.studentId,
        name: `${updatedStudentSafe.firstName} ${updatedStudentSafe.lastName}`,
        rfid_id: updatedStudentSafe.rfid_id,
      },
      metadata: {
        entityType: "Student",
        entityId: updatedStudentSafe.id,
        entityName: `${updatedStudentSafe.firstName} ${updatedStudentSafe.lastName}`,
        rfidCardNumber: String(rfidInt),
        isReassignment,
      },
    }).catch((error) => {
      console.error("Error logging RFID assignment:", error);
      // Don't fail RFID assignment if logging fails
    });

    const response = {
      message: "RFID successfully assigned.",
      student: updatedStudentSafe,
    };

    // Check if client requested encryption
    const wantsEncryption =
      request.headers.get("X-Encrypted-Response") === "true";

    if (wantsEncryption) {
      return NextResponse.json(
        {
          encrypted: true,
          data: encryptResponse(response),
        },
        { status: 200 }
      );
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Error assigning RFID:", error);

    // Log failure (fire-and-forget, never throw)
    try {
      getServerSession(authOptions)
        .then((session) => {
          if (session?.user) {
            logAction({
              userId: session.user.id,
              action: "STUDENT_RFID_ASSIGNED",
              module: "Student",
              reason: `Failed to assign RFID to student`,
              status: "FAILED",
              errorMessage:
                error instanceof Error ? error.message : "Unknown error",
              metadata: {
                attemptedRfid: body.rfid,
                attemptedStudentId: body.studentId,
              },
            }).catch((logError) => {
              console.error("Error logging RFID assignment failure:", logError);
            });
          }
        })
        .catch((sessionError) => {
          console.error(
            "Error getting server session for logging:",
            sessionError
          );
        });
    } catch (logOuterError) {
      console.error("Error in logging failure handler:", logOuterError);
    }

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
