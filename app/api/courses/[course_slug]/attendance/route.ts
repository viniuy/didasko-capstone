import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getAttendance } from "@/lib/services";
import { AttendanceResponse } from "@/shared/types/attendance";
import { prisma } from "@/lib/prisma";

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

//@ts-ignore
export async function GET(request: Request, context: { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await Promise.resolve(context.params);
    const { course_slug } = params;

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    if (!date) {
      return NextResponse.json(
        { error: "Date parameter is required" },
        { status: 400 }
      );
    }

    const result = await getAttendance(course_slug, date, { page, limit });

    if (!result) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const response: AttendanceResponse = {
      attendance: result.attendance,
      pagination: result.pagination,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Error fetching attendance records:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch attendance records",
        details: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
//@ts-ignore
export async function POST(request: Request, context: { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await Promise.resolve(context.params);
    const { course_slug } = params;

    const { date, attendance } = await request.json();

    try {
      // Parse date and set to UTC midnight
      const utcDate = new Date(date);
      utcDate.setUTCHours(0, 0, 0, 0);

      // Get course
      const course = await prisma.course.findUnique({
        where: { slug: course_slug },
        select: { id: true },
      });

      if (!course) {
        return NextResponse.json(
          { error: "Course not found" },
          { status: 404 }
        );
      }

      // Limit attendance array size to prevent excessive queries
      const MAX_ATTENDANCE_RECORDS = 500;
      const safeAttendance = attendance.slice(0, MAX_ATTENDANCE_RECORDS);

      // Process attendance records efficiently in batch
      await prisma.$transaction(async (tx) => {
        // 1. Fetch all existing records for this date in one query
        const studentIds = safeAttendance.map((r: any) => r.studentId);
        const existingRecords = await tx.attendance.findMany({
          where: {
            studentId: { in: studentIds },
            courseId: course.id,
            date: {
              gte: utcDate,
              lt: new Date(utcDate.getTime() + 24 * 60 * 60 * 1000),
            },
          },
          take: MAX_ATTENDANCE_RECORDS, // Limit query results
        });

        // 2. Create a map of existing records by studentId for quick lookup
        const existingMap = new Map(
          existingRecords.map((r) => [r.studentId, r])
        );

        // 3. Separate records into updates and creates
        const toUpdate: Array<{
          id: string;
          status: string;
          reason: string | null;
        }> = [];
        const toCreate: Array<{
          studentId: string;
          courseId: string;
          date: Date;
          status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
          reason: string | null;
        }> = [];

        for (const record of safeAttendance) {
          const existing = existingMap.get(record.studentId);
          const status = record.status as
            | "PRESENT"
            | "LATE"
            | "ABSENT"
            | "EXCUSED";
          const reason =
            record.status.toUpperCase() === "EXCUSED"
              ? record.reason ?? null
              : null;

          if (existing) {
            toUpdate.push({
              id: existing.id,
              status: status,
              reason: reason,
            });
          } else {
            toCreate.push({
              studentId: record.studentId,
              courseId: course.id,
              date: utcDate,
              status: status,
              reason: reason,
            });
          }
        }

        // 4. Batch update existing records
        // Limit concurrent updates to prevent connection pool exhaustion
        if (toUpdate.length > 0) {
          const BATCH_SIZE = 50;
          for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
            const batch = toUpdate.slice(i, i + BATCH_SIZE);
            await Promise.all(
              batch.map((update) =>
                tx.attendance.update({
                  where: { id: update.id },
                  data: {
                    status: update.status as any,
                    reason: update.reason,
                  },
                })
              )
            );
          }
        }

        // 5. Batch create new records
        if (toCreate.length > 0) {
          await tx.attendance.createMany({
            data: toCreate,
            skipDuplicates: true,
          });
        }
      });

      return NextResponse.json({
        message: "Attendance saved successfully",
        records: safeAttendance.length,
        totalReceived: attendance.length,
        ...(attendance.length > MAX_ATTENDANCE_RECORDS && {
          warning: `Only the first ${MAX_ATTENDANCE_RECORDS} records were processed`,
        }),
      });
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      throw error;
    }
  } catch (error: any) {
    console.error("Error saving attendance:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save attendance" },
      { status: 500 }
    );
  }
}
