import axiosInstance from "@/lib/axios";

export const gradesService = {
  // Get grades
  getGrades: (
    courseSlug: string,
    filters: {
      date: string;
      criteriaId?: string;
      courseCode?: string;
      courseSection?: string;
      groupId?: string;
    }
  ) =>
    axiosInstance
      .get(`/courses/${courseSlug}/grades`, { params: filters })
      .then((res) => res.data),

  // Save grades
  saveGrades: (courseSlug: string, data: any) =>
    axiosInstance
      .post(`/courses/${courseSlug}/grades`, data)
      .then((res) => res.data),

  // Delete grades
  deleteGrades: (courseSlug: string, criteriaId: string, date: string) =>
    axiosInstance
      .delete(`/courses/${courseSlug}/grades`, {
        params: { criteriaId, date },
      })
      .then((res) => res.data),
};
