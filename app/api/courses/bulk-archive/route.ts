import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { PrismaClient, CourseStatus } from "@prisma/client";

const prisma = new PrismaClient();

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
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

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${result.count} course(s)`,
      updatedCount: result.count,
    });
  } catch (error: any) {
    console.error("Bulk archive error:", error);
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
