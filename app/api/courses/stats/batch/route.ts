import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

// Route segment config to pre-compile and optimize
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30; // Maximum execution time

// Limit the number of courses processed at once to prevent timeouts
const MAX_COURSES_PER_BATCH = 50;

// Helper function for query timeouts
async function queryWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error(`Query timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });

  return Promise.race([promise, timeoutPromise]).finally(() =>
    clearTimeout(timeoutHandle)
  );
}

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

    // Limit the number of courses to prevent timeouts
    const limitedSlugs = courseSlugs.slice(0, MAX_COURSES_PER_BATCH);

    if (courseSlugs.length > MAX_COURSES_PER_BATCH) {
      console.warn(
        `Batch stats request exceeded limit: ${courseSlugs.length} courses requested, processing first ${MAX_COURSES_PER_BATCH}`
      );
    }

    // Fetch all courses with student count (using _count for efficiency)
    const courses = await queryWithTimeout(
      prisma.course.findMany({
        where: {
          slug: {
            in: limitedSlugs,
          },
        },
        select: {
          id: true,
          slug: true,
          _count: {
            select: {
              students: true,
            },
          },
        },
      }),
      10000 // 10 second timeout
    );

    if (courses.length === 0) {
      return NextResponse.json({ stats: [] });
    }

    const courseIds = courses.map((c) => c.id);

    // Use database aggregations instead of loading all records
    // This is much more efficient for large datasets
    const [finalsTermConfigs, attendanceTotal, attendancePresentOrLate] =
      await Promise.all([
        // Only get FINALS term configs with grade counts (aggregated)
        queryWithTimeout(
          prisma.termConfiguration.findMany({
            where: {
              courseId: {
                in: courseIds,
              },
              term: {
                in: ["FINALS", "Finals"],
              },
            },
            select: {
              courseId: true,
              termGrades: {
                select: {
                  studentId: true,
                  remarks: true,
                },
                // Limit to prevent excessive data loading (reasonable limit for stats)
                take: 5000,
              },
            },
          }),
          15000 // 15 second timeout
        ),
        // Get total attendance count per course
        queryWithTimeout(
          prisma.attendance.groupBy({
            by: ["courseId"],
            where: {
              courseId: {
                in: courseIds,
              },
            },
            _count: {
              id: true,
            },
          }),
          15000 // 15 second timeout
        ),
        // Get present/late attendance count per course
        queryWithTimeout(
          prisma.attendance.groupBy({
            by: ["courseId"],
            where: {
              courseId: {
                in: courseIds,
              },
              status: {
                in: ["PRESENT", "LATE"],
              },
            },
            _count: {
              id: true,
            },
          }),
          15000 // 15 second timeout
        ),
      ]);

    // Group finals configs by courseId
    const finalsByCourse = new Map<
      string,
      { totalGrades: number; passingGrades: number }
    >();

    finalsTermConfigs.forEach((config) => {
      const existing = finalsByCourse.get(config.courseId) || {
        totalGrades: 0,
        passingGrades: 0,
      };

      // Count passing students from term grades
      const passingCount = config.termGrades.filter(
        (g) => g.remarks === "PASSED"
      ).length;

      finalsByCourse.set(config.courseId, {
        totalGrades: existing.totalGrades + config.termGrades.length,
        passingGrades: existing.passingGrades + passingCount,
      });
    });

    // Group attendance stats by courseId
    const attendanceByCourse = new Map<
      string,
      { total: number; presentOrLate: number }
    >();

    attendanceTotal.forEach((stat) => {
      attendanceByCourse.set(stat.courseId, {
        total: stat._count.id,
        presentOrLate: 0, // Will be set below
      });
    });

    attendancePresentOrLate.forEach((stat) => {
      const existing = attendanceByCourse.get(stat.courseId) || {
        total: 0,
        presentOrLate: 0,
      };
      attendanceByCourse.set(stat.courseId, {
        ...existing,
        presentOrLate: stat._count.id,
      });
    });

    // Calculate stats for each course
    const stats = courses.map((course) => {
      const totalStudents = course._count.students;

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

      const finalsData = finalsByCourse.get(course.id) || {
        totalGrades: 0,
        passingGrades: 0,
      };

      const attendanceData = attendanceByCourse.get(course.id) || {
        total: 0,
        presentOrLate: 0,
      };

      const passingRate =
        finalsData.totalGrades > 0
          ? Math.round(
              (finalsData.passingGrades / finalsData.totalGrades) * 100
            )
          : 0;

      const attendanceRate =
        attendanceData.total > 0
          ? Math.round(
              (attendanceData.presentOrLate / attendanceData.total) * 100
            )
          : 0;

      return {
        slug: course.slug,
        stats: {
          passingRate,
          attendanceRate,
          totalStudents,
        },
      };
    });

    const response = NextResponse.json({ stats });

    // Add caching headers for better performance
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300"
    );

    return response;
  } catch (error) {
    console.error("Error fetching batch course stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch course statistics" },
      { status: 500 }
    );
  }
}
