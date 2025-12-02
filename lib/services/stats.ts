import { prisma } from "@/lib/prisma";

// Get faculty stats
// Note: Not cached to ensure fresh data after saves
export async function getFacultyStats(facultyId: string) {
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
}

// Get faculty count by work type
// Note: Not cached to ensure fresh data after saves
export async function getFacultyCount() {
  const [fullTime, partTime] = await Promise.all([
    prisma.user.count({
      where: {
        roles: { has: "FACULTY" },
        workType: "FULL_TIME",
      },
    }),
    prisma.user.count({
      where: {
        roles: { has: "FACULTY" },
        workType: "PART_TIME",
      },
    }),
  ]);

  return {
    fullTime,
    partTime,
  };
}

// Get grades leaderboard
// Note: Not cached to ensure fresh data after saves
export async function getGradesLeaderboard(courseSlug?: string) {
  // Implementation depends on your leaderboard logic
  // This is a placeholder - you'll need to implement based on your requirements
  return [];
}
