import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

// POST - Save multiple assessment scores at once
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
      select: { id: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const body = await req.json();
    const { scores } = body; // Array of { studentId, assessmentId, score }

    if (!Array.isArray(scores)) {
      return NextResponse.json(
        { error: "scores must be an array" },
        { status: 400 }
      );
    }

    // Validate all scores and get assessment max scores
    const assessmentIds = [...new Set(scores.map((s) => s.assessmentId))];
    const assessments = await prisma.assessment.findMany({
      where: {
        id: { in: assessmentIds },
        termConfig: { courseId: course.id },
      },
      select: { id: true, maxScore: true },
    });

    const assessmentMaxScores = new Map(
      assessments.map((a) => [a.id, a.maxScore])
    );

    // Validate each score
    for (const scoreData of scores) {
      const maxScore = assessmentMaxScores.get(scoreData.assessmentId);
      if (!maxScore) {
        return NextResponse.json(
          { error: `Invalid assessment ID: ${scoreData.assessmentId}` },
          { status: 400 }
        );
      }
      if (scoreData.score !== null && scoreData.score > maxScore) {
        return NextResponse.json(
          {
            error: `Score ${scoreData.score} exceeds max score ${maxScore} for assessment ${scoreData.assessmentId}`,
          },
          { status: 400 }
        );
      }
    }

    // Use transaction to save all scores
    const results = await prisma.$transaction(
      scores.map((scoreData) => {
        if (scoreData.score === null) {
          // Delete if score is null
          return prisma.assessmentScore.deleteMany({
            where: {
              studentId: scoreData.studentId,
              assessmentId: scoreData.assessmentId,
            },
          });
        }

        // Upsert the score
        return prisma.assessmentScore.upsert({
          where: {
            assessmentId_studentId: {
              assessmentId: scoreData.assessmentId,
              studentId: scoreData.studentId,
            },
          },
          create: {
            studentId: scoreData.studentId,
            assessmentId: scoreData.assessmentId,
            score: scoreData.score,
          },
          update: {
            score: scoreData.score,
          },
        });
      })
    );

    return NextResponse.json({
      success: true,
      savedCount: results.length,
    });
  } catch (error) {
    console.error("Error saving bulk assessment scores:", error);
    return NextResponse.json(
      { error: "Failed to save scores" },
      { status: 500 }
    );
  }
}
