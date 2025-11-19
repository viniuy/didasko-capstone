import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { requirePermission, handleAuthError } from "@/lib/authz";
import { Permission } from "@/lib/roles";
import { withLogging } from "@/lib/withLogging";

export const GET = withLogging(
  { action: "VIEW_ONLINE_USERS", module: "User Management" },
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Require VIEW_USERS permission
      await requirePermission(session.user, Permission.VIEW_USERS);

      // Consider users "online" if they have activity in the last 10 minutes
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

      // Find users with recent audit log activity (faculty and academic heads only)
      const recentActivity = await prisma.auditLog.findMany({
        where: {
          createdAt: {
            gte: tenMinutesAgo,
          },
          user: {
            role: {
              in: ["FACULTY", "ACADEMIC_HEAD"],
            },
            status: "ACTIVE",
          },
        },
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              department: true,
              workType: true,
              image: true,
            },
          },
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        distinct: ["userId"], // Get unique users
      });

      // Extract unique users from recent activity
      const onlineUsers = recentActivity
        .map((log) => log.user)
        .filter((user): user is NonNullable<typeof user> => user !== null);

      // Remove duplicates (in case of any edge cases)
      const uniqueUsers = Array.from(
        new Map(onlineUsers.map((user) => [user.id, user])).values()
      );

      return NextResponse.json(uniqueUsers);
    } catch (error) {
      return handleAuthError(error);
    }
  }
);
