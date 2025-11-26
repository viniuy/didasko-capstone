import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { CourseStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { checkScheduleOverlap } from "@/lib/utils/schedule-utils";

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function PATCH(request: NextRequest) {
  let body: { courseIds?: string[]; status?: string } = {};
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    body = await request.json();
    const { courseIds, status } = body;

    // Validate input
    if (!courseIds || !Array.isArray(courseIds) || courseIds.length === 0) {
      return NextResponse.json(
        { error: "Course IDs are required" },
        { status: 400 }
      );
    }

    if (!status || !["ACTIVE", "INACTIVE", "ARCHIVED"].includes(status)) {
      return NextResponse.json(
        { error: "Valid status is required (ACTIVE, INACTIVE, or ARCHIVED)" },
        { status: 400 }
      );
    }

    // Get courses before update for logging and validation
    const coursesToUpdate = await prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: {
        id: true,
        code: true,
        title: true,
        section: true,
        status: true,
        facultyId: true,
        semester: true,
        academicYear: true,
        schedules: {
          select: {
            day: true,
            fromTime: true,
            toTime: true,
          },
        },
      },
    });

    // Validate schedule conflicts when unarchiving (activating) courses
    if (status === "ACTIVE") {
      const scheduleConflicts: Array<{
        courseId: string;
        courseCode: string;
        courseSection: string;
        error: string;
      }> = [];

      for (const course of coursesToUpdate) {
        if (!course.facultyId) {
          scheduleConflicts.push({
            courseId: course.id,
            courseCode: course.code,
            courseSection: course.section || "",
            error: "Course has no assigned faculty",
          });
          continue;
        }

        // Skip if course has no schedules
        if (!course.schedules || course.schedules.length === 0) {
          continue;
        }

        // Check for schedule conflicts with existing active courses
        // Exclude courses that are being unarchived in the same batch
        const excludeCourseIds = coursesToUpdate
          .filter((c) => c.id !== course.id)
          .map((c) => c.id);

        const overlapError = await checkScheduleOverlap(
          course.schedules.map((s) => ({
            day: s.day,
            fromTime: s.fromTime,
            toTime: s.toTime,
          })),
          course.facultyId,
          excludeCourseIds,
          course.semester,
          course.academicYear
        );

        if (overlapError) {
          scheduleConflicts.push({
            courseId: course.id,
            courseCode: course.code,
            courseSection: course.section || "",
            error: overlapError,
          });
        }
      }

      // If there are schedule conflicts, return error with details
      if (scheduleConflicts.length > 0) {
        const conflictMessages = scheduleConflicts.map(
          (conflict) => `${conflict.courseCode}: ${conflict.error}`
        );

        return NextResponse.json(
          {
            error: "Schedule conflicts detected",
            conflicts: scheduleConflicts,
            message: `Cannot unarchive ${
              scheduleConflicts.length
            } course(s) due to schedule conflicts: ${conflictMessages.join(
              "; "
            )}`,
          },
          { status: 400 }
        );
      }
    }

    // Update all courses with the new status
    const result = await prisma.course.updateMany({
      where: {
        id: {
          in: courseIds,
        },
      },
      data: {
        status: status as CourseStatus,
        updatedAt: new Date(),
      },
    });

    // Log course archive/activate
    try {
      const action =
        status === "ARCHIVED"
          ? "Course Archived"
          : status === "ACTIVE"
          ? "Course Activated"
          : "Course Status Changed";
      await logAction({
        userId: session.user.id,
        action,
        module: "Course",
        reason: `${
          status === "ARCHIVED"
            ? "Archived"
            : status === "ACTIVE"
            ? "Activated"
            : "Changed status"
        } ${result.count} course(s)`,
        status: "SUCCESS",
        before: {
          courses: coursesToUpdate.map((c) => ({
            id: c.id,
            code: c.code,
            title: c.title,
            status: c.status,
          })),
        },
        after: {
          courses: coursesToUpdate.map((c) => ({
            id: c.id,
            code: c.code,
            title: c.title,
            status: status as CourseStatus,
          })),
          count: result.count,
        },
        metadata: {
          entityType: "Course",
          bulkOperation: true,
          affectedCount: result.count,
          newStatus: status,
        },
      });
    } catch (error) {
      console.error("Error logging course status change:", error);
      // Don't fail operation if logging fails
    }

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${result.count} course(s)`,
      updatedCount: result.count,
    });
  } catch (error: any) {
    console.error("Bulk archive error:", error);

    // Log failure
    try {
      const session = await getServerSession(authOptions);
      if (session?.user && body.status) {
        const action =
          body.status === "ARCHIVED"
            ? "Course Archived"
            : body.status === "ACTIVE"
            ? "Course Activated"
            : "Course Status Changed";
        await logAction({
          userId: session.user.id,
          action,
          module: "Course",
          reason: `Failed to update course status`,
          status: "FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
          metadata: {
            courseIds: body.courseIds || [],
            attemptedStatus: body.status,
          },
        });
      }
    } catch (logError) {
      console.error("Error logging failure:", logError);
    }

    return NextResponse.json(
      {
        error: "Failed to update courses",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
