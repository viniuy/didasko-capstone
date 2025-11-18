import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth-options";
import { getClientIp } from "./utils/ip";
import { logAction } from "./audit";

/**
 * Options for the withLogging wrapper
 */
export interface WithLoggingOptions {
  action: string;
  module: string;
  requireAuth?: boolean;
}

/**
 * Wraps an API route handler with audit logging.
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
    const { action, module, requireAuth = true } = options;
    const startTime = Date.now();

    try {
      // Get session
      const session = await getServerSession(authOptions);

      if (requireAuth && !session) {
        await logAction({
          action: `${action}_FAILED`,
          module,
          reason: "Unauthorized: No session",
          ip: getClientIp(req),
        });
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        ) as NextResponse<T>;
      }

      // Extract IP
      const ip = getClientIp(req);

      // Execute handler
      const response = await handler(req);

      // Calculate duration
      const duration = Date.now() - startTime;

      // Log success
      await logAction({
        userId: session?.user?.id || null,
        action: `${action}_SUCCESS`,
        module,
        after: {
          status: response.status,
          duration: `${duration}ms`,
        },
        ip,
      });

      return response;
    } catch (error: any) {
      // Calculate duration
      const duration = Date.now() - startTime;

      // Log failure
      const session = await getServerSession(authOptions);
      await logAction({
        userId: session?.user?.id || null,
        action: `${action}_FAILED`,
        module,
        reason: error.message || "Unknown error",
        after: {
          error: error.message || "Unknown error",
          duration: `${duration}ms`,
        },
        ip: getClientIp(req),
      });

      // Re-throw error
      throw error;
    }
  };
}
