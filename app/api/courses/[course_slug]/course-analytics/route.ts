import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getCourseAnalytics } from "@/lib/services";

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

// ==================== Types ====================
interface TermGradeData {
  ptScores: any[];
  quizScores: any[];
  examScore?: any;
  totalPercentage?: number | null;
  numericGrade?: number | null;
  remarks?: string | null;
}

// ==================== Helper Functions ====================

/**
 * Calculate attendance statistics for a student
 */
const calculateAttendanceStats = (attendanceRecords: any[]) => {
  const totalRecords = attendanceRecords.length;
  const present = attendanceRecords.filter(
    (a) => a.status === "PRESENT"
  ).length;
  const absent = attendanceRecords.filter((a) => a.status === "ABSENT").length;
  const late = attendanceRecords.filter((a) => a.status === "LATE").length;
  const excused = attendanceRecords.filter(
    (a) => a.status === "EXCUSED"
  ).length;

  const rate = totalRecords > 0 ? (present / totalRecords) * 100 : 0;

  return {
    totalPresent: present,
    totalAbsent: absent,
    totalLate: late,
    totalExcused: excused,
    attendanceRate: Math.round(rate * 10) / 10,
  };
};

/**
 * Map term name to object key
 */
const getTermKey = (term: string): string => {
  const normalized = term.toLowerCase().replace(/-/g, ""); // Replace all hyphens

  // Map to correct term keys
  if (normalized === "prelim") return "prelims";
  if (normalized === "prefinals") return "prefinals";
  if (normalized === "midterm") return "midterm";
  if (normalized === "finals") return "finals";

  // Fallback: return normalized value
  return normalized;
};

/**
 * Build assessment scores for a term
 */
