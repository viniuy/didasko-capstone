import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { AssessmentType } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ course_slug: string }> }
) {
  const { course_slug } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  { params }: { params: Promise<{ course_slug: string }> }
) {
  try {
    const { course_slug } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const body = await req.json();
    const termConfigs = body.termConfigs;

    // Validate weights
    for (const [term, config] of Object.entries(termConfigs) as any) {
      const total = config.ptWeight + config.quizWeight + config.examWeight;
      if (total !== 100) {
        return NextResponse.json(
          { error: `${term}: Weights must total 100%` },
          { status: 400 }
        );
      }
    }

    // Process each term config
    await prisma.$transaction(async (tx) => {
      for (const [term, config] of Object.entries(termConfigs) as any) {
        // Upsert term configuration
        const termConfig = await tx.termConfiguration.upsert({
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

        // Get existing assessments
        const existingAssessments = await tx.assessment.findMany({
          where: { termConfigId: termConfig.id },
          select: { id: true },
        });

        const existingIds = existingAssessments.map((a) => a.id);
        const incomingIds = config.assessments
          .filter((a: any) => a.id && !a.id.startsWith("temp"))
          .map((a: any) => a.id);

        // Delete assessments that are no longer in the config
        const idsToDelete = existingIds.filter(
          (id) => !incomingIds.includes(id)
        );
        if (idsToDelete.length > 0) {
          await tx.assessment.deleteMany({
            where: { id: { in: idsToDelete } },
          });
        }

        // Process each assessment
        for (const assessment of config.assessments) {
          // Check if assessment exists in database
          const existsInDb = existingIds.includes(assessment.id);

          const assessmentData = {
            name: assessment.name,
            maxScore: assessment.maxScore,
            date: assessment.date ? new Date(assessment.date) : null,
            enabled: assessment.enabled,
            order: assessment.order,
            linkedCriteriaId: assessment.linkedCriteriaId ?? null,
          };

          if (
            !existsInDb ||
            !assessment.id ||
            assessment.id.startsWith("temp")
          ) {
            // Create new assessment (doesn't exist in DB or has temp ID)
            await tx.assessment.create({
              data: {
                termConfigId: termConfig.id,
                type: assessment.type as AssessmentType,
                ...assessmentData,
              },
            });
          } else {
            // Update existing assessment (exists in DB)
            await tx.assessment.update({
              where: { id: assessment.id },
              data: assessmentData,
            });
          }
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving term configs:", error);

    // Log more detailed error information
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }

    return NextResponse.json(
      {
        error: "Failed to save configurations",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
