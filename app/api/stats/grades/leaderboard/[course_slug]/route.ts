// GET leaderboard for a specific course
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

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

    // Get the specific course with term configurations and grades
    const course = await prisma.course.findFirst({
      where: {
        slug: courseSlug,
        facultyId: session.user.id, // Ensure faculty owns this course
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
          orderBy: {
            term: "asc",
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
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

    // Collect all term grades for each student
    course.termConfigs.forEach((termConfig) => {
      termConfig.termGrades.forEach((termGrade) => {
        const studentKey = termGrade.studentId;

        if (!studentPerformanceMap.has(studentKey)) {
          studentPerformanceMap.set(studentKey, {
            studentId: termGrade.student.id,
            studentName: `${termGrade.student.firstName} ${termGrade.student.lastName}`,
            studentNumber: termGrade.student.studentId,
            termGrades: [],
          });
        }

        const studentData = studentPerformanceMap.get(studentKey)!;

        if (termGrade.totalPercentage !== null) {
          studentData.termGrades.push({
            term: termConfig.term,
            grade: termGrade.totalPercentage,
          });
        }
      });
    });

    // Calculate leaderboard data for each student
    const leaderboard = Array.from(studentPerformanceMap.values())
      .map((student) => {
        // Current grade is the average of all term grades
        const currentGrade =
          student.termGrades.length > 0
            ? student.termGrades.reduce((sum, tg) => sum + tg.grade, 0) /
              student.termGrades.length
            : 0;

        // Calculate improvement (first term vs latest term)
        let improvement = 0;
        if (student.termGrades.length >= 2) {
          const firstTerm = student.termGrades[0].grade;
          const latestTerm =
            student.termGrades[student.termGrades.length - 1].grade;
          improvement = ((latestTerm - firstTerm) / firstTerm) * 100;
        }

        return {
          id: `${student.studentId}-${courseSlug}`,
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
    console.error("Error fetching course leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch course leaderboard" },
      { status: 500 }
    );
  }
}
