import axiosInstance from "@/lib/axios";

// Client-side course service (uses axios)
export const coursesService = {
  // Get course by slug
  getBySlug: (slug: string) =>
    axiosInstance.get(`/courses/${slug}`).then((res) => res.data),

  // Get courses with filters
  getCourses: (filters?: {
    facultyId?: string;
    search?: string;
    department?: string;
    semester?: string;
    code?: string;
    section?: string;
    status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  }) =>
    axiosInstance.get("/courses", { params: filters }).then((res) => res.data),

  // Get active courses
  getActiveCourses: (filters?: { facultyId?: string }) =>
    axiosInstance
      .get("/courses/active", { params: filters })
      .then((res) => res.data),

  // Get course students with attendance
  getStudents: (slug: string, date?: Date) =>
    axiosInstance
      .get(`/courses/${slug}/students`, {
        params: date ? { date: date.toISOString().split("T")[0] } : {},
      })
      .then((res) => res.data),

  // Get course analytics
  getAnalytics: (slug: string) =>
    axiosInstance
      .get(`/courses/${slug}/course-analytics`)
      .then((res) => res.data),

  // Get course stats
  getStats: (slug: string) =>
    axiosInstance.get(`/courses/${slug}/courses-stats`).then((res) => res.data),

  // Batch get stats for multiple courses
  getStatsBatch: (slugs: string[]) =>
    Promise.all(slugs.map((slug) => coursesService.getStats(slug))),

  // Create course
  create: (data: any) =>
    axiosInstance.post("/courses", data).then((res) => res.data),

  // Update course
  update: (slug: string, data: any) =>
    axiosInstance.put(`/courses/${slug}`, data).then((res) => res.data),

  // Delete course
  delete: (slug: string) =>
    axiosInstance.delete(`/courses/${slug}`).then((res) => res.data),
};
