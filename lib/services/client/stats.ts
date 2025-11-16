import axiosInstance from "@/lib/axios";

export const statsService = {
  // Get faculty stats
  getFacultyStats: () =>
    axiosInstance.get("/stats/faculty-stats").then((res) => res.data),

  // Get faculty count
  getFacultyCount: () =>
    axiosInstance.get("/stats/faculty-count").then((res) => res.data),

  // Get grades leaderboard
  getGradesLeaderboard: (courseSlug?: string) => {
    const url = courseSlug
      ? `/stats/grades/leaderboard/${courseSlug}`
      : "/stats/grades/leaderboard";
    return axiosInstance.get(url).then((res) => res.data);
  },
};
