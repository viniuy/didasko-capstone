import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ course_slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { course_slug } = await params;
    const body = await request.json();
    const { schedules } = body;

    if (!Array.isArray(schedules)) {
      return NextResponse.json(
        { error: "Schedules must be an array" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Find course by slug to get the ID and facultyId
    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
      select: { id: true, facultyId: true },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Validate schedule format
    for (const schedule of schedules) {
      if (!schedule.day || !schedule.fromTime || !schedule.toTime) {
        return NextResponse.json(
          { error: "Each schedule must have day, fromTime, and toTime" },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }

      const validDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      if (!validDays.includes(schedule.day)) {
        return NextResponse.json(
          {
            error: `Invalid day format: ${
              schedule.day
            }. Must be one of: ${validDays.join(", ")}`,
          },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // Update schedules in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete existing schedules for this course
      await tx.courseSchedule.deleteMany({
        where: { courseId: course.id },
      });

      // Insert new schedules
      if (schedules.length > 0) {
        await tx.courseSchedule.createMany({
          data: schedules.map((s) => ({
            courseId: course.id,
            day: s.day,
            fromTime: s.fromTime,
            toTime: s.toTime,
          })),
        });
      }
    });

    // Invalidate Next.js cache
    revalidateTag("courses");
    revalidateTag(`course-${course_slug}`);

    return NextResponse.json(
      { message: "Schedules updated successfully" },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    console.error("Error updating schedules:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update schedules" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
