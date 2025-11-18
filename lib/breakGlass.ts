import { prisma } from "./prisma";
import { logAction } from "./audit";

/**
 * Activates break-glass override by temporarily promoting a Faculty member to Admin.
 * Academic Head can select a Faculty member to grant temporary Admin privileges.
 *
 * @param facultyUserId - The Faculty user ID to promote to Admin
 * @param reason - Justification for activation
 * @param activatedBy - Who activated it (Academic Head user ID)
 */
export async function activateBreakGlass(
  facultyUserId: string,
  reason: string,
  activatedBy: string
): Promise<void> {
  // Get the faculty user to verify role and store original role
  const facultyUser = await prisma.user.findUnique({
    where: { id: facultyUserId },
    select: { id: true, role: true, name: true, email: true },
  });

  if (!facultyUser) {
    throw new Error("Faculty user not found");
  }

  if (facultyUser.role !== "FACULTY") {
    throw new Error("Break-glass can only be activated for Faculty members");
  }

  // Temporarily change the user's role to ADMIN
  await prisma.user.update({
    where: { id: facultyUserId },
    data: { role: "ADMIN" },
  });

  // Create or update break-glass session (no expiration - manual deactivation only)
  // Note: originalRole field exists in schema but Prisma client needs regeneration after migration
  await (prisma.breakGlassSession as any).upsert({
    where: { userId: facultyUserId },
    create: {
      userId: facultyUserId,
      reason,
      activatedBy,
      originalRole: "FACULTY",
      expiresAt: null, // No automatic expiration - nullable field
    },
    update: {
      reason,
      activatedBy,
      activatedAt: new Date(),
      originalRole: "FACULTY",
      expiresAt: null,
    },
  });

  // Log the activation
  await logAction({
    userId: facultyUserId,
    action: "BREAK_GLASS_ACTIVATED",
    module: "Security",
    reason: `Faculty member ${facultyUser.name} (${facultyUser.email}) temporarily promoted to Admin. Reason: ${reason}`,
    before: {
      role: "FACULTY",
    },
    after: {
      role: "ADMIN",
      activatedBy,
    },
  });
}

/**
 * Deactivates break-glass override and restores the user's original role.
 *
 * @param userId - The user ID to deactivate break-glass for
 * @param deactivatedBy - Who deactivated it (user ID or name)
 */
export async function deactivateBreakGlass(
  userId: string,
  deactivatedBy: string
): Promise<void> {
  // Note: originalRole field exists in schema but Prisma client needs regeneration after migration
  const session = (await (prisma.breakGlassSession as any).findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
      reason: true,
      activatedAt: true,
      expiresAt: true,
      activatedBy: true,
      originalRole: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  })) as {
    id: string;
    userId: string;
    reason: string;
    activatedAt: Date;
    expiresAt: Date | null;
    activatedBy: string | null;
    originalRole: "FACULTY" | "ADMIN" | "ACADEMIC_HEAD";
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
  } | null;

  if (session) {
    // Restore the original role
    await prisma.user.update({
      where: { id: userId },
      data: { role: session.originalRole },
    });

    // Delete the break-glass session
    await prisma.breakGlassSession.delete({
      where: { userId },
    });

    // Log the deactivation
    await logAction({
      userId,
      action: "BREAK_GLASS_DEACTIVATED",
      module: "Security",
      reason: `Break-glass deactivated by ${deactivatedBy}. Role restored from ADMIN to ${session.originalRole}.`,
      before: {
        role: "ADMIN",
        activatedBy: session.activatedBy,
        reason: session.reason,
      },
      after: {
        role: session.originalRole,
      },
    });
  }
}

/**
 * Checks if break-glass override is active for a user.
 * Since we removed expiration, this just checks if a session exists.
 *
 * @param userId - The user ID to check
 * @returns True if break-glass is active, false otherwise
 */
export async function isBreakGlassActive(userId: string): Promise<boolean> {
  const session = await prisma.breakGlassSession.findUnique({
    where: { userId },
  });

  return !!session;
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
    await deactivateBreakGlass(session.userId, "SYSTEM");
  }
}
