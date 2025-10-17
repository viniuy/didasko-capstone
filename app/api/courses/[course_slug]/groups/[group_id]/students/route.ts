import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth-options";
//@ts-ignore
export async function GET(request: Request, context: { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await Promise.resolve(context.params);
    const { courseId, group_id } = params;

    // Get the group and its students
    const group = await prisma.group.findFirst({
      where: {
        id: group_id,
        courseId: courseId,
      },
      include: {
        students: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleInitial: true,
            image: true,
            studentId: true,
          },
        },
        course: {
          select: {
            id: true,
            code: true,
            title: true,
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Return both the group info and students for debugging
    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        number: group.number,
        courseId: group.courseId,
        course: group.course,
      },
      students: group.students,
      studentCount: group.students.length,
    });
  } catch (error) {
    console.error("Error fetching group students:", error);
    return NextResponse.json(
      { error: "Failed to fetch group students" },
      { status: 500 }
    );
  }
}
