import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth-options";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
//@ts-ignore

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function PUT(request: Request, context: { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { course_slug, criteria_id } = await context.params;
    if (!course_slug || !criteria_id) {
      return NextResponse.json(
        { error: "Missing course_slug or criteria_id" },
        { status: 400 }
      );
    }

    // First get the course ID from the slug
    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
      select: { id: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Get the existing criteria
    const existingCriteria = await prisma.criteria.findUnique({
      where: { id: criteria_id },
      include: { rubrics: true },
    });

    if (!existingCriteria) {
      return NextResponse.json(
        { error: "Criteria not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (existingCriteria.userId !== session.user.id) {
      return NextResponse.json(
        { error: "You do not have permission to edit this criteria" },
        { status: 403 }
      );
    }

    const data = await request.json();
    console.log("Updating criteria with data:", {
      course_slug,
      criteria_id,
      ...data,
    });

    // Start a transaction to update criteria and its rubrics
    const updatedCriteria = await prisma.$transaction(async (tx) => {
      // Update the criteria
      const criteria = await tx.criteria.update({
        where: { id: criteria_id },
        data: {
          name: data.name,
          scoringRange: String(data.scoringRange),
          passingScore: String(data.passingScore),
        },
      });

      // Update existing rubrics or create new ones
      const rubricUpdates = data.rubrics.map((r: any, index: number) => {
        const existingRubric = existingCriteria.rubrics[index];
        if (existingRubric) {
          // Update existing rubric
          return tx.rubric.update({
            where: { id: existingRubric.id },
            data: {
              name: r.name,
              percentage: r.weight ?? r.percentage,
            },
          });
        } else {
          // Create new rubric
          return tx.rubric.create({
            data: {
              name: r.name,
              percentage: r.weight ?? r.percentage,
              criteriaId: criteria_id,
            },
          });
        }
      });

      // Delete any extra rubrics that are no longer needed
      if (rubricUpdates.length < existingCriteria.rubrics.length) {
        await tx.rubric.deleteMany({
          where: {
            criteriaId: criteria_id,
            id: {
              notIn: existingCriteria.rubrics
                .slice(0, rubricUpdates.length)
                .map((r) => r.id),
            },
          },
        });
      }

      // Execute all rubric updates
      await Promise.all(rubricUpdates);

      // Return the updated criteria with its rubrics
      return tx.criteria.findUnique({
        where: { id: criteria_id },
        include: {
          user: {
            select: {
              name: true,
            },
          },
          rubrics: true,
        },
      });
    });

    return NextResponse.json(updatedCriteria);
  } catch (error) {
    let errorMessage = "Unknown error";
    if (error instanceof Error) errorMessage = error.message;
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === "P2003") {
        return NextResponse.json(
          { error: "Course or user not found", details: errorMessage },
          { status: 404 }
        );
      }
      if (error.code === "P2023") {
        return NextResponse.json(
          { error: "Invalid ID format", details: errorMessage },
          { status: 400 }
        );
      }
    }
    console.error("Error details:", {
      message: errorMessage,
      course_slug: (await context.params).course_slug,
      criteria_id: (await context.params).criteria_id,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Failed to update criteria", details: errorMessage },
      { status: 500 }
    );
  }
}
