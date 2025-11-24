"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "@/lib/axios";
import { queryKeys } from "./queryKeys";
import toast from "react-hot-toast";

// Query: Get criteria by course
export function useCriteriaByCourse(
  courseSlug: string,
  options?: {
    initialData?: any;
    refetchOnMount?: boolean;
    refetchOnWindowFocus?: boolean;
    enabled?: boolean;
  }
) {
  const {
    initialData,
    refetchOnMount = true,
    refetchOnWindowFocus = true,
    enabled = true,
  } = options || {};

  return useQuery({
    queryKey: queryKeys.criteria.byCourse(courseSlug),
    queryFn: async () => {
      const { data } = await axios.get(`/courses/${courseSlug}/criteria`);
      return data;
    },
    enabled: !!courseSlug && enabled,
    initialData,
    refetchOnMount,
    refetchOnWindowFocus,
  });
}

// Query: Get recitation criteria
export function useRecitationCriteria(
  courseSlug: string,
  options?: {
    initialData?: any;
    refetchOnMount?: boolean;
    refetchOnWindowFocus?: boolean;
    enabled?: boolean;
  }
) {
  const {
    initialData,
    refetchOnMount = true,
    refetchOnWindowFocus = true,
    enabled = true,
  } = options || {};

  return useQuery({
    queryKey: queryKeys.criteria.recitation(courseSlug),
    queryFn: async () => {
      const { data } = await axios.get(
        `/courses/${courseSlug}/recitation-criteria`
      );
      return data;
    },
    enabled: !!courseSlug && enabled,
    initialData,
    refetchOnMount,
    refetchOnWindowFocus,
  });
}

// Query: Get group criteria by course (for the whole section)
export function useGroupCriteriaByCourse(
  courseSlug: string,
  options?: {
    initialData?: any;
    refetchOnMount?: boolean;
    refetchOnWindowFocus?: boolean;
    enabled?: boolean;
  }
) {
  const {
    initialData,
    refetchOnMount = true,
    refetchOnWindowFocus = true,
    enabled = true,
  } = options || {};

  return useQuery({
    queryKey: queryKeys.criteria.group(courseSlug),
    queryFn: async () => {
      const { data } = await axios.get(`/courses/${courseSlug}/group-criteria`);
      return data;
    },
    enabled: !!courseSlug && enabled,
    initialData,
    refetchOnMount,
    refetchOnWindowFocus,
  });
}

// Query: Get criteria detail
export function useCriteriaDetail(courseSlug: string, criteriaId: string) {
  return useQuery({
    queryKey: queryKeys.criteria.detail(courseSlug, criteriaId),
    queryFn: async () => {
      const { data } = await axios.get(
        `/courses/${courseSlug}/criteria/${criteriaId}`
      );
      return data;
    },
    enabled: !!courseSlug && !!criteriaId,
  });
}

// Query: Get linked criteria
export function useLinkedCriteria(courseSlug: string) {
  return useQuery({
    queryKey: queryKeys.criteria.linked(courseSlug),
    queryFn: async () => {
      const { data } = await axios.get(`/courses/${courseSlug}/criteria/link`);
      return data;
    },
    enabled: !!courseSlug,
  });
}

// Mutation: Create criteria
export function useCreateCriteria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      courseSlug,
      criteriaData,
    }: {
      courseSlug: string;
      criteriaData: {
        name: string;
        userId: string;
        date: string;
        scoringRange: number;
        passingScore: number;
        isGroupCriteria?: boolean;
        isRecitationCriteria?: boolean;
        rubrics?: Array<{ name: string; percentage: number }>;
      };
    }) => {
      // Use the correct endpoint based on whether it's recitation criteria
      const endpoint = criteriaData.isRecitationCriteria
        ? `/courses/${courseSlug}/recitation-criteria`
        : `/courses/${courseSlug}/criteria`;

      const { data } = await axios.post(endpoint, criteriaData);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.criteria.byCourse(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.criteria.recitation(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.criteria.group(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.grading.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.groups.byCourse(variables.courseSlug),
      });
      toast.success("Criteria created successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to create criteria");
    },
  });
}

// Mutation: Update criteria
export function useUpdateCriteria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      courseSlug,
      criteriaId,
      criteriaData,
    }: {
      courseSlug: string;
      criteriaId: string;
      criteriaData: Partial<{
        name: string;
        date: string;
        scoringRange: number;
        passingScore: number;
        rubrics: Array<{ name: string; percentage: number }>;
      }>;
    }) => {
      const { data } = await axios.put(
        `/courses/${courseSlug}/criteria/${criteriaId}`,
        criteriaData
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.criteria.detail(
          variables.courseSlug,
          variables.criteriaId
        ),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.criteria.byCourse(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.criteria.recitation(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.criteria.group(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.grading.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.groups.byCourse(variables.courseSlug),
      });
      toast.success("Criteria updated successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to update criteria");
    },
  });
}

// Mutation: Delete criteria
export function useDeleteCriteria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      courseSlug,
      criteriaId,
    }: {
      courseSlug: string;
      criteriaId: string;
    }) => {
      await axios.delete(`/courses/${courseSlug}/criteria/${criteriaId}`);
      return { courseSlug, criteriaId };
    },
    onSuccess: (variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.criteria.byCourse(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.criteria.recitation(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.criteria.group(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.grading.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.groups.byCourse(variables.courseSlug),
      });
      toast.success("Criteria deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to delete criteria");
    },
  });
}

// Mutation: Link criteria to assessment
export function useLinkCriteria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      courseSlug,
      criteriaId,
      assessmentId,
    }: {
      courseSlug: string;
      criteriaId: string;
      assessmentId: string;
    }) => {
      const { data } = await axios.post(
        `/courses/${courseSlug}/criteria/link`,
        { criteriaId, assessmentId }
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.criteria.linked(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.grading.termConfigs(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.grading.assessmentScores(variables.courseSlug),
      });
      toast.success("Criteria linked successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to link criteria");
    },
  });
}
