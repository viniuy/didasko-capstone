"use server";

import { prisma } from "@/lib/db";
import { UserStatus, Role, WorkType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { logAction } from "@/lib/audit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { isTemporaryAdmin } from "@/lib/breakGlass";

export async function updateUserStatus(userId: string, status: UserStatus) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { status },
    });
    revalidatePath("/dashboard/admin");
    return { success: true };
  } catch (error) {
    console.error("Error updating user status:", error);
    return { success: false, error: "Failed to update user status" };
  }
}

export async function updateUserRole(userId: string, role: Role) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { role },
    });
    revalidatePath("/dashboard/admin");
    return { success: true };
  } catch (error) {
    console.error("Error updating user role:", error);
    return { success: false, error: "Failed to update user role" };
  }
}

interface AddUserParams {
  name: string;
  email: string;
  department: string;
  workType: WorkType;
  status: UserStatus;
  role: Role;
}

export async function addUser(userData: AddUserParams) {
  try {
    const session = await getServerSession(authOptions);

    // Check if current user is a temporary admin
    if (session?.user?.id) {
      const isTempAdmin = await isTemporaryAdmin(session.user.id);

      if (isTempAdmin) {
        // Temp admins can only create FACULTY users
        if (userData.role !== "FACULTY") {
          return {
            success: false,
            error: "Temporary admins can only create Faculty users",
          };
        }
      }
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (existingUser) {
      return { success: false, error: "Email already exists" };
    }

    // Create the user
    const newUser = await prisma.user.create({
      data: {
        name: userData.name,
        email: userData.email,
        department: userData.department,
        workType: userData.workType,
        status: userData.status,
        role: userData.role,
      },
    });

    // Log user creation
    try {
      const session = await getServerSession(authOptions);
      await logAction({
        userId: session?.user?.id || null,
        action: "USER_CREATED",
        module: "User Management",
        reason: `User created: ${newUser.name} (${newUser.email}) with role ${newUser.role}`,
        status: "SUCCESS",
        after: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          department: newUser.department,
          status: newUser.status,
          workType: newUser.workType,
        },
        metadata: {
          entityType: "User",
          entityId: newUser.id,
          entityName: newUser.name,
          createdRole: newUser.role,
          createdDepartment: newUser.department,
        },
      });
    } catch (error) {
      console.error("Error logging user creation:", error);
      // Don't fail user creation if logging fails
    }

    revalidatePath("/dashboard/admin");
    return { success: true };
  } catch (error) {
    console.error("Error adding user:", error);
    return { success: false, error: "Failed to add user" };
  }
}

export async function editUser(
  userId: string,
  data: {
    name?: string;
    email?: string;
    department?: string;
    workType?: WorkType;
    role?: Role;
    status?: UserStatus;
  }
) {
  try {
    const session = await getServerSession(authOptions);

    // Get user before update for logging and permission checks
    const userBefore = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        status: true,
        workType: true,
      },
    });

    if (!userBefore) {
      return { success: false, error: "User not found" };
    }

    // Check if current user is a temporary admin
    if (session?.user?.id) {
      const isTempAdmin = await isTemporaryAdmin(session.user.id);

      if (isTempAdmin) {
        // Temp admins cannot change roles of ADMIN or ACADEMIC_HEAD users
        if (
          userBefore.role === "ADMIN" ||
          userBefore.role === "ACADEMIC_HEAD"
        ) {
          if (data.role && data.role !== userBefore.role) {
            return {
              success: false,
              error:
                "Temporary admins cannot change roles of Admin or Academic Head users",
            };
          }
        }

        // Temp admins cannot assign FACULTY users to ACADEMIC_HEAD or ADMIN roles
        if (userBefore.role === "FACULTY" && data.role) {
          if (data.role === "ACADEMIC_HEAD" || data.role === "ADMIN") {
            return {
              success: false,
              error:
                "Temporary admins cannot promote Faculty to Academic Head or Admin",
            };
          }
        }
      }
    }

    // Check if email already exists (if email is being changed)
    if (data.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: data.email,
          NOT: {
            id: userId,
          },
        },
      });

      if (existingUser) {
        return { success: false, error: "Email already exists" };
      }
    }

    // Update the user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: data,
    });

    // Log user edit - determine action type
    try {
      const session = await getServerSession(authOptions);
      let action = "USER_EDITED";
      let reason = `User edited: ${updatedUser.name} (${updatedUser.email})`;

      if (data.role && data.role !== userBefore.role) {
        action = "USER_ROLE_CHANGED";
        reason = `User role changed: ${updatedUser.name} (${updatedUser.email}) from ${userBefore.role} to ${data.role}`;
      } else if (data.status && data.status !== userBefore.status) {
        action = data.status === "ACTIVE" ? "USER_ACTIVATED" : "USER_ARCHIVED";
        reason = `User ${
          data.status === "ACTIVE" ? "activated" : "archived"
        }: ${updatedUser.name} (${updatedUser.email})`;
      }

      await logAction({
        userId: session?.user?.id || null,
        action,
        module: "User Management",
        reason,
        status: "SUCCESS",
        before: {
          name: userBefore.name,
          email: userBefore.email,
          role: userBefore.role,
          department: userBefore.department,
          status: userBefore.status,
          workType: userBefore.workType,
        },
        after: {
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          department: updatedUser.department,
          status: updatedUser.status,
          workType: updatedUser.workType,
        },
        metadata: {
          entityType: "User",
          entityId: updatedUser.id,
          entityName: updatedUser.name,
          roleChanged: data.role && data.role !== userBefore.role,
          statusChanged: data.status && data.status !== userBefore.status,
          previousRole:
            data.role && data.role !== userBefore.role ? userBefore.role : null,
          newRole:
            data.role && data.role !== userBefore.role ? data.role : null,
        },
      });
    } catch (error) {
      console.error("Error logging user edit:", error);
      // Don't fail user edit if logging fails
    }

    revalidatePath("/dashboard/admin");
    return { success: true };
  } catch (error) {
    console.error("Error editing user:", error);
    return { success: false, error: "Failed to edit user" };
  }
}

export async function deleteUser(userId: string) {
  try {
    await prisma.user.delete({
      where: { id: userId },
    });

    revalidatePath("/dashboard/admin");
    return { success: true };
  } catch (error) {
    console.error("Error deleting user:", error);
    return { success: false, error: "Failed to delete user" };
  }
}
