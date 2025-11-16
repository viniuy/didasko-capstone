import axiosInstance from "@/lib/axios";

export const gradingService = {
  // Get term configs
  getTermConfigs: (courseSlug: string) =>
    axiosInstance
      .get(`/courses/${courseSlug}/term-configs`)
      .then((res) => res.data),

  // Save term configs
  saveTermConfigs: (courseSlug: string, configs: any) =>
    axiosInstance
      .post(`/courses/${courseSlug}/term-configs`, { termConfigs: configs })
      .then((res) => res.data),

  // Get assessment scores
  getAssessmentScores: (courseSlug: string) =>
    axiosInstance
      .get(`/courses/${courseSlug}/assessment-scores`)
      .then((res) => res.data),

  // Save assessment score
  saveAssessmentScore: (courseSlug: string, data: any) =>
    axiosInstance
      .put(`/courses/${courseSlug}/assessment-scores`, data)
      .then((res) => res.data),

  // Save assessment scores in bulk
  saveAssessmentScoresBulk: (courseSlug: string, scores: any[]) =>
    axiosInstance
      .post(`/courses/${courseSlug}/assessment-scores/bulk`, { scores })
      .then((res) => res.data),

  // Get class record data (batched)
  getClassRecordData: async (courseSlug: string) => {
    const [students, termConfigs, assessmentScores, criteriaLinks] =
      await Promise.all([
        axiosInstance
          .get(`/courses/${courseSlug}/students`)
          .then((res) => res.data.students || []),
        gradingService.getTermConfigs(courseSlug),
        gradingService.getAssessmentScores(courseSlug),
        axiosInstance
          .get(`/courses/${courseSlug}/criteria/link`)
          .then((res) => res.data),
      ]);

    return {
      students,
      termConfigs,
      assessmentScores,
      criteriaLinks,
    };
  },
};
