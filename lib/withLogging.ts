import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth-options";
import { logAction } from "./audit";

/**
 * Options for the withLogging wrapper
 */
export interface WithLoggingOptions {
  action: string;
  module: string;
  requireAuth?: boolean;
  // If true, skip automatic logging (for routes that log manually)
  skipAutoLog?: boolean;
}

/**
 * Wraps an API route handler with audit logging.
 * Only logs failures - successful actions should be logged manually with specific details.
 *
 * @param options - Logging configuration
 * @param handler - The actual route handler function
 * @returns Wrapped handler with logging
 */
export function withLogging<T = any>(
  options: WithLoggingOptions,
  handler: (req: NextRequest) => Promise<NextResponse<T>>
) {
  return async (req: NextRequest): Promise<NextResponse<T>> => {
    const { action, module, requireAuth = true, skipAutoLog = false } = options;

    try {
      // Get session
      const session = await getServerSession(authOptions);

      if (requireAuth && !session) {
        if (!skipAutoLog) {
          await logAction({
            action: `${action}_FAILED`,
            module,
            reason: "Unauthorized: No session",
          });
        }
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        ) as NextResponse<T>;
      }

      // Execute handler
      const response = await handler(req);

      // Don't log success automatically - let the handler log specific actions
      // This prevents duplicate logs

      return response;
    } catch (error: any) {
      // Only log failures if not skipping auto log
      if (!skipAutoLog) {
        const session = await getServerSession(authOptions);
        await logAction({
          userId: session?.user?.id || null,
          action: `${action}_FAILED`,
          module,
          reason: error.message || "Unknown error",
          after: {
            error: error.message || "Unknown error",
          },
        });
      }

      // Re-throw error
      throw error;
    }
  };
}
