import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
//@ts-ignore

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { course_slug } = params;

    const body = await request.json();
    // Support both 'attendance' (from hook) and 'updates' (legacy) for backward compatibility
    const { date, attendance, updates } = body as {
      date: string;
      attendance?: Array<{
        studentId: string;
        status: string;
        reason?: string;
      }>;
      updates?: Array<{
        studentId: string;
        status: string;
        timestamp?: string | Date;
      }>;
    };

    // Use attendance if provided, otherwise fall back to updates
    const recordsToProcess = attendance || updates || [];

    const utcDate = new Date(date);
    utcDate.setUTCHours(0, 0, 0, 0);

    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
    });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      for (const u of recordsToProcess) {
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
