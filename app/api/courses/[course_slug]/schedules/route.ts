import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

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

    // Validate schedule overlaps with existing active courses for the same faculty
    if (course.facultyId && schedules.length > 0) {
      // Get all active courses for this faculty (excluding current course)
      const activeCourses = await prisma.course.findMany({
        where: {
          facultyId: course.facultyId,
          status: "ACTIVE",
          id: { not: course.id },
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
              return NextResponse.json(
                {
                  error: `Schedule overlaps with existing course "${
                    activeCourse.code
                  } - ${activeCourse.section}" on ${normalizeDay(
                    newSchedule.day
                  )} (${existingSchedule.fromTime} - ${
                    existingSchedule.toTime
                  })`,
                },
                { status: 400, headers: { "Cache-Control": "no-store" } }
              );
            }
          }
        }
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
