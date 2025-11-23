import { NextResponse } from "next/server";
import { getGroupCriteria, createCriteria } from "@/lib/services";
//@ts-ignore

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Note: maxDuration only works on Vercel Pro/Enterprise plans
// On Hobby plan, default timeout is 10 seconds
export const maxDuration = 30;

// Helper function to add timeout protection
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });
  return Promise.race([promise, timeout]);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ course_slug: string }> }
) {
  try {
    const { course_slug } = await context.params;
    if (!course_slug || typeof course_slug !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid course_slug" },
        { status: 400 }
      );
    }

    // Add timeout protection (25 seconds to leave buffer before Vercel timeout)
    // This provides better error messages if query is slow
    const criteria = await withTimeout(
      getGroupCriteria(course_slug),
      25000,
      "Query timeout: Database query took too long. Please check database performance or contact support."
    );

    if (!criteria) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    return NextResponse.json(criteria);
  } catch (error: any) {
    console.error("Error fetching group criteria:", error);

    // Provide more specific error messages
    if (error.message?.includes("timeout")) {
      return NextResponse.json(
        {
          error: "Request timeout",
          details: error.message,
          suggestion:
            "The database query is taking too long. This may indicate a performance issue. Please try again or contact support.",
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch group criteria", details: error.message },
      { status: 500 }
    );
  }
}
//@ts-ignore
export async function POST(
  request: Request,
  context: { params: Promise<{ course_slug: string }> }
) {
  try {
    const params = await context.params;
    const { course_slug } = params;
    if (!course_slug || typeof course_slug !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid course_slug" },
        { status: 400 }
      );
    }

    const data = await request.json();

    const criteria = await createCriteria(course_slug, {
      name: data.name,
      userId: data.userId,
      date: new Date(data.date),
      scoringRange: data.scoringRange,
      passingScore: data.passingScore,
      isGroupCriteria: true,
      isRecitationCriteria: false,
      rubrics: Array.isArray(data.rubrics)
        ? data.rubrics.map((r: any) => ({
            name: r.name,
            percentage: r.weight ?? r.percentage,
          }))
        : [],
    });

    return NextResponse.json(criteria);
  } catch (error: any) {
    console.error("Error creating group criteria:", error);
    if (error.message.includes("not found")) {
      return NextResponse.json(
        { error: error.message, details: error.message },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create group criteria", details: error.message },
      { status: 500 }
    );
  }
}
