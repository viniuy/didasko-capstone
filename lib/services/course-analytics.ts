import { getCourseAnalytics } from "./courses";

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
 * Calculate attendance statistics for a student (optimized with single pass)
 */
const calculateAttendanceStats = (attendanceRecords: any[]) => {
  let totalRecords = 0;
  let present = 0;
  let absent = 0;
  let late = 0;
  let excused = 0;

  // Single pass instead of multiple filters
  for (const record of attendanceRecords) {
    totalRecords++;
    switch (record.status) {
      case "PRESENT":
        present++;
        break;
      case "ABSENT":
        absent++;
        break;
      case "LATE":
        late++;
        break;
      case "EXCUSED":
        excused++;
        break;
    }
  }

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
  return term.toLowerCase().replace("-", "") as
    | "prelims"
    | "midterm"
    | "prefinals"
    | "finals";
};

/**
 * Build assessment scores for a term (optimized with Map-based lookup)
 */
const buildAssessmentScores = (
  assessments: any[],
  studentId: string,
  type: string,
  scoresByAssessment: Map<string, Map<string, number>>
) => {
  if (!assessments || !Array.isArray(assessments)) return [];

  // Filter and sort assessments
  const filteredAssessments = assessments
    .filter((a) => a.type === type && a.enabled)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return filteredAssessments.map((assessment) => {
    // Use Map lookup instead of array.find() - O(1) instead of O(n)
    const assessmentScores = scoresByAssessment.get(assessment.id);
    const score = assessmentScores?.get(studentId);

    return {
      id: assessment.id,
      name: assessment.name,
      score: score ?? null,
      maxScore: assessment.maxScore,
      percentage:
        score !== undefined && assessment.maxScore > 0
          ? (score / assessment.maxScore) * 100
          : undefined,
    };
  });
};

/**
 * Build term grades structure for a student (optimized with Map-based lookups)
 */
