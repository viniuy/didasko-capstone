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

export default async function LogsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);

  // Redirect if no session
  if (!session) {
    redirect("/login");
  }

  const userRoles = session.user?.roles || [];

  // Redirect FACULTY (only if they don't have other roles)
  if (userRoles.length === 1 && userRoles[0] === Role.FACULTY) {
    redirect("/dashboard");
  }

  // Only ADMIN and ACADEMIC_HEAD can access
  if (
    !userRoles.includes(Role.ADMIN) &&
    !userRoles.includes(Role.ACADEMIC_HEAD)
  ) {
    redirect("/dashboard");
  }

  // Await searchParams (Next.js 15 requirement)
  const params = await searchParams;

  // Build where clause - only for date range and role restrictions
  const where: any = {};

  // Apply module filter for ACADEMIC_HEAD
  if (userRoles.includes(Role.ACADEMIC_HEAD)) {
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

  // Default to today's date range if no date specified
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  // Apply date range filter - default to today
  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) {
      where.createdAt.gte = new Date(params.startDate);
    } else {
      where.createdAt.gte = today;
    }
    if (params.endDate) {
      // Set end date to end of day
      const endDate = new Date(params.endDate);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = endDate;
    } else {
      where.createdAt.lte = endOfToday;
    }
  } else {
    // Default to today if no date range specified
    where.createdAt = {
      gte: today,
      lte: endOfToday,
    };
  }

  // Fetch ALL logs for the date range (no pagination, no filters)
  // Client-side will handle filtering, pagination, and sorting
  let logs: any[] = [];
  let isLoading = false;

  try {
    logs = await prisma.auditLog.findMany({
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
      // No skip/take - fetch all logs for the date range
    });
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
      isLoading = true;
    } else {
      throw error;
    }
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Header />
      <AppSidebar />

      <main className="h-full w-full xl:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all overflow-y-auto">
        <div className="flex flex-col flex-grow px-2 sm:px-4 md:px-6 lg:px-8">
          <div className="space-y-2 md:space-y-6 lg:space-y-8">
            <div className="space-y-2">
              <div className="grid gap-4 md:gap-6 lg:gap-8">
                <AuditLogsTable
                  initialLogs={logs}
                  userRole={userRoles[0] as Role}
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
