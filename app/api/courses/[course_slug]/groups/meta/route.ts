import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

//@ts-ignore
export async function GET(request: Request, context: { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await Promise.resolve(context.params);
    const { course_slug } = params;

    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const groups = await prisma.group.findMany({
      where: { courseId: course.id },
      select: {
        id: true,
        name: true,
        number: true,
      },
      orderBy: {
        number: "asc",
      },
    });

    const groupNames = groups.map((g) => g.name);
    const groupNumbers = groups.map((g) => g.number);

    return NextResponse.json({
      names: groupNames,
      numbers: groupNumbers,
      usedNames: groupNames,
      usedNumbers: groupNumbers,
      groups,
    });
  } catch (error) {
    console.error("Error fetching group meta:", error);
    return NextResponse.json(
      { error: "Failed to fetch group meta" },
      { status: 500 }
    );
  }
}
