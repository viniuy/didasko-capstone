import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getGroups, createGroup } from "@/lib/services";
import { revalidatePath } from "next/cache";

//@ts-ignore

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request, context: { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await Promise.resolve(context.params);
    const { course_slug } = params;

    const body = await request.json();
    const { groupNumber, groupName, studentIds, leaderId } = body;

    try {
      const group = await createGroup(course_slug, {
        groupNumber,
        groupName,
        studentIds,
        leaderId,
      });

      // Serialize BigInt fields to strings
      const serializedGroup = {
        ...group,
        students: group.students?.map((student: any) => ({
          ...student,
          rfid_id: student.rfid_id ? String(student.rfid_id) : null,
        })),
        leader: group.leader
          ? {
              ...group.leader,
              rfid_id: group.leader.rfid_id
                ? String(group.leader.rfid_id)
                : null,
            }
          : null,
      };

      // Revalidate the cache for this course's pages
      revalidatePath(`/main/grading/reporting/${course_slug}`);

      // Add a small delay to ensure DB transaction completes
      await new Promise((resolve) => setTimeout(resolve, 100));

      return NextResponse.json(serializedGroup, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    } catch (error: any) {
      if (error.message.includes("already exists")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      console.error("Error in inner catch (createGroup):", {
        message: error.message,
        stack: error.stack,
        course_slug,
        body,
      });
      throw error;
    }
  } catch (error: any) {
    const params = await Promise.resolve(context.params);
    console.error("Error creating group (outer catch):", {
      message: error.message,
      stack: error.stack,
      course_slug: params?.course_slug,
    });
    return NextResponse.json(
      { error: error.message || "Failed to create group" },
      { status: 500 }
    );
  }
}

//@ts-ignore
export async function GET(request: Request, context: { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await Promise.resolve(context.params);
    const { course_slug } = params;

    const groups = await getGroups(course_slug);

    if (!groups) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    return NextResponse.json(groups, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Error fetching groups:", error);
    return NextResponse.json(
      { error: "Failed to fetch groups" },
      { status: 500 }
    );
  }
}
