import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getAssessmentScores } from "@/lib/services";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ course_slug: string }> }
) {
  try {
    const { course_slug } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const scoresMap = await getAssessmentScores(course_slug);

    if (!scoresMap) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    return NextResponse.json(scoresMap);
  } catch (error) {
    console.error("Error loading assessment scores:", error);
    return NextResponse.json(
      { error: "Failed to load scores" },
      { status: 500 }
    );
  }
}

import { saveAssessmentScore } from "@/lib/services";

// PUT - Save or update a single assessment score
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ course_slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { studentId, assessmentId, score } = body;

    // Validate required fields
    if (!studentId || !assessmentId) {
      return NextResponse.json(
        { error: "studentId and assessmentId are required" },
        { status: 400 }
      );
    }

    try {
      const result = await saveAssessmentScore({
        studentId,
        assessmentId,
        score,
      });

      return NextResponse.json(result);
    } catch (error: any) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes("cannot exceed")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
  } catch (error: any) {
    console.error("Error saving assessment score:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save score" },
      { status: 500 }
    );
  }
}
