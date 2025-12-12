import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
//@ts-ignore

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ course_slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { course_slug } = await params;

    const body = await request.json();
    // Support both 'attendance' (from hook) and 'updates' (legacy) for backward compatibility
    const { date, attendance, updates } = body as {
      date: string;
      attendance?: Array<{
        studentId: string;
        status: string;
        reason?: string;
      }>;
      updates?: Array<{
        studentId: string;
        status: string;
        timestamp?: string | Date;
      }>;
    };

    // Use attendance if provided, otherwise fall back to updates
    const recordsToProcess = attendance || updates || [];

    const utcDate = new Date(date);
    utcDate.setUTCHours(0, 0, 0, 0);

    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
    });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Get all student IDs to process
    const studentIds = recordsToProcess.map((r) => r.studentId);

    // Fetch all existing records in one query (before transaction to avoid timeout)
    const existingRecords = await prisma.attendance.findMany({
      where: {
        studentId: { in: studentIds },
        courseId: course.id,
        date: {
          gte: utcDate,
          lt: new Date(utcDate.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    // Create a map for quick lookup
    const existingMap = new Map(existingRecords.map((r) => [r.studentId, r]));

    // Separate records into updates and creates
    const toUpdate: Array<{ id: string; status: string }> = [];
    const toCreate: Array<{
      studentId: string;
      courseId: string;
      date: Date;
      status: string;
    }> = [];

    for (const record of recordsToProcess) {
      const existing = existingMap.get(record.studentId);
      if (existing) {
        toUpdate.push({
          id: existing.id,
          status: record.status,
        });
      } else {
        toCreate.push({
          studentId: record.studentId,
          courseId: course.id,
          date: utcDate,
          status: record.status,
        });
      }
    }

    // Use transaction with timeout and batch operations
    await prisma.$transaction(
      async (tx) => {
        // Batch update existing records
        if (toUpdate.length > 0) {
          // Use Promise.all for parallel updates (more efficient than sequential)
          await Promise.all(
            toUpdate.map((record) =>
              tx.attendance.update({
                where: { id: record.id },
                data: { status: record.status as any },
              })
            )
          );
        }

        // Batch create new records
        if (toCreate.length > 0) {
          await tx.attendance.createMany({
            data: toCreate.map((record) => ({
              studentId: record.studentId,
              courseId: record.courseId,
              date: record.date,
              status: record.status as any,
            })),
            skipDuplicates: true,
          });
        }
      },
      {
        maxWait: 10000, // Maximum time to wait for a transaction slot (10 seconds)
        timeout: 20000, // Maximum time the transaction can run (20 seconds)
      }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error batch saving attendance:", error);
    return NextResponse.json(
      { error: "Failed to batch save" },
      { status: 500 }
    );
  }
}