const buildTermGrades = (
  termConfigs: any[],
  studentId: string,
  termGradesByConfig: Map<string, Map<string, any>>,
  scoresByAssessment: Map<string, Map<string, number>>
) => {
  const termGrades: Record<string, TermGradeData | undefined> = {
    prelims: undefined,
    midterm: undefined,
    prefinals: undefined,
    finals: undefined,
  };

  termConfigs.forEach((termConfig) => {
    const termKey = getTermKey(termConfig.term);

    // Get student's computed term grade using Map lookup - O(1) instead of O(n)
    const configTermGrades = termGradesByConfig.get(termConfig.id);
    const studentTermGrade = configTermGrades?.get(studentId);

    // Build assessment scores
    const ptScores = buildAssessmentScores(
      termConfig.assessments,
      studentId,
      "PT",
      scoresByAssessment
    );
    const quizScores = buildAssessmentScores(
      termConfig.assessments,
      studentId,
      "QUIZ",
      scoresByAssessment
    );

    // Build exam score using Map lookup
    const examAssessment = termConfig.assessments?.find(
      (a: any) => a.type === "EXAM" && a.enabled
    );
    const examScore = examAssessment
      ? (() => {
          const examScores = scoresByAssessment.get(examAssessment.id);
          const score = examScores?.get(studentId);
          return {
            id: examAssessment.id,
            name: examAssessment.name,
            score: score ?? null,
            maxScore: examAssessment.maxScore,
            percentage:
              score !== undefined && examAssessment.maxScore > 0
                ? (score / examAssessment.maxScore) * 100
                : undefined,
          };
        })()
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
 * Calculate course-wide statistics (optimized with single pass)
 */
const calculateCourseStats = (attendance: any[], studentAnalytics: any[]) => {
  // Single pass through attendance records
  let totalAttendanceRecords = 0;
  let totalPresent = 0;
  let totalAbsents = 0;
  let totalLate = 0;
  let totalExcused = 0;

  for (const record of attendance) {
    totalAttendanceRecords++;
    switch (record.status) {
      case "PRESENT":
        totalPresent++;
        break;
      case "ABSENT":
        totalAbsents++;
        break;
      case "LATE":
        totalLate++;
        break;
      case "EXCUSED":
        totalExcused++;
        break;
    }
  }

  const overallAttendanceRate =
    totalAttendanceRecords > 0
      ? (totalPresent / totalAttendanceRecords) * 100
      : 0;

  // Calculate average grade across all students (single pass)
  let gradeSum = 0;
  let gradeCount = 0;
  let passingStudents = 0;

  for (const student of studentAnalytics) {
    const grade = student.averageGrade;
    if (grade > 0) {
      gradeSum += grade;
      gradeCount++;

      // Check if passing (assuming 75 is passing for percentage, 3.0 or less for numeric)
      if (grade <= 5) {
        // Numeric grading (1.0-5.0)
        if (grade <= 3.0) passingStudents++;
      } else {
        // Percentage (0-100)
        if (grade >= 75) passingStudents++;
      }
    }
  }

  const courseAverageGrade = gradeCount > 0 ? gradeSum / gradeCount : 0;
  const passingRate = gradeCount > 0 ? (passingStudents / gradeCount) * 100 : 0;

  return {
    attendanceRate: Math.round(overallAttendanceRate * 10) / 10,
    averageGrade: Math.round(courseAverageGrade * 10) / 10,
    totalAbsents,
    totalLate,
    totalExcused,
    passingRate: Math.round(passingRate * 10) / 10,
  };
};

/**
 * Get course analytics with all calculations (server-side, optimized)
 */
export async function getCourseAnalyticsData(courseSlug: string) {
  // Fetch course with all related data using service
  const course = await getCourseAnalytics(courseSlug);

  if (!course) {
    return null;
  }

  // Build Maps for O(1) lookups instead of O(n²) filters
  // Map: studentId -> attendance records
  const attendanceByStudent = new Map<string, any[]>();
  for (const record of course.attendance || []) {
    const studentId = record.student.id;
    if (!attendanceByStudent.has(studentId)) {
      attendanceByStudent.set(studentId, []);
    }
    attendanceByStudent.get(studentId)!.push(record);
  }

  // Map: termConfigId -> (studentId -> termGrade)
  const termGradesByConfig = new Map<string, Map<string, any>>();
  for (const termConfig of course.termConfigs || []) {
    const configMap = new Map<string, any>();
    for (const termGrade of termConfig.termGrades || []) {
      // Use studentId directly (from optimized query structure)
      const studentId = termGrade.student?.id || termGrade.studentId;
      configMap.set(studentId, termGrade);
    }
    termGradesByConfig.set(termConfig.id, configMap);
  }

  // Map: assessmentId -> (studentId -> score)
  const scoresByAssessment = new Map<string, Map<string, number>>();
  for (const termConfig of course.termConfigs || []) {
    for (const assessment of termConfig.assessments || []) {
      const assessmentMap = new Map<string, number>();
      for (const score of assessment.scores || []) {
        // Use studentId directly (from optimized query structure)
        const studentId = score.student?.id || score.studentId;
        assessmentMap.set(studentId, score.score);
      }
      scoresByAssessment.set(assessment.id, assessmentMap);
    }
  }

  // Calculate student analytics using Map lookups - O(n) instead of O(n²)
  const studentAnalytics = course.students.map((student) => {
    // Get attendance using Map lookup - O(1) instead of O(n) filter
    const studentAttendance = attendanceByStudent.get(student.id) || [];

    // Calculate attendance stats
    const attendanceStats = calculateAttendanceStats(studentAttendance);

    // Build term grades structure using Map lookups
    const termGrades = buildTermGrades(
      course.termConfigs || [],
      student.id,
      termGradesByConfig,
      scoresByAssessment
    );

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

  return {
    course: courseInfo,
    stats,
    students: studentAnalytics,
  };
}
