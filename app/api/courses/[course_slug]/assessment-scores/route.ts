import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(
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
      select: { id: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // 1. Get all assessment scores
    const assessmentScores = await prisma.assessmentScore.findMany({
      where: {
        assessment: {
          termConfig: {
            courseId: course.id,
          },
        },
      },
      select: {
        studentId: true,
        assessmentId: true,
        score: true,
      },
    });

    // 2. Get all criteria scores (from Grade model)
    const criteriaScores = await prisma.grade.findMany({
      where: {
        courseId: course.id,
      },
      select: {
        studentId: true,
        criteriaId: true,
        value: true, // This is the percentage (0-100)
      },
    });

    // 3. Transform to Map-friendly format
    const scoresMap: Record<string, any> = {};

    // Add assessment scores with format: studentId:assessmentId
    assessmentScores.forEach((score) => {
      const key = `${score.studentId}:${score.assessmentId}`;
      scoresMap[key] = {
        studentId: score.studentId,
        assessmentId: score.assessmentId,
        score: score.score, // Raw score
      };
    });

    // 4. Add criteria scores with format: studentId:criteria:criteriaId
    // Store as percentage (0-100)
    criteriaScores.forEach((grade) => {
      const key = `${grade.studentId}:criteria:${grade.criteriaId}`;
      scoresMap[key] = {
        studentId: grade.studentId,
        assessmentId: `criteria:${grade.criteriaId}`,
        score: grade.value, // Percentage value (0-100)
      };
    });

    return NextResponse.json(scoresMap);
  } catch (error) {
    console.error("Error loading assessment scores:", error);
    return NextResponse.json(
      { error: "Failed to load scores" },
      { status: 500 }
    );
  }
}

// PUT - Save or update a single assessment score
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { studentId, assessmentId, score } = body;

    // Validate required fields
    if (!studentId || !assessmentId) {
      return NextResponse.json(
        { error: "studentId and assessmentId are required" },
        { status: 400 }
      );
    }

    // Verify assessment exists
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { maxScore: true },
    });

    if (!assessment) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      );
    }

    // Validate score doesn't exceed max
    if (score !== null && score > assessment.maxScore) {
      return NextResponse.json(
        { error: `Score cannot exceed max score of ${assessment.maxScore}` },
        { status: 400 }
      );
    }

    // If score is null, delete the record
    if (score === null) {
      await prisma.assessmentScore.deleteMany({
        where: {
          studentId,
          assessmentId,
        },
      });
      return NextResponse.json({ success: true, deleted: true });
    }

    // Upsert the score
    const assessmentScore = await prisma.assessmentScore.upsert({
      where: {
        assessmentId_studentId: {
          assessmentId,
          studentId,
        },
      },
      create: {
        studentId,
        assessmentId,
        score,
      },
      update: {
        score,
      },
    });

    return NextResponse.json({
      success: true,
      score: {
        studentId: assessmentScore.studentId,
        assessmentId: assessmentScore.assessmentId,
        score: assessmentScore.score,
      },
    });
  } catch (error) {
    console.error("Error saving assessment score:", error);
    return NextResponse.json(
      { error: "Failed to save score" },
      { status: 500 }
    );
  }
}
