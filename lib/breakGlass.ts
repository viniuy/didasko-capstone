import { prisma } from "./prisma";
import { logAction } from "./audit";
import bcrypt from "bcryptjs";

/**
 * Generates a secure random code (32 characters, alphanumeric + special chars)
 */
function generateSecureCode(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const length = 32;
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

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
): Promise<{ secretCode: string; promotionCode: string }> {
  // Prevent user from activating break-glass for themselves
  if (facultyUserId === activatedBy) {
    throw new Error("You cannot activate break-glass for yourself");
  }

  // Get the faculty user to verify role and store original roles
  const facultyUser = await prisma.user.findUnique({
    where: { id: facultyUserId },
    select: { id: true, roles: true, name: true, email: true },
  });

  if (!facultyUser) {
    throw new Error("Faculty user not found");
  }

  if (!facultyUser.roles.includes("FACULTY")) {
    throw new Error("Break-glass can only be activated for Faculty members");
  }

  // Get Academic Head user to send email
  const academicHead = await prisma.user.findUnique({
    where: { id: activatedBy },
    select: { id: true, name: true, email: true },
  });

  if (!academicHead) {
    throw new Error("Academic Head not found");
  }

  // Generate secure codes
  const secretCode = generateSecureCode();
  const promotionCode = generateSecureCode();

  // Encrypt codes with bcrypt
  const saltRounds = 12;
  const encryptedSecretCode = await bcrypt.hash(secretCode, saltRounds);
  const encryptedPromotionCode = await bcrypt.hash(promotionCode, saltRounds);

  // Temporarily add ADMIN role to user's roles (preserve existing roles)
  const updatedRoles = facultyUser.roles.includes("ADMIN")
    ? facultyUser.roles
    : [...facultyUser.roles, "ADMIN"];
  await prisma.user.update({
    where: { id: facultyUserId },
    data: { roles: updatedRoles as any },
  });

  // Create or update break-glass session with encrypted codes
  // Store plain promotion code for Academic Head to view
  // Note: Using raw query to handle case where promotionCodePlain column doesn't exist yet
  try {
    await (prisma.breakGlassSession as any).upsert({
      where: { userId: facultyUserId },
      create: {
        userId: facultyUserId,
        reason,
        activatedBy,
        originalRoles: facultyUser.roles,
        expiresAt: null,
        secretCode: encryptedSecretCode,
        promotionCode: encryptedPromotionCode,
        promotionCodePlain: promotionCode, // Store plain code for display
      },
      update: {
        reason,
        activatedBy,
        activatedAt: new Date(),
        originalRoles: facultyUser.roles,
        expiresAt: null,
        secretCode: encryptedSecretCode,
        promotionCode: encryptedPromotionCode,
        promotionCodePlain: promotionCode, // Store plain code for display
      },
    });
  } catch (error: any) {
    // If promotionCodePlain column doesn't exist yet, create without it
    if (
      error.message?.includes("promotionCodePlain") ||
      error.message?.includes("Unknown argument")
    ) {
      await (prisma.breakGlassSession as any).upsert({
        where: { userId: facultyUserId },
        create: {
          userId: facultyUserId,
          reason,
          activatedBy,
          originalRoles: facultyUser.roles,
          expiresAt: null,
          secretCode: encryptedSecretCode,
          promotionCode: encryptedPromotionCode,
        },
        update: {
          reason,
          activatedBy,
          activatedAt: new Date(),
          originalRoles: facultyUser.roles,
          expiresAt: null,
          secretCode: encryptedSecretCode,
          promotionCode: encryptedPromotionCode,
        },
      });
      console.warn(
        "[BreakGlass] promotionCodePlain column not found. Please run database migration."
      );
    } else {
      throw error;
    }
  }

  // Log the activation
  await logAction({
    userId: activatedBy,
    action: "BREAK_GLASS_ACTIVATED",
    module: "Security",
    reason: reason,
    before: {
      userId: facultyUserId,
      roles: facultyUser.roles,
      name: facultyUser.name,
      email: facultyUser.email,
    },
    after: {
      userId: facultyUserId,
      roles: updatedRoles,
      name: facultyUser.name,
      email: facultyUser.email,
    },
    status: "SUCCESS",
    metadata: {
      facultyUserId,
      academicHeadId: activatedBy,
    },
  });

  // Return plain codes (only returned once, not stored in plain text)
  return { secretCode, promotionCode };
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
  // Note: originalRoles field exists in schema but Prisma client needs regeneration after migration
  const session = (await (prisma.breakGlassSession as any).findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
      reason: true,
      activatedAt: true,
      expiresAt: true,
      activatedBy: true,
      originalRoles: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          roles: true,
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
    originalRoles: string[];
    user: {
      id: string;
      name: string;
      email: string;
      roles: string[];
    };
  } | null;

  if (session) {
    // Restore the original roles (remove ADMIN if it was added)
    const restoredRoles = session.originalRoles.filter(
      (role) => role !== "ADMIN" || session.originalRoles.includes("ADMIN")
    );
    // If ADMIN was in original roles, keep it; otherwise remove it
    const finalRoles = session.originalRoles.includes("ADMIN")
      ? session.originalRoles
      : session.originalRoles.filter((role) => role !== "ADMIN");

    await prisma.user.update({
      where: { id: userId },
      data: { roles: session.originalRoles as any },
    });

    // Delete the break-glass session
    await prisma.breakGlassSession.delete({
      where: { userId },
    });

    // Log the deactivation
    await logAction({
      userId: deactivatedBy,
      action: "BREAK_GLASS_DEACTIVATED",
      module: "Security",
      reason: session.reason || null,
      before: {
        userId: session.userId,
        roles: session.user.roles,
        name: session.user.name,
        email: session.user.email,
        activatedBy: session.activatedBy,
      },
      after: {
        userId: session.userId,
        roles: session.originalRoles,
        name: session.user.name,
        email: session.user.email,
      },
      status: "SUCCESS",
      metadata: {
        targetUserId: session.userId,
        originalRoles: session.originalRoles,
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
          roles: true,
        },
      },
    },
  });
}

