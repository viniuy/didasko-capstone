"use client";

import { useQuery, useQueries } from "@tanstack/react-query";
import axios from "@/lib/axios";
import { queryKeys } from "./queryKeys";

// Query: Get faculty count
export function useFacultyCount() {
  return useQuery({
    queryKey: queryKeys.stats.facultyCount(),
    queryFn: async () => {
      const { data } = await axios.get("/stats/faculty-count");
      return data;
    },
  });
}

// Query: Get faculty stats
export function useFacultyStats() {
  return useQuery({
    queryKey: queryKeys.stats.facultyStats(),
    queryFn: async () => {
      const { data } = await axios.get("/stats/faculty-stats");
      return data;
    },
  });
}

// Query: Get grades leaderboard (global or by course)
export function useGradesLeaderboard(courseSlug?: string) {
  return useQuery({
    queryKey: queryKeys.stats.gradesLeaderboard(courseSlug),
    queryFn: async () => {
      const url = courseSlug
        ? `/stats/grades/leaderboard/${courseSlug}`
        : "/stats/grades/leaderboard";
      const { data } = await axios.get(url);
      return data;
    },
  });
}

// Query: Get attendance ranking
export function useAttendanceRanking(facultyId?: string) {
  return useQuery({
    queryKey: queryKeys.stats.attendanceRanking(),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (facultyId) params.append("facultyId", facultyId);
      const { data } = await axios.get(
        `/courses/attendance-ranking?${params.toString()}`
      );
      return data;
    },
    enabled: !!facultyId,
  });
}

// Query: Get admin dashboard data (all stats in parallel)
export function useAdminDashboardData() {
  return useQueries({
    queries: [
      {
        queryKey: ["stats", "students", "count"],
        queryFn: async () => {
          const { data } = await axios.get("/api/students/count");
          return data;
        },
      },
      {
        queryKey: ["stats", "teachers", "count"],
        queryFn: async () => {
          const { data } = await axios.get("/api/teachers/count");
          return data;
        },
      },
      {
        queryKey: ["stats", "courses", "count"],
        queryFn: async () => {
          const { data } = await axios.get("/api/courses/count");
          return data;
        },
      },
      {
        queryKey: ["stats", "attendance", "count"],
        queryFn: async () => {
          const { data } = await axios.get("/api/attendance/count");
          return data;
        },
      },
      {
        queryKey: ["activity", "recent"],
        queryFn: async () => {
          const { data } = await axios.get("/api/activity/recent");
          return data;
        },
      },
      {
        queryKey: ["users", "list"],
        queryFn: async () => {
          const { data } = await axios.get("/users");
          return data.users || [];
        },
      },
      {
        queryKey: ["users", "count", "full-time"],
        queryFn: async () => {
          const { data } = await axios.get("/users/count/full-time");
          return data;
        },
      },
      {
        queryKey: ["users", "count", "part-time"],
        queryFn: async () => {
          const { data } = await axios.get("/users/count/part-time");
          return data;
        },
      },
      {
        queryKey: ["users", "count", "granted"],
        queryFn: async () => {
          const { data } = await axios.get("/users/count/granted");
          return data;
        },
      },
      {
        queryKey: ["users", "count", "denied"],
        queryFn: async () => {
          const { data } = await axios.get("/users/count/denied");
          return data;
        },
      },
      {
        queryKey: ["users", "count"],
        queryFn: async () => {
          const { data } = await axios.get("/users/count");
          return data;
        },
      },
    ],
  });
}
