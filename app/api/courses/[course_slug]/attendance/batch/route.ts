import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
//@ts-ignore
export async function POST(request: Request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { course_slug } = params;

    const body = await request.json();
    const { date, updates } = body as {
      date: string;
      updates: Array<{
        studentId: string;
        status: string;
        timestamp?: string | Date;
      }>;
    };

    const utcDate = new Date(date);
    utcDate.setUTCHours(0, 0, 0, 0);

    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
    });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      for (const u of updates) {
        const existing = await tx.attendance.findFirst({
          where: {
            studentId: u.studentId,
            courseId: course.id,
            date: {
              gte: utcDate,
              lt: new Date(utcDate.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        });

        if (existing) {
          await tx.attendance.update({
            where: { id: existing.id },
            data: { status: u.status as any },
          });
        } else {
          await tx.attendance.create({
            data: {
              studentId: u.studentId,
              courseId: course.id,
              date: utcDate,
              status: u.status as any,
            },
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error batch saving attendance:", error);
    return NextResponse.json(
      { error: "Failed to batch save" },
      { status: 500 }
    );
  }
}
