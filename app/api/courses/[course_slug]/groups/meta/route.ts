import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getGroupMeta } from "@/lib/services";

//@ts-ignore

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(request: Request, context: { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await Promise.resolve(context.params);
    const { course_slug } = params;

    const meta = await getGroupMeta(course_slug);

    if (!meta) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    return NextResponse.json(meta);
  } catch (error) {
    console.error("Error fetching group meta:", error);
    return NextResponse.json(
      { error: "Failed to fetch group meta" },
      { status: 500 }
    );
  }
}
