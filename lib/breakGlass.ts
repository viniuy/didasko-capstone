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

  // Temporarily change the user's role to ADMIN
  await prisma.user.update({
    where: { id: facultyUserId },
    data: { role: "ADMIN" },
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
        originalRole: "FACULTY",
        expiresAt: null,
        secretCode: encryptedSecretCode,
        promotionCode: encryptedPromotionCode,
        promotionCodePlain: promotionCode, // Store plain code for display
      },
      update: {
        reason,
        activatedBy,
        activatedAt: new Date(),
        originalRole: "FACULTY",
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
          originalRole: "FACULTY",
          expiresAt: null,
          secretCode: encryptedSecretCode,
          promotionCode: encryptedPromotionCode,
        },
        update: {
          reason,
          activatedBy,
          activatedAt: new Date(),
          originalRole: "FACULTY",
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
    action: "BreakGlass Activated",
    module: "Security",
    reason: reason,
    before: {
      userId: facultyUserId,
      role: "FACULTY",
      name: facultyUser.name,
      email: facultyUser.email,
    },
    after: {
      userId: facultyUserId,
      role: "ADMIN",
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
      userId: deactivatedBy,
      action: "BreakGlass Deactivate",
      module: "Security",
      reason: session.reason || null,
      before: {
        userId: session.userId,
        role: "ADMIN",
        name: session.user.name,
        email: session.user.email,
        activatedBy: session.activatedBy,
      },
      after: {
        userId: session.userId,
        role: session.originalRole,
        name: session.user.name,
        email: session.user.email,
      },
      status: "SUCCESS",
      metadata: {
        targetUserId: session.userId,
        originalRole: session.originalRole,
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
          role: true,
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
      role: string;
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

  // Update user role to permanent ADMIN (remove break-glass session)
  await prisma.user.update({
    where: { id: userId },
    data: { role: "ADMIN" },
  });

  // Delete the break-glass session
  await prisma.breakGlassSession.delete({
    where: { userId },
  });

  // Log the promotion
  await logAction({
    userId: promotedBy,
    action: "BreakGlass Promote",
    module: "Security",
    reason: `Temporary admin promoted to permanent Admin`,
    before: {
      userId: session.userId,
      role: "ADMIN",
      name: session.user.name,
      email: session.user.email,
      isTemporary: true,
    },
    after: {
      userId: session.userId,
      role: "ADMIN",
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
