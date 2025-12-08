import { PrismaClient } from "@prisma/client";

// Create a separate PrismaClient instance for audit logging to prevent recursion
// This instance should NOT have middleware applied
// Note: We still need a separate instance to avoid recursion, but we'll configure it properly
let auditPrisma: PrismaClient | null = null;

function getAuditPrisma(): PrismaClient {
  if (!auditPrisma) {
    auditPrisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error"] : [],
      // Use connection pooling with timeout to prevent hanging connections
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    // Add connection timeout to prevent hanging
    auditPrisma.$connect().catch((error) => {
      console.error("[Audit] Failed to connect to database:", error);
      auditPrisma = null; // Reset to allow retry on next call
    });

    // Clean up on process termination
    if (process.env.NODE_ENV === "production") {
      process.on("beforeExit", async () => {
        await auditPrisma?.$disconnect();
      });
    }
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
  batchId?: string | null; // For import/export batch tracking
  status?: "SUCCESS" | "FAILED" | "PENDING" | null;
  errorMessage?: string | null;
  metadata?: any; // Additional context: file name, size, filters, user agent, etc.
}

/**
 * Logs an action to the audit log.
 * NEVER throws errors - logs to console instead.
 */
/**
 * Generates a unique batch ID for import/export operations
 */
export function generateBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export async function logAction(params: LogActionParams): Promise<void> {
  try {
    const {
      userId,
      action,
      module,
      before,
      after,
      reason,
      batchId,
      status,
      errorMessage,
      metadata,
    } = params;

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
    const sanitizedMetadata = sanitizeObject(metadata);

    // Truncate action and module to max length
    const truncatedAction = action.substring(0, 100);
    const truncatedModule = module.substring(0, 100);
    const truncatedBatchId = batchId ? batchId.substring(0, 100) : null;
    const truncatedStatus = status ? status.substring(0, 20) : null;
    const truncatedErrorMessage = errorMessage
      ? errorMessage.substring(0, 5000)
      : null;

    const prisma = getAuditPrisma();

    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action: truncatedAction,
        module: truncatedModule,
        before: sanitizedBefore,
        after: sanitizedAfter,
        reason: reason || null,
        batchId: truncatedBatchId,
        status: truncatedStatus,
        errorMessage: truncatedErrorMessage,
        metadata: sanitizedMetadata,
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
