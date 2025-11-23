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
    const users = await prisma.user.findMany({
      where: {
        role: {
          in: ["FACULTY", "ACADEMIC_HEAD"],
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        workType: true,
        role: true,
        image: true,
        coursesTeaching: {
          include: {
            schedules: true,
            students: {
              select: {
                id: true,
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
