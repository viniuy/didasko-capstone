import axiosInstance from "@/lib/axios";

export const attendanceService = {
  // Get attendance
  getAttendance: (
    courseSlug: string,
    date: string,
    options?: {
      page?: number;
      limit?: number;
    }
  ) =>
    axiosInstance
      .get(`/courses/${courseSlug}/attendance`, {
        params: { date, ...options },
      })
      .then((res) => res.data),

  // Create attendance
  create: (courseSlug: string, data: any) =>
    axiosInstance
      .post(`/courses/${courseSlug}/attendance`, data)
      .then((res) => res.data),

  // Batch create attendance
  createBatch: (courseSlug: string, records: any[]) =>
    axiosInstance
      .post(`/courses/${courseSlug}/attendance/batch`, { records })
      .then((res) => res.data),

  // Update attendance
  update: (courseSlug: string, id: string, data: any) =>
    axiosInstance
      .put(`/courses/${courseSlug}/attendance/${id}`, data)
      .then((res) => res.data),

  // Delete attendance
  delete: (courseSlug: string, id: string) =>
    axiosInstance
      .delete(`/courses/${courseSlug}/attendance/${id}`)
      .then((res) => res.data),

  // Clear attendance for date
  clear: (courseSlug: string, date: string) =>
    axiosInstance
      .post(`/courses/${courseSlug}/attendance/clear`, { date })
      .then((res) => res.data),

  // Get attendance dates
  getDates: (courseSlug: string) =>
    axiosInstance
      .get(`/courses/${courseSlug}/attendance/dates`)
      .then((res) => res.data),

  // Get attendance stats
  getStats: (courseSlug: string) =>
    axiosInstance
      .get(`/courses/${courseSlug}/attendance/stats`)
      .then((res) => res.data),
};
