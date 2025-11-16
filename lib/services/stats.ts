import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

// Cached: Get faculty stats
export async function getFacultyStats(facultyId: string) {
  return unstable_cache(
    async () => {
      const courses = await prisma.course.findMany({
        where: {
          facultyId: facultyId,
        },
        include: {
          students: true,
          schedules: true,
        },
      });

      const uniqueStudentIds = new Set<string>();
      courses.forEach((course) => {
        course.students.forEach((student) => {
          uniqueStudentIds.add(student.id);
        });
      });

      const totalStudents = uniqueStudentIds.size;
      const totalCourses = courses.length;
      const totalClasses = courses.reduce(
        (acc, course) => acc + course.schedules.length,
        0
      );

      return {
        totalStudents,
        totalCourses,
        totalClasses,
      };
    },
    [`faculty-stats-${facultyId}`],
    { revalidate: 30 }
  )();
}

// Cached: Get faculty count by work type
export async function getFacultyCount() {
  return unstable_cache(
    async () => {
      const [fullTime, partTime] = await Promise.all([
        prisma.user.count({
          where: {
            role: "FACULTY",
            workType: "FULL_TIME",
          },
        }),
        prisma.user.count({
          where: {
            role: "FACULTY",
            workType: "PART_TIME",
          },
        }),
      ]);

      return {
        fullTime,
        partTime,
      };
    },
    ["faculty-count"],
    { revalidate: 30 }
  )();
}

// Get grades leaderboard
export async function getGradesLeaderboard(courseSlug?: string) {
  const cacheKey = courseSlug
    ? `grades-leaderboard-${courseSlug}`
    : "grades-leaderboard-all";

  return unstable_cache(
    async () => {
      // Implementation depends on your leaderboard logic
      // This is a placeholder - you'll need to implement based on your requirements
      return [];
    },
    [cacheKey],
    { revalidate: 30 }
  )();
}
