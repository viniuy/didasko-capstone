import { prisma } from "@/lib/prisma";
import { AssessmentType } from "@prisma/client";
import { getCriteriaLinks } from "./criteria";

// Get term configurations for a course
// Note: Not cached to ensure fresh data after saves
export async function getTermConfigs(courseSlug: string) {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    include: {
      termConfigs: {
        include: {
          assessments: {
            orderBy: [{ type: "asc" }, { order: "asc" }],
          },
        },
        orderBy: { term: "asc" },
      },
    },
  });

  if (!course) return null;

  const termConfigs: Record<string, any> = {};
  course.termConfigs.forEach((config) => {
    termConfigs[config.term] = {
      id: config.id,
      term: config.term,
      ptWeight: config.ptWeight,
      quizWeight: config.quizWeight,
      examWeight: config.examWeight,
      assessments: config.assessments.map((a: any) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        maxScore: a.maxScore,
        date: a.date ? a.date.toISOString().split("T")[0] : null,
        enabled: a.enabled,
        order: a.order,
        linkedCriteriaId: a.linkedCriteriaId ?? null,
        transmutationBase: a.transmutationBase ?? 0,
      })),
    };
  });

  return termConfigs;
}

// Save term configurations
export async function saveTermConfigs(
  courseSlug: string,
  termConfigs: Record<string, any>
) {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
  });

  if (!course) {
    throw new Error("Course not found");
  }

  // Validate weights
  for (const [term, config] of Object.entries(termConfigs)) {
    const total = config.ptWeight + config.quizWeight + config.examWeight;
    if (total !== 100) {
      throw new Error(`${term}: Weights must total 100%`);
    }
  }

  // Process each term config
  for (const [term, config] of Object.entries(termConfigs)) {
    try {
      const termConfig = await prisma.termConfiguration.upsert({
        where: {
          courseId_term: {
            courseId: course.id,
            term,
          },
        },
        create: {
          courseId: course.id,
          term,
          ptWeight: config.ptWeight,
          quizWeight: config.quizWeight,
          examWeight: config.examWeight,
        },
        update: {
          ptWeight: config.ptWeight,
          quizWeight: config.quizWeight,
          examWeight: config.examWeight,
        },
      });

      const existingAssessments = await prisma.assessment.findMany({
        where: { termConfigId: termConfig.id },
        select: { id: true },
      });

      const existingIds = existingAssessments.map((a) => a.id);
      const incomingIds = config.assessments
        .filter((a: any) => a.id && !a.id.startsWith("temp"))
        .map((a: any) => a.id);

      const idsToDelete = existingIds.filter((id) => !incomingIds.includes(id));

      if (idsToDelete.length > 0) {
        await prisma.assessment.deleteMany({
          where: { id: { in: idsToDelete } },
        });
      }

      for (const assessment of config.assessments) {
        const existsInDb = existingIds.includes(assessment.id);

        const assessmentData = {
          name: assessment.name,
          maxScore: assessment.maxScore,
          date: assessment.date ? new Date(assessment.date) : null,
          enabled: assessment.enabled,
          order: assessment.order,
          linkedCriteriaId: assessment.linkedCriteriaId ?? null,
          transmutationBase: assessment.transmutationBase ?? 0,
        };

        if (!existsInDb || !assessment.id || assessment.id.startsWith("temp")) {
          await prisma.assessment.create({
            data: {
              termConfigId: termConfig.id,
              type: assessment.type as AssessmentType,
              ...assessmentData,
            },
          });
        } else {
          await prisma.assessment.update({
            where: { id: assessment.id },
            data: assessmentData,
          });
        }
      }
    } catch (error: any) {
      // Check if error is due to missing column (migration not run)
      if (
        error.message?.includes("transmutation_base") ||
        error.message?.includes("column") ||
        error.code === "P2003" ||
        error.code === "P2011"
      ) {
        throw new Error(
          "Database migration required. Please run: npx prisma migrate dev"
        );
      }
      throw error;
    }
  }

  return { success: true };
}

// Get assessment scores for a course (batched query)
// Note: Not cached to ensure fresh data after saves
export async function getAssessmentScores(courseSlug: string) {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    select: { id: true },
  });

  if (!course) return null;

  // Batch query: Get all assessment scores and criteria scores in parallel
  const [assessmentScores, criteriaScores] = await Promise.all([
    prisma.assessmentScore.findMany({
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
    }),
    prisma.grade.findMany({
      where: {
        courseId: course.id,
      },
      select: {
        studentId: true,
        criteriaId: true,
        value: true,
      },
    }),
  ]);

  const scoresMap: Record<string, any> = {};

  assessmentScores.forEach((score) => {
    const key = `${score.studentId}:${score.assessmentId}`;
    scoresMap[key] = {
      studentId: score.studentId,
      assessmentId: score.assessmentId,
      score: score.score,
    };
  });

  criteriaScores.forEach((grade) => {
    const key = `${grade.studentId}:criteria:${grade.criteriaId}`;
    scoresMap[key] = {
      studentId: grade.studentId,
      assessmentId: `criteria:${grade.criteriaId}`,
      score: grade.value,
    };
  });

  return scoresMap;
}

