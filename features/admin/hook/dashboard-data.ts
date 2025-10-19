import axiosInstance from "@/lib/axios";

export interface DashboardData {
  totalStudents: number;
  totalTeachers: number;
  totalCourses: number;
  totalAttendance: number;
  recentActivity: {
    id: string;
    type: "attendance" | "course" | "user";
    description: string;
    timestamp: string;
  }[];
  grantedCount: number;
  deniedCount: number;
  totalUsers: number;
  fullTimeCount: number;
  partTimeCount: number;
  users: any[];
}

const fetchDashboardData = async () => {
  const [
    studentsCount,
    teachersCount,
    coursesCount,
    attendanceCount,
    recentActivity,
    users,
    fullTimeCount,
    partTimeCount,
    grantedCount,
    deniedCount,
    totalUsers,
  ] = await Promise.all([
    axiosInstance.get("/api/students/count").then((res) => res.data),
    axiosInstance.get("/api/teachers/count").then((res) => res.data),
    axiosInstance.get("/api/courses/count").then((res) => res.data),
    axiosInstance.get("/api/attendance/count").then((res) => res.data),
    axiosInstance.get("/api/activity/recent").then((res) => res.data),
    axiosInstance.get("/users").then((res) => res.data.users || []),
    axiosInstance.get("/users/count/full-time").then((res) => res.data),
    axiosInstance.get("/users/count/part-time").then((res) => res.data),
    axiosInstance.get("/users/count/granted").then((res) => res.data),
    axiosInstance.get("/users/count/denied").then((res) => res.data),
    axiosInstance.get("/users/count").then((res) => res.data),
  ]);

  return {
    totalStudents: studentsCount,
    totalTeachers: teachersCount,
    totalCourses: coursesCount,
    totalAttendance: attendanceCount,
    recentActivity,
    users,
    fullTimeCount,
    partTimeCount,
    grantedCount,
    deniedCount,
    totalUsers,
  };
};

export async function getDashboardData(): Promise<DashboardData> {
  return fetchDashboardData();
}
