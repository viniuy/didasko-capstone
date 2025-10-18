import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth-options";
//@ts-ignore
export async function POST(request: Request, context: { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await Promise.resolve(context.params);
    const { course_slug } = params;

    // First get the course using the slug
    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
      select: { id: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const body = await request.json();
    const { groupNumber, groupName, studentIds, leaderId } = body;

    // Check if group name already exists in this course
    if (groupName) {
      const existingGroup = await prisma.group.findFirst({
        where: {
          courseId: course.id,
          name: groupName,
        },
      });

      if (existingGroup) {
        return NextResponse.json(
          { error: "A group with this name already exists" },
          { status: 400 }
        );
      }
    }

    // Create the group
    const group = await prisma.group.create({
      data: {
        number: groupNumber,
        name: groupName,
        courseId: course.id,
        leaderId: leaderId || null,
        students: {
          connect: studentIds.map((id: string) => ({ id })),
        },
      },
      include: {
        students: true,
        leader: true,
      },
    });

    return NextResponse.json(group);
  } catch (error) {
    console.error("Error creating group:", error);
    return NextResponse.json(
      { error: "Failed to create group" },
      { status: 500 }
    );
  }
}
//@ts-ignore
export async function GET(request: Request, context: { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await Promise.resolve(context.params);
    const { course_slug } = params;

    // First get the course using the slug
    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
      select: { id: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Get all groups for the course
    const groups = await prisma.group.findMany({
      where: {
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

    return NextResponse.json(groups);
  } catch (error) {
    console.error("Error fetching groups:", error);
    return NextResponse.json(
      { error: "Failed to fetch groups" },
      { status: 500 }
    );
  }
}
