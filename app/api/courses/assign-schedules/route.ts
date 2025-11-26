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
          include: { schedules: true },
        });

        if (!course) {
          results.failed++;
          results.errors.push({
            courseId,
            message: "Course not found",
          });
          continue;
        }

        // Validate schedule overlaps with existing active courses for the same faculty
        if (course.facultyId && schedules.length > 0) {
          // Get all active courses for this faculty (excluding current course)
          const activeCourses = await prisma.course.findMany({
            where: {
              facultyId: course.facultyId,
              status: "ACTIVE",
              id: { not: courseId },
            },
            include: {
              schedules: true,
            },
          });

          // Helper function to normalize day names
          const normalizeDay = (day: string): string => {
            const dayMap: Record<string, string> = {
              Mon: "Monday",
              Tue: "Tuesday",
              Wed: "Wednesday",
              Thu: "Thursday",
              Fri: "Friday",
              Sat: "Saturday",
              Sun: "Sunday",
            };
            return dayMap[day] || day;
          };

          // Helper function to convert time to minutes
          const timeToMinutes = (time: string): number => {
            if (!time) return 0;
            // Handle both "HH:MM" and "HH:MM AM/PM" formats
            const parts = time.split(" ");
            const [hours, minutes] = parts[0].split(":").map(Number);
            let hour24 = hours;
            if (parts[1] === "PM" && hours !== 12) hour24 = hours + 12;
            if (parts[1] === "AM" && hours === 12) hour24 = 0;
            return hour24 * 60 + (minutes || 0);
          };

          // Helper function to check time overlap
          const checkOverlap = (
            day1: string,
            from1: string,
            to1: string,
            day2: string,
            from2: string,
            to2: string
          ): boolean => {
            if (normalizeDay(day1) !== normalizeDay(day2)) return false;
            const start1 = timeToMinutes(from1);
            const end1 = timeToMinutes(to1);
            const start2 = timeToMinutes(from2);
            const end2 = timeToMinutes(to2);
            return start1 < end2 && start2 < end1;
          };

          // Check each new schedule against existing schedules
          for (const newSchedule of schedules) {
            for (const activeCourse of activeCourses) {
              for (const existingSchedule of activeCourse.schedules) {
                if (
                  checkOverlap(
                    newSchedule.day,
                    newSchedule.fromTime,
                    newSchedule.toTime,
                    existingSchedule.day,
                    existingSchedule.fromTime,
                    existingSchedule.toTime
                  )
                ) {
                  results.failed++;
                  results.errors.push({
                    courseId,
                    message: `Schedule overlaps with existing course "${
                      activeCourse.code
                    } - ${activeCourse.section}" on ${normalizeDay(
                      newSchedule.day
                    )} (${existingSchedule.fromTime} - ${
                      existingSchedule.toTime
                    })`,
                  });
                  throw new Error("Schedule overlap detected");
                }
              }
            }
          }
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
