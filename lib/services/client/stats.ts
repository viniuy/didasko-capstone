import axiosInstance from "@/lib/axios";

export const statsService = {
  // Get faculty stats
  getFacultyStats: () =>
    axiosInstance.get("/stats/faculty-stats").then((res) => res.data),

  // Get faculty count
  getFacultyCount: () =>
    axiosInstance.get("/stats/faculty-count").then((res) => res.data),

  // Get grades leaderboard
  getGradesLeaderboard: (courseSlug?: string, facultyId?: string) => {
    if (courseSlug) {
      return axiosInstance
        .get(`/stats/grades/leaderboard/${courseSlug}`)
        .then((res) => res.data);
    }
    const url = facultyId
      ? `/stats/grades/leaderboard?facultyId=${facultyId}`
      : "/stats/grades/leaderboard";
    return axiosInstance.get(url).then((res) => res.data);
  },
};
