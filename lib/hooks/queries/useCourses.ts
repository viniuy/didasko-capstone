"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  useQueries,
} from "@tanstack/react-query";
import { useMemo } from "react";
import axios from "@/lib/axios";
import { queryKeys } from "./queryKeys";
import {
  Course,
  CourseResponse,
  CreateCourseInput,
  CourseUpdateInput,
} from "@/shared/types/course";
import toast from "react-hot-toast";

// Query: Get all courses
export function useCourses(filters?: {
  facultyId?: string;
  search?: string;
  department?: string;
  semester?: string;
  code?: string;
  section?: string;
  status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
}) {
  return useQuery({
    queryKey: queryKeys.courses.list(filters),
    queryFn: async ({ signal }) => {
      try {
        const params = new URLSearchParams();
        if (filters?.facultyId) params.append("facultyId", filters.facultyId);
        if (filters?.search) params.append("search", filters.search);
        if (filters?.department)
          params.append("department", filters.department);
        if (filters?.semester) params.append("semester", filters.semester);
        if (filters?.code) params.append("code", filters.code);
        if (filters?.section) params.append("section", filters.section);
        if (filters?.status) params.append("status", filters.status);

        const { data } = await axios.get<CourseResponse>(
          `/courses?${params.toString()}`,
          {
            signal,
            timeout: 30000, // 30 second timeout
          }
        );
        return data;
      } catch (error: any) {
        // Ignore cancellation errors (they're expected when query key changes)
        if (
          error.name === "CanceledError" ||
          error.code === "ERR_CANCELED" ||
          error.message === "canceled" ||
          signal?.aborted
        ) {
          // Return empty data structure to prevent error from being thrown
          return {
            courses: [],
            pagination: {
              total: 0,
              page: 1,
              limit: 0,
              totalPages: 0,
            },
          };
        }
        // Handle Prisma connection errors (P1017)
        if (
          error.response?.data?.error?.includes("P1017") ||
          error.response?.data?.error?.includes(
            "Server has closed the connection"
          ) ||
          error.message?.includes("P1017") ||
          error.message?.includes("Server has closed the connection")
        ) {
          throw new Error(
            "Database connection error. Please try again in a moment."
          );
        }
        if (
          error.code === "ECONNABORTED" ||
          error.message?.includes("timeout")
        ) {
          throw new Error("Request timeout. Please try again.");
        }
        if (error.response) {
          throw new Error(
            error.response?.data?.error || "Failed to fetch courses"
          );
        }
        if (error.request && !error.response) {
          throw new Error(
            "No response from server. Please check your connection."
          );
        }
        throw error;
      }
    },
    retry: (failureCount, error: any) => {
      // Retry on connection errors (P1017) or network errors
      if (failureCount < 3) {
        const errorMessage = error?.message || "";
        const responseError = error?.response?.data?.error || "";

        if (
          errorMessage.includes("P1017") ||
          errorMessage.includes("Server has closed the connection") ||
          errorMessage.includes("Database connection error") ||
          responseError.includes("P1017") ||
          responseError.includes("Server has closed the connection") ||
          error.code === "ECONNABORTED" ||
          errorMessage.includes("timeout") ||
          (error.request && !error.response)
        ) {
          return true;
        }
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff: 1s, 2s, 4s
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Query: Get active courses
export function useActiveCourses(options?: {
  filters?: {
    facultyId?: string;
    search?: string;
    department?: string;
    semester?: string;
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
    queryKey: queryKeys.courses.active(filters),
    queryFn: async ({ signal }) => {
      try {
        const params = new URLSearchParams();
        if (filters?.facultyId) params.append("facultyId", filters.facultyId);
        if (filters?.search) params.append("search", filters.search);
        if (filters?.department)
          params.append("department", filters.department);
        if (filters?.semester) params.append("semester", filters.semester);

        const { data } = await axios.get<CourseResponse>(
          `/courses/active?${params.toString()}`,
          {
            signal,
            timeout: 30000, // 30 second timeout
          }
        );
        return data;
      } catch (error: any) {
        // Handle Prisma connection errors (P1017)
        if (
          error.response?.data?.error?.includes("P1017") ||
          error.response?.data?.error?.includes(
            "Server has closed the connection"
          ) ||
          error.message?.includes("P1017") ||
          error.message?.includes("Server has closed the connection")
        ) {
          throw new Error(
            "Database connection error. Please try again in a moment."
          );
        }
        if (
          error.code === "ECONNABORTED" ||
          error.message?.includes("timeout")
        ) {
          throw new Error("Request timeout. Please try again.");
        }
        if (error.response) {
          throw new Error(
            error.response?.data?.error || "Failed to fetch active courses"
          );
        }
        if (error.request && !error.response) {
          throw new Error(
            "No response from server. Please check your connection."
          );
        }
        throw error;
      }
    },
    initialData,
    refetchOnMount,
    refetchOnWindowFocus,
    retry: (failureCount, error: any) => {
      // Retry on connection errors (P1017) or network errors
      if (failureCount < 3) {
        const errorMessage = error?.message || "";
        const responseError = error?.response?.data?.error || "";

        if (
          errorMessage.includes("P1017") ||
          errorMessage.includes("Server has closed the connection") ||
          errorMessage.includes("Database connection error") ||
          responseError.includes("P1017") ||
          responseError.includes("Server has closed the connection") ||
          error.code === "ECONNABORTED" ||
          errorMessage.includes("timeout") ||
          (error.request && !error.response)
        ) {
          return true;
        }
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff: 1s, 2s, 4s
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Query: Get archived courses (lightweight, for settings dialog)
export function useArchivedCourses(filters?: {
  facultyId?: string;
  search?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: queryKeys.courses.archived(filters),
    queryFn: async ({ signal }) => {
      try {
        const params = new URLSearchParams();
        if (filters?.facultyId) params.append("facultyId", filters.facultyId);
        if (filters?.search) params.append("search", filters.search);
        if (filters?.limit) params.append("limit", filters.limit.toString());

        const { data } = await axios.get<Course[]>(
          `/courses/archived?${params.toString()}`,
          {
            signal,
            timeout: 30000,
          }
        );
        return data;
      } catch (error: any) {
        if (error.response) {
          throw new Error(
            error.response?.data?.error || "Failed to fetch archived courses"
          );
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Query: Get course detail (checks list cache first)
export function useCourse(slug: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.courses.detail(slug),
    queryFn: async () => {
      // Check if course exists in any list cache
      const allLists = queryClient.getQueriesData({
        queryKey: queryKeys.courses.lists(),
      });

      for (const [, listData] of allLists) {
        if (listData && typeof listData === "object" && "courses" in listData) {
          const courseResponse = listData as CourseResponse;
          const course = courseResponse.courses.find((c) => c.slug === slug);
          if (course) {
            // Return cached course, but still fetch fresh data in background
            queryClient.prefetchQuery({
              queryKey: queryKeys.courses.detail(slug),
              queryFn: async () => {
                const { data } = await axios.get<Course>(`/courses/${slug}`);
                return data;
              },
            });
            return course;
          }
        }
      }

      // Not in cache, fetch from API
      const { data } = await axios.get<Course>(`/courses/${slug}`);
      return data;
    },
  });
}

// Query: Get course students
export function useCourseStudents(courseSlug: string, date?: Date) {
  return useQuery({
    queryKey: [...queryKeys.courses.students(courseSlug), date?.toISOString()],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (date) params.append("date", date.toISOString());

      const { data } = await axios.get(
        `/courses/${courseSlug}/students?${params.toString()}`,
        { signal }
      );
      return data;
    },
  });
}

// Query: Get course schedules
export function useCourseSchedules(courseSlug: string) {
  return useQuery({
    queryKey: queryKeys.courses.schedules(courseSlug),
    queryFn: async () => {
      const { data } = await axios.get(`/courses/${courseSlug}/schedules`);
      return data;
    },
  });
}

// Query: Get all schedules for a faculty member
export function useFacultySchedules(
  facultyId?: string,
  filters?: { semester?: string; courseSlug?: string; limit?: number }
) {
  return useQuery({
    queryKey: [
      ...queryKeys.courses.all,
      "schedules",
      "faculty",
      facultyId,
      filters,
    ] as const,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (facultyId) params.append("facultyId", facultyId);
      if (filters?.semester) params.append("semester", filters.semester);
      if (filters?.courseSlug) params.append("courseSlug", filters.courseSlug);
      if (filters?.limit) params.append("limit", filters.limit.toString());
      const { data } = await axios.get(
        `/courses/schedules?${params.toString()}`
      );
      return data;
    },
    enabled: !!facultyId,
  });
}

// Query: Get course analytics
export function useCourseAnalytics(
  courseSlug: string,
  options?: {
    initialData?: any;
    refetchOnMount?: boolean;
    refetchOnWindowFocus?: boolean;
  }
) {
  const {
    initialData,
    refetchOnMount = true,
    refetchOnWindowFocus = true,
  } = options || {};

  return useQuery({
    queryKey: queryKeys.courses.analytics(courseSlug),
    queryFn: async () => {
      const { data } = await axios.get(
        `/courses/${courseSlug}/course-analytics`
      );
      return data;
    },
    initialData,
    refetchOnMount,
    refetchOnWindowFocus,
    staleTime: 0, // Always consider data stale to ensure fresh term grades are fetched
  });
}

// Query: Get course stats
export function useCourseStats(courseSlug: string) {
  return useQuery({
    queryKey: queryKeys.courses.stats(courseSlug),
    queryFn: async () => {
      const { data } = await axios.get(`/courses/${courseSlug}/courses-stats`);
      return data;
    },
    enabled: !!courseSlug,
  });
}

// Query: Get batch course stats (for multiple courses efficiently)
// Uses a single API call instead of multiple individual calls
export function useCoursesStatsBatch(courseSlugs: string[]) {
  // Sort slugs for consistent cache key
  const sortedSlugs = useMemo(
    () => [...courseSlugs].sort().join(","),
    [courseSlugs]
  );

  return useQuery({
    queryKey: queryKeys.courses.statsBatch(courseSlugs),
    queryFn: async () => {
      if (courseSlugs.length === 0) {
        return { stats: [] };
      }

      try {
        const { data } = await axios.post("/courses/stats/batch", {
          courseSlugs,
        });
        return data;
      } catch (error: any) {
        console.error("Error fetching batch course stats:", error);
        // Return default stats for all courses on error
        return {
          stats: courseSlugs.map((slug) => ({
            slug,
            stats: {
              passingRate: 0,
              attendanceRate: 0,
              totalStudents: 0,
            },
          })),
        };
      }
    },
    enabled: courseSlugs.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

// Mutation: Create course
export function useCreateCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCourseInput) => {
      const { data } = await axios.post<Course>("/courses", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      toast.success("Course created successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to create course");
    },
  });
}

// Mutation: Update course
export function useUpdateCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      slug,
      data,
    }: {
      slug: string;
      data: CourseUpdateInput;
    }) => {
      const { data: response } = await axios.put<Course>(
        `/courses/${slug}`,
        data
      );
      return response;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.courses.detail(variables.slug),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.students.byCourse(variables.slug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.stats.all,
      });
      toast.success("Course updated successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to update course");
    },
  });
}

// Mutation: Delete course
export function useDeleteCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (slug: string) => {
      await axios.delete(`/courses/${slug}`);
      return slug;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      toast.success("Course deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to delete course");
    },
  });
}

// Mutation: Bulk archive courses
export function useBulkArchiveCourses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      courseIds,
      status,
    }: {
      courseIds: string[];
      status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
    }) => {
      const { data } = await axios.patch("/courses/bulk-archive", {
        courseIds,
        status,
      });
      return data;
    },
    onSuccess: () => {
      // Component handles refetching manually before showing success toast
      // No need to invalidate here to avoid race conditions
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to archive courses");
    },
  });
}

