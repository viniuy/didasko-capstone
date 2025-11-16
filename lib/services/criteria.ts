import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

// Cached: Get criteria for a course (batched query - fixes N+1)
export async function getCriteria(
  courseSlug: string,
  filters?: {
    isGroupCriteria?: boolean;
    isRecitationCriteria?: boolean;
    groupId?: string;
  }
) {
  const cacheKey = `criteria-${courseSlug}-${JSON.stringify(filters || {})}`;

  return unstable_cache(
    async () => {
      const course = await prisma.course.findUnique({
        where: { slug: courseSlug },
        select: { id: true },
      });

      if (!course) return null;

      const where: any = {
        courseId: course.id,
      };

      if (filters?.isGroupCriteria !== undefined) {
        where.isGroupCriteria = filters.isGroupCriteria;
      }
      if (filters?.isRecitationCriteria !== undefined) {
        where.isRecitationCriteria = filters.isRecitationCriteria;
      }
      if (filters?.groupId) {
        where.groupId = filters.groupId;
      }

      // If no specific filters, get non-group and non-recitation criteria
      if (
        filters?.isGroupCriteria === undefined &&
        filters?.isRecitationCriteria === undefined &&
        !filters?.groupId
      ) {
        where.isGroupCriteria = false;
        where.isRecitationCriteria = false;
      }

      const criteria = await prisma.criteria.findMany({
        where,
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Batch fetch all rubrics at once (fixes N+1)
      const criteriaIds = criteria.map((c) => c.id);
      const allRubrics = await prisma.rubric.findMany({
        where: { criteriaId: { in: criteriaIds } },
      });

      // Group rubrics by criteriaId
      const rubricsMap = new Map<string, typeof allRubrics>();
      for (const rubric of allRubrics) {
        if (!rubricsMap.has(rubric.criteriaId)) {
          rubricsMap.set(rubric.criteriaId, []);
        }
        rubricsMap.get(rubric.criteriaId)!.push(rubric);
      }

      // Attach rubrics to criteria
      return criteria.map((c) => ({
        ...c,
        rubrics: rubricsMap.get(c.id) || [],
      }));
    },
    [cacheKey],
    { revalidate: 30 }
  )();
}

// Get recitation criteria
export async function getRecitationCriteria(courseSlug: string) {
  return getCriteria(courseSlug, { isRecitationCriteria: true });
}

// Get group criteria
export async function getGroupCriteria(courseSlug: string, groupId: string) {
  return getCriteria(courseSlug, { isGroupCriteria: true, groupId });
}

// Get criteria links (recitations, group reportings, individual reportings)
export async function getCriteriaLinks(courseSlug: string) {
  return unstable_cache(
    async () => {
      const course = await prisma.course.findUnique({
        where: { slug: courseSlug },
        select: { id: true },
      });

      if (!course) return null;

      // Batch query all three types in parallel
      const [recitations, groupReportings, individualReportings] =
        await Promise.all([
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
        ]);

      return {
        recitations,
        groupReportings,
        individualReportings,
      };
    },
    [`criteria-links-${courseSlug}`],
    { revalidate: 30 }
  )();
}

// Create criteria
export async function createCriteria(
  courseSlug: string,
  data: {
    name: string;
    userId: string;
    date: Date;
    scoringRange: string | number;
    passingScore: string | number;
    isGroupCriteria?: boolean;
    isRecitationCriteria?: boolean;
    groupId?: string;
    rubrics?: Array<{ name: string; percentage: number }>;
  }
) {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    select: { id: true },
  });

  if (!course) {
    throw new Error("Course not found");
  }

  const scoringRange =
    typeof data.scoringRange === "number"
      ? String(data.scoringRange)
      : data.scoringRange;
  const passingScore =
    typeof data.passingScore === "number"
      ? String(data.passingScore)
      : data.passingScore;

  return prisma.criteria.create({
    data: {
      name: data.name,
      courseId: course.id,
      userId: data.userId,
      date: data.date,
      scoringRange,
      passingScore,
      isGroupCriteria: data.isGroupCriteria || false,
      isRecitationCriteria: data.isRecitationCriteria || false,
      groupId: data.groupId || null,
      rubrics: {
        create: Array.isArray(data.rubrics)
          ? data.rubrics.map((r) => ({
              name: r.name,
              percentage: r.percentage,
            }))
          : [],
      },
    },
    include: {
      user: {
        select: {
          name: true,
        },
      },
      rubrics: true,
    },
  });
}

// Update criteria
export async function updateCriteria(
  criteriaId: string,
  data: {
    name?: string;
    date?: Date;
    scoringRange?: string | number;
    passingScore?: string | number;
  }
) {
  const updateData: any = {};
  if (data.name) updateData.name = data.name;
  if (data.date) updateData.date = data.date;
  if (data.scoringRange !== undefined) {
    updateData.scoringRange =
      typeof data.scoringRange === "number"
        ? String(data.scoringRange)
        : data.scoringRange;
  }
  if (data.passingScore !== undefined) {
    updateData.passingScore =
      typeof data.passingScore === "number"
        ? String(data.passingScore)
        : data.passingScore;
  }

  return prisma.criteria.update({
    where: { id: criteriaId },
    data: updateData,
    include: {
      user: {
        select: {
          name: true,
        },
      },
      rubrics: true,
    },
  });
}

// Delete criteria
export async function deleteCriteria(criteriaId: string) {
  return prisma.criteria.delete({
    where: { id: criteriaId },
  });
}
