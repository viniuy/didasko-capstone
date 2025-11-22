import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import AuditLogsTable from "@/features/admin/components/AuditLogsTable";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { BreakGlassCompact } from "@/features/admin/components/break-glass-compact";

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

export default async function LogsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);

  // Redirect if no session
  if (!session) {
    redirect("/login");
  }

  const userRole = session.user?.role;

  // Redirect FACULTY
  if (userRole === Role.FACULTY) {
    redirect("/dashboard");
  }

  // Only ADMIN and ACADEMIC_HEAD can access
  if (userRole !== Role.ADMIN && userRole !== Role.ACADEMIC_HEAD) {
    redirect("/dashboard");
  }

  // Await searchParams (Next.js 15 requirement)
  const params = await searchParams;

  // Parse search params - use 'p' instead of 'page'
  const page = parseInt(params.p || params.page || "1", 10);
  const pageSize = 9;
  const skip = (page - 1) * pageSize;

  // Build where clause
  const where: any = {};

  // Apply module filter for ACADEMIC_HEAD
  if (userRole === Role.ACADEMIC_HEAD) {
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

  // Apply date range filter
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
  }

  // Fetch logs
  let logs: any[] = [];
  let totalCount = 0;
  let totalPages = 0;
  let isLoading = false;

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
      isLoading = true;
    } else {
      throw error;
    }
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Header />
      <AppSidebar />

      <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all overflow-y-auto">
        <div className="flex flex-col flex-grow px-2 sm:px-4 md:px-6 lg:px-8">
          <div className="space-y-2 md:space-y-6 lg:space-y-8">
            <div className="space-y-2">
              <div className="flex items-center justify-between pl-2">
                <div className="flex items-center">
                  <BreakGlassCompact />
                </div>
              </div>

              <div className="grid gap-4 md:gap-6 lg:gap-8">
                <AuditLogsTable
                  logs={logs}
                  currentPage={page}
                  totalPages={totalPages}
                  userRole={userRole!}
                  isLoading={isLoading}
                />
              </div>
            </div>
          </div>
        </div>
        <Rightsidebar />
      </main>
    </div>
  );
}
