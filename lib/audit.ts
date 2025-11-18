import { PrismaClient } from "@prisma/client";

// Create a separate PrismaClient instance for audit logging to prevent recursion
// This instance should NOT have middleware applied
let auditPrisma: PrismaClient | null = null;

function getAuditPrisma(): PrismaClient {
  if (!auditPrisma) {
    auditPrisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error"] : [],
    });
  }
  return auditPrisma;
}

/**
 * Maximum size for before/after fields (50KB in bytes)
 */
const MAX_FIELD_SIZE = 50 * 1024;

/**
 * Sanitizes an object to ensure it doesn't exceed size limits.
 * If it exceeds, returns a truncated version with metadata.
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  try {
    const jsonString = JSON.stringify(obj);
    const size = Buffer.byteLength(jsonString, "utf8");

    if (size <= MAX_FIELD_SIZE) {
      return obj;
    }

    // Object is too large, return truncated metadata
    return {
      _truncated: true,
      _size: size,
      _message: "Object exceeded maximum size limit and was truncated",
    };
  } catch (error) {
    // If stringification fails, return error metadata
    return {
      _error: true,
      _message: "Failed to serialize object",
    };
  }
}

/**
 * Parameters for logging an action
 */
export interface LogActionParams {
  userId?: string | null;
  action: string;
  module: string;
  before?: any;
  after?: any;
  reason?: string | null;
  ip?: string | null;
}

/**
 * Logs an action to the audit log.
 * NEVER throws errors - logs to console instead.
 */
export async function logAction(params: LogActionParams): Promise<void> {
  try {
    const { userId, action, module, before, after, reason, ip } = params;

    // Validate required fields
    if (!action || !module) {
      console.error(
        "[Audit] Missing required fields: action and module are required"
      );
      return;
    }

    // Sanitize before/after objects
    const sanitizedBefore = sanitizeObject(before);
    const sanitizedAfter = sanitizeObject(after);

    // Truncate action and module to max length
    const truncatedAction = action.substring(0, 100);
    const truncatedModule = module.substring(0, 100);
    const truncatedIp = ip ? ip.substring(0, 45) : null;

    const prisma = getAuditPrisma();

    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action: truncatedAction,
        module: truncatedModule,
        before: sanitizedBefore,
        after: sanitizedAfter,
        reason: reason || null,
        ip: truncatedIp,
      },
    });
  } catch (error) {
    // NEVER throw from audit logging - log to console instead
    console.error("[Audit] Failed to log action:", error);
    console.error("[Audit] Action params:", {
      action: params.action,
      module: params.module,
      userId: params.userId,
    });
  }
}

/**
 * Compares two objects and returns only the fields that changed.
 * Returns an object with 'before' and 'after' containing only changed fields.
 */
export function getChangedFields(
  before: any,
  after: any
): {
  before: any;
  after: any;
} {
  if (!before && !after) {
    return { before: null, after: null };
  }

  if (!before) {
    return { before: null, after };
  }

  if (!after) {
    return { before, after: null };
  }

  const changed: { before: any; after: any } = { before: {}, after: {} };

  // Check all keys in 'after'
  for (const key in after) {
    if (Object.prototype.hasOwnProperty.call(after, key)) {
      const beforeValue = before[key];
      const afterValue = after[key];

      // Deep comparison for objects/arrays
      if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
        changed.before[key] = beforeValue;
        changed.after[key] = afterValue;
      }
    }
  }

  // Check for keys that were removed (exist in before but not in after)
  for (const key in before) {
    if (Object.prototype.hasOwnProperty.call(before, key)) {
      if (!(key in after)) {
        changed.before[key] = before[key];
        changed.after[key] = undefined;
      }
    }
  }

  // Return null if no changes
  if (
    Object.keys(changed.before).length === 0 &&
    Object.keys(changed.after).length === 0
  ) {
    return { before: null, after: null };
  }

  return changed;
}
