import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { course_slug: string } }
) {
  try {
    const { course_slug } = params;

    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
      select: { id: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const [recitations, groupReportings, individualReportings] =
      await Promise.all([
        // ✅ Recitations → isRecitation=true
        prisma.criteria.findMany({
          where: {
            courseId: course.id,
            isRecitationCriteria: true,
          },
          orderBy: { createdAt: "desc" },
        }),

        // ✅ Group Reporting → isGroupCriteria=true
        prisma.criteria.findMany({
          where: {
            courseId: course.id,
            isGroupCriteria: true,
          },
          orderBy: { createdAt: "desc" },
        }),

        // ✅ Individual Reporting → BOTH false
        prisma.criteria.findMany({
          where: {
            courseId: course.id,
            isRecitationCriteria: false,
            isGroupCriteria: false,
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

    return NextResponse.json({
      recitations,
      groupReportings,
      individualReportings,
    });
  } catch (error: any) {
    console.error("Failed to load criteria links:", error);
    return NextResponse.json(
      { error: "Failed to load linked criteria", details: error.message },
      { status: 500 }
    );
  }
}
