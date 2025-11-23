import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

// Get all unique dates where grades exist for a criteria
//@ts-ignore

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(request: Request, { params }: { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { course_slug } = await params;
    const { searchParams } = new URL(request.url);
    const criteriaId = searchParams.get("criteriaId");
    const courseCode = searchParams.get("courseCode");
    const courseSection = searchParams.get("courseSection");

    // Find course by slug or code/section
    let course;
    if (course_slug) {
      course = await prisma.course.findFirst({
        where: { slug: course_slug },
        select: { id: true },
      });
    } else if (courseCode && courseSection) {
      course = await prisma.course.findFirst({
        where: {
          code: courseCode,
          section: courseSection,
        },
        select: { id: true },
      });
    }

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Require criteriaId to filter dates by criteria
    if (!criteriaId) {
      return NextResponse.json(
        { error: "criteriaId is required" },
        { status: 400 }
      );
    }

    const where: any = {
      courseId: course.id,
      criteriaId: criteriaId, // Always filter by criteriaId
    };

    // Get all unique dates where grades exist
    const uniqueDates = await prisma.grade.findMany({
      where,
      select: {
        date: true,
      },
      distinct: ["date"],
      orderBy: {
        date: "desc",
      },
    });

    // Convert dates to local time strings (YYYY-MM-DD format)
    const dates = uniqueDates.map((record) => {
      const date = new Date(record.date);
      // Get local date components to avoid timezone issues
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    });

    return NextResponse.json({ dates });
  } catch (error: any) {
    console.error("Error fetching grade dates:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch grade dates" },
      { status: 500 }
    );
  }
}
