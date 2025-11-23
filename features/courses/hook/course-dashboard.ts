import { prisma } from "@/lib/prisma";
import { CourseStatus } from "@prisma/client";
import { unstable_cache } from "next/cache";

export async function getCourseDashboardData() {
  return unstable_cache(
    async () => {
      try {
        // Optimized query: Only fetch what's needed, use _count instead of loading all students
        const courses = await prisma.course.findMany({
          select: {
            id: true,
            code: true,
            title: true,
            section: true,
            slug: true,
            status: true,
            semester: true,
            academicYear: true,
            createdAt: true,
            faculty: {
              select: {
                id: true,
                name: true,
                email: true,
              },
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
                students: true,
                attendance: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        // Calculate total unique students using _count
        // Note: This is an approximation since we're not loading all students
        // For exact count, you'd need a separate query, but this is much faster
        const totalStudents = courses.reduce(
          (sum, course) => sum + course._count.students,
          0
        );

        const activeCourses = courses.filter(
          (course) => course.status === CourseStatus.ACTIVE
        ).length;

        const inactiveCourses = courses.filter(
          (course) => course.status === CourseStatus.INACTIVE
        ).length;

        const archivedCourses = courses.filter(
          (course) => course.status === CourseStatus.ARCHIVED
        ).length;

        const totalCourses = courses.length;

        return {
          courses,
          activeCourses,
          inactiveCourses,
          archivedCourses,
          totalStudents,
          totalCourses,
        };
      } catch (error) {
        console.error("Error fetching course dashboard data:", error);

        return {
          courses: [],
          activeCourses: 0,
          inactiveCourses: 0,
          archivedCourses: 0,
          totalStudents: 0,
          totalCourses: 0,
        };
      }
    },
    ["course-dashboard"],
    {
      tags: ["courses"],
      revalidate: 60, // Cache for 60 seconds
    }
  )();
}
