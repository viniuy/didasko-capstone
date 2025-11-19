import axiosInstance from "@/lib/axios";

export const criteriaService = {
  // Get criteria
  getCriteria: (
    courseSlug: string,
    filters?: {
      isGroupCriteria?: boolean;
      isRecitationCriteria?: boolean;
    }
  ) => {
    if (filters?.isRecitationCriteria) {
      return axiosInstance
        .get(`/courses/${courseSlug}/recitation-criteria`)
        .then((res) => res.data);
    }
    if (filters?.isGroupCriteria) {
      // Group criteria is for the whole section, so we can use the general criteria endpoint
      // or the groups endpoint (which validates group exists but returns all group criteria)
      return axiosInstance
        .get(`/courses/${courseSlug}/criteria`)
        .then((res) => res.data.filter((c: any) => c.isGroupCriteria === true));
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
