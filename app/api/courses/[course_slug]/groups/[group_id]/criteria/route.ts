import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
//@ts-ignore
export async function GET(request: Request, { params }: { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { course_slug, group_id } = params;

    // Find the course using the slug
    const course = await prisma.course.findUnique({
      where: {
        slug: course_slug,
      },
      select: { id: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Find the group using the course ID and group ID
    const group = await prisma.group.findFirst({
      where: {
        id: group_id,
        courseId: course.id,
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Get the group criteria
    const criteria = await prisma.criteria.findMany({
      where: {
        courseId: course.id,
        isGroupCriteria: true,
      },
      include: {
        rubrics: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(criteria);
  } catch (error) {
    console.error("Error fetching group criteria:", error);
    return NextResponse.json(
      { error: "Failed to fetch group criteria" },
      { status: 500 }
    );
  }
}
//@ts-ignore
export async function POST(request: Request, context: { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await Promise.resolve(context.params);
    const { course_slug, group_id } = params;
    const body = await request.json();

    // Find the course using the slug
    const course = await prisma.course.findUnique({
      where: {
        slug: course_slug,
      },
      select: { id: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Find the group using the course ID and group ID
    const group = await prisma.group.findFirst({
      where: {
        id: group_id,
        courseId: course.id,
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Create the criteria
    const criteria = await prisma.criteria.create({
      data: {
        name: body.name,
        courseId: course.id,
        userId: session.user.id,
        scoringRange: body.scoringRange,
        passingScore: body.passingScore,
        date: new Date(body.date),
        isGroupCriteria: true,
        rubrics: {
          create: body.rubrics.map((r: any) => ({
            name: r.name,
            percentage: r.weight ?? r.percentage,
          })),
        },
      },
      include: {
        rubrics: true,
      },
    });

    return NextResponse.json(criteria);
  } catch (error) {
    console.error("Error creating group criteria:", error);
    return NextResponse.json(
      { error: "Failed to create group criteria" },
      { status: 500 }
    );
  }
}
