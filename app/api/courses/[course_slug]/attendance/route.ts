import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { AttendanceResponse } from "@/shared/types/attendance";

export async function GET(request: Request, context: { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      console.error("No session found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await Promise.resolve(context.params);
    const { course_slug } = params;
    console.log("Fetching attendance for course:", course_slug);

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    if (!date) {
      console.error("Date parameter is missing");
      return NextResponse.json(
        { error: "Date parameter is required" },
        { status: 400 }
      );
    }

    console.log("Fetching attendance for date:", date);

    // Create start and end of day dates to ensure we catch all records for the day
    const startDate = new Date(date + "T00:00:00.000Z");
    const endDate = new Date(date + "T23:59:59.999Z");

    console.log("Date range:", {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      inputDate: date,
    });

    // Get the course first using the slug
    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
    });

    if (!course) {
      console.error("Course not found:", course_slug);
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    console.log("Found course:", course.id);

    // Get total count for pagination
    const total = await prisma.attendance.count({
      where: {
        courseId: course.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    console.log("Total attendance records:", total);

    const attendanceRecords = await prisma.attendance.findMany({
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
    });

    console.log("Found attendance records:", attendanceRecords.length);

    const response: AttendanceResponse = {
      attendance: attendanceRecords,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching attendance records:", error);
    if (error instanceof Error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    }
    return NextResponse.json(
      {
        error: "Failed to fetch attendance records",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await Promise.resolve(context.params);
    const { course_slug } = params;

    const { date, attendance } = await request.json();

    // Create a UTC date at the start of the day
    const utcDate = new Date(date);
    utcDate.setUTCHours(0, 0, 0, 0);

    // Validate the course exists using the slug
    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Process each attendance record
    const result = await prisma.$transaction(async (tx) => {
      const records = [];
      for (const record of attendance) {
        // First try to find an existing record for this student on this date
        const existingRecord = await tx.attendance.findFirst({
          where: {
            studentId: record.studentId,
            courseId: course.id,
            date: {
              gte: utcDate,
              lt: new Date(utcDate.getTime() + 24 * 60 * 60 * 1000), // Next day
            },
          },
        });

        if (existingRecord) {
          // Update existing record
          const updated = await tx.attendance.update({
            where: { id: existingRecord.id },
            data: { status: record.status },
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
          });
          records.push(updated);
        } else {
          // Create new record only if one doesn't exist
          const created = await tx.attendance.create({
            data: {
              studentId: record.studentId,
              courseId: course.id,
              date: utcDate,
              status: record.status,
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
          });
          records.push(created);
        }
      }
      return records;
    });

    return NextResponse.json({
      message: "Attendance saved successfully",
      records: result,
    });
  } catch (error) {
    console.error("Error saving attendance:", error);
    return NextResponse.json(
      { error: "Failed to save attendance" },
      { status: 500 }
    );
  }
}
