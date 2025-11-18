import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getUsers, createUser, deleteUser } from "@/lib/services";
import { UserCreateInput } from "@/shared/types/user";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
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
    const { email, name, department, workType, role, status } = body;

    // Validate required fields
    if (!email || !name || !department || !workType || !role || !status) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    try {
      const user = await createUser({
        email,
        name,
        department,
        workType,
        role,
        status,
      });

      return NextResponse.json(user);
    } catch (error: any) {
      if (error.message.includes("already exists")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
  } catch (error: any) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create user" },
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

    await deleteUser(id);

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
