import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { UserCreateInput } from "@/shared/types/user";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const search = searchParams.get("search");
    const role = searchParams.get("role");
    const department = searchParams.get("department");

    // If email is provided, return single user
    if (email) {
      const user = await prisma.user.findUnique({
        where: { email },
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

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      return NextResponse.json(user);
    }

    // Build where clause based on filters
    const where: Prisma.UserWhereInput = {
      AND: [
        role ? { role: role as Prisma.EnumRoleFilter } : {},
        department ? { department } : {},
        search
          ? {
              OR: [
                {
                  name: {
                    contains: search,
                    mode: "insensitive" as Prisma.QueryMode,
                  },
                },
                {
                  email: {
                    contains: search,
                    mode: "insensitive" as Prisma.QueryMode,
                  },
                },
              ],
            }
          : {},
      ].filter((condition) => Object.keys(condition).length > 0),
    };

    // Get users with pagination
    const users = await prisma.user.findMany({
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

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: UserCreateInput = await request.json();
    const { email, name, department, workType, role, permission } = body;

    // Validate required fields
    if (!email || !name || !department || !workType || !role || !permission) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 400 }
      );
    }

    const user = await prisma.user.create({
      data: {
        email,
        name,
        department,
        workType,
        role,
        permission,
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

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
