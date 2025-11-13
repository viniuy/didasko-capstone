export type UserRole = "FACULTY" | "ACADEMIC_HEAD";

export interface CoursePermissions {
  canManageStudents: boolean;
  canImportStudents: boolean;
  canImportCourses: boolean;
  canExportData: boolean;
  canViewAllCourses: boolean;
  canFilterByFaculty: boolean;
  canCreateCourse: boolean;
  canEditOwnCourse: boolean;
  canDeleteOwnCourse: boolean;
  canArchiveOwnCourse: boolean; // NEW: Only archive own courses
}

/**
 * Get permissions based on user role
 */
export function getCoursePermissions(userRole: UserRole): CoursePermissions {
  const isFaculty = userRole === "FACULTY";
  const isAcademicHead = userRole === "ACADEMIC_HEAD";

  return {
    canManageStudents: isFaculty,
    canImportStudents: isFaculty,
    canImportCourses: true,
    canExportData: true,

    canViewAllCourses: isAcademicHead,
    canFilterByFaculty: isAcademicHead,

    canCreateCourse: true,
    canEditOwnCourse: true,
    canDeleteOwnCourse: true,
    canArchiveOwnCourse: true, // Both roles can archive their own courses
  };
}

/**
 * Check if user can manage students in a course
 */
export function canManageCourseStudents(
  userRole: UserRole,
  courseOwnerId: string,
  currentUserId: string
): boolean {
  if (userRole !== "FACULTY") return false;

  return courseOwnerId === currentUserId;
}

/**
 * Check if user can edit a specific course
 */
export function canEditCourse(
  courseOwnerId: string,
  currentUserId: string
): boolean {
  return courseOwnerId === currentUserId;
}

/**
 * Check if user can archive a specific course
 */
export function canArchiveCourse(
  courseOwnerId: string,
  currentUserId: string
): boolean {
  // Only the course owner can archive/unarchive
  return courseOwnerId === currentUserId;
}

/**
 * Filter courses that user can archive
 */
export function filterArchivableCourses(
  courses: any[],
  currentUserId: string
): any[] {
  return courses.filter((course) => course.facultyId === currentUserId);
}

/**
 * Filter courses based on user role and permissions
 */
export function filterCoursesByRole(
  courses: any[],
  userRole: UserRole,
  userId: string,
  selectedFacultyId?: string
): any[] {
  // Academic Head can view all courses or filter by faculty
  if (userRole === "ACADEMIC_HEAD") {
    if (!selectedFacultyId || selectedFacultyId === "ALL") {
      return courses;
    }
    return courses.filter((course) => course.facultyId === selectedFacultyId);
  }

  // Faculty only sees their own courses
  return courses.filter((course) => course.facultyId === userId);
}
