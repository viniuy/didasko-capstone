import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
//@ts-ignore
export async function PUT(request: Request, { params }: { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { studentId } = await Promise.resolve(params);
    const { imageUrl } = await request.json();

    // Update the student's image in the database
    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: { image: imageUrl },
    });

    return NextResponse.json(updatedStudent);
  } catch (error) {
    console.error("Error updating student image:", error);
    return NextResponse.json(
      { error: "Failed to update student image" },
      { status: 500 }
    );
  }
}
