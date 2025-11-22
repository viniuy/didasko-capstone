"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "@/lib/axios";
import { queryKeys } from "./queryKeys";
import toast from "react-hot-toast";

// Query: Get current user profile
export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile.current(),
    queryFn: async () => {
      // Note: Adjust endpoint based on your actual API route
      // This might need to use session data instead
      const { data } = await axios.get("/profile");
      return data;
    },
  });
}

// Mutation: Update profile
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profileData: { image?: string | null }) => {
      const { data } = await axios.put("/profile", profileData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.current() });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
      toast.success("Profile updated successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to update profile");
    },
  });
}
