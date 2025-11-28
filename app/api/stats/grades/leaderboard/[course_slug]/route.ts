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

// Helper: Transmute score using new formula
// Formula: raw_score * (base/100) + ((100 - base)/100) * max_score
function transmuteScore(
  rawScore: number | null,
  maxScore: number,
  base: number
): number | null {
  // If base is 0, no transmutation (raw score stays the same)
  if (base === 0 || rawScore === null) return rawScore;

  // New formula: (raw_score / max_score) * (base% of max_score) + (remaining% of max_score)
  // Simplified: raw_score * (base/100) + ((100 - base)/100) * max_score
  const basePercentage = base / 100;
  const remainingPercentage = (100 - base) / 100;
  const transmuted = rawScore * basePercentage + remainingPercentage * maxScore;

  return transmuted;
}

// Helper: Get effective score (handles linked criteria)
function getEffectiveScore(
  studentId: string,
  assessment: any,
  assessmentScores: Record<string, any>
): number | null {
  if (assessment.linkedCriteriaId) {
    // Get score from linked criteria
    const criteriaKey = `${studentId}:criteria:${assessment.linkedCriteriaId}`;
    const criteriaData = assessmentScores[criteriaKey];
    if (!criteriaData) return null;

    // If we have rawScores and criteria metadata, calculate true score
    // Otherwise, use the percentage value and convert to score
    if (criteriaData.rawScores && criteriaData.criteriaMeta) {
      const rawScores = Array.isArray(criteriaData.rawScores)
        ? criteriaData.rawScores
        : null;
      const rubrics = criteriaData.criteriaMeta.rubrics || [];
      const scoringRange = criteriaData.criteriaMeta.scoringRange || 5;

      if (rawScores && rubrics.length > 0) {
        // Calculate weighted percentage
        const validScores = rawScores.slice(0, rubrics.length);
        const weightedScores = validScores.map(
          (score: number, index: number) => {
            const weight = rubrics[index]?.percentage || 0;
            return (score / scoringRange) * weight;
          }
        );
        const weightedPercentage = weightedScores.reduce(
          (sum: number, val: number) => sum + val,
          0
        );

        // Convert percentage to actual score
        const trueScore = (weightedPercentage / 100) * assessment.maxScore;
        return Math.round(trueScore * 100) / 100;
      }
    }

    // Fallback: use percentage value and convert to score
    const percentage = criteriaData.score;
    if (percentage === null) return null;
    return Math.round((percentage / 100) * assessment.maxScore * 100) / 100;
  }

  // Regular assessment score
  const key = `${studentId}:${assessment.id}`;
  const scoreData = assessmentScores[key];
  return scoreData?.score !== null && scoreData?.score !== undefined
    ? scoreData.score
    : null;
}

