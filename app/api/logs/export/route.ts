import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { requirePermission, handleAuthError } from "@/lib/authz";
import { Permission } from "@/lib/roles";
import { withLogging } from "@/lib/withLogging";
import { logAction } from "@/lib/audit";

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export const POST = withLogging(
  { action: "AUDIT_LOGS_EXPORT", module: "Audit Logs" },
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Check permissions
      const userRoles = session.user.roles || [];
      if (userRoles.includes(Role.ADMIN)) {
        await requirePermission(session.user, Permission.VIEW_ALL_LOGS);
      } else if (userRoles.includes(Role.ACADEMIC_HEAD)) {
        await requirePermission(session.user, Permission.VIEW_LIMITED_LOGS);
      } else {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const body = await req.json();
      const {
        startDate,
        endDate,
        actions,
        modules,
        faculty,
        action, // Legacy support
        userId, // Legacy support
      } = body;

      // Build where clause
      const where: any = {};

      // Apply module filter for ACADEMIC_HEAD (not ADMIN)
      if (
        userRoles.includes(Role.ACADEMIC_HEAD) &&
        !userRoles.includes(Role.ADMIN)
      ) {
        const allowedModules = [
          "Course Management",
          "Course",
          "Courses",
          "Class Management",
          "Faculty",
          "Attendance",
          "Enrollment",
        ];

        // If modules filter is provided, intersect with allowed modules
        if (modules && Array.isArray(modules) && modules.length > 0) {
          where.module = {
            in: modules.filter((m: string) => allowedModules.includes(m)),
          };
        } else {
          where.module = {
            in: allowedModules,
          };
        }
      } else if (modules && Array.isArray(modules) && modules.length > 0) {
        // Apply module filter for ADMIN
        where.module = {
          in: modules,
        };
      }

      // Apply date filter
      if (startDate && endDate) {
        where.createdAt = {
          gte: new Date(startDate),
          lte: new Date(endDate),
        };
      }

      // Apply action filter (new array format preferred)
      if (actions && Array.isArray(actions) && actions.length > 0) {
        where.action = {
          in: actions,
        };
      } else if (action) {
        // Legacy support for single action
        where.action = {
          contains: action,
          mode: "insensitive",
        };
      }

      // Apply faculty/user filter (new array format preferred)
      if (faculty && Array.isArray(faculty) && faculty.length > 0) {
        where.userId = {
          in: faculty,
        };
      } else if (userId) {
        // Legacy support for single userId
        where.userId = userId;
      }

      // Fetch all matching logs (no pagination for export)
      const logs = await prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Log export operation with metadata
      try {
        const { generateBatchId } = await import("@/lib/audit");
        const batchId = generateBatchId();
        await logAction({
          userId: session.user.id,
          action: "AUDIT_LOGS_EXPORTED",
          module: "Audit Logs",
          reason: `Exported ${logs.length} audit log(s)${
            startDate && endDate ? ` from ${startDate} to ${endDate}` : ""
          }${
            actions && actions.length > 0
              ? ` filtered by actions: ${actions.join(", ")}`
              : action
              ? ` filtered by action: ${action}`
              : ""
          }${
            modules && modules.length > 0
              ? ` filtered by modules: ${modules.join(", ")}`
              : ""
          }${
            faculty && faculty.length > 0
              ? ` filtered by faculty: ${faculty.length} user(s)`
              : userId
              ? ` for user: ${userId}`
              : ""
          }`,
          batchId,
          status: "SUCCESS",
          after: {
            exportType: "audit_logs",
            count: logs.length,
            fileFormat: "Excel",
          },
          metadata: {
            exportType: "audit_logs",
            fileFormat: "xlsx",
            recordCount: logs.length,
            filters: {
              startDate: startDate || null,
              endDate: endDate || null,
              actions: actions || (action ? [action] : null),
              modules: modules || null,
              faculty: faculty || (userId ? [userId] : null),
            },
            dataRange:
              startDate && endDate ? `${startDate} to ${endDate}` : "All time",
          },
        });
      } catch (error) {
        console.error("Error logging export:", error);
        // Don't fail export if logging fails
      }

      return NextResponse.json(logs);
    } catch (error) {
      return handleAuthError(error);
    }
  }
);
