import { prisma } from "@/lib/prisma";

// Get grades for a course, date, and optionally criteria
export async function getGrades(
  courseSlug: string,
  filters: {
    date: string;
    criteriaId?: string;
    groupId?: string;
  }
) {
  const course = await prisma.course.findFirst({
    where: {
      slug: courseSlug,
    },
  });

  if (!course) {
    throw new Error("Course not found");
  }

  // Parse date string (YYYY-MM-DD) and create local date range
  const dateParts = filters.date.split("-");
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
  const day = parseInt(dateParts[2], 10);

  // Create start and end of day in local time
  const startOfDay = new Date(year, month, day, 0, 0, 0, 0);
  const endOfDay = new Date(year, month, day, 23, 59, 59, 999);

  const where: any = {
    courseId: course.id,
    date: {
      gte: startOfDay,
      lte: endOfDay,
    },
  };

  if (filters.criteriaId) {
    where.criteriaId = filters.criteriaId;
  }

  // If groupId is provided, filter by students in that group
  if (filters.groupId) {
    const group = await prisma.group.findUnique({
      where: { id: filters.groupId },
      select: { students: { select: { id: true } } },
    });

    if (group) {
      where.studentId = {
        in: group.students.map((s) => s.id),
      };
    }
  }

  return prisma.grade.findMany({
    where,
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleInitial: true,
          image: true,
        },
      },
    },
  });
}

// Save grades (batch)
export async function saveGrades(
  courseSlug: string,
  data: {
    date: string;
    criteriaId: string;
    grades: Array<{
      studentId: string;
      scores: number[];
      total: number;
      reportingScore?: boolean;
      recitationScore?: boolean;
    }>;
    isRecitationCriteria?: boolean;
  }
) {
  const course = await prisma.course.findFirst({
    where: {
      slug: courseSlug,
    },
  });

  if (!course) {
    throw new Error("Course not found");
  }

  const studentIds = data.grades.map((grade) => grade.studentId);

  // Parse date string (YYYY-MM-DD) and create local date range
  const dateParts = data.date.split("-");
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
  const day = parseInt(dateParts[2], 10);

  // Create start and end of day in local time
  const startOfDay = new Date(year, month, day, 0, 0, 0, 0);
  const endOfDay = new Date(year, month, day, 23, 59, 59, 999);
  const gradeDate = new Date(year, month, day, 0, 0, 0, 0);

  // Delete existing grades for these students on this date
  await prisma.grade.deleteMany({
    where: {
      courseId: course.id,
      studentId: {
        in: studentIds,
      },
      criteriaId: data.criteriaId,
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  // Create new grades
  return prisma.grade.createMany({
    data: data.grades.map((grade) => ({
      courseId: course.id,
      criteriaId: data.criteriaId,
      studentId: grade.studentId,
      value: grade.total,
      scores: grade.scores,
      total: grade.total,
      reportingScore: !data.isRecitationCriteria,
      recitationScore: data.isRecitationCriteria || false,
      date: gradeDate,
    })),
  });
}

// Delete grades
export async function deleteGrades(
  courseSlug: string,
  filters: {
    criteriaId: string;
    date: string;
  }
) {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
  });

  if (!course) {
    throw new Error("Course not found");
  }

  // Parse date string (YYYY-MM-DD) and create local date range
  const dateParts = filters.date.split("-");
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
  const day = parseInt(dateParts[2], 10);

  // Create start and end of day in local time
  const startOfDay = new Date(year, month, day, 0, 0, 0, 0);
  const endOfDay = new Date(year, month, day, 23, 59, 59, 999);

  return prisma.grade.deleteMany({
    where: {
      courseId: course.id,
      criteriaId: filters.criteriaId,
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });
}
