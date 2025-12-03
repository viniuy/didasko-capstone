import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get faculty and academic head users
    // Optimized: Use _count instead of loading all courses/students to reduce query time
    const users = await prisma.user.findMany({
      where: {
        roles: {
          hasSome: ["FACULTY", "ACADEMIC_HEAD"],
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        workType: true,
        roles: true,
        image: true,
        // Return only lightweight course info and relation counts to avoid
        // loading large nested arrays (schedules/students) which can be
        // expensive for faculty with many courses or large classes.
        coursesTeaching: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            code: true,
            title: true,
            section: true,
            slug: true,
            semester: true,
            status: true,
            _count: {
              select: {
                students: true,
                schedules: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching faculty:", error);
    return NextResponse.json(
      { error: "Failed to fetch faculty" },
      { status: 500 }
    );
  }
}
