"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import axios from "@/lib/axios";
import { queryKeys } from "./queryKeys";
import toast from "react-hot-toast";

// Query: Get audit logs with optional filters
export function useAuditLogs(filters?: {
  page?: number;
  pageSize?: number;
  action?: string;
  actions?: string[];
  userId?: string;
  faculty?: string[];
  module?: string;
  modules?: string[];
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: queryKeys.auditLogs.lists(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.page) params.append("p", filters.page.toString());
      if (filters?.pageSize)
        params.append("pageSize", filters.pageSize.toString());
      if (filters?.actions && filters.actions.length > 0) {
        params.append("actions", filters.actions.join(","));
      }
      if (filters?.action) params.append("action", filters.action);
      if (filters?.userId) params.append("userId", filters.userId);
      if (filters?.faculty && filters.faculty.length > 0) {
        params.append("faculty", filters.faculty.join(","));
      }
      if (filters?.modules && filters.modules.length > 0) {
        params.append("modules", filters.modules.join(","));
      }
      if (filters?.module) params.append("module", filters.module);
      if (filters?.startDate) params.append("startDate", filters.startDate);
      if (filters?.endDate) params.append("endDate", filters.endDate);

      const { data } = await axios.get(`/logs?${params.toString()}`);
      return data;
    },
    refetchInterval: 5000, // Poll every 5 seconds
  });
}

// Mutation: Export logs
export function useExportLogs() {
  return useMutation({
    mutationFn: async (filters?: {
      startDate?: Date;
      endDate?: Date;
      actions?: string[];
      modules?: string[];
      faculty?: string[];
    }) => {
      const { data } = await axios.post("/logs/export", filters, {
        responseType: "blob",
      });
      return data;
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to export logs");
    },
  });
}
