import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getTermConfigs, saveTermConfigs } from "@/lib/services";

// ✅ GET ROUTE

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ course_slug: string }> }
) {
  const { course_slug } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const termConfigs = await getTermConfigs(course_slug);

  if (!termConfigs) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  return NextResponse.json(termConfigs);
}

// ✅ POST ROUTE
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ course_slug: string }> }
) {
  try {
    const { course_slug } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const termConfigs = body.termConfigs;

    try {
      await saveTermConfigs(course_slug, termConfigs);
      return NextResponse.json({ success: true });
    } catch (error: any) {
      if (error.message.includes("Weights must total")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      throw error;
    }
  } catch (error: any) {
    console.error("Error saving term configs:", error);
    return NextResponse.json(
      {
        error: "Failed to save configurations",
        details: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
