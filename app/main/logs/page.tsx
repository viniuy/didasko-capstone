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
    page?: string;
    module?: string;
    action?: string;
    userId?: string;
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

  // Parse search params
  const page = parseInt(params.page || "1", 10);
  const pageSize = 50;
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

  // Apply search filters
  if (params.module) {
    where.module = {
      contains: params.module,
      mode: "insensitive",
    };
  }

  if (params.action) {
    where.action = {
      contains: params.action,
      mode: "insensitive",
    };
  }

  if (params.userId) {
    where.userId = params.userId;
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
      <AppSidebar />

      <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all overflow-y-auto">
        <div className="flex flex-col flex-grow px-2 sm:px-4 md:px-6 lg:px-8">
          <Header />

          <div className="space-y-2 md:space-y-6 lg:space-y-8">
            <div className="space-y-2">
              <div className="flex items-center justify-between pl-2">
                <div>
                  <h2 className="pb-1 text-xl sm:text-2xl font-bold text-[#124A69]">
                    Audit Logs
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {userRole === Role.ADMIN
                      ? "All system activity logs"
                      : "Course and faculty management logs"}
                  </p>
                </div>
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
