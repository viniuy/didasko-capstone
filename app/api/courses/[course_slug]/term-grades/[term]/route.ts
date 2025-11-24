import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

// Map frontend term keys to database term values
const TERM_MAP: Record<string, string> = {
  prelims: "PRELIM",
  midterm: "MIDTERM",
  preFinals: "PREFINALS",
  prefinals: "PREFINALS",
  finals: "FINALS",
};

interface TermGradeData {
  ptScores: Array<{
    id: string;
    name: string;
    score: number | null;
    maxScore: number;
    percentage?: number;
  }>;
  quizScores: Array<{
    id: string;
    name: string;
    score: number | null;
    maxScore: number;
    percentage?: number;
  }>;
  examScore?: {
    id: string;
    name: string;
    score: number | null;
    maxScore: number;
    percentage?: number;
  };
  totalPercentage?: number | null;
  numericGrade?: number | null;
  remarks?: string | null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ course_slug: string; term: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { course_slug, term } = await params;

    // Get course ID
    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
      select: {
        id: true,
        students: {
          select: {
            id: true,
            studentId: true,
            lastName: true,
            firstName: true,
            middleInitial: true,
            image: true,
          },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Map term key to database term value
    const dbTerm = TERM_MAP[term.toLowerCase()] || term.toUpperCase();

    // Fetch term config for the specific term
    const termConfig = await prisma.termConfiguration.findFirst({
      where: {
        courseId: course.id,
        term: dbTerm,
      },
      select: {
        id: true,
        term: true,
        ptWeight: true,
        quizWeight: true,
        examWeight: true,
        termGrades: {
          select: {
            studentId: true,
            totalPercentage: true,
            numericGrade: true,
            remarks: true,
          },
        },
        assessments: {
          where: { enabled: true },
          select: {
            id: true,
            type: true,
            name: true,
            maxScore: true,
            order: true,
            linkedCriteriaId: true,
            transmutationBase: true,
            scores: {
              select: {
                studentId: true,
                score: true,
              },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!termConfig) {
      return NextResponse.json({
        students: [],
        termConfig: null,
      });
    }

    // Build term grades for each student
    const studentsWithGrades = course.students.map((student) => {
      // Get student's computed term grade
      const studentTermGrade = termConfig.termGrades.find(
        (tg) => tg.studentId === student.id
      );

      // Build PT scores
      const ptScores = termConfig.assessments
        .filter((a) => a.type === "PT")
        .sort((a, b) => a.order - b.order)
        .map((assessment) => {
          const score = assessment.scores.find(
            (s) => s.studentId === student.id
          );
          return {
            id: assessment.id,
            name: assessment.name,
            score: score?.score ?? null,
            maxScore: assessment.maxScore,
            percentage:
              score && assessment.maxScore > 0
                ? (score.score / assessment.maxScore) * 100
                : undefined,
          };
        });

      // Build Quiz scores
      const quizScores = termConfig.assessments
        .filter((a) => a.type === "QUIZ")
        .sort((a, b) => a.order - b.order)
        .map((assessment) => {
          const score = assessment.scores.find(
            (s) => s.studentId === student.id
          );
          return {
            id: assessment.id,
            name: assessment.name,
            score: score?.score ?? null,
            maxScore: assessment.maxScore,
            percentage:
              score && assessment.maxScore > 0
                ? (score.score / assessment.maxScore) * 100
                : undefined,
          };
        });

      // Build Exam score
      const examAssessment = termConfig.assessments.find(
        (a) => a.type === "EXAM"
      );
      const examScore = examAssessment
        ? (() => {
            const score = examAssessment.scores.find(
              (s) => s.studentId === student.id
            );
            return {
              id: examAssessment.id,
              name: examAssessment.name,
              score: score?.score ?? null,
              maxScore: examAssessment.maxScore,
              percentage:
                score && examAssessment.maxScore > 0
                  ? (score.score / examAssessment.maxScore) * 100
                  : undefined,
            };
          })()
        : undefined;

      return {
        id: student.id,
        studentId: student.studentId,
        lastName: student.lastName,
        firstName: student.firstName,
        middleInitial: student.middleInitial || undefined,
        image: student.image || undefined,
        termGrade: {
          ptScores,
          quizScores,
          examScore,
          totalPercentage: studentTermGrade?.totalPercentage ?? null,
          numericGrade: studentTermGrade?.numericGrade ?? null,
          remarks: studentTermGrade?.remarks ?? null,
        },
      };
    });

    return NextResponse.json({
      students: studentsWithGrades,
      termConfig: {
        id: termConfig.id,
        term: termConfig.term,
        ptWeight: termConfig.ptWeight,
        quizWeight: termConfig.quizWeight,
        examWeight: termConfig.examWeight,
      },
    });
  } catch (error) {
    console.error("Error fetching term grades:", error);
    return NextResponse.json(
      { error: "Failed to fetch term grades" },
      { status: 500 }
    );
  }
}
