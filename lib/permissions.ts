import { Role } from "@prisma/client";

/**
 * Centralized permissions configuration
 * Maps permission keys to arrays of roles that have access
 */
export const Permissions = {
  CAN_ACCESS_FACULTY_DASHBOARD: ["FACULTY"] as Role[],
  CAN_ACCESS_ADMIN_DASHBOARD: ["ADMIN"] as Role[],
  CAN_ACCESS_ACADEMIC_HEAD_DASHBOARD: ["ACADEMIC_HEAD"] as Role[],
  CAN_ACCESS_GRADING: ["FACULTY"] as Role[],
  CAN_ACCESS_ATTENDANCE: ["FACULTY"] as Role[],
  CAN_ACCESS_COURSES: ["FACULTY"] as Role[],
  CAN_ACCESS_FACULTY_LOAD: ["ACADEMIC_HEAD"] as Role[],
  CAN_VIEW_COURSES: ["ACADEMIC_HEAD", "FACULTY"] as Role[],
  CAN_CREATE_COURSES: ["FACULTY"] as Role[],
  CAN_ACCESS_AUDIT_LOGS: ["ADMIN", "ACADEMIC_HEAD"] as Role[],
} as const;

/**
 * User type with roles for permission checking
 */
export interface UserWithRoles {
  roles: Role[];
}

/**
 * Checks if a user has access to a specific permission
 *
 * @param user - User object with roles array
 * @param permission - Permission key to check
 * @returns True if user has at least one role that grants the permission
 */
export function hasAccess(
  user: UserWithRoles | null | undefined,
  permission: keyof typeof Permissions
): boolean {
  if (!user || !user.roles || user.roles.length === 0) {
    return false;
  }

  const allowedRoles = Permissions[permission];
  return user.roles.some((role) => allowedRoles.includes(role));
}
