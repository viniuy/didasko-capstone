"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "@/lib/axios";
import { queryKeys } from "./queryKeys";
import toast from "react-hot-toast";

// Query: Get groups by course
export function useGroupsByCourse(courseSlug: string) {
  return useQuery({
    queryKey: queryKeys.groups.byCourse(courseSlug),
    queryFn: async () => {
      const { data } = await axios.get(`/courses/${courseSlug}/groups`);
      return data;
    },
    enabled: !!courseSlug,
  });
}

// Query: Get groups meta
export function useGroupsMeta(courseSlug: string) {
  return useQuery({
    queryKey: queryKeys.groups.meta(courseSlug),
    queryFn: async () => {
      const { data } = await axios.get(`/courses/${courseSlug}/groups/meta`);
      return data;
    },
    enabled: !!courseSlug,
  });
}

// Query: Get group detail
export function useGroupDetail(courseSlug: string, groupId: string) {
  return useQuery({
    queryKey: queryKeys.groups.detail(courseSlug, groupId),
    queryFn: async () => {
      const { data } = await axios.get(
        `/courses/${courseSlug}/groups/${groupId}`
      );
      return data;
    },
    enabled: !!courseSlug && !!groupId,
  });
}

// Query: Get group students
export function useGroupStudents(courseSlug: string, groupId: string) {
  return useQuery({
    queryKey: queryKeys.groups.students(courseSlug, groupId),
    queryFn: async () => {
      const { data } = await axios.get(
        `/courses/${courseSlug}/groups/${groupId}/students`
      );
      return data;
    },
    enabled: !!courseSlug && !!groupId,
  });
}

// Query: Get group criteria
export function useGroupCriteria(courseSlug: string, groupId: string) {
  return useQuery({
    queryKey: queryKeys.groups.criteria(courseSlug, groupId),
    queryFn: async () => {
      const { data } = await axios.get(
        `/courses/${courseSlug}/groups/${groupId}/criteria`
      );
      return data;
    },
    enabled: !!courseSlug && !!groupId,
  });
}

// Mutation: Create group
export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      courseSlug,
      groupData,
    }: {
      courseSlug: string;
      groupData: {
        groupNumber: number;
        groupName: string;
        studentIds: string[];
        leaderId?: string;
      };
    }) => {
      try {
        const { data } = await axios.post(
          `/courses/${courseSlug}/groups`,
          groupData
        );
        return data;
      } catch (error: any) {
        console.error("useCreateGroup error:", {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          courseSlug,
          groupData,
        });
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.groups.byCourse(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.groups.meta(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.courses.detail(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reporting.group(variables.courseSlug),
      });
      toast.success("Group created successfully");
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.error ||
        error?.message ||
        "Failed to create group";
      console.error("useCreateGroup onError:", errorMessage);
      toast.error(errorMessage);
    },
  });
}

// Mutation: Update group
export function useUpdateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      courseSlug,
      groupId,
      groupData,
    }: {
      courseSlug: string;
      groupId: string;
      groupData: {
        groupName?: string;
        leaderId?: string;
      };
    }) => {
      const { data } = await axios.put(
        `/courses/${courseSlug}/groups/${groupId}`,
        groupData
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.groups.detail(
          variables.courseSlug,
          variables.groupId
        ),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.groups.byCourse(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reporting.group(
          variables.courseSlug,
          variables.groupId
        ),
      });
      toast.success("Group updated successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to update group");
    },
  });
}

// Mutation: Delete group
export function useDeleteGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      courseSlug,
      groupId,
    }: {
      courseSlug: string;
      groupId: string;
    }) => {
      await axios.delete(`/courses/${courseSlug}/groups/${groupId}`);
      return { courseSlug, groupId };
    },
    onSuccess: (variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.groups.byCourse(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.groups.meta(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reporting.group(variables.courseSlug),
      });
      toast.success("Group deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to delete group");
    },
  });
}

// Mutation: Add/Remove students from group
export function useUpdateGroupStudents() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      courseSlug,
      groupId,
      studentIds,
    }: {
      courseSlug: string;
      groupId: string;
      studentIds: string[];
    }) => {
      const { data } = await axios.put(
        `/courses/${courseSlug}/groups/${groupId}/students`,
        { studentIds }
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.groups.students(
          variables.courseSlug,
          variables.groupId
        ),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.groups.detail(
          variables.courseSlug,
          variables.groupId
        ),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reporting.group(
          variables.courseSlug,
          variables.groupId
        ),
      });
      toast.success("Group students updated successfully");
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error || "Failed to update group students"
      );
    },
  });
}

// Mutation: Assign criteria to group
export function useAssignGroupCriteria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      courseSlug,
      groupId,
      criteriaId,
    }: {
      courseSlug: string;
      groupId: string;
      criteriaId: string;
    }) => {
      const { data } = await axios.post(
        `/courses/${courseSlug}/groups/${groupId}/criteria`,
        { criteriaId }
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.groups.criteria(
          variables.courseSlug,
          variables.groupId
        ),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.groups.detail(
          variables.courseSlug,
          variables.groupId
        ),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reporting.group(
          variables.courseSlug,
          variables.groupId
        ),
      });
      toast.success("Criteria assigned to group successfully");
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error || "Failed to assign criteria to group"
      );
    },
  });
}
