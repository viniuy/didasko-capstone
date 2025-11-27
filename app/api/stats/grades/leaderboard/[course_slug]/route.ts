// GET leaderboard for a specific course
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getAssessmentScores } from "@/lib/services";

// Helper: Check if term config weights are properly configured
function isTermConfigValid(termConfig: any): boolean {
  const ptWeight = termConfig.ptWeight ?? 0;
  const quizWeight = termConfig.quizWeight ?? 0;
  const examWeight = termConfig.examWeight ?? 0;
  const totalWeight = ptWeight + quizWeight + examWeight;

  // Weights should sum to 100 and all should be valid numbers
  return (
    totalWeight === 100 &&
    ptWeight >= 0 &&
    quizWeight >= 0 &&
    examWeight >= 0 &&
    !isNaN(ptWeight) &&
    !isNaN(quizWeight) &&
    !isNaN(examWeight)
  );
}

// Helper: Compute term grade from assessment scores
function computeTermGradeFromScores(
  termConfig: any,
  assessmentScores: Record<string, any>,
  studentId: string
): number | null {
  // Don't compute if weights are not properly configured
  if (!isTermConfigValid(termConfig)) {
    return null;
  }

  const ptAssessments = termConfig.assessments.filter(
    (a: any) => a.type === "PT" && a.enabled
  );
  const quizAssessments = termConfig.assessments.filter(
    (a: any) => a.type === "QUIZ" && a.enabled
  );
  const examAssessment = termConfig.assessments.find(
    (a: any) => a.type === "EXAM" && a.enabled
  );

  // Calculate PT average percentage
  const ptPercentages: number[] = [];
  ptAssessments.forEach((pt: any) => {
    const key = `${studentId}:${pt.id}`;
    const scoreData = assessmentScores[key];
    if (
      scoreData?.score !== null &&
      scoreData?.score !== undefined &&
      pt.maxScore > 0
    ) {
      const percentage = (scoreData.score / pt.maxScore) * 100;
      ptPercentages.push(percentage);
    }
  });
  const ptAvg =
    ptPercentages.length > 0
      ? ptPercentages.reduce((a, b) => a + b, 0) / ptAssessments.length
      : 0;

  // Calculate Quiz average percentage
  const quizPercentages: number[] = [];
  quizAssessments.forEach((quiz: any) => {
    const key = `${studentId}:${quiz.id}`;
    const scoreData = assessmentScores[key];
    if (
      scoreData?.score !== null &&
      scoreData?.score !== undefined &&
      quiz.maxScore > 0
    ) {
      const percentage = (scoreData.score / quiz.maxScore) * 100;
      quizPercentages.push(percentage);
    }
  });
  const quizAvg =
    quizPercentages.length > 0
      ? quizPercentages.reduce((a, b) => a + b, 0) / quizAssessments.length
      : 0;

  // Calculate Exam percentage
  let examPercentage: number | null = null;
  if (examAssessment) {
    const key = `${studentId}:${examAssessment.id}`;
    const scoreData = assessmentScores[key];
    if (
      scoreData?.score !== null &&
      scoreData?.score !== undefined &&
      examAssessment.maxScore > 0
    ) {
      examPercentage = (scoreData.score / examAssessment.maxScore) * 100;
    }
  }

  // If no exam score, can't compute term grade
  if (examPercentage === null) return null;

  // Calculate weighted total
  const ptWeighted = (ptAvg / 100) * termConfig.ptWeight;
  const quizWeighted = (quizAvg / 100) * termConfig.quizWeight;
  const examWeighted = (examPercentage / 100) * termConfig.examWeight;
  const totalPercentage = ptWeighted + quizWeighted + examWeighted;

  return totalPercentage;
}

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(
  request: Request,
  { params }: { params: Promise<{ course_slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { course_slug: courseSlug } = await params;

    // Get the specific course with term configurations, grades, and students
    const course = await prisma.course.findFirst({
      where: {
        slug: courseSlug,
        facultyId: session.user.id, // Ensure faculty owns this course
      },
      include: {
        students: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentId: true,
          },
        },
        termConfigs: {
          include: {
            termGrades: {
              include: {
                student: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    studentId: true,
                  },
                },
              },
            },
            assessments: {
              orderBy: [{ type: "asc" }, { order: "asc" }],
            },
          },
          orderBy: {
            term: "asc",
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Get assessment scores for computing grades
    const assessmentScores = await getAssessmentScores(courseSlug);

    // Map to track each student's performance across terms
    const studentPerformanceMap = new Map<
      string,
      {
        studentId: string;
        studentName: string;
        studentNumber: string;
        termGrades: { term: string; grade: number }[];
      }
    >();

    // Initialize all students
    course.students.forEach((student) => {
      studentPerformanceMap.set(student.id, {
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        studentNumber: student.studentId,
        termGrades: [],
      });
    });

    // Collect all term grades for each student (from saved termGrades or compute from scores)
    // Only process term configs with valid weights
    course.termConfigs.forEach((termConfig) => {
      // Skip if weights are not properly configured
      if (!isTermConfigValid(termConfig)) {
        return;
      }

      course.students.forEach((student) => {
        const studentKey = student.id;
        const studentData = studentPerformanceMap.get(studentKey)!;

        // Try to get saved term grade first
        const savedTermGrade = termConfig.termGrades.find(
          (tg: any) => tg.studentId === studentKey
        );

        let grade: number | null = null;

        if (
          savedTermGrade?.totalPercentage !== null &&
          savedTermGrade?.totalPercentage !== undefined
        ) {
          // Use saved term grade
          grade = savedTermGrade.totalPercentage;
        } else {
          // Compute from assessment scores
          grade = computeTermGradeFromScores(
            termConfig,
            assessmentScores || {},
            studentKey
          );
        }

        if (grade !== null) {
          studentData.termGrades.push({
            term: termConfig.term,
            grade: grade,
          });
        }
      });
    });

    // Helper function to get term grade by term name
    const getTermGrade = (
      termGrades: { term: string; grade: number }[],
      termName: string
    ): number | null => {
      const termGrade = termGrades.find(
        (tg) => tg.term.toUpperCase() === termName.toUpperCase()
      );
      return termGrade ? termGrade.grade : null;
    };

    // Term weights for final grade calculation (matching class-record.tsx)
    const TERM_WEIGHTS = {
      PRELIM: 0.2,
      MIDTERM: 0.2,
      PREFINALS: 0.2,
      FINALS: 0.4,
    } as const;

    // Helper: Convert percentage to numeric grade (matching class-record.tsx)
    const getNumericGradeFromPercent = (totalPercent: number): string => {
      if (totalPercent >= 97.5) return "1.00";
      if (totalPercent >= 94.5) return "1.25";
      if (totalPercent >= 91.5) return "1.50";
      if (totalPercent >= 86.5) return "1.75";
      if (totalPercent >= 81.5) return "2.00";
      if (totalPercent >= 76.0) return "2.25";
      if (totalPercent >= 70.5) return "2.50";
      if (totalPercent >= 65.0) return "2.75";
      if (totalPercent >= 59.5) return "3.00";
      return "5.00";
    };

    // Helper: Convert numeric grade string to number
    const numericGradeToNumber = (numericGrade: string): number => {
      const num = parseFloat(numericGrade);
      return isNaN(num) ? 0 : num;
    };

    // Calculate leaderboard data for each student
    const leaderboard = Array.from(studentPerformanceMap.values())
      .map((student) => {
        const prelimGrade = getTermGrade(student.termGrades, "PRELIM");
        const midtermGrade = getTermGrade(student.termGrades, "MIDTERM");
        const prefinalGrade = getTermGrade(student.termGrades, "PREFINALS");
        const finalGrade = getTermGrade(student.termGrades, "FINALS");

        // Calculate numeric grades for each term (for per-term counting)
        const prelimNumeric =
          prelimGrade !== null ? getNumericGradeFromPercent(prelimGrade) : null;
        const midtermNumeric =
          midtermGrade !== null
            ? getNumericGradeFromPercent(midtermGrade)
            : null;
        const prefinalNumeric =
          prefinalGrade !== null
            ? getNumericGradeFromPercent(prefinalGrade)
            : null;
        const finalNumeric =
          finalGrade !== null ? getNumericGradeFromPercent(finalGrade) : null;

        // Calculate final grade using weighted formula (matching computeFinalGrade)
        // Only calculate if all 4 term grades are available
        let currentGrade = 0;
        let numericGrade: string | null = null;

        if (
          prelimGrade !== null &&
          midtermGrade !== null &&
          prefinalGrade !== null &&
          finalGrade !== null
        ) {
          // Step 1: Convert each term's percentage to numeric grade
          const prelimNum = numericGradeToNumber(prelimNumeric!);
          const midtermNum = numericGradeToNumber(midtermNumeric!);
          const preFinalsNum = numericGradeToNumber(prefinalNumeric!);
          const finalsNum = numericGradeToNumber(finalNumeric!);

          // Step 2: Calculate weighted final numeric grade (matching computeFinalGrade logic)
          const finalWeightedNumeric =
            prelimNum * TERM_WEIGHTS.PRELIM +
            midtermNum * TERM_WEIGHTS.MIDTERM +
            preFinalsNum * TERM_WEIGHTS.PREFINALS +
            finalsNum * TERM_WEIGHTS.FINALS;

          // Step 3: Store numeric grade for counting (this is what gets counted in the leaderboard)
          numericGrade = finalWeightedNumeric.toFixed(2);

          // Step 4: Calculate weighted percentage for display (used in GradeBar)
          // This is the weighted average of term percentages
          const finalWeightedPercent =
            prelimGrade * TERM_WEIGHTS.PRELIM +
            midtermGrade * TERM_WEIGHTS.MIDTERM +
            prefinalGrade * TERM_WEIGHTS.PREFINALS +
            finalGrade * TERM_WEIGHTS.FINALS;

          currentGrade = finalWeightedPercent;
        } else {
          // If not all term grades are available, still include student for per-term counting
          // but set currentGrade to 0 so they don't appear in final grade leaderboard
          currentGrade = 0;
        }

        // Calculate improvement: Compare current term vs average of all previous terms
        // - MIDTERM vs PRELIM
        // - PREFINALS vs average of (PRELIM + MIDTERM)
        // - FINALS vs average of (PRELIM + MIDTERM + PREFINALS)
        let improvement = 0;
        let isImproving = false;

        // Sort term grades by term order to get proper progression
        const termOrder = ["PRELIM", "MIDTERM", "PREFINALS", "FINALS"];
        const sortedTermGrades = [...student.termGrades].sort((a, b) => {
          const aIndex = termOrder.indexOf(a.term.toUpperCase());
          const bIndex = termOrder.indexOf(b.term.toUpperCase());
          return aIndex - bIndex;
        });

        // Calculate improvement: Compare latest term vs average of all previous terms
        if (sortedTermGrades.length >= 2) {
          const latestTerm = sortedTermGrades[sortedTermGrades.length - 1];
          const previousTerms = sortedTermGrades.slice(0, -1);

          if (previousTerms.length > 0) {
            const avgPrevious =
              previousTerms.reduce((sum, tg) => sum + tg.grade, 0) /
              previousTerms.length;
            const absoluteImprovement = latestTerm.grade - avgPrevious;

            if (avgPrevious > 0) {
              improvement = (absoluteImprovement / avgPrevious) * 100;
            } else if (absoluteImprovement > 0) {
              improvement = absoluteImprovement * 10; // Cap at reasonable value
            }

            isImproving = absoluteImprovement > 0;
          }
        }

        return {
          id: `${student.studentId}-${courseSlug}`,
          studentId: student.studentId,
          studentName: student.studentName,
          studentNumber: student.studentNumber,
          currentGrade, // This is now the weighted percentage (0-100) for display (0 if not all terms available)
          numericGrade: numericGrade || undefined, // This is the final numeric grade string (e.g., "2.50") for counting
          improvement,
          isImproving,
          rank: 0, // Will be set after sorting
          // Add term-specific numeric grades for per-term counting
          termGrades: {
            PRELIM: prelimNumeric,
            MIDTERM: midtermNumeric,
            PREFINALS: prefinalNumeric,
            FINALS: finalNumeric,
          },
        };
      })
      .filter(
        (student): student is NonNullable<typeof student> => student !== null
      ) // Include all students (they may have term grades even if not final grade)
      .sort((a, b) => {
        // Sort by final grade if available, otherwise by 0
        const aGrade = a.currentGrade > 0 ? a.currentGrade : 0;
        const bGrade = b.currentGrade > 0 ? b.currentGrade : 0;
        return bGrade - aGrade;
      });

    // Assign ranks
    leaderboard.forEach((student, index) => {
      student.rank = index + 1;
    });

    return NextResponse.json(leaderboard);
  } catch (error) {
    console.error("Error fetching course leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch course leaderboard" },
      { status: 500 }
    );
  }
}
