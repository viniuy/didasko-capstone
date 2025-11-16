import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { AssessmentType } from "@prisma/client";

// Cached: Get term configurations for a course
export async function getTermConfigs(courseSlug: string) {
  return unstable_cache(
    async () => {
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
          assessments: config.assessments.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            maxScore: a.maxScore,
            date: a.date ? a.date.toISOString().split("T")[0] : null,
            enabled: a.enabled,
            order: a.order,
            linkedCriteriaId: a.linkedCriteriaId ?? null,
          })),
        };
      });

      return termConfigs;
    },
    [`term-configs-${courseSlug}`],
    { revalidate: 30 }
  )();
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
  }

  return { success: true };
}

// Cached: Get assessment scores for a course (batched query)
export async function getAssessmentScores(courseSlug: string) {
  return unstable_cache(
    async () => {
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
    },
    [`assessment-scores-${courseSlug}`],
    { revalidate: 30 }
  )();
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

// Batched: Get class record data (students, term-configs, assessment-scores, criteria-links)
export async function getClassRecordData(courseSlug: string) {
  return unstable_cache(
    async () => {
      const course = await prisma.course.findUnique({
        where: { slug: courseSlug },
        select: { id: true },
      });

      if (!course) return null;

      // Batch all queries in parallel
      const [students, termConfigs, assessmentScores, criteriaLinks] =
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
          }),

          // Term configs
          prisma.termConfiguration.findMany({
            where: { courseId: course.id },
            include: {
              assessments: {
                orderBy: [{ type: "asc" }, { order: "asc" }],
              },
            },
            orderBy: { term: "asc" },
          }),

          // Assessment scores (reuse existing function logic)
          getAssessmentScores(courseSlug),

          // Criteria links
          Promise.all([
            prisma.criteria.findMany({
              where: {
                courseId: course.id,
                isRecitationCriteria: true,
              },
              orderBy: { createdAt: "desc" },
            }),
            prisma.criteria.findMany({
              where: {
                courseId: course.id,
                isGroupCriteria: true,
              },
              orderBy: { createdAt: "desc" },
            }),
            prisma.criteria.findMany({
              where: {
                courseId: course.id,
                isRecitationCriteria: false,
                isGroupCriteria: false,
              },
              orderBy: { createdAt: "desc" },
            }),
          ]).then(([recitations, groupReportings, individualReportings]) => ({
            recitations,
            groupReportings,
            individualReportings,
          })),
        ]);

      return {
        students,
        termConfigs,
        assessmentScores,
        criteriaLinks,
      };
    },
    [`class-record-${courseSlug}`],
    { revalidate: 30 }
  )();
}
