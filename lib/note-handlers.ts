import axiosInstance from "axios";

interface NoteData {
  id?: string;
  title: string;
  description: string;
}

interface HandlerResult {
  success: boolean;
  error?: string;
}

export async function handleSaveNewNote(
  noteData: NoteData,
  userId: string,
  onSuccess: () => void
): Promise<HandlerResult> {
  try {
    if (!noteData.title.trim()) {
      return { success: false, error: "Title is required" };
    }

    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    await axiosInstance.post("/api/notes", {
      title: noteData.title,
      description: noteData.description,
      userId,
    });

    onSuccess();
    return { success: true };
  } catch (error) {
    console.error("Error saving note:", error);
    return { success: false, error: "Failed to save note" };
  }
}

export async function handleUpdateNote(
  noteData: NoteData,
  _userId: string,
  onSuccess: () => void
): Promise<HandlerResult> {
  try {
    if (!noteData.id) {
      return { success: false, error: "Note ID is required" };
    }

    if (!noteData.title.trim()) {
      return { success: false, error: "Title is required" };
    }

    const response = await axiosInstance.put("/api/notes", {
      id: noteData.id,
      title: noteData.title,
      description: noteData.description,
    });

    onSuccess();
    return { success: true };
  } catch (error) {
    console.error("Error updating note:", error);
    return { success: false, error: "Failed to update note" };
  }
}

export async function handleDeleteNote(
  noteId: string,
  _userId: string,
  onSuccess: () => void
): Promise<HandlerResult> {
  try {
    console.log("Attempting to delete note with ID:", noteId);

    if (!noteId) {
      console.log("Error: Note ID is required");
      return { success: false, error: "Note ID is required" };
    }

    await axiosInstance.delete("/notes", {
      data: { id: noteId },
    });

    console.log("Note deleted successfully");
    onSuccess();
    return { success: true };
  } catch (error) {
    console.error("Error deleting note:", error);
    return { success: false, error: "Failed to delete note" };
  }
}
