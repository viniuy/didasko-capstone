import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getGroupStudents } from "@/lib/services";
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
    const { group_id } = params;

    const students = await getGroupStudents(group_id);

    return NextResponse.json({
      students,
      studentCount: students.length,
    });
  } catch (error) {
    console.error("Error fetching group students:", error);
    return NextResponse.json(
      { error: "Failed to fetch group students" },
      { status: 500 }
    );
  }
}
