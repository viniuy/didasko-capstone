import { NextRequest, NextResponse } from "next/server";
import { getCriteriaLinks } from "@/lib/services";


// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(
  req: NextRequest,
  { params }: { params: { course_slug: string } }
) {
  try {
    const { course_slug } = params;

    const result = await getCriteriaLinks(course_slug);

    if (!result) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Failed to load criteria links:", error);
    return NextResponse.json(
      { error: "Failed to load linked criteria", details: error.message },
      { status: 500 }
    );
  }
}
