"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { handleSaveNewNote, handleUpdateNote } from "@/lib/note-handlers";
import { useSession } from "next-auth/react";
import axiosInstance from "axios";
import { Skeleton } from "@/components/ui/skeleton";
import toast from "react-hot-toast";

interface Note {
  id: string;
  title: string;
  description: string | null;
}

export default function Notes() {
  const { data: session, status } = useSession();
  const [noteList, setNoteList] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [openDelete, setOpenDelete] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  const [openEdit, setOpenEdit] = useState(false);
  const [editData, setEditData] = useState<Note>({
    id: "",
    title: "",
    description: "",
  });
  const [openAdd, setOpenAdd] = useState(false);
  const [newNote, setNewNote] = useState<Note>({
    id: "",
    title: "",
    description: "",
  });

  const previousStatus = useRef(status);

  useEffect(() => {
    if (
      (!noteList.length && status === "authenticated") ||
      (status === "authenticated" &&
        previousStatus.current === "unauthenticated")
    ) {
      fetchNotes();
    }

    previousStatus.current = status;
  }, [status, session]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !noteList.length) {
        fetchNotes();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [noteList.length]);

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

  async function fetchNotes() {
    try {
      setIsLoading(true);
      const response = await axiosInstance.get("/api/notes");
      const data = response.data;

      if (Array.isArray(data.notes)) {
        setNoteList(data.notes);
      } else {
        setNoteList([]);
      }
    } catch (error) {
      showAlert("Error", "Failed to fetch notes", "error");
      setNoteList([]);
    } finally {
      setIsLoading(false);
    }
  }

  const refreshNotes = async () => {
    setIsLoading(true);
    await fetchNotes();
    setIsLoading(false);
  };

  // Skeleton UI for loading state
  if (status === "loading" || isLoading)
    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-lg font-semibold text-[#FAEDCB]">Notes</h2>
          <Skeleton className="w-6 h-6 rounded-full" />
        </div>
        <div className="flex-1 bg-white rounded-lg p-2 shadow-md overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#124A69] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#0a2f42]">
          <div className="space-y-2 mt-2">
            {/* First date group */}
            <div className="flex items-center gap-2 text-[#124A69] mb-1">
              <Skeleton className="h-4 w-32" />
            </div>

            {/* First group of note skeletons */}
            {[...Array(2)].map((_, index) => (
              <Card
                key={index}
                className="border-l-[8px] border-[#FAEDCB] mb-1"
              >
                <CardContent className="p-2 relative">
                  <div className="absolute right-1 -top-5 flex gap-0.5">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-5 w-5 rounded-full" />
                  </div>
                  <div className="-mt-4 -mb-4">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Second date group */}
            <div className="flex items-center gap-2 text-[#124A69] mb-1 mt-4">
              <Skeleton className="h-4 w-32" />
            </div>

            {/* Second group of note skeletons */}
            {[...Array(2)].map((_, index) => (
              <Card
                key={`second-${index}`}
                className="border-l-[8px] border-[#FAEDCB] mb-1"
              >
                <CardContent className="p-2 relative">
                  <div className="absolute right-1 -top-5 flex gap-0.5">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-5 w-5 rounded-full" />
                  </div>
                  <div className="-mt-4 -mb-4">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );

  if (status === "unauthenticated") {
    return <div>Please sign in to view notes</div>;
  }

  function handleAddClick() {
    setOpenAdd(true);
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

    const result = await handleSaveNewNote(
      {
        title: newNote.title,
        description: newNote.description || "",
      },
      session.user.id,
      () => {
        setOpenAdd(false);
        setNewNote({
          id: "",
          title: "",
          description: "",
        });
        refreshNotes();
      }
    );

    if (result.success) {
      showAlert("Success", "Note added successfully", "success");
    } else {
      showAlert("Error", result.error || "Failed to add note", "error");
    }
  };

  function handleDeleteClick(noteId: string) {
    setNoteToDelete(noteId);
    setOpenDelete(true);
  }

  async function confirmDelete() {
    try {
      if (!noteToDelete) {
        return;
      }

      setDeletingNoteId(noteToDelete);
      const loadingToast = toast.loading("Deleting note...", {
        style: {
          background: "#fff",
          color: "#124A69",
          border: "1px solid #e5e7eb",
          boxShadow:
            "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          borderRadius: "0.5rem",
          padding: "1rem",
        },
      });

      const response = await axiosInstance.delete(`/api/notes/${noteToDelete}`);

      if (response.status === 200) {
        setOpenDelete(false);
        setNoteToDelete(null);
        refreshNotes();
        toast.success("Note deleted successfully", {
          id: loadingToast,
          style: {
            background: "#fff",
            color: "#124A69",
            border: "1px solid #e5e7eb",
            boxShadow:
              "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
            borderRadius: "0.5rem",
            padding: "1rem",
          },
          iconTheme: {
            primary: "#124A69",
            secondary: "#fff",
          },
        });
      } else {
        toast.error("Failed to delete note", {
          id: loadingToast,
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
    } catch (error) {
      console.error("Error deleting note:", error);
      showAlert("Error", "An error occurred while deleting the note", "error");
    } finally {
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

    if (!session?.user?.id) {
      showAlert("Error", "User ID not found. Please sign in again.", "error");
      return;
    }

    const result = await handleUpdateNote(
      {
        id: editData.id,
        title: editData.title,
        description: editData.description || "",
      },
      session.user.id,
      () => {
        setOpenEdit(false);
        refreshNotes();
      }
    );

    if (result.success) {
      showAlert("Success", "Note updated successfully", "success");
    } else {
      showAlert("Error", result.error || "Failed to update note", "error");
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-lg font-semibold text-[#FAEDCB]">Notes</h2>
        <Button
          variant="ghost"
          size="icon"
          className="text-[#FAEDCB] hover:text-white hover:bg-[#0a2f42]"
          onClick={handleAddClick}
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>
      <div className="flex-1 bg-white rounded-lg p-2 shadow-md overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#124A69] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#0a2f42]">
        {noteList.length > 0 ? (
          noteList.map((note) => (
            <Card
              key={note.id}
              className="border-l-[8px] border-[#FAEDCB] mb-1 hover:shadow-md transition-shadow"
            >
              <CardContent className="p-2 relative">
                <div className="absolute right-1 -top-5 flex gap-0.5">
                  <Button
                    variant="ghost"
                    className="h-5 w-5 p-0 hover:bg-transparent"
                    onClick={() => handleEditClick(note)}
                    disabled={deletingNoteId === note.id}
                  >
                    <Edit className="h-3 w-3" color="#124a69" />
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-5 w-5 p-0 hover:bg-transparent"
                    onClick={() => handleDeleteClick(note.id)}
                    disabled={deletingNoteId === note.id}
                  >
                    {deletingNoteId === note.id ? (
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
                </div>
              </CardContent>
            </Card>
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
                Description <span className="text-gray-400">(optional)</span>
              </Label>
              <Textarea
                placeholder="Add your description"
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

      <AlertDialog open={openAdd} onOpenChange={setOpenAdd}>
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
                Description <span className="text-gray-400">(optional)</span>
              </Label>
              <Textarea
                placeholder="Add your description"
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
    </div>
  );
}