/**
 * Promotes a temporary admin (break-glass user) to permanent admin.
 * Requires the promotion code that was emailed to the Academic Head.
 *
 * @param userId - The temporary admin user ID
 * @param promotionCode - The promotion code (plain text)
 * @param promotedBy - Who is promoting (permanent admin user ID)
 */
export async function promoteToPermanentAdmin(
  userId: string,
  promotionCode: string,
  promotedBy: string
): Promise<void> {
  // Get the break-glass session
  const session = (await (prisma.breakGlassSession as any).findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
      promotionCode: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          roles: true,
        },
      },
    },
  })) as {
    id: string;
    userId: string;
    promotionCode: string;
    user: {
      id: string;
      name: string;
      email: string;
      roles: string[];
    };
  } | null;

  if (!session) {
    throw new Error(
      "Break-glass session not found. User is not a temporary admin."
    );
  }

  // Verify the promotion code
  const isValidCode = await bcrypt.compare(
    promotionCode,
    session.promotionCode
  );
  if (!isValidCode) {
    throw new Error("Invalid promotion code");
  }

  // Update user roles to include permanent ADMIN (ensure ADMIN is in roles)
  const updatedRoles = session.user.roles.includes("ADMIN")
    ? session.user.roles
    : [...session.user.roles, "ADMIN"];
  await prisma.user.update({
    where: { id: userId },
    data: { roles: updatedRoles as any },
  });

  // Delete the break-glass session
  await prisma.breakGlassSession.delete({
    where: { userId },
  });

  // Log the promotion
  await logAction({
    userId: promotedBy,
    action: "BREAK_GLASS_PROMOTE",
    module: "Security",
    reason: `Temporary admin promoted to permanent Admin`,
    before: {
      userId: session.userId,
      roles: session.user.roles,
      name: session.user.name,
      email: session.user.email,
      isTemporary: true,
    },
    after: {
      userId: session.userId,
      roles: updatedRoles,
      name: session.user.name,
      email: session.user.email,
      isTemporary: false,
    },
    status: "SUCCESS",
    metadata: {
      targetUserId: session.userId,
    },
  });
}

/**
 * Verifies if a user is a temporary admin (has active break-glass session)
 */
export async function isTemporaryAdmin(userId: string): Promise<boolean> {
  const session = await prisma.breakGlassSession.findUnique({
    where: { userId },
  });
  return !!session;
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
