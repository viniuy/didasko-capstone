import { prisma } from "@/lib/prisma";

export interface FacultyLoad {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  courseCount: number;
  totalStudents: number;
}

export interface WorstAttendanceCourse {
  id: string;
  courseCode: string;
  courseName: string;
  facultyName: string;
  facultyImage?: string | null;
  attendanceRate: number;
  totalStudents: number;
}

/**
 * Get faculty members with the highest course load
 * Optimized with aggregation and indexes for 45+ faculty with 13+ courses each
 */
export async function getFacultyWithHighestLoad(): Promise<FacultyLoad[]> {
  try {
    // Use raw query for optimal performance with aggregation
    // Expected performance: ~50-100ms for 45 faculty × 13 courses
    const facultyLoad = await prisma.$queryRaw<FacultyLoad[]>`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.image,
        COUNT(DISTINCT c.id)::int as "courseCount",
        COUNT(DISTINCT cs."B")::int as "totalStudents"
      FROM users u
      INNER JOIN courses c ON c.faculty_id = u.id AND c.status = 'ACTIVE'
      LEFT JOIN "_StudentCourses" cs ON cs."A" = c.id
      WHERE u.status = 'ACTIVE'
        AND 'FACULTY' = ANY(u.roles)
      GROUP BY u.id, u.name, u.email, u.image
      ORDER BY 
        COUNT(DISTINCT c.id) DESC, 
        COUNT(DISTINCT cs."B") DESC
      LIMIT 3
    `;

    return facultyLoad.map((faculty) => ({
      ...faculty,
      name: faculty.name || "Unknown",
      email: faculty.email || "",
    }));
  } catch (error) {
    console.error("Error fetching faculty with highest load:", error);
    return [];
  }
}

/**
 * Get courses with the worst attendance rates
 * Optimized with aggregation and early filtering for large datasets
 */
export async function getCoursesWithWorstAttendance(): Promise<
  WorstAttendanceCourse[]
> {
  try {
    // Use raw query for optimal performance with aggregation
    // Expected performance: ~200-400ms for 585 courses × 20 attendance records
    const coursesWithAttendance = await prisma.$queryRaw<
      Array<{
        id: string;
        courseCode: string;
        courseName: string;
        facultyName: string;
        facultyImage: string | null;
        totalStudents: number;
        presentCount: number;
        totalAttendanceRecords: number;
      }>
    >`
      SELECT 
        c.id,
        c.code as "courseCode",
        c.title as "courseName",
        u.name as "facultyName",
        u.image as "facultyImage",
        COUNT(DISTINCT cs."B")::int as "totalStudents",
        COUNT(CASE WHEN a.status = 'PRESENT' THEN 1 END)::int as "presentCount",
        COUNT(a.id)::int as "totalAttendanceRecords"
      FROM courses c
      INNER JOIN users u ON u.id = c.faculty_id
      INNER JOIN "_StudentCourses" cs ON cs."A" = c.id
      INNER JOIN attendance a ON a."courseId" = c.id
      WHERE c.status = 'ACTIVE'
      GROUP BY c.id, c.code, c.title, u.name, u.image
      HAVING COUNT(a.id) > 0
      ORDER BY 
        (COUNT(CASE WHEN a.status = 'PRESENT' THEN 1 END)::float / COUNT(a.id)::float) ASC
      LIMIT 3
    `;

    return coursesWithAttendance.map((course) => ({
      id: course.id,
      courseCode: course.courseCode,
      courseName: course.courseName,
      facultyName: course.facultyName || "Unknown",
      facultyImage: course.facultyImage,
      attendanceRate:
        course.totalAttendanceRecords > 0
          ? (course.presentCount / course.totalAttendanceRecords) * 100
          : 0,
      totalStudents: course.totalStudents,
    }));
  } catch (error) {
    console.error("Error fetching courses with worst attendance:", error);
    return [];
  }
}
