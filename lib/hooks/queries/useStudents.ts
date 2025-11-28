"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "@/lib/axios";
import { queryKeys } from "./queryKeys";
import { Student, StudentCreateInput } from "@/shared/types/student";
import toast from "react-hot-toast";

// Query: Get all students
export function useStudents(options?: {
  filters?: {
    page?: number;
    limit?: number;
    search?: string;
    courseId?: string;
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
    queryKey: queryKeys.students.list(filters),
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (filters?.page) params.append("page", filters.page.toString());
      if (filters?.limit) params.append("limit", filters.limit.toString());
      if (filters?.search) params.append("search", filters.search);
      if (filters?.courseId) params.append("courseId", filters.courseId);

      const { data } = await axios.get(`/students?${params.toString()}`, {
        signal,
      });
      return data;
    },
    initialData,
    refetchOnMount,
    refetchOnWindowFocus,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}

// Query: Get student detail
export function useStudent(id: string) {
  return useQuery({
    queryKey: queryKeys.students.detail(id),
    queryFn: async () => {
      const { data } = await axios.get<Student>(`/students/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// Query: Get student image
export function useStudentImage(id: string) {
  return useQuery({
    queryKey: queryKeys.students.image(id),
    queryFn: async () => {
      const { data } = await axios.get(`/students/${id}/image`, {
        responseType: "blob",
      });
      return URL.createObjectURL(data);
    },
    enabled: !!id,
  });
}

// Query: Get students by course
export function useStudentsByCourse(
  courseSlug: string,
  date?: Date,
  options?: {
    initialData?: any;
    refetchOnMount?: boolean;
    refetchOnWindowFocus?: boolean;
  }
) {
  const {
    initialData,
    refetchOnMount = true,
    refetchOnWindowFocus = false, // Disable refetch on window focus for fresh data
  } = options || {};

  return useQuery({
    queryKey: [...queryKeys.students.byCourse(courseSlug), date?.toISOString()],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (date) params.append("date", date.toISOString());

      const { data } = await axios.get(
        `/courses/${courseSlug}/students?${params.toString()}`,
        { signal }
      );
      return data;
    },
    enabled: !!courseSlug,
    initialData,
    refetchOnMount,
    refetchOnWindowFocus,
    staleTime: 0, // Always consider data stale for real-time updates when used with attendance
  });
}

// Query: Get student by RFID
export function useStudentByRFID(rfidId: string) {
  return useQuery({
    queryKey: queryKeys.students.rfid(rfidId),
    queryFn: async () => {
      const { data } = await axios.get(`/students/rfid?rfidId=${rfidId}`);
      return data;
    },
    enabled: !!rfidId,
  });
}

// Mutation: Create student
export function useCreateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: StudentCreateInput) => {
      const { data } = await axios.post<Student>("/students", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all });
      toast.success("Student created successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to create student");
    },
  });
}

// Mutation: Update student
export function useUpdateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Student>;
    }) => {
      const { data: response } = await axios.put<Student>(
        `/students/${id}`,
        data
      );
      return response;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.students.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.students.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all });
      // Invalidate course students if student is in courses
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.students.all, "byCourse"],
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.courses.all,
      });
      toast.success("Student updated successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to update student");
    },
  });
}

// Mutation: Delete student
export function useDeleteStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/students/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.courses.all,
      });
      toast.success("Student deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to delete student");
    },
  });
}

// Mutation: Import students to course
export function useImportStudentsToCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      courseSlug,
      students,
    }: {
      courseSlug: string;
      students: any[];
    }) => {
      const { data } = await axios.post(
        `/courses/${courseSlug}/students/import`,
        { students }
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.students.byCourse(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.courses.students(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.courses.detail(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.courses.analytics(variables.courseSlug),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.students.lists() });

      // Show appropriate message based on number of students
      const studentCount = variables.students?.length || 0;
      if (studentCount === 1) {
        toast.success("Student added successfully");
      } else {
        toast.success("Students imported successfully");
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to import students");
    },
  });
}

// Mutation: Assign RFID to student
export function useAssignRFID() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      studentId,
      rfidId,
    }: {
      studentId: string;
      rfidId: string | number;
    }) => {
      const { data } = await axios.post("/students/rfid/assign", {
        studentId,
        rfidId,
      });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.students.detail(variables.studentId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.students.rfid(String(variables.rfidId)),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.students.lists() });
      toast.success("RFID assigned successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to assign RFID");
    },
  });
}

// Mutation: Remove students from course
export function useRemoveStudentsFromCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      courseSlug,
      studentIds,
    }: {
      courseSlug: string;
      studentIds: string[];
    }) => {
      await axios.delete(`/courses/${courseSlug}/students`, {
        data: { studentIds },
      });
      return { courseSlug, studentIds };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.students.byCourse(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.courses.students(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.courses.detail(variables.courseSlug),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.courses.analytics(variables.courseSlug),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.students.lists() });

      // Show appropriate message based on number of students
      const studentCount = variables.studentIds?.length || 0;
      if (studentCount === 1) {
        toast.success("Student removed successfully");
      } else {
        toast.success(`Successfully removed ${studentCount} students`);
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to remove students");
    },
  });
}

// Mutation: Upload student image
export function useUploadStudentImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      studentId,
      file,
    }: {
      studentId: string;
      file: File;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await axios.post(
        `/students/${studentId}/image`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.students.image(variables.studentId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.students.detail(variables.studentId),
      });
      toast.success("Image uploaded successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to upload image");
    },
  });
}
