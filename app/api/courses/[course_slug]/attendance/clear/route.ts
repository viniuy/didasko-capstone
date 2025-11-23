import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
//@ts-ignore

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { course_slug } = await params;
    const { date } = await request.json();

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
      select: { id: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Parse the date and create date range for the entire day
    const utcDate = new Date(date);
    utcDate.setUTCHours(0, 0, 0, 0);
    const nextDay = new Date(utcDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    // Delete all attendance records for this course on this date
    const deleted = await prisma.attendance.deleteMany({
      where: {
        courseId: course.id,
        date: {
          gte: utcDate,
          lt: nextDay,
        },
      },
    });

    return NextResponse.json(
      {
        message: "Attendance records cleared successfully",
        deletedCount: deleted.count,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error clearing attendance:", error);
    return NextResponse.json(
      { error: "Failed to clear attendance records" },
      { status: 500 }
    );
  }
}
