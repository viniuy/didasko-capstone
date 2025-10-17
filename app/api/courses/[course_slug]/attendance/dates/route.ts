import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET(request: Request, { params }: { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { course_slug } = await params;

    // Get the course
    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Get all unique dates where attendance was taken for this course
    const uniqueDates = await prisma.attendance.findMany({
      where: {
        courseId: course.id,
      },
      select: {
        date: true,
      },
      distinct: ["date"],
      orderBy: {
        date: "asc",
      },
    });

    // Convert dates to ISO strings and return
    return NextResponse.json({
      dates: uniqueDates.map((record) => record.date.toISOString()),
    });
  } catch (error) {
    console.error("Error fetching attendance dates:", error);
    return NextResponse.json(
      { error: "Failed to fetch attendance dates" },
      { status: 500 }
    );
  }
}
