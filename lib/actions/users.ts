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

export async function updateUserRoles(userId: string, roles: Role[]) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { roles },
    });
    revalidatePath("/dashboard/admin");
    return { success: true };
  } catch (error) {
    console.error("Error updating user roles:", error);
    return { success: false, error: "Failed to update user roles" };
  }
}

interface AddUserParams {
  name: string;
  email: string;
  department: string;
  workType: WorkType;
  status: UserStatus;
  roles: Role[];
}

export async function addUser(userData: AddUserParams) {
  try {
    const session = await getServerSession(authOptions);

    // Check if current user is a temporary admin
    if (session?.user?.id) {
      const isTempAdmin = await isTemporaryAdmin(session.user.id);

      if (isTempAdmin) {
        // Temp admins can only create FACULTY users
        if (
          userData.roles.length !== 1 ||
          !userData.roles.includes("FACULTY")
        ) {
          return {
            success: false,
            error: "Temporary admins can only create Faculty users",
          };
        }
      }
    }

    // Prevent having both ADMIN and ACADEMIC_HEAD roles
    const hasAdmin = userData.roles.includes("ADMIN");
    const hasAcademicHead = userData.roles.includes("ACADEMIC_HEAD");
    if (hasAdmin && hasAcademicHead) {
      return {
        success: false,
        error:
          "A user cannot have both Admin and Academic Head roles simultaneously.",
      };
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
        roles: userData.roles,
      },
    });

    // Log user creation
    try {
      const session = await getServerSession(authOptions);
      await logAction({
        userId: session?.user?.id || null,
        action: "USER_CREATED",
        module: "User Management",
        reason: `User created: ${newUser.name} (${
          newUser.email
        }) with roles ${newUser.roles.join(", ")}`,
        status: "SUCCESS",
        after: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          roles: newUser.roles,
          department: newUser.department,
          status: newUser.status,
          workType: newUser.workType,
        },
        metadata: {
          entityType: "User",
          entityId: newUser.id,
          entityName: newUser.name,
          createdRoles: newUser.roles,
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
    roles?: Role[];
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
        roles: true,
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
          userBefore.roles.includes("ADMIN") ||
          userBefore.roles.includes("ACADEMIC_HEAD")
        ) {
          if (
            data.roles &&
            JSON.stringify(data.roles.sort()) !==
              JSON.stringify(userBefore.roles.sort())
          ) {
            return {
              success: false,
              error:
                "Temporary admins cannot change roles of Admin or Academic Head users",
            };
          }
        }

        // Temp admins cannot assign FACULTY users to ACADEMIC_HEAD or ADMIN roles
        if (
          userBefore.roles.includes("FACULTY") &&
          !userBefore.roles.includes("ADMIN") &&
          !userBefore.roles.includes("ACADEMIC_HEAD") &&
          data.roles
        ) {
          if (
            data.roles.includes("ACADEMIC_HEAD") ||
            data.roles.includes("ADMIN")
          ) {
            return {
              success: false,
              error:
                "Temporary admins cannot promote Faculty to Academic Head or Admin",
            };
          }
        }
      }
    }

    // Prevent having both ADMIN and ACADEMIC_HEAD roles
    if (data.roles) {
      const hasAdmin = data.roles.includes("ADMIN");
      const hasAcademicHead = data.roles.includes("ACADEMIC_HEAD");
      if (hasAdmin && hasAcademicHead) {
        return {
          success: false,
          error:
            "A user cannot have both Admin and Academic Head roles simultaneously.",
        };
      }

      const userHadAdmin = userBefore.roles.includes("ADMIN");
      const userHadAcademicHead = userBefore.roles.includes("ACADEMIC_HEAD");
      const userWillHaveAdmin = data.roles.includes("ADMIN");
      const userWillHaveAcademicHead = data.roles.includes("ACADEMIC_HEAD");

      // Check if removing admin role
      if (userHadAdmin && !userWillHaveAdmin) {
        const adminCount = await prisma.user.count({
          where: {
            roles: {
              has: "ADMIN",
            },
          },
        });
        if (adminCount <= 1) {
          return {
            success: false,
            error:
              "Cannot remove Admin role. At least one Admin must exist in the system.",
          };
        }
      }

      // Check if removing academic head role
      if (userHadAcademicHead && !userWillHaveAcademicHead) {
        const academicHeadCount = await prisma.user.count({
          where: {
            roles: {
              has: "ACADEMIC_HEAD",
            },
          },
        });
        if (academicHeadCount <= 1) {
          return {
            success: false,
            error:
              "Cannot remove Academic Head role. At least one Academic Head must exist in the system.",
          };
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

      const rolesChanged =
        data.roles &&
        JSON.stringify(data.roles.sort()) !==
          JSON.stringify(userBefore.roles.sort());

      if (rolesChanged && data.roles) {
        action = "USER_ROLE_CHANGED";
        reason = `User roles changed: ${updatedUser.name} (${
          updatedUser.email
        }) from ${userBefore.roles.join(", ")} to ${data.roles.join(", ")}`;
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
          roles: userBefore.roles,
          department: userBefore.department,
          status: userBefore.status,
          workType: userBefore.workType,
        },
        after: {
          name: updatedUser.name,
          email: updatedUser.email,
          roles: updatedUser.roles,
          department: updatedUser.department,
          status: updatedUser.status,
          workType: updatedUser.workType,
        },
        metadata: {
          entityType: "User",
          entityId: updatedUser.id,
          entityName: updatedUser.name,
          rolesChanged: rolesChanged || false,
          statusChanged: data.status && data.status !== userBefore.status,
          previousRoles: rolesChanged ? userBefore.roles : null,
          newRoles: rolesChanged ? data.roles : null,
        },
      });
    } catch (error) {
      console.error("Error logging user edit:", error);
      // Don't fail user edit if logging fails
    }

    // If roles changed, broadcast to trigger refresh for the affected user
    const rolesChanged =
      data.roles &&
      JSON.stringify(data.roles.sort()) !==
        JSON.stringify(userBefore.roles.sort());

    if (rolesChanged) {
      try {
        // Broadcast role change event
        await fetch(
          `${
            process.env.NEXTAUTH_URL || "http://localhost:3000"
          }/api/users/role-changed`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: updatedUser.id }),
          }
        );
      } catch (error) {
        console.error("Error broadcasting role change:", error);
        // Don't fail the edit if broadcast fails
      }
    }

    revalidatePath("/dashboard/admin");
    return { success: true, rolesChanged, userId: updatedUser.id };
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
