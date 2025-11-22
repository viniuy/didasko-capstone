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

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const facultyId = searchParams.get("facultyId") || session.user.id;

    // Get all active courses for the faculty
    const courses = await prisma.course.findMany({
      where: {
        facultyId: facultyId,
        status: "ACTIVE",
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
        },
      },
    });

    // Get assessment scores for all courses
    const allAssessmentScores: Record<string, Record<string, any>> = {};
    await Promise.all(
      courses.map(async (course) => {
        const scores = await getAssessmentScores(course.slug);
        if (scores) {
          allAssessmentScores[course.slug] = scores;
        }
      })
    );

    // Aggregate student performance across all courses and terms
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

    courses.forEach((course) => {
      const courseAssessmentScores = allAssessmentScores[course.slug] || {};

      course.students.forEach((student) => {
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

        course.termConfigs.forEach((termConfig) => {
          // Skip if weights are not properly configured
          if (!isTermConfigValid(termConfig)) {
            return;
          }

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
              courseAssessmentScores,
              studentKey
            );
          }

          if (grade !== null) {
            studentData.totalGrades.push(grade);

            // Categorize by term (handle both "PRELIM" and "PRELIMS", "PREFINALS" and "PRE-FINALS")
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
        });
      });
    });

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
      .sort((a, b) => b.currentGrade - a.currentGrade);

    // Assign ranks
    leaderboard.forEach((student, index) => {
      student.rank = index + 1;
    });

    return NextResponse.json(leaderboard);
  } catch (error) {
    console.error("Error fetching grades leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch grades leaderboard" },
      { status: 500 }
    );
  }
}
