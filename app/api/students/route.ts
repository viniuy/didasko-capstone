import { NextResponse } from "next/server";
import { getStudents, createStudent } from "@/lib/services";
import { Student, StudentCreateInput } from "@/shared/types/student";
import { encryptResponse } from "@/lib/crypto-server";

// Route segment config for pre-compilation and performance
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = {
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "10"),
      search: searchParams.get("search") || undefined,
      courseId: searchParams.get("courseId") || undefined,
    };

    const result = await getStudents(filters);

    // Check if client requested encryption
    const wantsEncryption =
      request.headers.get("X-Encrypted-Response") === "true";

    if (wantsEncryption) {
      return NextResponse.json({
        encrypted: true,
        data: encryptResponse(result),
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching students:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch students",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      lastName,
      firstName,
      middleInitial,
      image,
      studentId,
      rfid_id: rfid_id_raw,
      courseId,
    } = body as StudentCreateInput & { rfid_id?: string | number };

    // Parse rfid_id to integer if provided
    const rfid_id =
      rfid_id_raw !== undefined && rfid_id_raw !== null
        ? parseInt(String(rfid_id_raw), 10)
        : undefined;

    // Validate required fields
    if (!lastName || !firstName || !studentId) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: lastName, firstName, and studentId are required",
        },
        { status: 400 }
      );
    }

    try {
      const student = await createStudent({
        lastName,
        firstName,
        middleInitial,
        image,
        studentId,
        rfid_id,
        courseId,
      });

      // Check if client requested encryption
      const wantsEncryption =
        request.headers.get("X-Encrypted-Response") === "true";

      if (wantsEncryption) {
        return NextResponse.json({
          encrypted: true,
          data: encryptResponse(student),
        });
      }

      return NextResponse.json(student as Student);
    } catch (error: any) {
      if (
        error.message.includes("already exists") ||
        error.message.includes("already registered")
      ) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      throw error;
    }
  } catch (error: any) {
    console.error("Error creating student:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to create student",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
