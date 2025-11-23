import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Helper function to generate slug
export function generateSlug(code: string, section: string): string {
  return `${code.toLowerCase().replace(/\s+/g, "-")}-${section
    .toLowerCase()
    .replace(/\s+/g, "-")}`;
}

// Get course by slug with basic info
// Note: Not cached to ensure fresh data after saves
export async function getCourseBySlug(slug: string) {
  return prisma.course.findUnique({
    where: { slug },
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
  });
}

// Get courses with filters (merged /courses and /courses/active)
// Note: Not cached to ensure fresh data after saves
export async function getCourses(filters: {
  facultyId?: string;
  search?: string;
  department?: string;
  semester?: string;
  code?: string;
  section?: string;
  status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
}) {
  const where: Prisma.CourseWhereInput = {};

  if (filters.status) where.status = filters.status;
  if (filters.facultyId) where.facultyId = filters.facultyId;
  if (filters.department) where.faculty = { department: filters.department };
  if (filters.semester) where.semester = filters.semester;
  if (filters.code) where.code = filters.code;
  if (filters.section) where.section = filters.section;
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { code: { contains: filters.search, mode: "insensitive" } },
      { room: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const courses = await prisma.course.findMany({
    where,
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
      attendance: true,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  return courses.map((course) => {
    const totalStudents = course.students.length;
    const totalPresent = course.attendance.filter(
      (a) => a.status === "PRESENT"
    ).length;
    const totalAbsents = course.attendance.filter(
      (a) => a.status === "ABSENT"
    ).length;
    const totalLate = course.attendance.filter(
      (a) => a.status === "LATE"
    ).length;
    const lastAttendanceDate = course.attendance.length
      ? course.attendance[course.attendance.length - 1].date
      : null;

    return {
      ...course,
      attendanceStats: {
        totalStudents,
        totalPresent,
        totalAbsents,
        totalLate,
        lastAttendanceDate,
        attendanceRate: totalStudents > 0 ? totalPresent / totalStudents : 0,
      },
      students: course.students.map((s) => ({
        ...s,
        middleInitial: s.middleInitial || undefined,
      })),
      schedules: course.schedules,
      attendance: undefined,
    };
  });
}

// Get course with students and today's attendance (batched query)
// Note: Not cached to ensure fresh data after saves
export async function getCourseStudentsWithAttendance(
  courseSlug: string,
  date?: Date
) {
  const targetDate = date || new Date();
  targetDate.setHours(0, 0, 0, 0);
  const tomorrow = new Date(targetDate);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get course ID first
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    select: {
      id: true,
      code: true,
      section: true,
      title: true,
      semester: true,
      academicYear: true,
      status: true,
      slug: true,
    },
  });

  if (!course) return null;

  // Batched query: Get all students with attendance and gradeScores in one go
  const courseWithData = await prisma.course.findUnique({
    where: { id: course.id },
    include: {
      students: {
        select: {
          id: true,
          studentId: true,
          firstName: true,
          lastName: true,
          middleInitial: true,
          image: true,
          rfid_id: true,
          attendance: {
            where: {
              courseId: course.id,
              date: {
                gte: targetDate,
                lt: tomorrow,
              },
            },
            select: {
              id: true,
              status: true,
              date: true,
              courseId: true,
            },
            orderBy: {
              date: "desc",
            },
            take: 1,
          },
          quizScores: true,
        },
      },
    },
  });

  if (!courseWithData) return null;

  // Batch fetch all gradeScores for all students at once (fixes N+1)
  const studentIds = courseWithData.students.map((s) => s.id);
  const allGradeScores = await prisma.gradeScore.findMany({
    where: {
      courseId: course.id,
      studentId: { in: studentIds },
    },
    orderBy: { createdAt: "desc" },
  });

  // Group gradeScores by studentId, taking the latest for each
  const gradeScoresMap = new Map<string, (typeof allGradeScores)[0]>();
  for (const score of allGradeScores) {
    if (!gradeScoresMap.has(score.studentId)) {
      gradeScoresMap.set(score.studentId, score);
    }
  }

  // Transform students with their gradeScores
  const students = courseWithData.students.map((student) => {
    const latestGradeScore = gradeScoresMap.get(student.id);

    return {
      id: student.id,
      studentId: student.studentId,
      name: `${student.firstName} ${student.lastName}`,
      firstName: student.firstName,
      lastName: student.lastName,
      middleInitial: student.middleInitial,
      image: student.image || undefined,
      rfid_id: student.rfid_id ?? null, // Include rfid_id in the response
      status: student.attendance[0]?.status || "NOT_SET",
      attendanceRecords: student.attendance,
      reportingScore: latestGradeScore?.reportingScore ?? 0,
      recitationScore: latestGradeScore?.recitationScore ?? 0,
      quizScore: latestGradeScore?.quizScore ?? 0,
      totalScore: latestGradeScore?.totalScore ?? 0,
      remarks: latestGradeScore?.remarks ?? "",
      quizScores: student.quizScores,
    };
  });

  return {
    course: {
      id: courseWithData.id,
      code: courseWithData.code,
      section: courseWithData.section,
      title: courseWithData.title,
      semester: courseWithData.semester,
      academicYear: courseWithData.academicYear,
      status: courseWithData.status,
      slug: courseSlug,
    },
    students,
  };
}

// Get course students (simple version - just students, no attendance/gradeScores)
// Note: Not cached to ensure fresh data after saves
export async function getCourseStudents(courseSlug: string, date?: Date) {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    select: { id: true },
  });

  if (!course) return null;

  const students = await prisma.student.findMany({
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
  });

  return {
    students,
  };
}

