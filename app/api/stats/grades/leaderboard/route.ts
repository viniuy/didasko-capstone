import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getAssessmentScores } from "@/lib/services";
import { unstable_cache } from "next/cache";

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
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const facultyId = searchParams.get("facultyId") || session.user.id;
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100); // Top 50, max 100

    // Use cached function for leaderboard calculation
    const leaderboard = await getLeaderboardData(facultyId, limit);

    return NextResponse.json(leaderboard);
  } catch (error) {
    console.error("Error fetching grades leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch grades leaderboard" },
      { status: 500 }
    );
  }
}

// Cached leaderboard calculation function
async function getLeaderboardData(facultyId: string, limit: number) {
  return unstable_cache(
    async (faculty: string, topLimit: number) => {
      // Get course IDs for the faculty (optimized query)
    const courses = await prisma.course.findMany({
      where: {
          facultyId: faculty,
        status: "ACTIVE",
      },
          select: {
            id: true,
          slug: true,
        },
      });

      const courseIds = courses.map((c) => c.id);
      if (courseIds.length === 0) {
        return [];
      }

      // Get all term grades with student info in a single query (database aggregation)
      const termGrades = await prisma.termGrade.findMany({
        where: {
          termConfig: {
            courseId: { in: courseIds },
          },
          totalPercentage: { not: null },
        },
        select: {
          studentId: true,
          totalPercentage: true,
          termConfig: {
            select: {
              term: true,
            },
          },
                student: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    studentId: true,
          },
        },
      },
    });

      // Get assessment scores for computing missing term grades
    const allAssessmentScores: Record<string, Record<string, any>> = {};
    await Promise.all(
      courses.map(async (course) => {
        const scores = await getAssessmentScores(course.slug);
        if (scores) {
          allAssessmentScores[course.slug] = scores;
        }
      })
    );

      // Get term configs for computing grades (only what we need)
      const termConfigs = await prisma.termConfiguration.findMany({
        where: {
          courseId: { in: courseIds },
        },
        include: {
          assessments: {
            where: { enabled: true },
            orderBy: [{ type: "asc" }, { order: "asc" }],
          },
          course: {
            select: { slug: true },
          },
        },
      });

      // Build student performance map using database data (O(n) instead of O(n³))
    const studentPerformanceMap = new Map<
      string,
      {
        studentId: string;
        studentName: string;
        studentNumber: string;
        totalGrades: number[];
        prelimsGrades: number[];
        midtermGrades: number[];
        prefinalsGrades: number[];
        finalsGrades: number[];
      }
    >();

      // Process term grades from database (already computed)
      termGrades.forEach((tg) => {
        if (!tg.totalPercentage) return;

        const studentKey = tg.studentId;
        if (!studentPerformanceMap.has(studentKey)) {
          studentPerformanceMap.set(studentKey, {
            studentId: tg.student.id,
            studentName: `${tg.student.firstName} ${tg.student.lastName}`,
            studentNumber: tg.student.studentId,
            totalGrades: [],
            prelimsGrades: [],
            midtermGrades: [],
            prefinalsGrades: [],
            finalsGrades: [],
          });
        }

        const studentData = studentPerformanceMap.get(studentKey)!;
        const grade = tg.totalPercentage;
        studentData.totalGrades.push(grade);

        // Categorize by term
        const term = tg.termConfig.term.toUpperCase();
        if (term === "PRELIM" || term === "PRELIMS") {
          studentData.prelimsGrades.push(grade);
        } else if (term === "MIDTERM") {
          studentData.midtermGrades.push(grade);
        } else if (term === "PREFINALS" || term === "PRE-FINALS") {
          studentData.prefinalsGrades.push(grade);
        } else if (term === "FINALS") {
          studentData.finalsGrades.push(grade);
          }
      });

      // Compute missing term grades from assessment scores (only for valid configs)
      const validTermConfigs = termConfigs.filter((tc) =>
        isTermConfigValid(tc)
      );

      // Get all unique student IDs from courses
      const studentIds = await prisma.student.findMany({
        where: {
          coursesEnrolled: {
            some: { id: { in: courseIds } },
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          studentId: true,
        },
      });

      // Process missing grades (only compute what's not in termGrades)
      for (const termConfig of validTermConfigs) {
        const courseSlug = termConfig.course.slug;
        const courseAssessmentScores = allAssessmentScores[courseSlug] || {};

        for (const student of studentIds) {
          // Skip if we already have this term grade
          const hasGrade = termGrades.some(
            (tg) =>
              tg.studentId === student.id &&
              tg.termConfig.term === termConfig.term
          );
          if (hasGrade) continue;

          const grade = computeTermGradeFromScores(
              termConfig,
              courseAssessmentScores,
            student.id
            );

          if (grade !== null) {
            const studentKey = student.id;
            if (!studentPerformanceMap.has(studentKey)) {
              studentPerformanceMap.set(studentKey, {
                studentId: student.id,
                studentName: `${student.firstName} ${student.lastName}`,
                studentNumber: student.studentId,
                totalGrades: [],
                prelimsGrades: [],
                midtermGrades: [],
                prefinalsGrades: [],
                finalsGrades: [],
              });
            }

            const studentData = studentPerformanceMap.get(studentKey)!;
            studentData.totalGrades.push(grade);

            const term = termConfig.term.toUpperCase();
            if (term === "PRELIM" || term === "PRELIMS") {
              studentData.prelimsGrades.push(grade);
            } else if (term === "MIDTERM") {
              studentData.midtermGrades.push(grade);
            } else if (term === "PREFINALS" || term === "PRE-FINALS") {
              studentData.prefinalsGrades.push(grade);
            } else if (term === "FINALS") {
              studentData.finalsGrades.push(grade);
            }
          }
        }
      }

    // Calculate averages and improvements
    const leaderboard = Array.from(studentPerformanceMap.values())
      .map((student) => {
        // Calculate current grade (average of all term grades)
        const currentGrade =
          student.totalGrades.length > 0
            ? student.totalGrades.reduce((a, b) => a + b, 0) /
              student.totalGrades.length
            : 0;

        // Calculate improvement: Compare latest term vs average of all previous terms
        // Build term progression array
        const termProgression: { term: string; avg: number }[] = [];
        if (student.prelimsGrades.length > 0) {
          termProgression.push({
            term: "PRELIM",
            avg:
              student.prelimsGrades.reduce((a, b) => a + b, 0) /
              student.prelimsGrades.length,
          });
        }
        if (student.midtermGrades.length > 0) {
          termProgression.push({
            term: "MIDTERM",
            avg:
              student.midtermGrades.reduce((a, b) => a + b, 0) /
              student.midtermGrades.length,
          });
        }
        if (student.prefinalsGrades.length > 0) {
          termProgression.push({
            term: "PREFINALS",
            avg:
              student.prefinalsGrades.reduce((a, b) => a + b, 0) /
              student.prefinalsGrades.length,
          });
        }
        if (student.finalsGrades.length > 0) {
          termProgression.push({
            term: "FINALS",
            avg:
              student.finalsGrades.reduce((a, b) => a + b, 0) /
              student.finalsGrades.length,
          });
        }

        let improvement = 0;
        let isImproving = false;

        // Compare latest term vs average of all previous terms
        if (termProgression.length >= 2) {
          const latestTerm = termProgression[termProgression.length - 1];
          const previousTerms = termProgression.slice(0, -1);

          if (previousTerms.length > 0) {
            const avgPrevious =
              previousTerms.reduce((sum, t) => sum + t.avg, 0) /
              previousTerms.length;
            const absoluteImprovement = latestTerm.avg - avgPrevious;

            if (avgPrevious > 0) {
              improvement = (absoluteImprovement / avgPrevious) * 100;
            } else if (absoluteImprovement > 0) {
              improvement = absoluteImprovement * 10; // Cap at reasonable value
            }

            isImproving = absoluteImprovement > 0;
          }
        }

        // Calculate numeric grade from percentage
        const getNumericGrade = (totalPercent: number): string => {
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

        return {
          id: `${student.studentId}-aggregate`,
          studentId: student.studentId,
          studentName: student.studentName,
          studentNumber: student.studentNumber,
          currentGrade,
          numericGrade: getNumericGrade(currentGrade),
          improvement,
          isImproving,
          rank: 0, // Will be set after sorting
        };
      })
      .filter((student) => student.currentGrade > 0) // Only include students with grades
        .sort((a, b) => b.currentGrade - a.currentGrade)
        .slice(0, topLimit); // Apply pagination

    // Assign ranks
    leaderboard.forEach((student, index) => {
      student.rank = index + 1;
    });

      return leaderboard;
    },
    [`leaderboard-${facultyId}-${limit}`],
    {
      tags: [`leaderboard-${facultyId}`, "leaderboard"],
      revalidate: 300, // 5 minutes
    }
  )(facultyId, limit);
}
