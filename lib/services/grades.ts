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

  const where: any = {
    courseId: course.id,
    date: {
      gte: new Date(filters.date + "T00:00:00.000Z"),
      lt: new Date(filters.date + "T23:59:59.999Z"),
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

  // Delete existing grades for these students on this date
  await prisma.grade.deleteMany({
    where: {
      courseId: course.id,
      studentId: {
        in: studentIds,
      },
      criteriaId: data.criteriaId,
      date: {
        gte: new Date(data.date + "T00:00:00.000Z"),
        lt: new Date(data.date + "T23:59:59.999Z"),
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
      date: new Date(data.date + "T00:00:00.000Z"),
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

  return prisma.grade.deleteMany({
    where: {
      courseId: course.id,
      criteriaId: filters.criteriaId,
      date: {
        gte: new Date(filters.date + "T00:00:00.000Z"),
        lt: new Date(filters.date + "T23:59:59.999Z"),
      },
    },
  });
}
