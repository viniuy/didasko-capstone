import { Prisma } from "@prisma/client";
import { logAction } from "./audit";

/**
 * Models that should be audited
 */
const AUDITED_MODELS = ["User", "Course", "Attendance"] as const;

/**
 * Models that should be skipped (to prevent recursion)
 */
const SKIP_MODELS = ["AuditLog", "BreakGlassSession"] as const;

/**
 * Maps Prisma model names to module names for audit logs
 */
const MODEL_TO_MODULE: Record<string, string> = {
  User: "User Management",
  Course: "Course Management",
  Attendance: "Attendance",
  Enrollment: "Enrollment",
};

/**
 * Sets up audit middleware for Prisma client.
 * This middleware automatically logs create, update, and delete operations.
 *
 * Note: userId and IP must be added by API wrapper (middleware doesn't have access to session)
 *
 * Note: $use is deprecated in Prisma 5+ and removed in Prisma 6+.
 * This function will gracefully fail if $use is not available.
 * Manual logging via API wrapper is the recommended approach.
 */
export function setupAuditMiddleware(prisma: any): void {
  // Check if $use is available (deprecated in Prisma 5+, removed in Prisma 6+)
  if (typeof prisma.$use !== "function") {
    console.warn(
      "[Audit Middleware] Prisma $use middleware is not available. " +
        "Automatic logging via middleware is disabled. " +
        "Manual logging via API wrapper will still work."
    );
    return;
  }

  try {
    prisma.$use(async (params: any, next: any) => {
      const { model, action, args } = params;

      // Skip logging for audit-related models to prevent recursion
      if (SKIP_MODELS.includes(model as any)) {
        return next(params);
      }

      // Only log operations on audited models
      if (!AUDITED_MODELS.includes(model as any)) {
        return next(params);
      }

      // Only log create, update, delete, deleteMany, updateMany
      const auditableActions = [
        "create",
        "update",
        "delete",
        "deleteMany",
        "updateMany",
      ];
      if (!auditableActions.includes(action)) {
        return next(params);
      }

      let before: any = null;
      let after: any = null;

      // For update/delete operations, fetch the "before" state
      if (action === "update" || action === "delete") {
        try {
          const where = args.where;
          if (where) {
            const beforeRecord = await (prisma as any)[model].findUnique({
              where,
            });
            before = beforeRecord;
          }
        } catch (error) {
          console.error(
            `[Audit Middleware] Failed to fetch before state for ${model}.${action}:`,
            error
          );
        }
      }

      // For updateMany/deleteMany, we don't fetch before state (too expensive)
      if (action === "updateMany" || action === "deleteMany") {
        // Log the count of affected records instead
        before = { _count: "multiple" };
      }

      // Execute the operation
      const result = await next(params);

      // Determine the "after" state
      if (action === "create") {
        after = result;
      } else if (action === "update") {
        after = result;
      } else if (action === "delete") {
        after = null;
      } else if (action === "updateMany" || action === "deleteMany") {
        after = { _count: result.count || 0 };
      }

      // Build action name
      const actionName = `${model.toUpperCase()}_${action.toUpperCase()}`;
      const moduleName = MODEL_TO_MODULE[model] || model;

      // Log the action (without userId/IP - these will be added by API wrapper)
      await logAction({
        action: actionName,
        module: moduleName,
        before,
        after,
      });

      return result;
    });
  } catch (error) {
    console.error("[Audit Middleware] Failed to setup middleware:", error);
    // Don't throw - allow app to continue without middleware
  }
}
