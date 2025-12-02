import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { canViewLog } from "@/lib/roles";
import AuditLogsTable from "@/features/admin/components/AuditLogsTable";
import { getUsers } from "@/lib/services";
import { hasAccess } from "@/lib/permissions";

interface PageProps {
  searchParams: Promise<{
    p?: string;
    page?: string;
    module?: string;
    action?: string;
    userId?: string;
    actions?: string;
    faculty?: string;
    modules?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function AuditLogsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);

  // Redirect if no session
  if (!session) {
    redirect("/login");
  }

  const userRoles = session.user?.roles || [];

  // Check permission - only ADMIN and ACADEMIC_HEAD can access logs
  // This is a special permission, not a dashboard permission
  if (
    !userRoles.includes(Role.ADMIN) &&
    !userRoles.includes(Role.ACADEMIC_HEAD)
  ) {
    redirect("/dashboard");
  }

  // Determine primary role for filtering
  const userRole = userRoles.includes(Role.ADMIN)
    ? Role.ADMIN
    : userRoles.includes(Role.ACADEMIC_HEAD)
    ? Role.ACADEMIC_HEAD
    : userRoles[0];

  // Await searchParams (Next.js 15 requirement)
  const params = await searchParams;

  // Parse search params - use 'p' instead of 'page'
  const page = parseInt(params.p || params.page || "1", 10);
  const pageSize = 9;
  const skip = (page - 1) * pageSize;

  // Build where clause
  const where: any = {};

  // Apply module filter for ACADEMIC_HEAD (not ADMIN)
  if (
    userRoles.includes(Role.ACADEMIC_HEAD) &&
    !userRoles.includes(Role.ADMIN)
  ) {
    // ACADEMIC_HEAD can only see specific modules
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

  // Apply new filter parameters (preferred over old single filters)
  if (params.actions) {
    const actionList = params.actions.split(",");
    where.action = {
      in: actionList,
    };
  } else if (params.action) {
    // Fallback to old single action filter for backward compatibility
    where.action = {
      contains: params.action,
      mode: "insensitive",
    };
  }

  if (params.faculty) {
    const facultyList = params.faculty.split(",");
    where.userId = {
      in: facultyList,
    };
  } else if (params.userId) {
    // Fallback to old single userId filter for backward compatibility
    where.userId = params.userId;
  }

  if (params.modules) {
    const moduleList = params.modules.split(",");
    where.module = {
      in: moduleList,
    };
  } else if (params.module) {
    // Fallback to old single module filter for backward compatibility
    where.module = {
      contains: params.module,
      mode: "insensitive",
    };
  }

  // Apply date range filter - default to today if no date params provided
  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) {
      where.createdAt.gte = new Date(params.startDate);
    }
    if (params.endDate) {
      // Set end date to end of day
      const endDate = new Date(params.endDate);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = endDate;
    }
  } else {
    // Default to today's date range if no date params provided
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);
    where.createdAt = {
      gte: today,
      lte: endOfToday,
    };
  }

  // Fetch logs
  let logs: any[] = [];
  let totalCount = 0;
  let totalPages = 0;

  try {
    [logs, totalCount] = await Promise.all([
      prisma.auditLog.findMany({
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
        skip,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    totalPages = Math.ceil(totalCount / pageSize);
  } catch (error: any) {
    // Handle case where tables don't exist yet (migration not run)
    if (
      error?.message?.includes("auditLog") ||
      error?.message?.includes("does not exist")
    ) {
      console.error(
        "Audit log tables not found. Please run: npx prisma migrate dev"
      );
      // Return empty state
      logs = [];
      totalCount = 0;
      totalPages = 0;
    } else {
      throw error;
    }
  }

  // Fetch faculty users for filter dropdown
  const facultyUsers = await getUsers({
    role: "FACULTY" as any, // Filter by role for backward compatibility
  });

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Audit Logs</h1>
        <p className="text-muted-foreground">
          {userRoles.includes(Role.ADMIN)
            ? "All system activity logs"
            : "Course and faculty management logs"}
        </p>
      </div>

      <AuditLogsTable
        initialLogs={logs}
        userRole={userRole!}
        initialFaculty={facultyUsers}
      />
    </div>
  );
}
