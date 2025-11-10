import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

// Optional: GET endpoint to fetch schedules for a specific course
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId");

    if (!courseId) {
      return NextResponse.json(
        { error: "Course ID is required" },
        { status: 400 }
      );
    }

    const schedules = await prisma.courseSchedule.findMany({
      where: { courseId },
      orderBy: { day: "asc" },
    });

    return NextResponse.json({ schedules });
  } catch (error) {
    console.error("Error fetching schedules:", error);
    return NextResponse.json(
      { error: "Failed to fetch schedules" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
