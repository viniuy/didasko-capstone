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

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log("Processing DELETE request for note with ID:", params.id);

    if (!params.id) {
      console.log("Error: Note ID is missing from request");
      return NextResponse.json(
        { error: "Note ID is required" },
        { status: 400 }
      );
    }

    // Get session
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    console.log("Session email:", email);

    // Get user ID from email
    const userId = await getUserIdByEmail(email || "admin@example.com");
    console.log("Resolved user ID:", userId);

    if (!userId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Find the note first to check if it exists
    const noteToDelete = await prisma.note.findUnique({
      where: {
        id: params.id,
      },
    });

    if (!noteToDelete) {
      console.log(`Note with ID ${params.id} not found`);
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    console.log(
      `Found note to delete: ${noteToDelete.id}, owner: ${noteToDelete.userId}`
    );

    // Check if the note belongs to the user
    if (noteToDelete.userId !== userId) {
      console.log(`Note belongs to user ${noteToDelete.userId}, not ${userId}`);
      return NextResponse.json(
        { error: "Not authorized to delete this note" },
        { status: 403 }
      );
    }

    // Delete the note
    await prisma.note.delete({
      where: {
        id: params.id,
      },
    });

    console.log(`Successfully deleted note with ID ${params.id}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting note:", error);
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    );
  }
}
