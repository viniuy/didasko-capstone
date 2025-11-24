"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "@/lib/axios";
import { queryKeys } from "./queryKeys";
import toast from "react-hot-toast";

// Query: Get class record
export function useClassRecord(courseSlug: string) {
  return useQuery({
    queryKey: queryKeys.grading.classRecord(courseSlug),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(`/courses/${courseSlug}/grades`, {
        signal,
      });
      return data;
    },
    enabled: !!courseSlug,
  });
}

// Query: Get term configs
export function useTermConfigs(courseSlug: string) {
  return useQuery({
    queryKey: queryKeys.grading.termConfigs(courseSlug),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(`/courses/${courseSlug}/term-configs`, {
        signal,
      });
      return data;
    },
    enabled: !!courseSlug,
  });
}

// Query: Get assessment scores
export function useAssessmentScores(courseSlug: string) {
  return useQuery({
    queryKey: queryKeys.grading.assessmentScores(courseSlug),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(
        `/courses/${courseSlug}/assessment-scores`,
        { signal }
      );
      return data;
    },
    enabled: !!courseSlug,
  });
}

// Query: Get term grades for a specific term
export function useTermGrades(
  courseSlug: string,
  term: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: queryKeys.grading.termGrades(courseSlug, term),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(
        `/courses/${courseSlug}/term-grades/${term}`,
        { signal }
      );
      return data;
    },
    enabled: !!courseSlug && !!term && enabled,
    staleTime: 0, // Always fetch fresh data when tab is switched
  });
}

// Query: Get grades
export function useGrades(
  courseSlug: string,
  filters?: {
    date?: string;
    criteriaId?: string;
    courseCode?: string;
    courseSection?: string;
    groupId?: string;
  }
) {
  return useQuery({
    queryKey: [...queryKeys.grading.grades(courseSlug), filters],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (filters?.date) params.append("date", filters.date);
      if (filters?.criteriaId) params.append("criteriaId", filters.criteriaId);
      if (filters?.courseCode) params.append("courseCode", filters.courseCode);
      if (filters?.courseSection)
        params.append("courseSection", filters.courseSection);
      if (filters?.groupId) params.append("groupId", filters.groupId);

      const { data } = await axios.get(
        `/courses/${courseSlug}/grades?${params.toString()}`,
        { signal }
      );
      return data;
    },
    enabled:
      !!courseSlug &&
      !!filters?.date &&
      !!filters?.courseCode &&
      !!filters?.courseSection,
  });
}

// Query: Get dates where grades exist for a criteria
export function useGradeDates(
  courseSlug: string,
  filters?: {
    criteriaId?: string;
    courseCode?: string;
    courseSection?: string;
  }
) {
  return useQuery({
    queryKey: [...queryKeys.grading.grades(courseSlug), "dates", filters],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (filters?.criteriaId) params.append("criteriaId", filters.criteriaId);
      if (filters?.courseCode) params.append("courseCode", filters.courseCode);
      if (filters?.courseSection)
        params.append("courseSection", filters.courseSection);

      const { data } = await axios.get(
        `/courses/${courseSlug}/grades/dates?${params.toString()}`,
        { signal }
      );
      return data;
    },
    enabled: !!courseSlug && !!filters?.criteriaId, // Only fetch when criteriaId is provided
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Query: Get recitation scores
export function useRecitationScores(courseSlug: string) {
  return useQuery({
    queryKey: queryKeys.grading.recitation(courseSlug),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(`/courses/${courseSlug}/grades`, {
        signal,
      });
      return data;
    },
    enabled: !!courseSlug,
  });
}

// Mutation: Update grade
export function useUpdateGrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      courseSlug,
      gradeData,
    }: {
      courseSlug: string;
      gradeData: any;
    }) => {
      const { data } = await axios.post(
        `/courses/${courseSlug}/grades`,
        gradeData
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.grading.classRecord(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.grading.grades(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reporting.individual(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reporting.group(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.stats.gradesLeaderboard(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.stats.gradesLeaderboard(),
      });
      toast.success("Grade updated successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to update grade");
    },
  });
}

// Mutation: Bulk update assessment scores
export function useBulkUpdateAssessmentScores() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      courseSlug,
      scores,
      signal,
    }: {
      courseSlug: string;
      scores: any[];
      signal?: AbortSignal;
    }) => {
      const { data } = await axios.post(
        `/courses/${courseSlug}/assessment-scores/bulk`,
        { scores },
        { signal }
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.grading.assessmentScores(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.grading.classRecord(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reporting.individual(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reporting.group(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.stats.gradesLeaderboard(variables.courseSlug),
      });
      toast.success("Assessment scores updated successfully");
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error || "Failed to update assessment scores"
      );
    },
  });
}

// Mutation: Create/Update term config
export function useSaveTermConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      courseSlug,
      termConfigs,
      signal,
    }: {
      courseSlug: string;
      termConfigs: any;
      signal?: AbortSignal;
    }) => {
      const { data } = await axios.post(
        `/courses/${courseSlug}/term-configs`,
        { termConfigs },
        { signal }
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.grading.termConfigs(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.grading.classRecord(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reporting.individual(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reporting.group(variables.courseSlug),
      });
      toast.success("Term configuration saved successfully");
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error || "Failed to save term configuration"
      );
    },
  });
}

// Mutation: Save grades (batch)
export function useSaveGrades() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      courseSlug,
      gradeData,
      signal,
    }: {
      courseSlug: string;
      gradeData: {
        date: string;
        criteriaId: string;
        courseCode: string;
        courseSection: string;
        grades: Array<{
          studentId: string;
          scores: number[];
          total: number;
          reportingScore?: number | null;
          recitationScore?: number | null;
        }>;
        isRecitationCriteria?: boolean;
      };
      signal?: AbortSignal;
    }) => {
      const { data } = await axios.post(
        `/courses/${courseSlug}/grades`,
        gradeData,
        { signal }
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.grading.grades(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.grading.classRecord(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reporting.individual(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reporting.group(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.stats.gradesLeaderboard(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.stats.gradesLeaderboard(),
      });
      // Toast is handled by the calling function (auto-save) to avoid duplicates
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to save grades");
    },
  });
}

// Mutation: Delete grades
export function useDeleteGrades() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      courseSlug,
      criteriaId,
      date,
    }: {
      courseSlug: string;
      criteriaId: string;
      date: string;
    }) => {
      const params = new URLSearchParams();
      params.append("criteriaId", criteriaId);
      params.append("date", date);
      await axios.delete(`/courses/${courseSlug}/grades?${params.toString()}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.grading.grades(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.grading.classRecord(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reporting.individual(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reporting.group(variables.courseSlug),
      });
      toast.success("Grades deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to delete grades");
    },
  });
}
