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
    const { course_slug, group_id } = params;

    // First get the course using the slug
    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
      select: { id: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Get the specific group
    const group = await prisma.group.findFirst({
      where: {
        id: group_id,
        courseId: course.id,
      },
      include: {
        students: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleInitial: true,
            image: true,
          },
        },
        leader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleInitial: true,
            image: true,
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json(group);
  } catch (error) {
    console.error("Error fetching group:", error);
    return NextResponse.json(
      { error: "Failed to fetch group" },
      { status: 500 }
    );
  }
}
//@ts-ignore
export async function DELETE(request: Request, { params }: { params }) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const { course_slug, group_id } = resolvedParams;

    // Get the course
    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
    });

    if (!course) {
      return new NextResponse("Course not found", { status: 404 });
    }

    // Get the group
    const group = await prisma.group.findFirst({
      where: {
        id: group_id,
        courseId: course.id,
      },
    });

    if (!group) {
      return new NextResponse("Group not found", { status: 404 });
    }

    // Delete the group and its associations
    await prisma.group.delete({
      where: {
        id: group_id,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting group:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