// Helper: Compute term grade from assessment scores (matching class-record.tsx logic)
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

  // Apply transmutation to raw scores before calculating percentages (per-assessment)
  // Match class-record.tsx logic exactly
  let ptPercentages: number[] = [];
  ptAssessments.forEach((pt: any) => {
    const rawScore = getEffectiveScore(studentId, pt, assessmentScores);
    // For linked assessments, if no score exists, treat as 0 for computation
    const scoreForComputation =
      rawScore === null && pt.linkedCriteriaId ? 0 : rawScore;
    // Apply transmutation using assessment's own transmutationBase
    const transmutedScore = transmuteScore(
      scoreForComputation,
      pt.maxScore,
      pt.transmutationBase ?? 0
    );
    if (transmutedScore !== null && pt.maxScore > 0) {
      const pct = Math.max(
        0,
        Math.min(100, (transmutedScore / pt.maxScore) * 100)
      );
      ptPercentages.push(pct);
    }
  });

  let quizPercentages: number[] = [];
  quizAssessments.forEach((quiz: any) => {
    const rawScore = getEffectiveScore(studentId, quiz, assessmentScores);
    // For linked assessments, if no score exists, treat as 0 for computation
    const scoreForComputation =
      rawScore === null && quiz.linkedCriteriaId ? 0 : rawScore;
    // Apply transmutation using assessment's own transmutationBase
    const transmutedScore = transmuteScore(
      scoreForComputation,
      quiz.maxScore,
      quiz.transmutationBase ?? 0
    );
    if (transmutedScore !== null && quiz.maxScore > 0) {
      const pct = Math.max(
        0,
        Math.min(100, (transmutedScore / quiz.maxScore) * 100)
      );
      quizPercentages.push(pct);
    }
  });

  let examPercentage: number | null = null;
  if (examAssessment) {
    const rawExamScore = getEffectiveScore(
      studentId,
      examAssessment,
      assessmentScores
    );
    // For linked assessments, if no score exists, treat as 0 for computation
    const scoreForComputation =
      rawExamScore === null && examAssessment.linkedCriteriaId
        ? 0
        : rawExamScore;
    // Apply transmutation using assessment's own transmutationBase
    const transmutedExamScore = transmuteScore(
      scoreForComputation,
      examAssessment.maxScore,
      examAssessment.transmutationBase ?? 0
    );
    if (transmutedExamScore !== null && examAssessment.maxScore > 0) {
      examPercentage = Math.max(
        0,
        Math.min(100, (transmutedExamScore / examAssessment.maxScore) * 100)
      );
    }
  }

  // If no exam score, can't compute term grade
  if (examPercentage === null) return null;

  // CRITICAL FIX: Divide by actual number of scores, not total assessments
  // If a student has scores for 2 out of 3 PT assessments, divide by 2, not 3
  const ptAvg =
    ptPercentages.length > 0
      ? ptPercentages.reduce((a, b) => a + b, 0) / ptPercentages.length
      : null;
  const quizAvg =
    quizPercentages.length > 0
      ? quizPercentages.reduce((a, b) => a + b, 0) / quizPercentages.length
      : null;

  // Calculate weighted scores independently:
  // PT weighted is calculated if ALL PT assessments have scores
  // Quiz weighted is calculated if ALL Quiz assessments have scores
  // Exam weighted is calculated if Exam has a score
  const hasAllPTScores =
    ptAssessments.length === 0 ||
    (ptPercentages.length === ptAssessments.length && ptAvg !== null);
  const hasAllQuizScores =
    quizAssessments.length === 0 ||
    (quizPercentages.length === quizAssessments.length && quizAvg !== null);
  const hasExamScore = !examAssessment || examPercentage !== null;

  const ptWeighted =
    hasAllPTScores && ptAvg !== null
      ? (ptAvg / 100) * termConfig.ptWeight
      : null;
  const quizWeighted =
    hasAllQuizScores && quizAvg !== null
      ? (quizAvg / 100) * termConfig.quizWeight
      : null;
  const examWeighted =
    hasExamScore && examPercentage !== null
      ? (examPercentage / 100) * termConfig.examWeight
      : null;

  // Only calculate total if we have all required scores
  const hasRequiredPTScores = ptAssessments.length === 0 || ptWeighted !== null;
  const hasRequiredQuizScores =
    quizAssessments.length === 0 || quizWeighted !== null;
  const hasRequiredExamScore = !examAssessment || examWeighted !== null;

  // Calculate total only if all required components are present
  const totalPercentage =
    hasRequiredPTScores && hasRequiredQuizScores && hasRequiredExamScore
      ? (ptWeighted ?? 0) + (quizWeighted ?? 0) + (examWeighted ?? 0)
      : null;

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
              select: {
                id: true,
                name: true,
                type: true,
                maxScore: true,
                date: true,
                enabled: true,
                order: true,
                linkedCriteriaId: true,
                transmutationBase: true,
              },
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

    // Get assessment scores for computing grades (with criteria metadata)
    const assessmentScoresResult = await getAssessmentScores(courseSlug);
    const assessmentScores = assessmentScoresResult || {};

    // Fetch criteria metadata for linked assessments
    const criteriaMetadata: Record<string, any> = {};
    const criteriaIds = new Set<string>();
    course.termConfigs.forEach((tc: any) => {
      tc.assessments.forEach((a: any) => {
        if (a.linkedCriteriaId) {
          criteriaIds.add(a.linkedCriteriaId);
        }
      });
    });

    if (criteriaIds.size > 0) {
      const criteria = await prisma.criteria.findMany({
        where: { id: { in: Array.from(criteriaIds) } },
        select: {
          id: true,
          scoringRange: true,
          rubrics: {
            select: {
              id: true,
              name: true,
              percentage: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      criteria.forEach((c: any) => {
        criteriaMetadata[c.id] = {
          scoringRange: Number(c.scoringRange) || 5,
          rubrics: c.rubrics.map((r: any) => ({
            percentage: r.percentage,
          })),
        };
      });

      // Update assessmentScores with criteria metadata and raw scores
      const criteriaScores = await prisma.grade.findMany({
        where: {
          courseId: course.id,
          criteriaId: { in: Array.from(criteriaIds) },
        },
        select: {
          studentId: true,
          criteriaId: true,
          value: true,
          scores: true,
        },
      });

      criteriaScores.forEach((grade: any) => {
        const key = `${grade.studentId}:criteria:${grade.criteriaId}`;
        if (assessmentScores[key]) {
          assessmentScores[key] = {
            ...assessmentScores[key],
            rawScores: grade.scores,
            criteriaMeta: criteriaMetadata[grade.criteriaId],
          };
        }
      });
    }

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
        studentName: `${student.lastName}, ${student.firstName}`,
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
          // Add term-specific numeric grades and percentages for per-term counting and sorting
          termGrades: {
            PRELIM: prelimNumeric,
            MIDTERM: midtermNumeric,
            PREFINALS: prefinalNumeric,
            FINALS: finalNumeric,
          },
          termPercentages: {
            PRELIM: prelimGrade,
            MIDTERM: midtermGrade,
            PREFINALS: prefinalGrade,
            FINALS: finalGrade,
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
