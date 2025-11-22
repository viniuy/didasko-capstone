import { prisma } from "@/lib/prisma";

// Get groups for a course
// Note: Not cached to ensure fresh data after saves
export async function getGroups(courseSlug: string) {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    select: { id: true },
  });

  if (!course) return null;

  return prisma.group.findMany({
    where: {
      courseId: course.id,
    },
    include: {
      students: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleInitial: true,
          image: true,
        },
      },
      leader: {
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

// Get group by ID
export async function getGroupById(groupId: string) {
  return prisma.group.findUnique({
    where: { id: groupId },
    include: {
      students: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleInitial: true,
          image: true,
        },
      },
      leader: {
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

// Get group students
export async function getGroupStudents(groupId: string) {
  const group = await getGroupById(groupId);
  return group?.students || [];
}

// Get group metadata (names, numbers, etc.)
// Note: Not cached to ensure fresh data after saves
export async function getGroupMeta(courseSlug: string) {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    select: { id: true },
  });

  if (!course) return null;

  const groups = await prisma.group.findMany({
    where: { courseId: course.id },
    select: {
      id: true,
      name: true,
      number: true,
    },
    orderBy: {
      number: "asc",
    },
  });

  const groupNames = groups.map((g) => g.name);
  const groupNumbers = groups.map((g) => g.number);

  return {
    names: groupNames,
    numbers: groupNumbers,
    usedNames: groupNames,
    usedNumbers: groupNumbers,
    groups,
  };
}

// Create group
export async function createGroup(
  courseSlug: string,
  data: {
    groupNumber: number;
    groupName?: string;
    studentIds: string[];
    leaderId?: string;
  }
) {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    select: { id: true },
  });

  if (!course) {
    throw new Error("Course not found");
  }

  // Check if group name already exists
  if (data.groupName) {
    const existingGroup = await prisma.group.findFirst({
      where: {
        courseId: course.id,
        name: data.groupName,
      },
    });

    if (existingGroup) {
      throw new Error("A group with this name already exists");
    }
  }

  return prisma.group.create({
    data: {
      number: String(data.groupNumber),
      name: data.groupName,
      courseId: course.id,
      leaderId: data.leaderId || null,
      students: {
        connect: data.studentIds.map((id) => ({ id })),
      },
    },
    include: {
      students: true,
      leader: true,
    },
  });
}

// Update group
export async function updateGroup(
  groupId: string,
  data: {
    groupNumber?: number;
    groupName?: string;
    studentIds?: string[];
    leaderId?: string;
  }
) {
  const updateData: any = {};
  if (data.groupNumber !== undefined)
    updateData.number = String(data.groupNumber);
  if (data.groupName !== undefined) updateData.name = data.groupName;
  if (data.leaderId !== undefined) updateData.leaderId = data.leaderId;

  if (data.studentIds) {
    updateData.students = {
      set: data.studentIds.map((id) => ({ id })),
    };
  }

  return prisma.group.update({
    where: { id: groupId },
    data: updateData,
    include: {
      students: true,
      leader: true,
    },
  });
}

// Delete group
export async function deleteGroup(groupId: string) {
  return prisma.group.delete({
    where: { id: groupId },
  });
}

// Batched: Get course with groups, students, and meta
// Note: Not cached to ensure fresh data after saves
export async function getCourseWithGroupsData(courseSlug: string) {
  const [course, groups, students, meta] = await Promise.all([
    prisma.course.findUnique({
      where: { slug: courseSlug },
      include: {
        faculty: {
          select: { id: true, name: true, email: true, department: true },
        },
        students: {
          select: {
            id: true,
            lastName: true,
            firstName: true,
            middleInitial: true,
          },
        },
        schedules: true,
      },
    }),
    getGroups(courseSlug),
    prisma.course
      .findUnique({
        where: { slug: courseSlug },
        select: { id: true },
      })
      .then((c) =>
        c
          ? prisma.student.findMany({
              where: {
                coursesEnrolled: {
                  some: { id: c.id },
                },
              },
              select: {
                id: true,
                firstName: true,
                lastName: true,
                middleInitial: true,
                image: true,
              },
            })
          : []
      ),
    getGroupMeta(courseSlug),
  ]);

  return {
    course,
    groups,
    students,
    meta,
  };
}
