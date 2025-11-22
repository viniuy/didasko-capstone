import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { CourseStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

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

    // Get courses before update for logging
    const coursesBefore = await prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, code: true, title: true, status: true },
    });

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
          courses: coursesBefore.map((c) => ({
            id: c.id,
            code: c.code,
            title: c.title,
            status: c.status,
          })),
        },
        after: {
          courses: coursesBefore.map((c) => ({
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