// Save or update assessment score
export async function saveAssessmentScore(data: {
  studentId: string;
  assessmentId: string;
  score: number | null;
}) {
  const { studentId, assessmentId, score } = data;

  if (!studentId || !assessmentId) {
    throw new Error("studentId and assessmentId are required");
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { maxScore: true },
  });

  if (!assessment) {
    throw new Error("Assessment not found");
  }

  if (score !== null && score > assessment.maxScore) {
    throw new Error(`Score cannot exceed max score of ${assessment.maxScore}`);
  }

  if (score === null) {
    await prisma.assessmentScore.deleteMany({
      where: {
        studentId,
        assessmentId,
      },
    });
    return { success: true, deleted: true };
  }

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

  return {
    success: true,
    score: {
      studentId: assessmentScore.studentId,
      assessmentId: assessmentScore.assessmentId,
      score: assessmentScore.score,
    },
  };
}

// Save multiple assessment scores in bulk
export async function saveAssessmentScoresBulk(
  courseSlug: string,
  scores: Array<{
    studentId: string;
    assessmentId: string;
    score: number | null;
  }>
) {
  if (!Array.isArray(scores)) {
    throw new Error("scores must be an array");
  }

  // Find course
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    select: { id: true },
  });

  if (!course) {
    throw new Error("Course not found");
  }

  // Filter out null scores for validation (they're valid for deletion)
  const scoresToValidate = scores.filter((s) => s.score !== null);

  if (scoresToValidate.length === 0 && scores.length > 0) {
    // All scores are null (deletions only), skip validation but still process
  } else if (scoresToValidate.length > 0) {
    // Validate all scores and get assessment max scores
    const assessmentIds = [
      ...new Set(scoresToValidate.map((s) => s.assessmentId)),
    ];
    const assessments = await prisma.assessment.findMany({
      where: {
        id: { in: assessmentIds },
        termConfig: { courseId: course.id },
      },
      select: { id: true, maxScore: true },
    });

    const assessmentMaxScores = new Map(
      assessments.map((a) => [a.id, a.maxScore])
    );

    // Validate each score
    for (const scoreData of scoresToValidate) {
      const maxScore = assessmentMaxScores.get(scoreData.assessmentId);
      if (!maxScore) {
        throw new Error(
          `Invalid assessment ID: ${scoreData.assessmentId}. Assessment may not exist or may not belong to this course.`
        );
      }
      if (scoreData.score !== null && scoreData.score > maxScore) {
        throw new Error(
          `Score ${scoreData.score} exceeds max score ${maxScore} for assessment ${scoreData.assessmentId}`
        );
      }
    }
  }

  // Use transaction to save all scores
  const results = await prisma.$transaction(
    scores.map((scoreData) => {
      if (scoreData.score === null) {
        // Delete if score is null
        return prisma.assessmentScore.deleteMany({
          where: {
            studentId: scoreData.studentId,
            assessmentId: scoreData.assessmentId,
          },
        });
      }

      // Upsert the score
      return prisma.assessmentScore.upsert({
        where: {
          assessmentId_studentId: {
            assessmentId: scoreData.assessmentId,
            studentId: scoreData.studentId,
          },
        },
        create: {
          studentId: scoreData.studentId,
          assessmentId: scoreData.assessmentId,
          score: scoreData.score,
        },
        update: {
          score: scoreData.score,
        },
      });
    })
  );

  return {
    success: true,
    savedCount: results.length,
  };
}

// Helper: Compute term grade from assessment scores
function computeTermGradeFromScores(
  termConfig: any,
  assessmentScores: Record<string, any>,
  studentId: string
): number | null {
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

// Batched: Get class record data (students, term-configs, assessment-scores, criteria-links)
// Note: Not cached to ensure fresh data after grade saves
export async function getClassRecordData(courseSlug: string) {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    select: { id: true },
  });

  if (!course) return null;

  // Batch all queries in parallel
  const [students, termConfigs, assessmentScoresResult, criteriaLinks] =
    await Promise.all([
      // Students
      prisma.student.findMany({
        where: {
          coursesEnrolled: {
            some: { id: course.id },
          },
        },
        select: {
          id: true,
          studentId: true,
          firstName: true,
          lastName: true,
          middleInitial: true,
          image: true,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),

      // Term configs (not cached for fresh data)
      getTermConfigs(courseSlug),

      // Assessment scores (not cached for fresh data)
      getAssessmentScores(courseSlug),

      // Criteria links (not cached for fresh data)
      getCriteriaLinks(courseSlug),
    ]);

  // Ensure assessmentScores is never null
  const assessmentScores: Record<string, any> = assessmentScoresResult ?? {};

  return {
    students,
    termConfigs,
    assessmentScores,
    criteriaLinks,
  };
}
