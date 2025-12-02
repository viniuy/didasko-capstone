import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getUsers, createUser, deleteUser } from "@/lib/services";
import { UserCreateInput } from "@/shared/types/user";
import { requirePermission, handleAuthError } from "@/lib/authz";
import { Permission } from "@/lib/roles";
import { withLogging } from "@/lib/withLogging";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { canManageUser } from "@/lib/roles";
import { isTemporaryAdmin } from "@/lib/breakGlass";

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export const GET = withLogging(
  { action: "USER_LIST", module: "User Management" },
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Require VIEW_USERS permission
      await requirePermission(session.user, Permission.VIEW_USERS);

      const { searchParams } = new URL(req.url);
      const filters = {
        email: searchParams.get("email") || undefined,
        search: searchParams.get("search") || undefined,
        role:
          (searchParams.get("role") as "ADMIN" | "FACULTY" | "ACADEMIC_HEAD") ||
          undefined,
        department: searchParams.get("department") || undefined,
      };

      const users = await getUsers(filters);

      if (filters.email && users.length === 0) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      return NextResponse.json(filters.email ? users[0] : users);
    } catch (error) {
      return handleAuthError(error);
    }
  }
);

export const POST = withLogging(
  { action: "USER_CREATE", module: "User Management" },
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const body: UserCreateInput = await req.json();
      const { email, name, department, workType, roles, status } = body;

      // Validate required fields
      if (
        !email ||
        !name ||
        !department ||
        !workType ||
        !roles ||
        !Array.isArray(roles) ||
        roles.length === 0 ||
        !status
      ) {
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400 }
        );
      }

      // Check if current user is a temporary admin
      const isTempAdmin = await isTemporaryAdmin(session.user.id);

      if (isTempAdmin) {
        // Temp admins can only create FACULTY users
        if (roles.length !== 1 || !roles.includes("FACULTY" as any)) {
          return NextResponse.json(
            { error: "Temporary admins can only create Faculty users" },
            { status: 403 }
          );
        }
      } else {
        // Check permissions based on roles being created (only for permanent admins)
        if (roles.includes("ADMIN" as any)) {
          await requirePermission(session.user, Permission.MANAGE_ADMINS);
        }
        if (roles.includes("FACULTY" as any)) {
          await requirePermission(session.user, Permission.MANAGE_FACULTY);
        }
        if (roles.includes("ACADEMIC_HEAD" as any)) {
          await requirePermission(session.user, Permission.MANAGE_USERS);
        }
      }

      try {
        const user = await createUser({
          email,
          name,
          department,
          workType,
          roles,
          status,
        });

        // Log user creation with explicit action
        await logAction({
          userId: session.user.id,
          action: "USER_CREATED",
          module: "User Management",
          after: {
            id: user.id,
            email: user.email,
            name: user.name,
            roles: user.roles,
            department: user.department,
          },
          reason: `Created user with roles ${roles.join(", ")}: ${user.name} (${
            user.email
          })`,
        });

        return NextResponse.json(user);
      } catch (error: any) {
        if (error.message.includes("already exists")) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
      }
    } catch (error) {
      return handleAuthError(error);
    }
  }
);

export const DELETE = withLogging(
  { action: "USER_DELETE", module: "User Management" },
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { searchParams } = new URL(req.url);
      const id = searchParams.get("id");

      if (!id) {
        return NextResponse.json(
          { error: "User ID is required" },
          { status: 400 }
        );
      }

      // Get target user to check permissions
      const targetUser = await prisma.user.findUnique({
        where: { id },
        select: { id: true, roles: true, email: true, name: true },
      });

      if (!targetUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Check if actor can manage target user
      const canManage = await canManageUser(session.user, targetUser);
      if (!canManage) {
        return NextResponse.json(
          { error: "You do not have permission to delete this user" },
          { status: 403 }
        );
      }

      // Get before state for logging
      const before = {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        roles: targetUser.roles,
      };

      await deleteUser(id);

      // Log deletion with explicit action
      await logAction({
        userId: session.user.id,
        action: "USER_DELETED",
        module: "User Management",
        before,
        reason: `Deleted user: ${targetUser.name} (${
          targetUser.email
        }) - ${targetUser.roles.join(", ")}`,
      });

      return NextResponse.json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error) {
      return handleAuthError(error);
    }
  }
);
