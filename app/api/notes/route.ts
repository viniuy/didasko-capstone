import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import {
  Note,
  NoteCreateInput,
  NoteUpdateInput,
  NoteResponse,
} from "@/shared/types/note";

const MAX_NOTES_PER_USER = 30;

// ✅ Utility to transform Prisma note into serializable format
function serializeNote(note: {
  id: string;
  title: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}): Note {
  return {
    ...note,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

// ✅ GET: Fetch paginated notes

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const skip = (page - 1) * limit;

    const total = await prisma.note.count({
      where: { userId: session.user.id },
    });

    const notesFromDb = await prisma.note.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    const transformedNotes: Note[] = notesFromDb.map((note) =>
      serializeNote(note)
    );

    const response: NoteResponse = {
      notes: transformedNotes,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 }
    );
  }
}

// ✅ POST: Create note
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: NoteCreateInput = await request.json();
    const { title, description, userId } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (userId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to create note for another user" },
        { status: 403 }
      );
    }

    // Check if user has reached the maximum number of notes
    const noteCount = await prisma.note.count({
      where: { userId: session.user.id },
    });

    if (noteCount >= MAX_NOTES_PER_USER) {
      return NextResponse.json(
        {
          error: `Maximum limit of ${MAX_NOTES_PER_USER} notes reached. Please delete some notes before creating new ones.`,
        },
        { status: 400 }
      );
    }

    const createdNote = await prisma.note.create({
      data: {
        title,
        description: description || null,
        userId,
      },
    });

    const transformedNote = serializeNote(createdNote);
    return NextResponse.json({ note: transformedNote });
  } catch (error) {
    console.error("Error creating note:", error);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}

// ✅ PUT: Update note
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: NoteUpdateInput = await request.json();
    const { id, title, description } = body;

    if (!id || !title) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check ownership first
    const existingNote = await prisma.note.findUnique({ where: { id } });
    if (!existingNote || existingNote.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Note not found or unauthorized" },
        { status: 403 }
      );
    }

    const updatedNote = await prisma.note.update({
      where: { id },
      data: { title, description },
    });

    const transformedNote = serializeNote(updatedNote);
    return NextResponse.json({ note: transformedNote });
  } catch (error) {
    console.error("Error updating note:", error);
    return NextResponse.json(
      { error: "Failed to update note" },
      { status: 500 }
    );
  }
}

// ✅ DELETE: Delete note
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body as { id?: string };

    if (!id) {
      return NextResponse.json(
        { error: "Note ID is required" },
        { status: 400 }
      );
    }

    const noteToDelete = await prisma.note.findUnique({ where: { id } });
    if (!noteToDelete) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    if (noteToDelete.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Not authorized to delete this note" },
        { status: 403 }
      );
    }

    await prisma.note.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting note:", error);
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    );
  }
}
