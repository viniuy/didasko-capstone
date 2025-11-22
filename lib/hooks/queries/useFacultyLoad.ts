"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "@/lib/axios";
import { queryKeys } from "./queryKeys";

// Query: Get current user's faculty load (courses teaching)
export function useFacultyLoad() {
  return useQuery({
    queryKey: queryKeys.facultyLoad.current(),
    queryFn: async () => {
      // Note: This might need to be derived from courses with facultyId filter
      // Adjust endpoint based on your actual API route
      const { data } = await axios.get("/courses/schedules", {
        params: {
          // You may need to pass facultyId from session
        },
      });
      return data;
    },
  });
}
