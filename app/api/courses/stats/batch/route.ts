import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

type TermConfigWithGrades = {
  courseId: string;
  termGrades: Array<{
    studentId: string;
    remarks: string | null;
  }>;
};

type AttendanceRecord = {
  courseId: string;
  status: string;
};

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { courseSlugs } = await req.json();

    if (!Array.isArray(courseSlugs) || courseSlugs.length === 0) {
      return NextResponse.json(
        { error: "courseSlugs must be a non-empty array" },
        { status: 400 }
      );
    }

    // Fetch all courses with their students in a single query
    const courses = await prisma.course.findMany({
      where: {
        slug: {
          in: courseSlugs,
        },
      },
      include: {
        students: {
          select: {
            id: true,
          },
        },
      },
    });

    if (courses.length === 0) {
      return NextResponse.json({ stats: [] });
    }

    const courseIds = courses.map((c) => c.id);

    // Batch query: Get all term configs and attendance records in parallel
    const [termConfigs, attendanceRecords] = await Promise.all([
      prisma.termConfiguration.findMany({
        where: {
          courseId: {
            in: courseIds,
          },
        },
        include: {
          termGrades: {
            select: {
              studentId: true,
              remarks: true,
            },
          },
        },
      }),
      prisma.attendance.findMany({
        where: {
          courseId: {
            in: courseIds,
          },
        },
        select: {
          courseId: true,
          status: true,
        },
      }),
    ]);

    // Group term configs and attendance by courseId
    const termConfigsByCourse = new Map<string, TermConfigWithGrades[]>();
    const attendanceByCourse = new Map<string, AttendanceRecord[]>();

    termConfigs.forEach((config: TermConfigWithGrades) => {
      if (!termConfigsByCourse.has(config.courseId)) {
        termConfigsByCourse.set(config.courseId, []);
      }
      termConfigsByCourse.get(config.courseId)!.push(config);
    });

    attendanceRecords.forEach((record: AttendanceRecord) => {
      if (!attendanceByCourse.has(record.courseId)) {
        attendanceByCourse.set(record.courseId, []);
      }
      attendanceByCourse.get(record.courseId)!.push(record);
    });

    // Calculate stats for each course
    const stats = courses.map((course) => {
      const totalStudents = course.students.length;

      if (totalStudents === 0) {
        return {
          slug: course.slug,
          stats: {
            passingRate: 0,
            attendanceRate: 0,
            totalStudents: 0,
          },
        };
      }

      const courseTermConfigs = termConfigsByCourse.get(course.id) || [];
      const courseAttendance = attendanceByCourse.get(course.id) || [];

      const studentsWithGrades = new Set<string>();
      const passingStudents = new Set<string>();

      courseTermConfigs.forEach((config: TermConfigWithGrades) => {
        config.termGrades.forEach(
          (grade: { studentId: string; remarks: string | null }) => {
            studentsWithGrades.add(grade.studentId);
            if (grade.remarks === "PASSED") {
              passingStudents.add(grade.studentId);
            }
          }
        );
      });

      const passingRate =
        studentsWithGrades.size > 0
          ? Math.round((passingStudents.size / studentsWithGrades.size) * 100)
          : 0;

      const attendanceRate =
        courseAttendance.length === 0
          ? 0
          : Math.round(
              (courseAttendance.filter(
                (record: AttendanceRecord) =>
                  record.status === "PRESENT" || record.status === "LATE"
              ).length /
                courseAttendance.length) *
                100
            );

      return {
        slug: course.slug,
        stats: {
          passingRate,
          attendanceRate,
          totalStudents,
        },
      };
    });

    return NextResponse.json({ stats });
  } catch (error) {
    console.error("Error fetching batch course stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch course statistics" },
      { status: 500 }
    );
  }
}
