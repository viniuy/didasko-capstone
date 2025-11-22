"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "@/lib/axios";
import { queryKeys } from "./queryKeys";

// Query: Get individual reporting by course
export function useIndividualReporting(courseSlug: string) {
  return useQuery({
    queryKey: queryKeys.reporting.individual(courseSlug),
    queryFn: async () => {
      // Note: Adjust endpoint based on your actual API route
      const { data } = await axios.get(
        `/courses/${courseSlug}/reporting/individual`
      );
      return data;
    },
    enabled: !!courseSlug,
  });
}

// Query: Get group reporting by course
export function useGroupReporting(courseSlug: string, groupId?: string) {
  return useQuery({
    queryKey: queryKeys.reporting.group(courseSlug, groupId),
    queryFn: async () => {
      const url = groupId
        ? `/courses/${courseSlug}/reporting/group/${groupId}`
        : `/courses/${courseSlug}/reporting/group`;
      const { data } = await axios.get(url);
      return data;
    },
    enabled: !!courseSlug,
  });
}

// Query: Get specific group report detail
export function useGroupReportDetail(courseSlug: string, groupId: string) {
  return useQuery({
    queryKey: queryKeys.reporting.group(courseSlug, groupId),
    queryFn: async () => {
      const { data } = await axios.get(
        `/courses/${courseSlug}/reporting/group/${groupId}`
      );
      return data;
    },
    enabled: !!courseSlug && !!groupId,
  });
}
