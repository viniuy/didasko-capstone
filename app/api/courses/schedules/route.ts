import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import {
  Schedule,
  ScheduleCreateInput,
  ScheduleResponse,
} from "@/shared/types/schedule";

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(request: Request) {
  try {
    console.log("GET /courses/schedules - Starting request");
    const session = await getServerSession(authOptions);
    if (!session) {
      console.log("No session found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const facultyId = searchParams.get("facultyId");
    const semester = searchParams.get("semester");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    console.log("Request params:", { facultyId, semester, page, limit, skip });

    if (!facultyId) {
      console.log("No facultyId provided");
      return NextResponse.json(
        { error: "Faculty ID is required" },
        { status: 400 }
      );
    }

    // Verify the user exists
    const user = await prisma.user.findUnique({
      where: { id: facultyId },
      select: { id: true, email: true, roles: true },
    });

    console.log("Found user:", user);

    if (!user) {
      console.log("User not found");
      return NextResponse.json({ error: "Faculty not found" }, { status: 404 });
    }

    // Get total count for pagination
    const total = await prisma.courseSchedule.count({
      where: {
        course: {
          facultyId,
          status: "ACTIVE",
          ...(semester ? { semester } : {}),
        },
      },
    });

    console.log("Total schedules found:", total);

    // Get schedules with pagination
    const schedules = await prisma.courseSchedule.findMany({
      where: {
        course: {
          facultyId,
          status: "ACTIVE",
          ...(semester ? { semester } : {}),
        },
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            room: true,
            semester: true,
            section: true,
            slug: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: { day: "asc" },
    });

    console.log("Schedules retrieved:", schedules.length);

    const response: ScheduleResponse = {
      schedules,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in GET /courses/schedules:", error);
    return NextResponse.json(
      { error: "Failed to fetch schedules" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { courseId, day, fromTime, toTime } = body as ScheduleCreateInput;

    // Validate required fields
    if (!courseId || !day || !fromTime || !toTime) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate day format
    const validDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    if (!validDays.includes(day)) {
      return NextResponse.json(
        {
          error:
            "Invalid day format. Must be one of: Sun, Mon, Tue, Wed, Thu, Fri, Sat",
        },
        { status: 400 }
      );
    }

    const schedule = await prisma.courseSchedule.create({
      data: {
        courseId,
        day,
        fromTime,
        toTime,
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            room: true,
            semester: true,
            section: true,
          },
        },
      },
    });

    return NextResponse.json(schedule as Schedule);
  } catch (error) {
    console.error("Error creating schedule:", error);
    return NextResponse.json(
      { error: "Failed to create schedule" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get("id");

    if (!scheduleId) {
      return NextResponse.json(
        { error: "Schedule ID is required" },
        { status: 400 }
      );
    }

    await prisma.courseSchedule.delete({
      where: { id: scheduleId },
    });

    return NextResponse.json({ message: "Schedule deleted successfully" });
  } catch (error) {
    console.error("Error deleting schedule:", error);
    return NextResponse.json(
      { error: "Failed to delete schedule" },
      { status: 500 }
    );
  }
}
