import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getGrades, saveGrades, deleteGrades } from "@/lib/services";
import { prisma } from "@/lib/prisma";
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

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const criteriaId = searchParams.get("criteriaId");
    const courseCode = searchParams.get("courseCode");
    const courseSection = searchParams.get("courseSection");
    const groupId = searchParams.get("groupId");
    const studentIdsParam = searchParams.get("studentIds");

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    if (!courseCode || !courseSection) {
      return NextResponse.json(
        { error: "Course code and section are required" },
        { status: 400 }
      );
    }

    // Find course by code and section to get slug
    const course = await prisma.course.findFirst({
      where: {
        code: courseCode,
        section: courseSection,
      },
      select: { slug: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Parse studentIds if provided
    const studentIds = studentIdsParam
      ? studentIdsParam.split(",").filter((id) => id.trim())
      : undefined;

    const grades = await getGrades(course.slug, {
      date,
      criteriaId: criteriaId || undefined,
      groupId: groupId || undefined,
      studentIds: studentIds,
    });

    return NextResponse.json(grades);
  } catch (error: any) {
    console.error("Error fetching grades:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch grades" },
      { status: 500 }
    );
  }
}
//@ts-ignore
export async function POST(request: NextRequest, { params }: { params }) {
  try {
    const {
      date,
      criteriaId,
      grades,
      courseCode,
      courseSection,
      isRecitationCriteria,
    } = await request.json();

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !date ||
      !criteriaId ||
      !grades ||
      !Array.isArray(grades) ||
      !courseCode ||
      !courseSection
    ) {
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 }
      );
    }

    // Find course by code and section to get slug
    const course = await prisma.course.findFirst({
      where: {
        code: courseCode,
        section: courseSection,
      },
      select: { slug: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    try {
      const createdGrades = await saveGrades(course.slug, {
        date,
        criteriaId,
        grades,
        isRecitationCriteria,
      });

      return NextResponse.json(createdGrades);
    } catch (error: any) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      throw error;
    }
  } catch (error: any) {
    console.error("Error saving grades:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to save grades",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
//@ts-ignore
export async function DELETE(request: Request, { params }: { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const criteriaId = searchParams.get("criteriaId");
    const date = searchParams.get("date");

    if (!criteriaId || !date) {
      return NextResponse.json(
        { error: "Criteria ID and date are required" },
        { status: 400 }
      );
    }

    const { course_slug } = await params;

    try {
      await deleteGrades(course_slug, { criteriaId, date });
      return NextResponse.json({ message: "Grades deleted successfully" });
    } catch (error: any) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      throw error;
    }
  } catch (error: any) {
    console.error("Error deleting grades:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete grades" },
      { status: 500 }
    );
  }
}
