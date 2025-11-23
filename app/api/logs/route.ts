import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

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

    const userRole = session.user.role;

    // Only ADMIN and ACADEMIC_HEAD can access
    if (userRole !== Role.ADMIN && userRole !== Role.ACADEMIC_HEAD) {
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

    // Apply module filter for ACADEMIC_HEAD
    if (userRole === Role.ACADEMIC_HEAD) {
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

    // Fetch logs - if no pagination params, return all logs
    const shouldPaginate = searchParams.has("p") || searchParams.has("page");

    let logs;
    let totalCount;
    let totalPages = 0;

    if (shouldPaginate) {
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
    } else {
      // Return all logs without pagination
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
      });
      totalCount = logs.length;
    }

    return NextResponse.json({
      logs,
      currentPage: shouldPaginate ? page : 1,
      totalPages: shouldPaginate ? totalPages : 1,
      totalCount,
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
