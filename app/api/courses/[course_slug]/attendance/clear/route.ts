import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }) {
  try {
    // Check for session
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { date, recordsToDelete } = await request.json();

    if (!date || !recordsToDelete) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Delete the specified attendance records
    await prisma.attendance.deleteMany({
      where: {
        id: {
          in: recordsToDelete,
        },
        courseId: params.course_slug,
      },
    });

    return NextResponse.json(
      { message: "Attendance records cleared successfully" },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to clear attendance records" },
      { status: 500 }
    );
  }
}
