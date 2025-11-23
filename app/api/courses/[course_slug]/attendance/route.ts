import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getAttendance, createAttendanceBatch } from "@/lib/services";
import { AttendanceResponse } from "@/shared/types/attendance";

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
      const records = attendance.map((record: any) => ({
        studentId: record.studentId,
        date,
        status: record.status,
        reason:
          record.status.toUpperCase() === "EXCUSED"
            ? record.reason ?? undefined
            : undefined,
      }));

      await createAttendanceBatch(course_slug, records);

      return NextResponse.json({
        message: "Attendance saved successfully",
        records: attendance.length,
      });
    } catch (error: any) {
      if (error.message.includes("not found")) {
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