// Mutation: Import courses
export function useImportCourses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await axios.post("/courses/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      toast.success("Courses imported successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to import courses");
    },
  });
}

// Mutation: Import courses with schedules
export function useImportCoursesWithSchedules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await axios.post(
        "/courses/import-with-schedules",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      toast.success("Courses with schedules imported successfully");
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error ||
          "Failed to import courses with schedules"
      );
    },
  });
}

// Mutation: Import courses with schedules (array of courses)
export function useImportCoursesWithSchedulesArray() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      courses: Array<{
        code: string;
        title: string;
        section: string;
        room: string;
        semester: string;
        academicYear: string;
        classNumber: string | number;
        status: string;
        facultyId?: string;
        schedules: Array<{ day: string; fromTime: string; toTime: string }>;
      }>
    ) => {
      const { data } = await axios.post("/courses/import-with-schedules", {
        courses,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      toast.success("Courses with schedules imported successfully");
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error ||
          "Failed to import courses with schedules"
      );
    },
  });
}

// Mutation: Assign schedules
export function useAssignSchedules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      courseSlug,
      schedules,
    }: {
      courseSlug: string;
      schedules: Array<{ day: string; fromTime: string; toTime: string }>;
    }) => {
      const { data } = await axios.put(`/courses/${courseSlug}/schedules`, {
        schedules,
      });
      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate all course-related queries to ensure UI updates
      queryClient.invalidateQueries({
        queryKey: queryKeys.courses.schedules(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.courses.detail(variables.courseSlug),
      });
      // Invalidate main courses list to update the course cards
      queryClient.invalidateQueries({
        queryKey: queryKeys.courses.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.courses.lists(),
      });
      // Invalidate active courses query
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            Array.isArray(key) &&
            key.length >= 2 &&
            key[0] === "courses" &&
            key[1] === "active"
          );
        },
      });
      toast.success("Schedules assigned successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to assign schedules");
    },
  });
}

// Mutation: Export courses
export function useExportCourses() {
  return useMutation({
    mutationFn: async (filters?: {
      facultyId?: string;
      search?: string;
      department?: string;
      semester?: string;
    }) => {
      const params = new URLSearchParams();
      if (filters?.facultyId) params.append("facultyId", filters.facultyId);
      if (filters?.search) params.append("search", filters.search);
      if (filters?.department) params.append("department", filters.department);
      if (filters?.semester) params.append("semester", filters.semester);

      const { data } = await axios.get(`/courses/export?${params.toString()}`, {
        responseType: "blob",
      });
      return data;
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to export courses");
    },
  });
}
