import axiosInstance from "@/lib/axios";

export const studentsService = {
  // Get students
  getStudents: (filters?: {
    page?: number;
    limit?: number;
    search?: string;
    courseId?: string;
  }) =>
    axiosInstance.get("/students", { params: filters }).then((res) => res.data),

  // Get student by ID
  getById: (id: string) =>
    axiosInstance.get(`/students/${id}`).then((res) => res.data),

  // Create student
  create: (data: any) =>
    axiosInstance.post("/students", data).then((res) => res.data),

  // Update student
  update: (id: string, data: any) =>
    axiosInstance.put(`/students/${id}`, data).then((res) => res.data),

  // Delete student
  delete: (id: string) =>
    axiosInstance.delete(`/students/${id}`).then((res) => res.data),

  // Assign RFID
  assignRfid: (data: { rfid: number; studentId: string }) =>
    axiosInstance.post("/students/rfid/assign", data).then((res) => res.data),

  // Import students to course
  importToCourse: (courseSlug: string, students: any[]) =>
    axiosInstance
      .post(`/courses/${courseSlug}/students`, students)
      .then((res) => res.data),
};
