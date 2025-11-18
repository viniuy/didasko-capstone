import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { canViewLog } from "@/lib/roles";
import AuditLogsTable from "@/features/admin/components/AuditLogsTable";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    module?: string;
    action?: string;
    userId?: string;
  }>;
}

export default async function AuditLogsPage({ searchParams }: PageProps) {
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

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Audit Logs</h1>
        <p className="text-muted-foreground">
          {userRole === Role.ADMIN
            ? "All system activity logs"
            : "Course and faculty management logs"}
        </p>
      </div>

      <AuditLogsTable
        logs={logs}
        currentPage={page}
        totalPages={totalPages}
        userRole={userRole!}
      />
    </div>
  );
}
