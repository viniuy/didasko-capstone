import axiosInstance from "@/lib/axios";

export const groupsService = {
  // Get groups
  getGroups: (courseSlug: string) =>
    axiosInstance.get(`/courses/${courseSlug}/groups`).then((res) => res.data),

  // Get group by ID
  getGroup: (courseSlug: string, groupId: string) =>
    axiosInstance
      .get(`/courses/${courseSlug}/groups/${groupId}`)
      .then((res) => res.data),

  // Get group students
  getGroupStudents: (courseSlug: string, groupId: string) =>
    axiosInstance
      .get(`/courses/${courseSlug}/groups/${groupId}/students`)
      .then((res) => res.data),

  // Get group meta
  getGroupMeta: (courseSlug: string) =>
    axiosInstance
      .get(`/courses/${courseSlug}/groups/meta`)
      .then((res) => res.data),

  // Get course with groups data (batched)
  getCourseWithGroupsData: async (courseSlug: string) => {
    const [course, groups, students, meta] = await Promise.all([
      axiosInstance.get(`/courses/${courseSlug}`).then((res) => res.data),
      groupsService.getGroups(courseSlug),
      axiosInstance
        .get(`/courses/${courseSlug}/students`)
        .then((res) => res.data.students || []),
      groupsService.getGroupMeta(courseSlug),
    ]);

    return { course, groups, students, meta };
  },

  // Create group
  create: (courseSlug: string, data: any) =>
    axiosInstance
      .post(`/courses/${courseSlug}/groups`, data)
      .then((res) => res.data),

  // Update group
  update: (courseSlug: string, groupId: string, data: any) =>
    axiosInstance
      .put(`/courses/${courseSlug}/groups/${groupId}`, data)
      .then((res) => res.data),

  // Delete group
  delete: (courseSlug: string, groupId: string) =>
    axiosInstance
      .delete(`/courses/${courseSlug}/groups/${groupId}`)
      .then((res) => res.data),
};
