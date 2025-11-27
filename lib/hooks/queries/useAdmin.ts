"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "@/lib/axios";
import { queryKeys } from "./queryKeys";
import { UserCreateInput } from "@/shared/types/user";
import toast from "react-hot-toast";

// Query: Get all users
export function useUsers(options?: {
  filters?: {
    search?: string;
    role?: string;
    department?: string;
  };
  initialData?: any;
  refetchOnMount?: boolean;
  refetchOnWindowFocus?: boolean;
}) {
  const {
    filters,
    initialData,
    refetchOnMount = true,
    refetchOnWindowFocus = true,
  } = options || {};

  return useQuery({
    queryKey: queryKeys.admin.users(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.search) params.append("search", filters.search);
      if (filters?.role) params.append("role", filters.role);
      if (filters?.department) params.append("department", filters.department);

      const { data } = await axios.get(`/users?${params.toString()}`);
      return data;
    },
    initialData,
    refetchOnMount,
    refetchOnWindowFocus,
  });
}

// Query: Get faculty users
export function useFaculty(options?: {
  filters?: { department?: string; search?: string };
  initialData?: any;
  refetchOnMount?: boolean;
  refetchOnWindowFocus?: boolean;
}) {
  const {
    filters,
    initialData,
    refetchOnMount = true,
    refetchOnWindowFocus = true,
  } = options || {};

  return useQuery({
    queryKey: queryKeys.admin.faculty(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.department) params.append("department", filters.department);
      if (filters?.search) params.append("search", filters.search);

      const { data } = await axios.get(`/users/faculty?${params.toString()}`);
      return data;
    },
    initialData,
    refetchOnMount,
    refetchOnWindowFocus,
  });
}

// Query: Get online users
export function useOnlineUsers() {
  return useQuery({
    queryKey: queryKeys.admin.online(),
    queryFn: async () => {
      const { data } = await axios.get("/users/online");
      return data;
    },
  });
}

// Query: Get break glass status
export function useBreakGlassStatus(
  userId?: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.admin.breakGlass(userId),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userId) params.append("userId", userId);
      const { data } = await axios.get(
        `/break-glass/status?${params.toString()}`
      );
      return data;
    },
    enabled: options?.enabled !== false, // Default to true, can be disabled
    refetchInterval: 30000, // Poll every 30 seconds
  });
}

// Mutation: Create user
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UserCreateInput) => {
      const { data } = await axios.post("/users", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.faculty() });
      toast.success("User created successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to create user");
    },
  });
}

// Mutation: Update user
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<UserCreateInput>;
    }) => {
      const { data: response } = await axios.put(`/users/${id}`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.faculty() });
      toast.success("User updated successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to update user");
    },
  });
}

// Mutation: Delete user
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/users/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.faculty() });
      toast.success("User deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to delete user");
    },
  });
}

// Mutation: Import users
export function useImportUsers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (users: any[]) => {
      const { data } = await axios.post("/users/import", users);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.faculty() });
      toast.success("Users imported successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to import users");
    },
  });
}

// Mutation: Export users
export function useExportUsers() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await axios.get("/users/export", {
        responseType: "blob",
      });
      return data;
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to export users");
    },
  });
}

// Mutation: Activate break glass
export function useActivateBreakGlass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      facultyUserId,
      reason,
    }: {
      facultyUserId: string;
      reason: string;
    }) => {
      const { data } = await axios.post("/break-glass/activate", {
        facultyUserId,
        reason,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.breakGlass() });
      toast.success("Break glass activated successfully");
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error || "Failed to activate break glass"
      );
    },
  });
}

// Mutation: Deactivate break glass
export function useDeactivateBreakGlass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await axios.post("/break-glass/deactivate", {
        userId,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.breakGlass() });
      toast.success("Break glass deactivated successfully");
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error || "Failed to deactivate break glass"
      );
    },
  });
}

// Mutation: Promote user
export function usePromoteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      promotionCode,
    }: {
      userId: string;
      promotionCode: string;
    }) => {
      const { data } = await axios.post("/break-glass/promote", {
        userId,
        promotionCode,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.breakGlass() });
      toast.success("User promoted successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to promote user");
    },
  });
}

// Mutation: Self-promote (break-glass)
export function useSelfPromote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ promotionCode }: { promotionCode: string }) => {
      const { data } = await axios.post("/break-glass/self-promote", {
        promotionCode,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.breakGlass() });
      toast.success("Break-glass access activated successfully");
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error || "Failed to activate break-glass access"
      );
    },
  });
}
