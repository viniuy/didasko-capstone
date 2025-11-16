import { NextResponse } from "next/server";
import { getCriteria, createCriteria } from "@/lib/services";
//@ts-ignore
export async function GET(request: Request, context: { params }) {
  try {
    const { course_slug } = await context.params;
    if (!course_slug || typeof course_slug !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid course_slug" },
        { status: 400 }
      );
    }

    const criteria = await getCriteria(course_slug);

    if (!criteria) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    return NextResponse.json(criteria);
  } catch (error: any) {
    console.error("Error fetching criteria:", error);
    return NextResponse.json(
      { error: "Failed to fetch criteria", details: error.message },
      { status: 500 }
    );
  }
}
//@ts-ignore
export async function POST(request: Request, context: { params }) {
  try {
    const { course_slug } = await context.params;
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
      isGroupCriteria: false,
      rubrics: Array.isArray(data.rubrics)
        ? data.rubrics.map((r: any) => ({
            name: r.name,
            percentage: r.weight ?? r.percentage,
          }))
        : [],
    });

    return NextResponse.json(criteria);
  } catch (error: any) {
    console.error("Error creating criteria:", error);
    if (error.message.includes("not found")) {
      return NextResponse.json(
        { error: error.message, details: error.message },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create criteria", details: error.message },
      { status: 500 }
    );
  }
}
