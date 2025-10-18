import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@/lib/types";

export async function GET() {
  try {
    // Get all faculty members (users with FACULTY role)
    const facultyMembers = await prisma.user.findMany({
      where: {
        role: Role.FACULTY,
      },
      select: {
        workType: true,
      },
    });

    // Count faculty by work type
    const fullTime = facultyMembers.filter(
      (user) => user.workType === "FULL_TIME"
    ).length;
    const partTime = facultyMembers.filter(
      (user) => user.workType === "PART_TIME"
    ).length;

    return NextResponse.json({ fullTime, partTime });
  } catch (error) {
    console.error("Error fetching faculty count:", error);
    return NextResponse.json(
      { error: "Failed to fetch faculty count" },
      { status: 500 }
    );
  }
}
