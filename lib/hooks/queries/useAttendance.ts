"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "@/lib/axios";
import { queryKeys } from "./queryKeys";
import toast from "react-hot-toast";

// Query: Get attendance by course
export function useAttendanceByCourse(
  courseSlug: string,
  date: string,
  options?: { page?: number; limit?: number }
) {
  return useQuery({
    queryKey: [...queryKeys.attendance.byCourse(courseSlug), date, options],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("date", date);
      if (options?.page) params.append("page", options.page.toString());
      if (options?.limit) params.append("limit", options.limit.toString());

      const { data } = await axios.get(
        `/courses/${courseSlug}/attendance?${params.toString()}`
      );
      return data;
    },
    enabled: !!courseSlug && !!date,
    staleTime: 0, // Always consider data stale for real-time updates
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

// Query: Get all attendance for a course (fetches all dates at once)
export function useAllAttendanceByCourse(courseSlug: string) {
  const { data: datesData, isLoading: isLoadingDates } =
    useAttendanceDates(courseSlug);

  return useQuery({
    queryKey: [
      ...queryKeys.attendance.byCourse(courseSlug),
      "all",
      datesData?.dates,
    ],
    queryFn: async () => {
      if (!datesData?.dates || datesData.dates.length === 0) {
        return { attendance: [] };
      }

      // Fetch attendance for all dates in parallel
      const attendancePromises = datesData.dates.map(
        async (dateStr: string) => {
          // Extract date part from ISO string (YYYY-MM-DD)
          const dateOnly = dateStr.split("T")[0];
          const { data } = await axios.get(
            `/courses/${courseSlug}/attendance?date=${dateOnly}&limit=1000`
          );
          return {
            date: dateOnly, // Store as YYYY-MM-DD format
            attendance: (data?.attendance || []).map((record: any) => ({
              ...record,
              date: dateOnly, // Ensure all records have the date in YYYY-MM-DD format
            })),
          };
        }
      );

      const results = await Promise.all(attendancePromises);

      // Flatten all attendance records
      const allAttendance = results.flatMap((result) => result.attendance);

      return { attendance: allAttendance };
    },
    enabled:
      !!courseSlug &&
      !!datesData?.dates &&
      datesData.dates.length > 0 &&
      !isLoadingDates,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    // Keep previous data while refetching to prevent loading states
    placeholderData: (previousData) => previousData,
  });
}

// Query: Get attendance dates for a course
export function useAttendanceDates(courseSlug: string) {
  return useQuery({
    queryKey: queryKeys.attendance.dates(courseSlug),
    queryFn: async () => {
      const { data } = await axios.get(
        `/courses/${courseSlug}/attendance/dates`
      );
      return data;
    },
    enabled: !!courseSlug,
    staleTime: 30 * 1000, // Cache for 30 seconds to prevent unnecessary refetches
    refetchOnMount: false, // Don't refetch on mount if we have cached data
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });
}

// Query: Get attendance stats for a course
export function useAttendanceStats(courseSlug: string) {
  return useQuery({
    queryKey: queryKeys.attendance.stats(courseSlug),
    queryFn: async () => {
      const { data } = await axios.get(
        `/courses/${courseSlug}/attendance/stats`
      );
      return data;
    },
    enabled: !!courseSlug,
    staleTime: 0, // Always consider data stale for real-time updates
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

// Query: Get attendance leaderboard (all courses or by course)
export function useAttendanceLeaderboard(courseSlug?: string) {
  return useQuery({
    queryKey: queryKeys.attendance.leaderboard(courseSlug),
    queryFn: async () => {
      const url = courseSlug
        ? `/attendance/leaderboard?courseSlug=${courseSlug}`
        : "/attendance/leaderboard";
      const { data } = await axios.get(url);
      return data;
    },
  });
}

// Query: Get attendance leaderboard (all courses)
export function useAttendanceLeaderboardAll(filters?: {
  facultyId?: string;
  courseSlug?: string;
}) {
  return useQuery({
    queryKey: [...queryKeys.attendance.leaderboardAll(), filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.facultyId) params.append("facultyId", filters.facultyId);
      if (filters?.courseSlug) params.append("courseSlug", filters.courseSlug);
      const { data } = await axios.get(
        `/attendance/leaderboard/all?${params.toString()}`
      );
      return data;
    },
  });
}

// Query: Get class attendance
export function useClassAttendance(courseSlug: string, date?: string) {
  return useQuery({
    queryKey: queryKeys.attendance.class(courseSlug, date),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (date) params.append("date", date);
      // Note: This endpoint uses classId (course id), not slug
      // You may need to adjust based on your API
      const { data } = await axios.get(
        `/attendance/class?classId=${courseSlug}&${params.toString()}`
      );
      return data;
    },
    enabled: !!courseSlug,
  });
}

// Mutation: Record attendance (with optimistic update)
export function useRecordAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      courseSlug,
      date,
      attendance,
    }: {
      courseSlug: string;
      date: string;
      attendance: Array<{
        studentId: string;
        status: string;
        reason?: string;
      }>;
    }) => {
      const { data } = await axios.post(`/courses/${courseSlug}/attendance`, {
        date,
        attendance,
      });
      return data;
    },
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.attendance.byCourse(variables.courseSlug),
      });

      // Snapshot previous value
      const previousAttendance = queryClient.getQueryData(
        queryKeys.attendance.byCourse(variables.courseSlug)
      );

      // Optimistically update
      queryClient.setQueryData(
        queryKeys.attendance.byCourse(variables.courseSlug),
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            attendance: [
              ...(old.attendance || []),
              ...variables.attendance.map((a) => ({
                studentId: a.studentId,
                date: variables.date,
                status: a.status,
                reason: a.reason,
              })),
            ],
          };
        }
      );

      return { previousAttendance };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousAttendance) {
        queryClient.setQueryData(
          queryKeys.attendance.byCourse(variables.courseSlug),
          context.previousAttendance
        );
      }
      // Dismiss any loading toasts first
      toast.dismiss();
      toast.error("Failed to record attendance");
    },
    onSuccess: (_, variables) => {
      // Invalidate and immediately refetch for real-time updates
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.byCourse(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.dates(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.stats(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.leaderboard(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.leaderboardAll(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.courses.analytics(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.stats.attendanceRanking(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.students.byCourse(variables.courseSlug),
      });
      // Immediately refetch attendance data
      queryClient.refetchQueries({
        queryKey: queryKeys.attendance.byCourse(variables.courseSlug),
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.attendance.dates(variables.courseSlug),
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.attendance.stats(variables.courseSlug),
      });
      // Dismiss any loading toasts first
      toast.dismiss();
      toast.success("Attendance recorded successfully");
    },
  });
}

// Mutation: Batch attendance
export function useBatchAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      courseSlug,
      date,
      attendance,
    }: {
      courseSlug: string;
      date: string;
      attendance: Array<{
        studentId: string;
        status: string;
        reason?: string;
      }>;
    }) => {
      const { data } = await axios.post(
        `/courses/${courseSlug}/attendance/batch`,
        {
          date,
          attendance,
        }
      );
      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate and immediately refetch for real-time updates
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.byCourse(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.dates(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.stats(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.leaderboard(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.leaderboardAll(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.courses.analytics(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.stats.attendanceRanking(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.students.byCourse(variables.courseSlug),
      });
      // Immediately refetch attendance data
      queryClient.refetchQueries({
        queryKey: queryKeys.attendance.byCourse(variables.courseSlug),
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.attendance.dates(variables.courseSlug),
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.attendance.stats(variables.courseSlug),
      });
      // Dismiss any loading toasts first
      toast.dismiss();
      toast.success("Attendance batch recorded successfully");
    },
    onError: (error: any) => {
      // Dismiss any loading toasts first
      toast.dismiss();
      toast.error(
        error?.response?.data?.error || "Failed to record batch attendance"
      );
    },
  });
}

// Mutation: Clear attendance
export function useClearAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      courseSlug,
      date,
    }: {
      courseSlug: string;
      date: string;
    }) => {
      const { data } = await axios.post(
        `/courses/${courseSlug}/attendance/clear`,
        { date }
      );
      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate all attendance queries for this course
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.byCourse(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.dates(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.stats(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.leaderboard(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.courses.analytics(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.students.byCourse(variables.courseSlug),
      });
      // Note: Don't show toast here - let the component handle it to avoid duplicates
    },
    onError: (error: any) => {
      // Dismiss any loading toasts first
      toast.dismiss();
      toast.error(error?.response?.data?.error || "Failed to clear attendance");
    },
  });
}
