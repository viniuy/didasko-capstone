import { prisma } from "@/lib/prisma";

// Get attendance for a course on a specific date
// Note: Not cached to ensure fresh data after saves
export async function getAttendance(
  courseSlug: string,
  date: string,
  options?: { page?: number; limit?: number }
) {
  const { page = 1, limit = 10 } = options || {};
  const skip = (page - 1) * limit;

  const startDate = new Date(date + "T00:00:00.000Z");
  const endDate = new Date(date + "T23:59:59.999Z");

  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
  });

  if (!course) return null;

  const [total, attendanceRecords] = await Promise.all([
    prisma.attendance.count({
      where: {
        courseId: course.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    }),
    prisma.attendance.findMany({
      where: {
        courseId: course.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        student: {
          select: {
            id: true,
            lastName: true,
            firstName: true,
            middleInitial: true,
          },
        },
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            section: true,
            slug: true,
            academicYear: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return {
    attendance: attendanceRecords,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// Create attendance record
export async function createAttendance(data: {
  studentId: string;
  courseId: string;
  date: Date;
  status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
  reason?: string;
}) {
  return prisma.attendance.create({
    data,
    include: {
      student: {
        select: {
          id: true,
          lastName: true,
          firstName: true,
          middleInitial: true,
        },
      },
      course: {
        select: {
          id: true,
          code: true,
          title: true,
          section: true,
        },
      },
    },
  });
}

// Batch create attendance records
export async function createAttendanceBatch(
  courseSlug: string,
  records: Array<{
    studentId: string;
    date: string;
    status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
    reason?: string;
  }>
) {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    select: { id: true },
  });

  if (!course) {
    throw new Error("Course not found");
  }

  return prisma.attendance.createMany({
    data: records.map((record) => ({
      studentId: record.studentId,
      courseId: course.id,
      date: new Date(record.date),
      status: record.status,
      reason: record.reason || null,
    })),
    skipDuplicates: true,
  });
}

// Update attendance record
export async function updateAttendance(
  id: string,
  data: {
    status?: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
    reason?: string;
  }
) {
  return prisma.attendance.update({
    where: { id },
    data,
    include: {
      student: {
        select: {
          id: true,
          lastName: true,
          firstName: true,
          middleInitial: true,
        },
      },
      course: {
        select: {
          id: true,
          code: true,
          title: true,
          section: true,
        },
      },
    },
  });
}

// Delete attendance record
export async function deleteAttendance(id: string) {
  return prisma.attendance.delete({
    where: { id },
  });
}

// Clear attendance for a date
export async function clearAttendance(courseSlug: string, date: string) {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    select: { id: true },
  });

  if (!course) {
    throw new Error("Course not found");
  }

  const startDate = new Date(date + "T00:00:00.000Z");
  const endDate = new Date(date + "T23:59:59.999Z");

  return prisma.attendance.deleteMany({
    where: {
      courseId: course.id,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  });
}

// Get attendance dates for a course
// Note: Not cached to ensure fresh data after saves
export async function getAttendanceDates(courseSlug: string) {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    select: { id: true },
  });

  if (!course) return [];

  const dates = await prisma.attendance.findMany({
    where: { courseId: course.id },
    select: { date: true },
    distinct: ["date"],
    orderBy: { date: "desc" },
  });

  return dates.map((d) => d.date.toISOString().split("T")[0]);
}

// Get attendance stats for a course
// Note: Not cached to ensure fresh data after saves
export async function getAttendanceStats(courseSlug: string) {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    select: { id: true },
  });

  if (!course) return null;

  const attendanceRecords = await prisma.attendance.findMany({
    where: { courseId: course.id },
  });

  const totalRecords = attendanceRecords.length;
  const totalPresent = attendanceRecords.filter(
    (a) => a.status === "PRESENT"
  ).length;
  const totalAbsents = attendanceRecords.filter(
    (a) => a.status === "ABSENT"
  ).length;
  const totalLate = attendanceRecords.filter(
    (a) => a.status === "LATE"
  ).length;
  const totalExcused = attendanceRecords.filter(
    (a) => a.status === "EXCUSED"
  ).length;

  const attendanceRate =
    totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;

  return {
    totalRecords,
    totalPresent,
    totalAbsents,
    totalLate,
    totalExcused,
    attendanceRate,
  };
}
