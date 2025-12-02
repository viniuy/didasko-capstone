import { Role } from "@prisma/client";
import { isBreakGlassActive } from "./breakGlass";

/**
 * Permission enum
 */
export enum Permission {
  MANAGE_USERS = "MANAGE_USERS",
  MANAGE_ADMINS = "MANAGE_ADMINS",
  MANAGE_FACULTY = "MANAGE_FACULTY",
  VIEW_USERS = "VIEW_USERS",
  MANAGE_COURSES = "MANAGE_COURSES",
  VIEW_COURSES = "VIEW_COURSES",
  VIEW_ALL_LOGS = "VIEW_ALL_LOGS",
  VIEW_LIMITED_LOGS = "VIEW_LIMITED_LOGS",
  USE_BREAK_GLASS = "USE_BREAK_GLASS",
  ACTIVATE_BREAK_GLASS = "ACTIVATE_BREAK_GLASS",
}

/**
 * Permission matrix: maps roles to their permissions
 */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: [
    Permission.MANAGE_USERS,
    Permission.MANAGE_ADMINS,
    Permission.MANAGE_FACULTY,
    Permission.VIEW_USERS,
    Permission.MANAGE_COURSES,
    Permission.VIEW_COURSES,
    Permission.VIEW_ALL_LOGS,
    Permission.VIEW_LIMITED_LOGS,
    Permission.USE_BREAK_GLASS,
    Permission.ACTIVATE_BREAK_GLASS,
  ],
  [Role.ACADEMIC_HEAD]: [
    Permission.MANAGE_FACULTY,
    Permission.VIEW_USERS,
    Permission.MANAGE_COURSES,
    Permission.VIEW_COURSES,
    Permission.VIEW_LIMITED_LOGS,
    Permission.USE_BREAK_GLASS, // Only when break-glass is active
  ],
  [Role.FACULTY]: [
    Permission.VIEW_COURSES,
    Permission.MANAGE_COURSES, // Own courses only
  ],
};

/**
 * Allowed modules for ACADEMIC_HEAD to view in logs
 */
const ACADEMIC_HEAD_ALLOWED_MODULES = [
  "Course",
  "Courses",
  "Class Management",
  "Faculty",
  "Attendance",
  "Enrollment",
];

/**
 * User type with roles
 */
export interface UserWithRole {
  id: string;
  roles: Role[];
}

/**
 * Checks if a user has a specific permission.
 *
 * @param user - User object with roles
 * @param permission - Permission to check
 * @returns True if user has permission, false otherwise
 */
export async function hasPermission(
  user: UserWithRole | null | undefined,
  permission: Permission
): Promise<boolean> {
  if (!user || !user.roles || user.roles.length === 0) {
    return false;
  }

  // ADMIN always has all permissions
  if (user.roles.includes(Role.ADMIN)) {
    return true;
  }

  // ACADEMIC_HEAD needs break-glass for USE_BREAK_GLASS permission
  if (
    user.roles.includes(Role.ACADEMIC_HEAD) &&
    permission === Permission.USE_BREAK_GLASS
  ) {
    return await isBreakGlassActive(user.id);
  }

  // Check if any role has the permission (union logic)
  for (const role of user.roles) {
    const rolePermissions = ROLE_PERMISSIONS[role] || [];
    if (rolePermissions.includes(permission)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if an actor can manage a target user.
 *
 * @param actor - The user performing the action
 * @param targetUser - The user being managed
 * @returns True if actor can manage target, false otherwise
 */
export async function canManageUser(
  actor: UserWithRole | null | undefined,
  targetUser: UserWithRole
): Promise<boolean> {
  if (!actor || !actor.roles || actor.roles.length === 0) {
    return false;
  }

  // ADMIN can manage anyone
  if (actor.roles.includes(Role.ADMIN)) {
    return true;
  }

  // ACADEMIC_HEAD can manage FACULTY
  if (
    actor.roles.includes(Role.ACADEMIC_HEAD) &&
    targetUser.roles.includes(Role.FACULTY)
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if a user can view logs for a specific module.
 *
 * @param userRoles - The user's roles
 * @param logModule - The module name from the log
 * @returns True if user can view the log, false otherwise
 */
export function canViewLog(
  userRoles: Role[] | undefined,
  logModule: string
): boolean {
  if (!userRoles || userRoles.length === 0) {
    return false;
  }

  // ADMIN can view all logs
  if (userRoles.includes(Role.ADMIN)) {
    return true;
  }

  // ACADEMIC_HEAD can view limited modules
  if (userRoles.includes(Role.ACADEMIC_HEAD)) {
    const moduleLower = logModule.toLowerCase();
    return ACADEMIC_HEAD_ALLOWED_MODULES.some((allowed) =>
      moduleLower.includes(allowed.toLowerCase())
    );
  }

  // FACULTY cannot view logs
  return false;
}
