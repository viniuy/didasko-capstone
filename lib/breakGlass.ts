import { prisma } from "./prisma";
import { logAction } from "./audit";
import { getClientIp } from "./utils/ip";
import { NextRequest } from "next/server";

/**
 * Break-glass session duration in hours
 */
export const BREAK_GLASS_DURATION_HOURS = 1;

/**
 * Activates break-glass override for a user.
 *
 * @param userId - The user ID to activate break-glass for
 * @param reason - Justification for activation
 * @param activatedBy - Who activated it (user ID or name)
 * @param ip - Optional IP address (will be extracted from request if not provided)
 */
export async function activateBreakGlass(
  userId: string,
  reason: string,
  activatedBy: string,
  ip?: string
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + BREAK_GLASS_DURATION_HOURS);

  // Upsert break-glass session
  await prisma.breakGlassSession.upsert({
    where: { userId },
    create: {
      userId,
      reason,
      activatedBy,
      expiresAt,
    },
    update: {
      reason,
      activatedBy,
      activatedAt: new Date(),
      expiresAt,
    },
  });

  // Log the activation
  await logAction({
    userId,
    action: "BREAK_GLASS_ACTIVATED",
    module: "Security",
    reason,
    after: {
      expiresAt: expiresAt.toISOString(),
      activatedBy,
    },
    ip: ip || undefined,
  });
}

/**
 * Deactivates break-glass override for a user.
 *
 * @param userId - The user ID to deactivate break-glass for
 * @param deactivatedBy - Who deactivated it (user ID or name)
 * @param ip - Optional IP address
 */
export async function deactivateBreakGlass(
  userId: string,
  deactivatedBy: string,
  ip?: string
): Promise<void> {
  const session = await prisma.breakGlassSession.findUnique({
    where: { userId },
  });

  if (session) {
    await prisma.breakGlassSession.delete({
      where: { userId },
    });

    // Log the deactivation
    await logAction({
      userId,
      action: "BREAK_GLASS_DEACTIVATED",
      module: "Security",
      reason: `Deactivated by ${deactivatedBy}`,
      before: {
        expiresAt: session.expiresAt.toISOString(),
        activatedBy: session.activatedBy,
        reason: session.reason,
      },
      ip: ip || undefined,
    });
  }
}

/**
 * Checks if break-glass override is active for a user.
 * Auto-deletes expired sessions.
 *
 * @param userId - The user ID to check
 * @returns True if break-glass is active, false otherwise
 */
export async function isBreakGlassActive(userId: string): Promise<boolean> {
  const session = await prisma.breakGlassSession.findUnique({
    where: { userId },
  });

  if (!session) {
    return false;
  }

  // Check if expired
  if (session.expiresAt < new Date()) {
    // Auto-delete expired session
    await prisma.breakGlassSession.delete({
      where: { userId },
    });

    // Log expiration
    await logAction({
      userId,
      action: "BREAK_GLASS_EXPIRED",
      module: "Security",
      reason: "Break-glass session expired",
      before: {
        expiresAt: session.expiresAt.toISOString(),
        activatedBy: session.activatedBy,
      },
    });

    return false;
  }

  return true;
}

/**
 * Gets the break-glass session for a user.
 *
 * @param userId - The user ID
 * @returns Break-glass session with user relation, or null if not found
 */
export async function getBreakGlassSession(userId: string) {
  return await prisma.breakGlassSession.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });
}

/**
 * Cleans up all expired break-glass sessions.
 * Should be called by a cron job periodically.
 */
export async function cleanupExpiredBreakGlassSessions(): Promise<void> {
  const now = new Date();
  const expiredSessions = await prisma.breakGlassSession.findMany({
    where: {
      expiresAt: {
        lt: now,
      },
    },
  });

  for (const session of expiredSessions) {
    await deactivateBreakGlass(session.userId, "SYSTEM", "system");
  }
}
