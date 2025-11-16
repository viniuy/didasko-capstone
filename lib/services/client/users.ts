import axiosInstance from "@/lib/axios";

export const usersService = {
  // Get users
  getUsers: (filters?: {
    email?: string;
    search?: string;
    role?: "ADMIN" | "FACULTY" | "ACADEMIC_HEAD";
    department?: string;
  }) =>
    axiosInstance.get("/users", { params: filters }).then((res) => res.data),

  // Create user
  create: (data: any) =>
    axiosInstance.post("/users", data).then((res) => res.data),

  // Update user
  update: (id: string, data: any) =>
    axiosInstance.put(`/users/${id}`, data).then((res) => res.data),

  // Delete user
  delete: (id: string) =>
    axiosInstance.delete(`/users`, { params: { id } }).then((res) => res.data),
};
