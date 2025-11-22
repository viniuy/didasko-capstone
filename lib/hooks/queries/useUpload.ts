"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "@/lib/axios";
import { queryKeys } from "./queryKeys";
import { UploadResponse, DeleteImageResponse } from "@/shared/types/upload";
import toast from "react-hot-toast";

// Mutation: Upload image
export function useUploadImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      // Note: userId is not needed - API gets it from session

      const { data } = await axios.post<UploadResponse>("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.current() });
      toast.success("Image uploaded successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to upload image");
    },
  });
}

// Mutation: Delete image
export function useDeleteImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (imageUrl: string) => {
      const { data } = await axios.delete<DeleteImageResponse>("/upload", {
        data: { imageUrl },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.current() });
      toast.success("Image deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to delete image");
    },
  });
}

// Legacy exports for backward compatibility
export const useUpload = useUploadImage;
export const useDeleteUpload = useDeleteImage;
