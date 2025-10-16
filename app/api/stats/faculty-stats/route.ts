import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all courses assigned to the faculty member
    const courses = await prisma.course.findMany({
      where: {
        facultyId: session.user.id,
      },
      include: {
        students: true,
        schedules: true,
      },
    });

    // Calculate totals
    const uniqueStudentIds = new Set();
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

    return NextResponse.json({
      totalStudents,
      totalCourses,
      totalClasses,
    });
  } catch (error) {
    console.error("Error fetching faculty stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch faculty stats" },
      { status: 500 }
    );
  }
}