// Get course analytics (heavy query - all related data)
// Note: Not cached to ensure fresh data after saves
export async function getCourseAnalytics(courseSlug: string) {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    include: {
      faculty: {
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
        },
      },
      students: {
        select: {
          id: true,
          studentId: true,
          lastName: true,
          firstName: true,
          middleInitial: true,
          image: true,
          rfid_id: true,
        },
      },
      schedules: true,
      attendance: {
        include: {
          student: {
            select: {
              id: true,
              studentId: true,
            },
          },
        },
      },
      termConfigs: {
        include: {
          termGrades: {
            include: {
              student: {
                select: {
                  id: true,
                  studentId: true,
                },
              },
            },
          },
          assessments: {
            include: {
              scores: {
                include: {
                  student: {
                    select: {
                      id: true,
                      studentId: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      grades: {
        include: {
          student: {
            select: {
              id: true,
              studentId: true,
            },
          },
        },
      },
    },
  });

  if (!course) return null;

  // Import calculation functions (these are pure functions, can be extracted)
  // For now, we'll return the raw data and let the API route handle calculations
  // Or we can move the calculation logic here
  return course;
}

// Get course stats (passing rate, attendance rate)
// Note: Not cached to ensure fresh data after saves
export async function getCourseStats(courseSlug: string) {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    include: { students: true },
  });

  if (!course) return null;

  const totalStudents = course.students.length;

  if (totalStudents === 0) {
    return {
      passingRate: 0,
      attendanceRate: 0,
      totalStudents: 0,
    };
  }

  // Batch query: Get term configs and attendance in parallel
  const [termConfigs, attendanceRecords] = await Promise.all([
    prisma.termConfiguration.findMany({
      where: { courseId: course.id },
      include: {
        termGrades: {
          where: {
            studentId: {
              in: course.students.map((s) => s.id),
            },
          },
        },
      },
    }),
    prisma.attendance.findMany({
      where: { courseId: course.id },
    }),
  ]);

  const studentsWithGrades = new Set<string>();
  const passingStudents = new Set<string>();

  termConfigs.forEach((config) => {
    config.termGrades.forEach((grade) => {
      studentsWithGrades.add(grade.studentId);
      if (grade.remarks === "PASSED") {
        passingStudents.add(grade.studentId);
      }
    });
  });

  const passingRate =
    studentsWithGrades.size > 0
      ? Math.round((passingStudents.size / studentsWithGrades.size) * 100)
      : 0;

  const attendanceRate =
    attendanceRecords.length === 0
      ? 0
      : Math.round(
          (attendanceRecords.filter(
            (record) => record.status === "PRESENT" || record.status === "LATE"
          ).length /
            attendanceRecords.length) *
            100
        );

  return {
    passingRate,
    attendanceRate,
    totalStudents,
    studentsWithGrades: studentsWithGrades.size,
    passingStudents: passingStudents.size,
    totalAttendanceRecords: attendanceRecords.length,
    presentCount: attendanceRecords.filter(
      (r) => r.status === "PRESENT" || r.status === "LATE"
    ).length,
  };
}

// Batch: Get stats for multiple courses
export async function getCoursesStatsBatch(courseSlugs: string[]) {
  return Promise.all(courseSlugs.map((slug) => getCourseStats(slug)));
}

// Create course
export async function createCourse(data: {
  code: string;
  title: string;
  section: string;
  room?: string;
  semester: string;
  academicYear: string;
  classNumber?: number;
  status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  facultyId?: string | null;
  schedules?: Array<{ day: string; fromTime: string; toTime: string }>;
}) {
  const baseSlug = generateSlug(data.code, data.section);
  let slug = baseSlug;
  let counter = 1;

  // Check for slug uniqueness
  while (await prisma.course.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  // Check if course already exists
  const existingCourse = await prisma.course.findFirst({
    where: {
      code: data.code,
      section: data.section,
      semester: data.semester,
      academicYear: data.academicYear,
    },
  });

  if (existingCourse) {
    throw new Error(
      "Course with this code and section already exists for this semester"
    );
  }

  const parsedClassNumber = data.classNumber
    ? parseInt(String(data.classNumber), 10)
    : 0;
  if (isNaN(parsedClassNumber)) {
    throw new Error("classNumber must be a valid number");
  }

  return prisma.course.create({
    data: {
      code: data.code,
      title: data.title,
      section: data.section,
      room: data.room || "",
      semester: data.semester,
      academicYear: data.academicYear,
      slug,
      classNumber: parsedClassNumber,
      status: data.status || "ACTIVE",
      facultyId: data.facultyId || null,
      schedules: data.schedules?.length
        ? {
            create: data.schedules.map((s) => ({
              day: s.day,
              fromTime: s.fromTime,
              toTime: s.toTime,
            })),
          }
        : undefined,
    },
    include: {
      schedules: true,
      faculty: {
        select: { id: true, name: true, email: true, department: true },
      },
    },
  });
}

// Update course
export async function updateCourse(
  courseSlug: string,
  data: {
    code?: string;
    title?: string;
    room?: string;
    semester?: string;
    section?: string;
    facultyId?: string;
    academicYear?: string;
  }
) {
  const newSlug =
    data.code && data.section && data.academicYear
      ? generateSlug(data.code, data.section)
      : undefined;

  if (newSlug) {
    const existingCourse = await prisma.course.findFirst({
      where: {
        slug: newSlug,
        NOT: { slug: courseSlug },
      },
    });

    if (existingCourse) {
      throw new Error(
        "Course with this code, academic year, and section already exists"
      );
    }
  }

  return prisma.course.update({
    where: { slug: courseSlug },
    data: {
      ...data,
      ...(newSlug && { slug: newSlug }),
    },
    include: {
      faculty: {
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
        },
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
  });
}

// Delete course
export async function deleteCourse(courseSlug: string) {
  return prisma.course.delete({
    where: { slug: courseSlug },
  });
}