const buildAssessmentScores = (
  assessments: any[],
  studentId: string,
  type: string
) => {
  if (!assessments || !Array.isArray(assessments)) return [];
  return assessments
    .filter((a) => a.type === type && a.enabled)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((assessment) => {
      const score = assessment.scores?.find(
        (s: any) => s.student?.id === studentId
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
};

/**
 * Build term grades structure for a student
 */
const buildTermGrades = (termConfigs: any[], studentId: string) => {
  const termGrades: Record<string, TermGradeData | undefined> = {
    prelims: undefined,
    midterm: undefined,
    prefinals: undefined,
    finals: undefined,
  };

  termConfigs.forEach((termConfig) => {
    const termKey = getTermKey(termConfig.term);

    // Get student's computed term grade
    const studentTermGrade = termConfig.termGrades?.find(
      (tg: any) => tg.student.id === studentId
    );

    // Build assessment scores
    const ptScores = buildAssessmentScores(
      termConfig.assessments,
      studentId,
      "PT"
    );
    const quizScores = buildAssessmentScores(
      termConfig.assessments,
      studentId,
      "QUIZ"
    );

    // Build exam score
    const examAssessment = termConfig.assessments?.find(
      (a: any) => a.type === "EXAM" && a.enabled
    );
    const examScore = examAssessment
      ? {
          id: examAssessment.id,
          name: examAssessment.name,
          score:
            examAssessment.scores?.find((s: any) => s.student?.id === studentId)
              ?.score ?? null,
          maxScore: examAssessment.maxScore,
          percentage:
            examAssessment.scores?.find(
              (s: any) => s.student?.id === studentId
            ) && examAssessment.maxScore > 0
              ? (examAssessment.scores.find(
                  (s: any) => s.student?.id === studentId
                )!.score /
                  examAssessment.maxScore) *
                100
              : undefined,
        }
      : undefined;

    // Only add term data if there are assessments or grades
    if (
      ptScores.length > 0 ||
      quizScores.length > 0 ||
      examScore ||
      studentTermGrade
    ) {
      termGrades[termKey] = {
        ptScores,
        quizScores,
        examScore,
        totalPercentage: studentTermGrade?.totalPercentage,
        numericGrade: studentTermGrade?.numericGrade,
        remarks: studentTermGrade?.remarks,
      };
    }
  });

  return termGrades;
};

/**
 * Calculate average grade from term grades with fallback
 */
const calculateAverageGrade = (
  termGrades: Record<string, TermGradeData | undefined>
) => {
  // Try numeric grades first
  const numericGrades = Object.values(termGrades)
    .filter(
      (tg): tg is TermGradeData =>
        tg !== undefined &&
        tg.numericGrade !== null &&
        tg.numericGrade !== undefined
    )
    .map((tg) => tg.numericGrade as number);

  if (numericGrades.length > 0) {
    const average =
      numericGrades.reduce((sum, grade) => sum + grade, 0) /
      numericGrades.length;
    const latest = numericGrades[numericGrades.length - 1];
    return {
      averageGrade: Math.round(average * 10) / 10,
      latestGrade: Math.round(latest * 10) / 10,
    };
  }

  // Fallback to percentage grades
  const percentageGrades = Object.values(termGrades)
    .filter(
      (tg): tg is TermGradeData =>
        tg !== undefined &&
        tg.totalPercentage !== null &&
        tg.totalPercentage !== undefined
    )
    .map((tg) => tg.totalPercentage as number);

  if (percentageGrades.length > 0) {
    const average =
      percentageGrades.reduce((sum, grade) => sum + grade, 0) /
      percentageGrades.length;
    const latest = percentageGrades[percentageGrades.length - 1];
    return {
      averageGrade: Math.round(average * 10) / 10,
      latestGrade: Math.round(latest * 10) / 10,
    };
  }

  return { averageGrade: 0, latestGrade: 0 };
};

/**
 * Calculate course-wide statistics
 */
const calculateCourseStats = (attendance: any[], studentAnalytics: any[]) => {
  const totalAttendanceRecords = attendance.length;
  const totalPresent = attendance.filter((a) => a.status === "PRESENT").length;
  const totalAbsents = attendance.filter((a) => a.status === "ABSENT").length;
  const totalLate = attendance.filter((a) => a.status === "LATE").length;
  const totalExcused = attendance.filter((a) => a.status === "EXCUSED").length;

  const overallAttendanceRate =
    totalAttendanceRecords > 0
      ? (totalPresent / totalAttendanceRecords) * 100
      : 0;

  // Calculate average grade across all students
  const allGrades = studentAnalytics
    .map((s) => s.averageGrade)
    .filter((grade) => grade > 0);

  const courseAverageGrade =
    allGrades.length > 0
      ? allGrades.reduce((sum, grade) => sum + grade, 0) / allGrades.length
      : 0;

  // Calculate passing rate (assuming 75 is passing for percentage, 3.0 or less for numeric)
  const passingStudents = allGrades.filter((grade) => {
    // If grade is less than 5, assume it's numeric grading (1.0-5.0)
    if (grade <= 5) {
      return grade <= 3.0;
    }
    // Otherwise it's percentage (0-100)
    return grade >= 75;
  }).length;

  const passingRate =
    allGrades.length > 0 ? (passingStudents / allGrades.length) * 100 : 0;

  return {
    attendanceRate: Math.round(overallAttendanceRate * 10) / 10,
    averageGrade: Math.round(courseAverageGrade * 10) / 10,
    totalAbsents,
    totalLate,
    totalExcused,
    passingRate: Math.round(passingRate * 10) / 10,
  };
};

// ==================== Main Handler ====================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ course_slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { course_slug } = await params;

    // Fetch course with all related data using service
    const course = await getCourseAnalytics(course_slug);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Calculate student analytics
    const studentAnalytics = course.students.map((student) => {
      // Filter attendance for this student
      const studentAttendance = (course.attendance || []).filter(
        (a) => a.student.id === student.id
      );

      // Calculate attendance stats
      const attendanceStats = calculateAttendanceStats(studentAttendance);

      // Build term grades structure
      const termGrades = buildTermGrades(course.termConfigs || [], student.id);

      // Calculate average grade
      const gradeStats = calculateAverageGrade(termGrades);

      return {
        id: student.id,
        studentId: student.studentId,
        lastName: student.lastName,
        firstName: student.firstName,
        middleInitial: student.middleInitial || undefined,
        image: student.image || undefined,
        rfid_id: student.rfid_id || undefined,
        attendanceRecords: studentAttendance
          .map((a) => ({
            id: a.id,
            date: typeof a.date === "string" ? a.date : a.date.toISOString(),
            status: a.status,
          }))
          .sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          ),
        ...attendanceStats,
        ...gradeStats,
        termGrades,
      };
    });

    // Calculate course-wide statistics
    const stats = {
      totalStudents: course.students.length,
      ...calculateCourseStats(course.attendance || [], studentAnalytics),
    };

    // Course info
    const courseInfo = {
      id: course.id,
      code: course.code,
      title: course.title,
      section: course.section,
      room: course.room,
      semester: course.semester,
      academicYear: course.academicYear,
      slug: course.slug,
      status: course.status,
      faculty: course.faculty,
      schedules: course.schedules,
    };

    return NextResponse.json({
      course: courseInfo,
      stats,
      students: studentAnalytics,
    });
  } catch (error) {
    console.error("Error fetching course analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch course analytics" },
      { status: 500 }
    );
  }
}
