"use server";

import { prisma } from "@/lib/db";
import { UserStatus, Role, WorkType } from "@prisma/client";
import { revalidatePath } from "next/cache";

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
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (existingUser) {
      return { success: false, error: "Email already exists" };
    }

    // Create the user
    await prisma.user.create({
      data: {
        name: userData.name,
        email: userData.email,
        department: userData.department,
        workType: userData.workType,
        status: userData.status,
        role: userData.role,
      },
    });

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
    await prisma.user.update({
      where: { id: userId },
      data: data,
    });

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
