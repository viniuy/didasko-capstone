import { Prisma } from '@prisma/client';
import { logAction } from './audit';

/**
 * Models that should be audited
 */
const AUDITED_MODELS = ['User', 'Course', 'Attendance'] as const;

/**
 * Models that should be skipped (to prevent recursion)
 */
const SKIP_MODELS = ['AuditLog', 'BreakGlassSession'] as const;

/**
 * Maps Prisma model names to module names for audit logs
 */
const MODEL_TO_MODULE: Record<string, string> = {
  User: 'User Management',
  Course: 'Course Management',
  Attendance: 'Attendance',
  Enrollment: 'Enrollment',
};

/**
 * Creates audit extension for Prisma client (Prisma 6+).
 * This extension automatically logs create, update, and delete operations.
 *
 * Note: userId and IP must be added by API wrapper (extension doesn't have access to session)
 */
export const auditExtension = Prisma.defineExtension((client) => {
  return client.$extends({
    name: 'auditExtension',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          // Skip logging for audit-related models to prevent recursion
          if (SKIP_MODELS.includes(model as any)) {
            return query(args);
          }

          // Only log operations on audited models
          if (!AUDITED_MODELS.includes(model as any)) {
            return query(args);
          }

          // Only log create, update, delete, deleteMany, updateMany
          const auditableActions = [
            'create',
            'update',
            'delete',
            'deleteMany',
            'updateMany',
          ];
          if (!auditableActions.includes(operation)) {
            return query(args);
          }

          let before: any = null;
          let after: any = null;

          // For update/delete operations, fetch the "before" state
          if (operation === 'update' || operation === 'delete') {
            try {
              const where = args.where;
              if (where) {
                const beforeRecord = await (client as any)[model].findUnique({
                  where,
                });
                before = beforeRecord;
              }
            } catch (error) {
              console.error(
                `[Audit Extension] Failed to fetch before state for ${model}.${operation}:`,
                error,
              );
            }
          }

          // For updateMany/deleteMany, we don't fetch before state (too expensive)
          if (operation === 'updateMany' || operation === 'deleteMany') {
            // Log the count of affected records instead
            before = { _count: 'multiple' };
          }

          // Execute the operation
          const result = await query(args);

          // Capture the "after" state
          if (operation === 'create') {
            after = result;
          } else if (operation === 'update') {
            after = result;
          } else if (operation === 'delete') {
            after = null;
          } else if (operation === 'updateMany' || operation === 'deleteMany') {
            after = { _count: result.count || 0 };
          }

          // Build action name
          const actionName = `${model.toUpperCase()}_${operation.toUpperCase()}`;
          const moduleName = MODEL_TO_MODULE[model] || model;

          // Log the action (without userId/IP - these will be added by API wrapper)
          try {
            await logAction({
              action: actionName,
              module: moduleName,
              before,
              after,
            });
          } catch (error) {
            console.error(
              `[Audit Extension] Failed to log action for ${model}.${operation}:`,
              error,
            );
            // Don't throw - allow operation to succeed even if logging fails
          }

          return result;
        },
      },
    },
  });
});
