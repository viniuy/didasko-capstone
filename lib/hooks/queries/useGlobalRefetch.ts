"use client";

import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";

/**
 * Global refetch utility hooks
 * Provides helper functions to invalidate related queries
 */

export function useGlobalRefetch() {
  const queryClient = useQueryClient();

  const refetchDashboard = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.notes.all });
  };

  const refetchCourse = (slug: string) => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.courses.detail(slug),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.courses.students(slug),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.courses.schedules(slug),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.courses.analytics(slug),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.courses.stats(slug),
    });
    // Note: Attendance queries are NOT invalidated here to prevent unnecessary refetches
    // when grades are saved. Attendance should only be refetched when attendance data changes.
    queryClient.invalidateQueries({
      queryKey: queryKeys.grading.classRecord(slug),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.groups.byCourse(slug),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.criteria.byCourse(slug),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.reporting.individual(slug),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.reporting.group(slug),
    });
  };

  const refetchBulk = () => {
    // Invalidate all major entity lists after bulk operations
    queryClient.invalidateQueries({ queryKey: queryKeys.courses.lists() });
    queryClient.invalidateQueries({ queryKey: queryKeys.students.lists() });
    queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.criteria.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
    queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
  };

  return {
    refetchDashboard,
    refetchCourse,
    refetchBulk,
  };
}
