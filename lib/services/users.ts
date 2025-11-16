import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Cached: Get users with filters
export async function getUsers(filters: {
  email?: string;
  search?: string;
  role?: "ADMIN" | "FACULTY" | "ACADEMIC_HEAD";
  department?: string;
}) {
  const cacheKey = `users-${JSON.stringify(filters)}`;

  return unstable_cache(
    async () => {
      // If email is provided, return single user
      if (filters.email) {
        const user = await prisma.user.findUnique({
          where: { email: filters.email },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: true,
            workType: true,
            permission: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        return user ? [user] : [];
      }

      // Build where clause based on filters
      const where: Prisma.UserWhereInput = {
        AND: [
          filters.role ? { role: filters.role as Prisma.EnumRoleFilter } : {},
          filters.department ? { department: filters.department } : {},
          filters.search
            ? {
                OR: [
                  {
                    name: {
                      contains: filters.search,
                      mode: "insensitive" as Prisma.QueryMode,
                    },
                  },
                  {
                    email: {
                      contains: filters.search,
                      mode: "insensitive" as Prisma.QueryMode,
                    },
                  },
                ],
              }
            : {},
        ].filter((condition) => Object.keys(condition).length > 0),
      };

      return prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: true,
          workType: true,
          permission: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ name: "asc" }, { createdAt: "desc" }],
      });
    },
    [cacheKey],
    { revalidate: 30 }
  )();
}

// Get user by ID
export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      workType: true,
      permission: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// Get user by email
export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      role: true,
    },
  });
}

// Create user
export async function createUser(data: {
  email: string;
  name: string;
  department: string;
  workType: "FULL_TIME" | "PART_TIME" | "CONTRACT";
  role: "ADMIN" | "FACULTY" | "ACADEMIC_HEAD";
  permission: "GRANTED" | "DENIED";
}) {
  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw new Error("Email already exists");
  }

  return prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      department: data.department,
      workType: data.workType,
      role: data.role,
      permission: data.permission,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      workType: true,
      permission: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// Update user
export async function updateUser(
  id: string,
  data: {
    name?: string;
    email?: string;
    department?: string;
    workType?: "FULL_TIME" | "PART_TIME" | "CONTRACT";
    role?: "ADMIN" | "FACULTY" | "ACADEMIC_HEAD";
    permission?: "GRANTED" | "DENIED";
  }
) {
  return prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      workType: true,
      permission: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// Delete user
export async function deleteUser(id: string) {
  return prisma.user.delete({
    where: { id },
  });
}
