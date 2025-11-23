import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// Function to get user ID by email
async function getUserIdByEmail(email: string) {
  if (!email) {
    return null;
  }

  try {
    // Try to find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    // If user found, return ID
    if (user) {
      console.log(`Found user ID ${user.id} for email ${email}`);
      return user.id;
    }

    return null;
  } catch (error) {
    console.error("Error getting user by email:", error);
    return null;
  }
}


// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    console.log("Processing DELETE request for note with ID:", id);

    if (!id) {
      return NextResponse.json(
        { error: "Note ID is required" },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    console.log("Session email:", email);

    const userId = await getUserIdByEmail(email || "admin@example.com");
    console.log("Resolved user ID:", userId);

    if (!userId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const noteToDelete = await prisma.note.findUnique({ where: { id } });

    if (!noteToDelete) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    if (noteToDelete.userId !== userId) {
      return NextResponse.json(
        { error: "Not authorized to delete this note" },
        { status: 403 }
      );
    }

    await prisma.note.delete({ where: { id } });

    console.log(`Successfully deleted note with ID ${id}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting note:", error);
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    );
  }
}
