import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { Permission, hasPermission, canViewLog } from "./roles";
import { isBreakGlassActive } from "./breakGlass";

/**
 * User type with roles
 */
export interface UserWithRole {
  id: string;
  roles: Role[];
}

/**
 * Custom error for unauthorized access (401)
 */
export class UnauthorizedError extends Error {
  constructor(message: string = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Custom error for forbidden access (403)
 */
export class ForbiddenError extends Error {
  constructor(message: string = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Requires the user to have one of the allowed roles.
 *
 * @param user - User object (can be null/undefined)
 * @param allowedRoles - Array of allowed roles
 * @throws UnauthorizedError if no user
 * @throws ForbiddenError if user roles not allowed
 */
export function requireRole(
  user: UserWithRole | null | undefined,
  allowedRoles: Role[]
): void {
  if (!user || !user.roles || user.roles.length === 0) {
    throw new UnauthorizedError("Authentication required");
  }

  const hasAllowedRole = user.roles.some((role) => allowedRoles.includes(role));
  if (!hasAllowedRole) {
    const requiredRoles = allowedRoles.join(" or ");
    const userRoles = user.roles.join(", ");
    throw new ForbiddenError(
      `Access denied. Required role: ${requiredRoles}. Your roles: ${userRoles}`
    );
  }
}

/**
 * Requires the user to be an ADMIN.
 *
 * @param user - User object
 * @throws UnauthorizedError if no user
 * @throws ForbiddenError if not ADMIN
 */
export function requireAdmin(user: UserWithRole | null | undefined): void {
  if (!user || !user.roles || user.roles.length === 0) {
    throw new UnauthorizedError("Authentication required");
  }

  if (!user.roles.includes(Role.ADMIN)) {
    throw new ForbiddenError("Access denied. Required role: ADMIN");
  }
}

/**
 * Requires the user to be ADMIN or ACADEMIC_HEAD.
 *
 * @param user - User object
 * @throws UnauthorizedError if no user
 * @throws ForbiddenError if not ADMIN or ACADEMIC_HEAD
 */
export function requireAcademicHead(
  user: UserWithRole | null | undefined
): void {
  requireRole(user, [Role.ADMIN, Role.ACADEMIC_HEAD]);
}

/**
 * Requires break-glass override to be active (for ACADEMIC_HEAD).
 * ADMIN is always allowed.
 *
 * @param user - User object
 * @throws UnauthorizedError if no user
 * @throws ForbiddenError if break-glass not active (for ACADEMIC_HEAD)
 */
export async function requireBreakGlass(
  user: UserWithRole | null | undefined
): Promise<void> {
  if (!user || !user.roles || user.roles.length === 0) {
    throw new UnauthorizedError("Authentication required");
  }

  // ADMIN is always allowed
  if (user.roles.includes(Role.ADMIN)) {
    return;
  }

  // ACADEMIC_HEAD needs break-glass active
  if (user.roles.includes(Role.ACADEMIC_HEAD)) {
    const isActive = await isBreakGlassActive(user.id);
    if (!isActive) {
      throw new ForbiddenError("Break-glass override required");
    }
    return;
  }

  // FACULTY cannot use break-glass
  throw new ForbiddenError("Requires elevated privileges");
}

/**
 * Requires the user to have a specific permission.
 *
 * @param user - User object
 * @param permission - Permission to check
 * @throws UnauthorizedError if no user
 * @throws ForbiddenError if permission not granted
 */
export async function requirePermission(
  user: UserWithRole | null | undefined,
  permission: Permission
): Promise<void> {
  if (!user) {
    throw new UnauthorizedError("Authentication required");
  }

  const hasPerm = await hasPermission(user, permission);
  if (!hasPerm) {
    throw new ForbiddenError(`Permission denied: ${permission}`);
  }
}

/**
 * Handles authorization errors and returns appropriate HTTP responses.
 *
 * @param error - The error to handle
 * @returns NextResponse with appropriate status code
 */
export function handleAuthError(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  // Re-throw unknown errors
  throw error;
}
