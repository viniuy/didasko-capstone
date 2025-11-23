import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { saveAssessmentScoresBulk } from "@/lib/services";

// POST - Save multiple assessment scores at once

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ course_slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { course_slug } = await params;
    const body = await req.json();
    const { scores } = body; // Array of { studentId, assessmentId, score }

    if (!Array.isArray(scores)) {
      return NextResponse.json(
        { error: "scores must be an array" },
        { status: 400 }
      );
    }

    try {
      const result = await saveAssessmentScoresBulk(course_slug, scores);
      return NextResponse.json(result);
    } catch (error: any) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (
        error.message.includes("exceeds max score") ||
        error.message.includes("Invalid assessment")
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
  } catch (error: any) {
    console.error("Error saving bulk assessment scores:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save scores" },
      { status: 500 }
    );
  }
}
