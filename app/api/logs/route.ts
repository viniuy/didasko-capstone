import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { canViewLog } from "@/lib/roles";

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRoles = session.user.roles || [];

    // Only ADMIN and ACADEMIC_HEAD can access
    if (
      !userRoles.includes(Role.ADMIN) &&
      !userRoles.includes(Role.ACADEMIC_HEAD)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(
      searchParams.get("p") || searchParams.get("page") || "1",
      10
    );
    const pageSize = 9;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: any = {};

    // Apply module filter for ACADEMIC_HEAD (not ADMIN)
    if (userRoles.includes(Role.ACADEMIC_HEAD) && !userRoles.includes(Role.ADMIN)) {
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

    // Apply filter parameters
    if (searchParams.get("actions")) {
      const actionList = searchParams.get("actions")!.split(",");
      where.action = {
        in: actionList,
      };
    } else if (searchParams.get("action")) {
      where.action = {
        contains: searchParams.get("action"),
        mode: "insensitive",
      };
    }

    if (searchParams.get("faculty")) {
      const facultyList = searchParams.get("faculty")!.split(",");
      where.userId = {
        in: facultyList,
      };
    } else if (searchParams.get("userId")) {
      where.userId = searchParams.get("userId");
    }

    if (searchParams.get("modules")) {
      const moduleList = searchParams.get("modules")!.split(",");
      where.module = {
        in: moduleList,
      };
    } else if (searchParams.get("module")) {
      where.module = {
        contains: searchParams.get("module"),
        mode: "insensitive",
      };
    }

    // Apply date range filter
    if (searchParams.get("startDate") || searchParams.get("endDate")) {
      where.createdAt = {};
      if (searchParams.get("startDate")) {
        where.createdAt.gte = new Date(searchParams.get("startDate")!);
      }
      if (searchParams.get("endDate")) {
        const endDate = new Date(searchParams.get("endDate")!);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    // Fetch logs - always enforce pagination to prevent connection pool exhaustion
    // Default to page 1 if not specified, with a maximum limit of 1000 records
    const shouldPaginate = searchParams.has("p") || searchParams.has("page");
    const defaultPageSize = 100;
    const maxPageSize = 1000;
    const requestedPageSize = shouldPaginate ? pageSize : defaultPageSize;
    const effectivePageSize = Math.min(requestedPageSize, maxPageSize);
    const effectiveSkip = shouldPaginate ? skip : 0;

    let logs;
    let totalCount;
    let totalPages = 0;

    // Always use pagination to prevent loading all records
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
        skip: effectiveSkip,
        take: effectivePageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    totalPages = Math.ceil(totalCount / effectivePageSize);

    return NextResponse.json({
      logs,
      currentPage: shouldPaginate ? page : 1,
      totalPages,
      totalCount,
      pageSize: effectivePageSize,
      hasMore: effectiveSkip + effectivePageSize < totalCount,
    });
  } catch (error: any) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch audit logs",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
