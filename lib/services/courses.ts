import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { unstable_cache, revalidateTag } from "next/cache";

// Helper function to generate slug
export function generateSlug(code: string, section: string): string {
  return `${code.toLowerCase().replace(/\s+/g, "-")}-${section
    .toLowerCase()
    .replace(/\s+/g, "-")}`;
}

// Get course by slug with basic info (cached)
export async function getCourseBySlug(slug: string) {
  return unstable_cache(
    async (courseSlug: string) => {
      return prisma.course.findUnique({
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
      });
    },
    [`course-by-slug-${slug}`],
    {
      tags: [`course-${slug}`, "courses"],
      revalidate: 60, // Revalidate every 60 seconds
    }
  )(slug);
}

// Get archived courses count (lightweight, just count)
export async function getArchivedCoursesCount(filters: { facultyId?: string }) {
  return unstable_cache(
    async () => {
      const where: Prisma.CourseWhereInput = {
        status: "ARCHIVED",
      };

      if (filters.facultyId) where.facultyId = filters.facultyId;

      return await prisma.course.count({ where });
    },
    [`archived-count-${JSON.stringify(filters)}`],
    {
      tags: ["courses"],
      revalidate: 300, // 5 minutes
    }
  )();
}

// Get archived courses (lightweight, minimal fields for settings dialog)
export async function getArchivedCourses(filters: {
  facultyId?: string;
  search?: string;
  limit?: number;
}) {
  return unstable_cache(
    async () => {
      const where: Prisma.CourseWhereInput = {
        status: "ARCHIVED",
      };

      if (filters.facultyId) where.facultyId = filters.facultyId;
      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search, mode: "insensitive" } },
          { code: { contains: filters.search, mode: "insensitive" } },
          { section: { contains: filters.search, mode: "insensitive" } },
        ];
      }

      const queryOptions: any = {
        where,
        select: {
          id: true,
          code: true,
          title: true,
          section: true,
          status: true,
          semester: true,
          academicYear: true,
          facultyId: true,
          slug: true,
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      };

      // Limit to 100 courses if no search query (initial load)
      // If search is provided, fetch all matching results
      if (!filters.search && (filters.limit || filters.limit === undefined)) {
        queryOptions.take = filters.limit || 100;
      }

      return await prisma.course.findMany(queryOptions);
    },
    [`archived-courses-${JSON.stringify(filters)}`],
    {
      tags: ["courses"],
      revalidate: 300, // 5 minutes
    }
  )();
}

