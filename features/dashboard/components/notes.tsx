"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AnimatedContent from "@/components/ui/AnimatedContent";
import { Loader2 } from "lucide-react";
import { gsap } from "gsap";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { Trash, Edit, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import {
  useNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
} from "@/lib/hooks/queries";

interface Note {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
}

const MAX_NOTES_PER_USER = 30;

// Helper function to format date in a subtle way
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) {
    return "Today";
  } else if (diffInDays === 1) {
    return "Yesterday";
  } else if (diffInDays < 7) {
    return `${diffInDays} days ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
}

export default function Notes() {
  const { data: session, status } = useSession();
  const [openDelete, setOpenDelete] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const noteRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const [openEdit, setOpenEdit] = useState(false);
  const [editData, setEditData] = useState<Note>({
    id: "",
    title: "",
    description: "",
    createdAt: "",
  });
  const [openAdd, setOpenAdd] = useState(false);
  const [openUnsavedChanges, setOpenUnsavedChanges] = useState(false);
  const [pendingAction, setPendingAction] = useState<"open" | "close" | null>(
    null
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [newNote, setNewNote] = useState<Note>({
    id: "",
    title: "",
    description: "",
    createdAt: "",
  });

  // React Query hooks
  const { data: notesData, isLoading } = useNotes();
  const createNoteMutation = useCreateNote();
  const updateNoteMutation = useUpdateNote();
  const deleteNoteMutation = useDeleteNote();

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(hasChanges(newNote));
  }, [newNote]);

  // Extract notes from response
  const noteList = notesData?.notes || [];
  const totalNotes = notesData?.pagination?.total || noteList.length;
  const hasReachedMaxNotes = totalNotes >= MAX_NOTES_PER_USER;

  // Function to check for unsaved changes
  const hasChanges = (note: Note) => {
    return note.title !== "" || note.description !== "";
  };

  // Function to reset new note form
  const resetNewNoteForm = () => {
    setNewNote({
      id: "",
      title: "",
      description: "",
      createdAt: "",
    });
    setHasUnsavedChanges(false);
  };

  // Function to handle unsaved changes response
  const handleUnsavedChangesResponse = (keepChanges: boolean) => {
    if (!keepChanges) {
      resetNewNoteForm();
    }

    if (pendingAction === "open") {
      setOpenAdd(true);
    } else if (pendingAction === "close") {
      // If keeping changes, re-open the modal; otherwise close it
      setOpenAdd(keepChanges);
    }

    setOpenUnsavedChanges(false);
    setPendingAction(null);
  };

  // Function to show alert notifications
  const showAlert = (
    title: string,
    description: string,
    variant: "success" | "error" = "success"
  ) => {
    if (variant === "success") {
      toast.success(description);
    } else {
      toast.error(description, {
        style: {
          background: "#fff",
          color: "#dc2626",
          border: "1px solid #e5e7eb",
          boxShadow:
            "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          borderRadius: "0.5rem",
          padding: "1rem",
        },
        iconTheme: {
          primary: "#dc2626",
          secondary: "#fff",
        },
      });
    }
  };

  // Loading state with spinner
  if (status === "loading" || isLoading)
    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-lg font-semibold text-[#FAEDCB]">Notes</h2>
        </div>
        <div className="flex-1 bg-white rounded-lg p-2 shadow-md overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#124A69] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#0a2f42]">
          <div className="flex items-center justify-center h-full min-h-[200px]">
            <Loader2 className="w-8 h-8 animate-spin text-[#124A69]" />
          </div>
        </div>
      </div>
    );

  if (status === "unauthenticated") {
    return <div>Please sign in to view notes</div>;
  }

  function handleAddClick() {
    if (hasReachedMaxNotes) {
      showAlert(
        "Error",
        `Maximum limit of ${MAX_NOTES_PER_USER} notes reached. Please delete some notes before creating new ones.`,
        "error"
      );
      return;
    }
    if (hasUnsavedChanges) {
      setPendingAction("open");
      setOpenUnsavedChanges(true);
    } else {
      setOpenAdd(true);
    }
  }

  const saveNewNote = async () => {
    if (!newNote.title.trim()) {
      showAlert("Error", "Title is required", "error");
      return;
    }

    if (!session?.user?.id) {
      showAlert("Error", "User ID not found. Please sign in again.", "error");
      return;
    }

    if (hasReachedMaxNotes) {
      showAlert(
        "Error",
        `Maximum limit of ${MAX_NOTES_PER_USER} notes reached. Please delete some notes before creating new ones.`,
        "error"
      );
      return;
    }

    try {
      setIsSaving(true);
      await createNoteMutation.mutateAsync({
        title: newNote.title,
        description: newNote.description || null,
        userId: session.user.id,
      });
      resetNewNoteForm();
      setOpenAdd(false);
    } catch (error) {
      // Error is handled by the mutation hook
    } finally {
      setIsSaving(false);
    }
  };

  function handleDeleteClick(noteId: string) {
    setNoteToDelete(noteId);
    setOpenDelete(true);
  }

  async function confirmDelete() {
    if (!noteToDelete) {
      return;
    }

    try {
      setOpenDelete(false);
      setDeletingNoteId(noteToDelete);

      // Get the note element
      const noteElement = noteRefs.current.get(noteToDelete);
      if (noteElement) {
        // Animate slide to the right
        await gsap.to(noteElement, {
          x: 150,
          opacity: 0,
          scale: 0.8,
          duration: 0.5,
          ease: "power3.in",
        });
      }

      // Delete the note after animation
      await deleteNoteMutation.mutateAsync(noteToDelete);
      setNoteToDelete(null);
      setDeletingNoteId(null);
    } catch (error) {
      // Error is handled by the mutation hook
      setDeletingNoteId(null);
    }
  }

  function handleEditClick(note: Note) {
    setEditData(note);
    setOpenEdit(true);
  }

  const saveEdit = async () => {
    if (!editData.title.trim()) {
      showAlert("Error", "Title is required", "error");
      return;
    }

    if (!editData.id) {
      showAlert("Error", "Note ID not found", "error");
      return;
    }

    if (!session?.user?.id) {
      showAlert("Error", "User ID not found. Please sign in again.", "error");
      return;
    }

    try {
      await updateNoteMutation.mutateAsync({
        id: editData.id,
        title: editData.title,
        description: editData.description || null,
        userId: session.user.id,
      });
      setOpenEdit(false);
    } catch (error) {
      // Error is handled by the mutation hook
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-lg font-semibold text-[#FAEDCB]">Notes</h2>
        <Button
          variant="ghost"
          size="icon"
          className="text-[#FAEDCB] hover:text-white hover:bg-[#0a2f42] disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleAddClick}
          disabled={hasReachedMaxNotes}
          title={
            hasReachedMaxNotes
              ? `Maximum ${MAX_NOTES_PER_USER} notes reached. Delete some notes to create new ones.`
              : "Add new note"
          }
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>
      {hasReachedMaxNotes && (
        <p className="text-xs text-amber-600 mb-1 px-1">
          Maximum {MAX_NOTES_PER_USER} notes reached ({totalNotes}/
          {MAX_NOTES_PER_USER}). Delete some notes to create new ones.
        </p>
      )}
      <div className="flex-1 bg-white rounded-lg p-2 shadow-md overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#124A69] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#0a2f42]">
        {noteList.length > 0 ? (
          noteList.map((note: Note, index: number) => (
            <AnimatedContent
              key={note.id}
              distance={150}
              direction="horizontal"
              reverse={true}
              duration={1.2}
              ease="power3.out"
              initialOpacity={0.2}
              animateOpacity
              scale={1.1}
              threshold={0.2}
              delay={0.3 + index * 0.1}
              container="snap-main-container"
              onComplete={() => {}}
              onDisappearanceComplete={() => {}}
            >
              <div
                ref={(el) => {
                  if (el) {
                    noteRefs.current.set(note.id, el);
                  } else {
                    noteRefs.current.delete(note.id);
                  }
                }}
              >
                <Card className="border-l-[8px] border-[#FAEDCB] mb-1 hover:shadow-md transition-shadow">
                  <CardContent className="p-2 relative">
                    <div className="absolute right-1 -top-5 flex gap-0.5">
                      <Button
                        variant="ghost"
                        className="h-5 w-5 p-0 hover:bg-transparent"
                        onClick={() => handleEditClick(note)}
                        disabled={
                          deleteNoteMutation.isPending &&
                          noteToDelete === note.id
                        }
                      >
                        <Edit className="h-3 w-3" color="#124a69" />
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-5 w-5 p-0 hover:bg-transparent"
                        onClick={() => handleDeleteClick(note.id)}
                        disabled={
                          deleteNoteMutation.isPending &&
                          noteToDelete === note.id
                        }
                      >
                        {deleteNoteMutation.isPending &&
                        noteToDelete === note.id ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#124A69]" />
                        ) : (
                          <Trash className="h-3 w-3" color="#124a69" />
                        )}
                      </Button>
                    </div>
                    <div className="-mt-4 -mb-4">
                      <div className="text-[#124A69] font-medium text-xs mb-0.5">
                        {note.title}
                      </div>
                      <div className="text-gray-600 text-[11px] whitespace-pre-wrap">
                        {note.description}
                      </div>
                      <div className="text-gray-400 text-[10px] mt-1.5">
                        {formatDate(note.createdAt)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </AnimatedContent>
          ))
        ) : (
          <div className="flex items-center justify-center h-full min-h-[200px]">
            <p className="text-gray-500 text-xs text-center">No notes yet.</p>
          </div>
        )}
      </div>

      <AlertDialog open={openDelete} onOpenChange={setOpenDelete}>
        <AlertDialogContent className="">
          <AlertDialogHeader className="">
            <AlertDialogTitle className="text-xl font-semibold">
              Are you sure?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              This action cannot be undone. This will permanently delete the
              note.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              onClick={() => setOpenDelete(false)}
              className="border-0 bg-gray-100 hover:bg-gray-200 text-gray-900"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-[#124A69] hover:bg-[#0a2f42] text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={openEdit} onOpenChange={setOpenEdit}>
        <AlertDialogContent className="max-w-[425px] w-full h-[400px]">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-xl font-semibold">
              Edit Note
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Title <span className="text-red-500"> *</span>
              </Label>
              <Input
                placeholder="Title"
                value={editData.title}
                onChange={(e) => {
                  if (e.target.value.length <= 20) {
                    setEditData({ ...editData, title: e.target.value });
                  }
                }}
                className="rounded-lg"
              />
              <p className="text-xs flex justify-end mt-2 text-gray-500">
                {editData.title.length}/20
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">
                Details <span className="text-gray-400">(optional)</span>
              </Label>
              <Textarea
                placeholder="Add your details"
                className="resize-none min-h-[100px] max-h-[100px] overflow-y-auto w-full break-words rounded-lg"
                value={editData.description || ""}
                onChange={(e) => {
                  if (e.target.value.length <= 30) {
                    setEditData({ ...editData, description: e.target.value });
                  }
                }}
              />
              <p className="text-xs flex justify-end mt-2 text-gray-500">
                {(editData.description || "").length}/30
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setOpenAdd(false)}
              className="bg-gray-100 text-gray-700 hover:bg-gray-200 h-8 text-xs"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={saveEdit}
              className="bg-[#124A69] text-white hover:bg-[#0a2f42] h-8 text-xs"
              disabled={!editData.title.trim()}
            >
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={openAdd}
        onOpenChange={(open) => {
          // Check for unsaved changes first before any other conditions
          // But don't check if we're currently saving
          if (!open && hasUnsavedChanges && !isSaving) {
            setPendingAction("close");
            setOpenUnsavedChanges(true);
            return;
          }
          setOpenAdd(open);
        }}
      >
        <AlertDialogContent className="max-w-[425px] w-full h-[400px]">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-xl font-semibold">
              Add New Note
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Title <span className="text-red-500"> *</span>
              </Label>
              <Input
                placeholder="Title"
                value={newNote.title}
                onChange={(e) => {
                  if (e.target.value.length <= 20) {
                    setNewNote({ ...newNote, title: e.target.value });
                  }
                }}
                className="rounded-lg"
              />
              <p className="text-xs flex justify-end mt-2 text-gray-500">
                {newNote.title.length}/20
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">
                Details <span className="text-gray-400">(optional)</span>
              </Label>
              <Textarea
                placeholder="Add your details"
                className="resize-none min-h-[100px] max-h-[200px] overflow-y-auto w-full break-words whitespace-pre-wrap rounded-lg"
                value={newNote.description || ""}
                onChange={(e) => {
                  if (e.target.value.length <= 30) {
                    setNewNote({ ...newNote, description: e.target.value });
                  }
                }}
              />
              <p className="text-xs flex justify-end mt-2 text-gray-500">
                {(newNote.description || "").length}/30
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setOpenAdd(false)}
              className="bg-gray-100 text-gray-700 hover:bg-gray-200 h-8 text-xs"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={saveNewNote}
              className="bg-[#124A69] text-white hover:bg-[#0a2f42] h-8 text-xs"
              disabled={!newNote.title.trim()}
            >
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={openUnsavedChanges}
        onOpenChange={setOpenUnsavedChanges}
      >
        <AlertDialogContent className="">
          <AlertDialogHeader className="">
            <AlertDialogTitle className="text-xl font-semibold">
              Unsaved Changes
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              You have unsaved changes. Do you want to keep or discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              onClick={() => {
                handleUnsavedChangesResponse(false);
              }}
              className="border-0 bg-gray-100 hover:bg-gray-200 text-gray-900"
            >
              Exit without saving
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handleUnsavedChangesResponse(true);
              }}
              className="bg-[#124A69] hover:bg-[#0a2f42] text-white"
            >
              Continue editing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
