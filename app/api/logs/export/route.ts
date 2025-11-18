import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { requirePermission, handleAuthError } from "@/lib/authz";
import { Permission } from "@/lib/roles";
import { withLogging } from "@/lib/withLogging";
import { logAction } from "@/lib/audit";

export const POST = withLogging(
  { action: "AUDIT_LOGS_EXPORT", module: "Audit Logs" },
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Check permissions
      if (session.user.role === Role.ADMIN) {
        await requirePermission(session.user, Permission.VIEW_ALL_LOGS);
      } else if (session.user.role === Role.ACADEMIC_HEAD) {
        await requirePermission(session.user, Permission.VIEW_LIMITED_LOGS);
      } else {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const body = await req.json();
      const { startDate, endDate, action, userId } = body;

      // Build where clause
      const where: any = {};

      // Apply module filter for ACADEMIC_HEAD
      if (session.user.role === Role.ACADEMIC_HEAD) {
        where.module = {
          in: [
            "Course Management",
            "Course",
            "Courses",
            "Class Management",
            "Faculty",
            "Attendance",
            "Enrollment",
          ],
        };
      }

      // Apply date filter
      if (startDate && endDate) {
        where.createdAt = {
          gte: new Date(startDate),
          lte: new Date(endDate),
        };
      }

      // Apply action filter
      if (action) {
        where.action = {
          contains: action,
          mode: "insensitive",
        };
      }

      // Apply user filter
      if (userId) {
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

      // Log export operation
      try {
        await logAction({
          userId: session.user.id,
          action: "AUDIT_LOGS_EXPORTED",
          module: "Audit Logs",
          reason: `Exported ${logs.length} audit log(s)${
            startDate && endDate ? ` from ${startDate} to ${endDate}` : ""
          }${action ? ` filtered by action: ${action}` : ""}${
            userId ? ` for user: ${userId}` : ""
          }`,
          after: {
            exportType: "audit_logs",
            count: logs.length,
            filters: {
              startDate: startDate || null,
              endDate: endDate || null,
              action: action || null,
              userId: userId || null,
            },
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
