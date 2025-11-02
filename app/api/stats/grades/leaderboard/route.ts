import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

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
          },
        },
      },
    });

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
      course.termConfigs.forEach((termConfig) => {
        termConfig.termGrades.forEach((termGrade) => {
          const studentKey = termGrade.studentId;

          if (!studentPerformanceMap.has(studentKey)) {
            studentPerformanceMap.set(studentKey, {
              studentId: termGrade.student.id,
              studentName: `${termGrade.student.firstName} ${termGrade.student.lastName}`,
              studentNumber: termGrade.student.studentId,
              totalGrades: [],
              prelimsGrades: [],
              midtermGrades: [],
              prefinalsGrades: [],
              finalsGrades: [],
            });
          }

          const studentData = studentPerformanceMap.get(studentKey)!;

          // Add grades based on term
          if (termGrade.totalPercentage !== null) {
            studentData.totalGrades.push(termGrade.totalPercentage);

            // Categorize by term
            const term = termConfig.term.toUpperCase();
            if (term === "PRELIMS") {
              studentData.prelimsGrades.push(termGrade.totalPercentage);
            } else if (term === "MIDTERM") {
              studentData.midtermGrades.push(termGrade.totalPercentage);
            } else if (term === "PRE-FINALS") {
              studentData.prefinalsGrades.push(termGrade.totalPercentage);
            } else if (term === "FINALS") {
              studentData.finalsGrades.push(termGrade.totalPercentage);
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

        // Calculate average of early terms (PRELIMS + MIDTERM)
        const earlyTermsGrades = [
          ...student.prelimsGrades,
          ...student.midtermGrades,
        ];
        const avgEarlyTerms =
          earlyTermsGrades.length > 0
            ? earlyTermsGrades.reduce((a, b) => a + b, 0) /
              earlyTermsGrades.length
            : 0;

        // Calculate average of later terms (PRE-FINALS + FINALS)
        const laterTermsGrades = [
          ...student.prefinalsGrades,
          ...student.finalsGrades,
        ];
        const avgLaterTerms =
          laterTermsGrades.length > 0
            ? laterTermsGrades.reduce((a, b) => a + b, 0) /
              laterTermsGrades.length
            : 0;

        // Calculate improvement (early terms vs later terms)
        const improvement =
          avgEarlyTerms > 0 && avgLaterTerms > 0
            ? ((avgLaterTerms - avgEarlyTerms) / avgEarlyTerms) * 100
            : 0;

        return {
          id: `${student.studentId}-aggregate`,
          studentId: student.studentId,
          studentName: student.studentName,
          studentNumber: student.studentNumber,
          currentGrade,
          improvement,
          isImproving: improvement > 0,
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
