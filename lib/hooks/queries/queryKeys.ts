/**
 * Centralized query keys for React Query
 * Uses hierarchical pattern: queryKeys.entity.type(params)
 */

export const queryKeys = {
  // Courses
  courses: {
    all: ["courses"] as const,
    lists: () => [...queryKeys.courses.all, "list"] as const,
    list: (filters?: {
      facultyId?: string;
      search?: string;
      department?: string;
      semester?: string;
      code?: string;
      section?: string;
      status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
    }) => [...queryKeys.courses.lists(), filters] as const,
    detail: (slug: string) =>
      [...queryKeys.courses.all, "detail", slug] as const,
    students: (slug: string) =>
      [...queryKeys.courses.all, "students", slug] as const,
    schedules: (slug: string) =>
      [...queryKeys.courses.all, "schedules", slug] as const,
    analytics: (slug: string) =>
      [...queryKeys.courses.all, "analytics", slug] as const,
    active: (filters?: {
      facultyId?: string;
      search?: string;
      department?: string;
      semester?: string;
    }) => [...queryKeys.courses.all, "active", filters] as const,
    archived: (filters?: { facultyId?: string; search?: string }) =>
      [...queryKeys.courses.all, "archived", filters] as const,
    stats: (slug: string) => [...queryKeys.courses.all, "stats", slug] as const,
    statsBatch: (slugs: string[]) =>
      [...queryKeys.courses.all, "statsBatch", ...slugs.sort()] as const,
  },

  // Students
  students: {
    all: ["students"] as const,
    lists: () => [...queryKeys.students.all, "list"] as const,
    list: (filters?: {
      page?: number;
      limit?: number;
      search?: string;
      courseId?: string;
    }) => [...queryKeys.students.lists(), filters] as const,
    detail: (id: string) => [...queryKeys.students.all, "detail", id] as const,
    byCourse: (courseSlug: string) =>
      [...queryKeys.students.all, "byCourse", courseSlug] as const,
    image: (id: string) => [...queryKeys.students.all, "image", id] as const,
    rfid: (rfidId: string) =>
      [...queryKeys.students.all, "rfid", rfidId] as const,
  },

  // Attendance
  attendance: {
    all: ["attendance"] as const,
    byCourse: (courseSlug: string) =>
      [...queryKeys.attendance.all, "byCourse", courseSlug] as const,
    dates: (courseSlug: string) =>
      [...queryKeys.attendance.all, "dates", courseSlug] as const,
    stats: (courseSlug: string) =>
      [...queryKeys.attendance.all, "stats", courseSlug] as const,
    leaderboard: (courseSlug?: string) =>
      courseSlug
        ? ([...queryKeys.attendance.all, "leaderboard", courseSlug] as const)
        : ([...queryKeys.attendance.all, "leaderboard"] as const),
    leaderboardAll: () =>
      [...queryKeys.attendance.all, "leaderboard", "all"] as const,
    class: (courseSlug: string, date?: string) =>
      [
        ...queryKeys.attendance.all,
        "class",
        courseSlug,
        date || "today",
      ] as const,
  },

  // Grading
  grading: {
    all: ["grading"] as const,
    classRecord: (courseSlug: string) =>
      [...queryKeys.grading.all, "classRecord", courseSlug] as const,
    recitation: (courseSlug: string) =>
      [...queryKeys.grading.all, "recitation", courseSlug] as const,
    grades: (courseSlug: string) =>
      [...queryKeys.grading.all, "grades", courseSlug] as const,
    termConfigs: (courseSlug: string) =>
      [...queryKeys.grading.all, "termConfigs", courseSlug] as const,
    assessmentScores: (courseSlug: string) =>
      [...queryKeys.grading.all, "assessmentScores", courseSlug] as const,
    termGrades: (courseSlug: string, term: string) =>
      [...queryKeys.grading.all, "termGrades", courseSlug, term] as const,
  },

  // Groups
  groups: {
    all: ["groups"] as const,
    byCourse: (courseSlug: string) =>
      [...queryKeys.groups.all, "byCourse", courseSlug] as const,
    detail: (courseSlug: string, groupId: string) =>
      [...queryKeys.groups.all, "detail", courseSlug, groupId] as const,
    students: (courseSlug: string, groupId: string) =>
      [...queryKeys.groups.all, "students", courseSlug, groupId] as const,
    criteria: (courseSlug: string, groupId: string) =>
      [...queryKeys.groups.all, "criteria", courseSlug, groupId] as const,
    meta: (courseSlug: string) =>
      [...queryKeys.groups.all, "meta", courseSlug] as const,
  },

  // Reporting
  reporting: {
    all: ["reporting"] as const,
    individual: (courseSlug: string) =>
      [...queryKeys.reporting.all, "individual", courseSlug] as const,
    group: (courseSlug: string, groupId?: string) =>
      groupId
        ? ([...queryKeys.reporting.all, "group", courseSlug, groupId] as const)
        : ([...queryKeys.reporting.all, "group", courseSlug] as const),
  },

  // Criteria
  criteria: {
    all: ["criteria"] as const,
    byCourse: (courseSlug: string) =>
      [...queryKeys.criteria.all, "byCourse", courseSlug] as const,
    detail: (courseSlug: string, criteriaId: string) =>
      [...queryKeys.criteria.all, "detail", courseSlug, criteriaId] as const,
    recitation: (courseSlug: string) =>
      [...queryKeys.criteria.all, "recitation", courseSlug] as const,
    group: (courseSlug: string) =>
      [...queryKeys.criteria.all, "group", courseSlug] as const,
    linked: (courseSlug: string) =>
      [...queryKeys.criteria.all, "linked", courseSlug] as const,
  },

  // Admin
  admin: {
    all: ["admin"] as const,
    users: (filters?: {
      search?: string;
      role?: string;
      department?: string;
    }) => [...queryKeys.admin.all, "users", filters] as const,
    faculty: (filters?: { department?: string; search?: string }) =>
      [...queryKeys.admin.all, "faculty", filters] as const,
    facultyRequests: (filters?: { status?: string }) =>
      [...queryKeys.admin.all, "facultyRequests", filters] as const,
    online: () => [...queryKeys.admin.all, "online"] as const,
    breakGlass: (userId?: string) =>
      userId
        ? ([...queryKeys.admin.all, "breakGlass", userId] as const)
        : ([...queryKeys.admin.all, "breakGlass"] as const),
  },

  // Audit Logs
  auditLogs: {
    all: ["auditLogs"] as const,
    lists: (filters?: {
      page?: number;
      pageSize?: number;
      action?: string;
      actions?: string[];
      userId?: string;
      faculty?: string[];
      module?: string;
      modules?: string[];
      startDate?: string;
      endDate?: string;
    }) => [...queryKeys.auditLogs.all, "list", filters] as const,
  },

  // Stats
  stats: {
    all: ["stats"] as const,
    facultyCount: () => [...queryKeys.stats.all, "facultyCount"] as const,
    facultyStats: () => [...queryKeys.stats.all, "facultyStats"] as const,
    gradesLeaderboard: (slug?: string) =>
      slug
        ? ([...queryKeys.stats.all, "gradesLeaderboard", slug] as const)
        : ([...queryKeys.stats.all, "gradesLeaderboard"] as const),
    courseAnalytics: (slug: string) =>
      [...queryKeys.stats.all, "courseAnalytics", slug] as const,
    attendanceRanking: () =>
      [...queryKeys.stats.all, "attendanceRanking"] as const,
  },

  // Notes
  notes: {
    all: ["notes"] as const,
    lists: () => [...queryKeys.notes.all, "list"] as const,
    detail: (id: string) => [...queryKeys.notes.all, "detail", id] as const,
  },

  // Events
  events: {
    all: ["events"] as const,
    lists: () => [...queryKeys.events.all, "list"] as const,
    byRole: (role: string) =>
      [...queryKeys.events.all, "byRole", role] as const,
  },

  // Profile
  profile: {
    all: ["profile"] as const,
    current: () => [...queryKeys.profile.all, "current"] as const,
  },

  // Faculty Load
  facultyLoad: {
    all: ["facultyLoad"] as const,
    current: () => [...queryKeys.facultyLoad.all, "current"] as const,
  },
} as const;
