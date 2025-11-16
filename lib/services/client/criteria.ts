import axiosInstance from "@/lib/axios";

export const criteriaService = {
  // Get criteria
  getCriteria: (
    courseSlug: string,
    filters?: {
      isGroupCriteria?: boolean;
      isRecitationCriteria?: boolean;
      groupId?: string;
    }
  ) => {
    if (filters?.isRecitationCriteria) {
      return axiosInstance
        .get(`/courses/${courseSlug}/recitation-criteria`)
        .then((res) => res.data);
    }
    if (filters?.groupId) {
      return axiosInstance
        .get(`/courses/${courseSlug}/groups/${filters.groupId}/criteria`)
        .then((res) => res.data);
    }
    return axiosInstance
      .get(`/courses/${courseSlug}/criteria`)
      .then((res) => res.data);
  },

  // Get criteria links
  getCriteriaLinks: (courseSlug: string) =>
    axiosInstance
      .get(`/courses/${courseSlug}/criteria/link`)
      .then((res) => res.data),

  // Create criteria
  create: (courseSlug: string, data: any) =>
    axiosInstance
      .post(`/courses/${courseSlug}/criteria`, data)
      .then((res) => res.data),

  // Update criteria
  update: (courseSlug: string, criteriaId: string, data: any) =>
    axiosInstance
      .put(`/courses/${courseSlug}/criteria/${criteriaId}`, data)
      .then((res) => res.data),

  // Delete criteria
  delete: (courseSlug: string, criteriaId: string) =>
    axiosInstance
      .delete(`/courses/${courseSlug}/criteria/${criteriaId}`)
      .then((res) => res.data),
};