// Get courses with filters (merged /courses and /courses/active) (cached)
// Optimized: Excludes ARCHIVED by default unless explicitly requested
export async function getCourses(filters: {
  facultyId?: string;
  search?: string;
  department?: string;
  semester?: string;
  code?: string;
  section?: string;
  status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
}) {
  // Create cache key from filters
  const cacheKey = `courses-${JSON.stringify(filters)}`;

  return unstable_cache(
    async () => {
      const where: Prisma.CourseWhereInput = {};

      // Exclude ARCHIVED by default unless explicitly requested
      if (filters.status) {
        where.status = filters.status;
      } else {
        // Default: exclude archived courses
        where.status = { not: "ARCHIVED" };
      }
      if (filters.facultyId) where.facultyId = filters.facultyId;
      if (filters.department)
        where.faculty = { department: filters.department };
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

      // Optimized: Use select instead of include, don't load all students
      const courses = await prisma.course.findMany({
        where,
        select: {
          id: true,
          code: true,
          title: true,
          room: true,
          semester: true,
          academicYear: true,
          classNumber: true,
          status: true,
          section: true,
          slug: true,
          facultyId: true,
          createdAt: true,
          updatedAt: true,
          faculty: {
            select: { id: true, name: true, email: true, department: true },
          },
          schedules: {
            select: {
              id: true,
              day: true,
              fromTime: true,
              toTime: true,
            },
          },
          _count: {
            select: {
              attendance: true,
              students: true,
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      });

      // Fetch aggregated attendance stats in parallel for all courses
      const courseIds = courses.map((c) => c.id);
      const [presentCounts, absentCounts, lateCounts, lastAttendanceDates] =
        await Promise.all([
          // Count PRESENT attendance
          prisma.attendance.groupBy({
            by: ["courseId"],
            where: {
              courseId: { in: courseIds },
              status: "PRESENT",
            },
            _count: { id: true },
          }),
          // Count ABSENT attendance
          prisma.attendance.groupBy({
            by: ["courseId"],
            where: {
              courseId: { in: courseIds },
              status: "ABSENT",
            },
            _count: { id: true },
          }),
          // Count LATE attendance
          prisma.attendance.groupBy({
            by: ["courseId"],
            where: {
              courseId: { in: courseIds },
              status: "LATE",
            },
            _count: { id: true },
          }),
          // Get last attendance date for each course
          prisma.attendance.findMany({
            where: { courseId: { in: courseIds } },
            select: {
              courseId: true,
              date: true,
            },
            orderBy: { date: "desc" },
            distinct: ["courseId"],
          }),
        ]);

      // Build Maps for O(1) lookups
      const presentCountMap = new Map(
        presentCounts.map((c) => [c.courseId, c._count.id])
      );
      const absentCountMap = new Map(
        absentCounts.map((c) => [c.courseId, c._count.id])
      );
      const lateCountMap = new Map(
        lateCounts.map((c) => [c.courseId, c._count.id])
      );
      const lastDateMap = new Map(
        lastAttendanceDates.map((a) => [a.courseId, a.date])
      );

      // Optimized: Get absents count for last attendance dates efficiently
      // Group courses by date and fetch in batches (reduces from N queries to ~unique dates)
      const lastAttendanceAbsentsMap = new Map<string, number>();

      if (lastDateMap.size > 0) {
        // Group courses by their last attendance date (YYYY-MM-DD format)
        const dateToCourses = new Map<string, string[]>();
        for (const [courseId, lastDate] of lastDateMap.entries()) {
          if (lastDate) {
            const dateKey = lastDate.toISOString().split("T")[0];
            if (!dateToCourses.has(dateKey)) {
              dateToCourses.set(dateKey, []);
            }
            dateToCourses.get(dateKey)!.push(courseId);
          }
        }

        // Fetch absents for all date groups in parallel (one query per unique date)
        // This reduces from potentially 100+ queries to ~5-10 queries
        const absentsPromises = Array.from(dateToCourses.entries()).map(
          async ([dateKey, courseIds]) => {
            // Parse date and set time boundaries for the entire day (UTC)
            const [year, month, day] = dateKey.split("-").map(Number);
            const startDate = new Date(
              Date.UTC(year, month - 1, day, 0, 0, 0, 0)
            );
            const endDate = new Date(
              Date.UTC(year, month - 1, day, 23, 59, 59, 999)
            );

            const results = await prisma.attendance.groupBy({
              by: ["courseId"],
              where: {
                courseId: { in: courseIds },
                date: {
                  gte: startDate,
                  lte: endDate,
                },
                status: "ABSENT",
              },
              _count: { id: true },
            });

            return results.map(
              (r) => [r.courseId, r._count.id] as [string, number]
            );
          }
        );

        const absentsResults = await Promise.all(absentsPromises);
        absentsResults.flat().forEach(([courseId, count]) => {
          lastAttendanceAbsentsMap.set(courseId, count);
        });
      }

      return courses.map((course) => {
        // Use _count instead of loading all students
        const totalStudents = course._count.students;
        const totalPresent = presentCountMap.get(course.id) || 0;
        const totalAbsents = absentCountMap.get(course.id) || 0;
        const totalLate = lateCountMap.get(course.id) || 0;
        const lastAttendanceDate = lastDateMap.get(course.id) || null;
        const lastAttendanceAbsents =
          lastAttendanceDate && lastAttendanceAbsentsMap.has(course.id)
            ? lastAttendanceAbsentsMap.get(course.id)!
            : 0;

        return {
          ...course,
          _count: {
            students: course._count.students,
            attendance: course._count.attendance,
          },
          attendanceStats: {
            totalStudents,
            totalPresent,
            totalAbsents,
            totalLate,
            lastAttendanceDate,
            lastAttendanceAbsents,
            attendanceRate:
              totalStudents > 0 ? totalPresent / totalStudents : 0,
          },
          // Don't include students array - use _count instead to reduce data transfer
          students: [],
          schedules: course.schedules,
          attendance: undefined,
        };
      });
    },
    [cacheKey],
    {
      tags: ["courses"],
      revalidate: 300, // Revalidate every 5 minutes (reduced database load)
    }
  )();
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

// Get course analytics (optimized - split into 3 parallel queries)
// Cached with tags for invalidation
export async function getCourseAnalytics(courseSlug: string) {
  // Query 1: Basic course info + students list only (no nested data)
  const coursePromise = prisma.course.findUnique({
    where: { slug: courseSlug },
    select: {
      id: true,
      code: true,
      title: true,
      section: true,
      room: true,
      semester: true,
      academicYear: true,
      slug: true,
      status: true,
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
    },
  });

  // Query 2: Get course ID first, then fetch attendance and term configs in parallel
  const courseForData = await prisma.course.findUnique({
    where: { slug: courseSlug },
    select: { id: true },
  });

  if (!courseForData) return null;

  // Query 2: Attendance records (minimal fields only)
  const attendancePromise = prisma.attendance.findMany({
    where: { courseId: courseForData.id },
    select: {
      id: true,
      studentId: true,
      date: true,
      status: true,
    },
    orderBy: { date: "desc" },
  });

  // Query 3: Term configs with assessments and scores (optimized structure)
  const termConfigsPromise = prisma.termConfiguration.findMany({
    where: { courseId: courseForData.id },
    select: {
      id: true,
      term: true,
      ptWeight: true,
      quizWeight: true,
      examWeight: true,
      termGrades: {
        select: {
          studentId: true,
          totalPercentage: true,
          numericGrade: true,
          remarks: true,
        },
      },
      assessments: {
        where: { enabled: true },
        select: {
          id: true,
          type: true,
          name: true,
          maxScore: true,
          order: true,
          scores: {
            select: {
              studentId: true,
              score: true,
            },
          },
        },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { term: "asc" },
  });

  // Execute queries in parallel
  const [course, attendance, termConfigs] = await Promise.all([
    coursePromise,
    attendancePromise,
    termConfigsPromise,
  ]);

  if (!course) return null;

  // Build student Map for O(1) lookups
  const studentsMap = new Map(course.students.map((s) => [s.id, s]));

  // Transform attendance to include student reference (for compatibility)
  const attendanceWithStudent = attendance.map((a) => ({
    ...a,
    student: {
      id: a.studentId,
      studentId: studentsMap.get(a.studentId)?.studentId || "",
    },
  }));

  // Transform term configs to include student references (for compatibility)
  const termConfigsWithStudents = termConfigs.map((tc) => ({
    ...tc,
    termGrades: tc.termGrades.map((tg) => ({
      ...tg,
      student: {
        id: tg.studentId,
        studentId: studentsMap.get(tg.studentId)?.studentId || "",
      },
    })),
    assessments: tc.assessments.map((a) => ({
      ...a,
      scores: a.scores.map((s) => ({
        ...s,
        student: {
          id: s.studentId,
          studentId: studentsMap.get(s.studentId)?.studentId || "",
        },
      })),
    })),
  }));

  return {
    ...course,
    attendance: attendanceWithStudent,
    termConfigs: termConfigsWithStudents,
    grades: [], // Not used in analytics
  };
}

// Get course stats (passing rate, attendance rate) (cached)
export async function getCourseStats(courseSlug: string) {
  return unstable_cache(
    async (slug: string) => {
      const course = await prisma.course.findUnique({
        where: { slug },
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

      // Only use FINALS term for passing rate calculation
      const finalsConfig = termConfigs.find(
        (config) => config.term === "FINALS" || config.term === "Finals"
      );

      // Only count students with FINALS term grades for passing rate
      if (finalsConfig) {
        finalsConfig.termGrades.forEach((grade) => {
          studentsWithGrades.add(grade.studentId);
          if (grade.remarks === "PASSED") {
            passingStudents.add(grade.studentId);
          }
        });
      }

      const passingRate =
        studentsWithGrades.size > 0
          ? Math.round((passingStudents.size / studentsWithGrades.size) * 100)
          : 0;

      const attendanceRate =
        attendanceRecords.length === 0
          ? 0
          : Math.round(
              (attendanceRecords.filter(
                (record) =>
                  record.status === "PRESENT" || record.status === "LATE"
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
    },
    [`course-stats-${courseSlug}`],
    {
      tags: [`course-${courseSlug}`, "courses"],
      revalidate: 60, // Revalidate every 60 seconds
    }
  )(courseSlug);
}

// Batch: Get stats for multiple courses
export async function getCoursesStatsBatch(courseSlugs: string[]) {
  return Promise.all(courseSlugs.map((slug) => getCourseStats(slug)));
}

// Create course (invalidates cache)
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

  // Validate schedule overlaps with existing active courses for the same faculty
  if (data.facultyId && data.schedules && data.schedules.length > 0) {
    // Get all active courses for this faculty
    const activeCourses = await prisma.course.findMany({
      where: {
        facultyId: data.facultyId,
        status: "ACTIVE",
      },
      include: {
        schedules: true,
      },
    });

    // Helper function to normalize day names
    const normalizeDay = (day: string): string => {
      const dayMap: Record<string, string> = {
        Mon: "Monday",
        Tue: "Tuesday",
        Wed: "Wednesday",
        Thu: "Thursday",
        Fri: "Friday",
        Sat: "Saturday",
        Sun: "Sunday",
      };
      return dayMap[day] || day;
    };

    // Helper function to convert time to minutes
    const timeToMinutes = (time: string): number => {
      if (!time) return 0;
      // Handle both "HH:MM" and "HH:MM AM/PM" formats
      const parts = time.split(" ");
      const [hours, minutes] = parts[0].split(":").map(Number);
      let hour24 = hours;
      if (parts[1] === "PM" && hours !== 12) hour24 = hours + 12;
      if (parts[1] === "AM" && hours === 12) hour24 = 0;
      return hour24 * 60 + (minutes || 0);
    };

    // Helper function to check time overlap
    const checkOverlap = (
      day1: string,
      from1: string,
      to1: string,
      day2: string,
      from2: string,
      to2: string
    ): boolean => {
      if (normalizeDay(day1) !== normalizeDay(day2)) return false;
      const start1 = timeToMinutes(from1);
      const end1 = timeToMinutes(to1);
      const start2 = timeToMinutes(from2);
      const end2 = timeToMinutes(to2);
      return start1 < end2 && start2 < end1;
    };

    // Check each new schedule against existing schedules
    for (const newSchedule of data.schedules) {
      for (const activeCourse of activeCourses) {
        for (const existingSchedule of activeCourse.schedules) {
          if (
            checkOverlap(
              newSchedule.day,
              newSchedule.fromTime,
              newSchedule.toTime,
              existingSchedule.day,
              existingSchedule.fromTime,
              existingSchedule.toTime
            )
          ) {
            throw new Error(
              `Schedule overlaps with existing course "${activeCourse.code} - ${
                activeCourse.section
              }" on ${normalizeDay(newSchedule.day)} (${
                existingSchedule.fromTime
              } - ${existingSchedule.toTime})`
            );
          }
        }
      }
    }
  }

  const parsedClassNumber = data.classNumber
    ? parseInt(String(data.classNumber), 10)
    : 0;
  if (isNaN(parsedClassNumber)) {
    throw new Error("classNumber must be a valid number");
  }

  const result = await prisma.course.create({
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

  // Invalidate cache
  revalidateTag("courses");
  if (data.facultyId) {
    revalidateTag(`course-${slug}`);
  }

  return result;
}

// Update course (invalidates cache)
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

  const result = await prisma.course.update({
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

  // Invalidate cache
  revalidateTag("courses");
  revalidateTag(`course-${courseSlug}`);
  if (newSlug) {
    revalidateTag(`course-${newSlug}`);
  }

  return result;
}

// Delete course (invalidates cache)
export async function deleteCourse(courseSlug: string) {
  const result = await prisma.course.delete({
    where: { slug: courseSlug },
  });

  // Invalidate cache
  revalidateTag("courses");
  revalidateTag(`course-${courseSlug}`);

  return result;
}
