import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";


// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    // Expected format: { courseId: string, schedules: Array<{day, fromTime, toTime}> }[]
    const { coursesSchedules } = body;

    if (!coursesSchedules || !Array.isArray(coursesSchedules)) {
      return NextResponse.json(
        { error: "Invalid request format" },
        { status: 400 }
      );
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[],
    };

    // Process each course's schedules
    for (const courseSchedule of coursesSchedules) {
      const { courseId, schedules } = courseSchedule;

      if (!courseId || !schedules || !Array.isArray(schedules)) {
        results.failed++;
        results.errors.push({
          courseId,
          message: "Invalid course schedule format",
        });
        continue;
      }

      try {
        // Verify course exists
        const course = await prisma.course.findUnique({
          where: { id: courseId },
        });

        if (!course) {
          results.failed++;
          results.errors.push({
            courseId,
            message: "Course not found",
          });
          continue;
        }

        // Delete existing schedules for this course
        await prisma.courseSchedule.deleteMany({
          where: { courseId },
        });

        // Create new schedules
        if (schedules.length > 0) {
          await prisma.courseSchedule.createMany({
            data: schedules.map((schedule: any) => ({
              courseId,
              day: schedule.day,
              fromTime: schedule.fromTime,
              toTime: schedule.toTime,
            })),
          });
        }

        results.success++;
      } catch (error) {
        console.error(
          `Error assigning schedules to course ${courseId}:`,
          error
        );
        results.failed++;
        results.errors.push({
          courseId,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      message: `Successfully assigned schedules to ${results.success} courses`,
      results,
    });
  } catch (error) {
    console.error("Error in assign schedules:", error);
    return NextResponse.json(
      { error: "Failed to assign schedules" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
