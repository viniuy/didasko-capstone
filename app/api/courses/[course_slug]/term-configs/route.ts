import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { AssessmentType } from "@prisma/client";

// ✅ GET — Load all term configurations for a course
export async function GET(
  req: NextRequest,
  { params }: { params: { course_slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { course_slug } = params;

  const course = await prisma.course.findUnique({
    where: { slug: course_slug },
    include: {
      termConfigs: {
        include: {
          assessments: {
            orderBy: [{ type: "asc" }, { order: "asc" }],
          },
        },
        orderBy: { term: "asc" },
      },
    },
  });

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const termConfigs: Record<string, any> = {};
  course.termConfigs.forEach((config) => {
    termConfigs[config.term] = {
      id: config.id,
      term: config.term,
      ptWeight: config.ptWeight,
      quizWeight: config.quizWeight,
      examWeight: config.examWeight,
      assessments: config.assessments.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        maxScore: a.maxScore,
        date: a.date ? a.date.toISOString().split("T")[0] : null,
        enabled: a.enabled,
        order: a.order,
        linkedCriteriaId: a.linkedCriteriaId ?? null,
      })),
    };
  });

  return NextResponse.json(termConfigs);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { course_slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { course_slug } = params;

    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const body = await req.json();
    const termConfigs = body.termConfigs;

    for (const [term, config] of Object.entries(termConfigs) as any) {
      const total = config.ptWeight + config.quizWeight + config.examWeight;
      if (total !== 100) {
        return NextResponse.json(
          { error: `${term}: Weights must total 100%` },
          { status: 400 }
        );
      }
    }

    const operations: any[] = [];

    for (const [term, config] of Object.entries(termConfigs) as any) {
      const termConfig = await prisma.termConfiguration.upsert({
        where: {
          courseId_term: {
            courseId: course.id,
            term,
          },
        },
        create: {
          courseId: course.id,
          term,
          ptWeight: config.ptWeight,
          quizWeight: config.quizWeight,
          examWeight: config.examWeight,
        },
        update: {
          ptWeight: config.ptWeight,
          quizWeight: config.quizWeight,
          examWeight: config.examWeight,
        },
      });

      const existingAssessments = await prisma.assessment.findMany({
        where: { termConfigId: termConfig.id },
        select: { id: true },
      });

      const existingIds = existingAssessments.map((a) => a.id);
      const incomingIds = config.assessments
        .filter((a: any) => a.id && !a.id.startsWith("temp"))
        .map((a: any) => a.id);

      const idsToDelete = existingIds.filter((id) => !incomingIds.includes(id));
      if (idsToDelete.length > 0) {
        operations.push(
          prisma.assessment.deleteMany({
            where: { id: { in: idsToDelete } },
          })
        );
      }

      for (const assessment of config.assessments) {
        const isNew = !assessment.id || assessment.id.startsWith("temp");

        operations.push(
          prisma.assessment.upsert({
            where: { id: isNew ? "" : assessment.id },
            update: {
              name: assessment.name,
              maxScore: assessment.maxScore,
              date: assessment.date ? new Date(assessment.date) : null,
              enabled: assessment.enabled,
              order: assessment.order,
              linkedCriteriaId: assessment.linkedCriteriaId ?? null,
            },
            create: {
              termConfigId: termConfig.id,
              type: assessment.type as AssessmentType,
              name: assessment.name,
              maxScore: assessment.maxScore,
              date: assessment.date ? new Date(assessment.date) : null,
              enabled: assessment.enabled,
              order: assessment.order,
              linkedCriteriaId: assessment.linkedCriteriaId ?? null,
            },
          })
        );
      }
    }

    await prisma.$transaction(operations);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving term configs:", error);
    return NextResponse.json(
      { error: "Failed to save configurations" },
      { status: 500 }
    );
  }
}
