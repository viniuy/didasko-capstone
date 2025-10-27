import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
//@ts-ignore
export async function POST(request: Request, { params }: { params }) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { date, recordsToDelete } = await request.json();

    if (!date || !recordsToDelete || !Array.isArray(recordsToDelete)) {
      return NextResponse.json(
        { error: "Missing or invalid fields" },
        { status: 400 }
      );
    }

    const course = await prisma.course.findUnique({
      where: { slug: params.course_slug },
      select: { id: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const deleted = await prisma.attendance.deleteMany({
      where: {
        id: { in: recordsToDelete },
        courseId: course.id,
      },
    });

    return NextResponse.json(
      {
        message: "Attendance records cleared successfully",
        deletedCount: deleted.count,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error clearing attendance:", error);
    return NextResponse.json(
      { error: "Failed to clear attendance records" },
      { status: 500 }
    );
  }
}
