import { prisma } from "@/lib/prisma";

// Get criteria for a course (optimized single query with includes)
// Note: Not cached to ensure fresh data after saves
export async function getCriteria(
  courseSlug: string,
  filters?: {
    isGroupCriteria?: boolean;
    isRecitationCriteria?: boolean;
  }
) {
  // First, get course ID (this is fast with slug index)
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

  // If no specific filters, get non-group and non-recitation criteria
  if (
    filters?.isGroupCriteria === undefined &&
    filters?.isRecitationCriteria === undefined
  ) {
    where.isGroupCriteria = false;
    where.isRecitationCriteria = false;
  }

  // Optimized: Single query with includes (uses database joins, much faster)
  // This leverages the indexes we added to Criteria model
  const criteria = await prisma.criteria.findMany({
    where,
    include: {
      user: {
        select: {
          name: true,
        },
      },
      rubrics: true, // Direct include - Prisma handles the join efficiently
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return criteria;
}

// Get recitation criteria
export async function getRecitationCriteria(courseSlug: string) {
  return getCriteria(courseSlug, { isRecitationCriteria: true });
}

// Get group criteria (for the whole section)
// Highly optimized: Uses composite index and limits data fetched
export async function getGroupCriteria(courseSlug: string) {
  // Step 1: Get course ID (fast with slug index - usually < 5ms)
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    select: { id: true },
  });

  if (!course) return null;

  // Step 2: Get criteria with optimized query
  // This query uses the composite index @@index([courseId, isGroupCriteria])
  // which makes this extremely fast even with thousands of criteria
  const criteria = await prisma.criteria.findMany({
    where: {
      courseId: course.id, // Uses index
      isGroupCriteria: true, // Uses composite index
    },
    select: {
      // Only select fields we actually need (reduces data transfer)
      id: true,
      name: true,
      date: true,
      scoringRange: true,
      passingScore: true,
      isGroupCriteria: true,
      isRecitationCriteria: true,
      courseId: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          name: true,
        },
      },
      rubrics: {
        select: {
          id: true,
          name: true,
          percentage: true,
          criteriaId: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return criteria;
}

// Get criteria links (recitations, group reportings, individual reportings)
// Note: Not cached to ensure fresh data after saves
export async function getCriteriaLinks(courseSlug: string) {
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
        select: {
          id: true,
          name: true,
          date: true,
          scoringRange: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.criteria.findMany({
        where: {
          courseId: course.id,
          isGroupCriteria: true,
        },
        select: {
          id: true,
          name: true,
          date: true,
          scoringRange: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.criteria.findMany({
        where: {
          courseId: course.id,
          isRecitationCriteria: false,
          isGroupCriteria: false,
        },
        select: {
          id: true,
          name: true,
          date: true,
          scoringRange: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  // Transform data to match expected interface
  const transformCriteria = (
    criteria: Array<{
      id: string;
      name: string;
      date: Date | null;
      scoringRange: string;
    }>
  ) => {
    return criteria.map((c) => ({
      id: c.id,
      name: c.name,
      date: c.date ? c.date.toISOString().split("T")[0] : null,
      maxScore: parseFloat(c.scoringRange) || 0,
    }));
  };

  return {
    recitations: transformCriteria(recitations),
    groupReportings: transformCriteria(groupReportings),
    individualReportings: transformCriteria(individualReportings),
  };
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
