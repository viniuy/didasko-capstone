"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "@/lib/axios";
import { queryKeys } from "./queryKeys";
import { Note, NoteCreateInput, NoteUpdateInput } from "@/shared/types/note";
import toast from "react-hot-toast";

// Query: Get all notes
export function useNotes(options?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: [...queryKeys.notes.lists(), options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.page) params.append("page", options.page.toString());
      if (options?.limit) params.append("limit", options.limit.toString());

      const { data } = await axios.get(`/notes?${params.toString()}`);
      return data;
    },
  });
}

// Query: Get note detail
export function useNote(id: string) {
  return useQuery({
    queryKey: queryKeys.notes.detail(id),
    queryFn: async () => {
      const { data } = await axios.get<Note>(`/notes/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// Mutation: Create note
export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NoteCreateInput) => {
      const { data } = await axios.post<Note>("/notes", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.lists() });
      toast.success("Note created successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to create note");
    },
  });
}

// Mutation: Update note
export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NoteUpdateInput) => {
      const { data } = await axios.put<{ note: Note }>("/notes", input);
      return data.note;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notes.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.lists() });
      toast.success("Note updated successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to update note");
    },
  });
}

// Mutation: Delete note
export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await axios.delete("/notes", {
        data: { id },
      });
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.lists() });
      toast.success("Note deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to delete note");
    },
  });
}
