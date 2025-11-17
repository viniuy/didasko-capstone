import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body = await request.json();
    const { image } = body;

    if (typeof image !== "string" && image !== null) {
      return NextResponse.json(
        { error: "Invalid image URL" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    await prisma.user.update({
      where: { email: session.user.email },
      data: { image },
    });

    return NextResponse.json(
      { message: "Profile updated successfully" },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: { "Cache-Control": "no-store" } }
  );
}
