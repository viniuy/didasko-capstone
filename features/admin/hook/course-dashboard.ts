import { prisma } from "@/lib/prisma";
import { CourseStatus } from "@prisma/client";

export async function getCourseDashboardData() {
  try {
    const courses = await prisma.course.findMany({
      include: {
        faculty: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        schedules: true,
        students: {
          select: {
            id: true,
          },
        },
        _count: {
          select: {
            students: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const uniqueStudentIds = new Set(
      courses.flatMap((course) => course.students.map((s) => s.id))
    );
    const totalStudents = uniqueStudentIds.size;

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
}
