import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role, WorkType, UserStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { logAction, generateBatchId } from "@/lib/audit";

interface ImportResult {
  success: boolean;
  total: number;
  imported: number;
  skipped: number;
  errors: {
    row: number;
    email: string;
    message: string;
  }[];
  importedUsers: {
    name: string;
    email: string;
    row: number;
  }[];
  detailedFeedback: {
    row: number;
    email: string;
    status: "imported" | "skipped" | "error";
    message?: string;
  }[];
}

export async function POST(request: Request) {
  console.log("Starting import process...");

  // Get session for audit logging
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Generate batch ID for this import operation
  const batchId = generateBatchId();

  const result: ImportResult = {
    success: false,
    total: 0,
    imported: 0,
    skipped: 0,
    errors: [],
    importedUsers: [],
    detailedFeedback: [],
  };

  try {
    // Log the request headers
    console.log(
      "Request headers:",
      Object.fromEntries(request.headers.entries())
    );

    // Expecting an array of user data in the request body
    const body = await request.json();
    if (!Array.isArray(body)) {
      console.log("Invalid request body: not an array");
      return NextResponse.json(
        { error: "Invalid request body: Expected an array of user data" },
        { status: 400 }
      );
    }

    let data: any[];

    data = body;

    console.log("Parsed data sample:", data.slice(0, 1));
    result.total = data.length;
    console.log(`Found ${result.total} rows to process`);

    // Get existing emails for duplicate checking
    console.log("Fetching existing users...");
    const existingUsers = await prisma.user.findMany({
      select: { email: true },
    });
    const existingEmails = new Set(
      existingUsers.map((user) => user.email.toLowerCase())
    );
    console.log(`Found ${existingEmails.size} existing users`);

    // Process all rows concurrently (remove batch limit)
    await Promise.all(
      data.map(async (row: any, index: number) => {
        const rowNumber = index + 1; // Row number in the file

        // Log progress
        console.log(`Processing row ${rowNumber} of ${data.length}`);

        const email = row["Email"]?.toLowerCase().trim();
        const fullname = row["Full Name"]?.trim();
        const department = row["Department"]?.trim();
        const workType = row["Work Type"]?.trim();
        const role = row["Role"]?.trim();
        const status = row["Status"]?.trim();

        if (!email.endsWith("@alabang.sti.edu.ph")) {
          console.log(`Row ${rowNumber}: Invalid email domain: ${email}`);
          result.errors.push({
            row: rowNumber,
            email,
            message: "Email must end with @alabang.sti.edu.ph",
          });
          result.skipped++;
          result.detailedFeedback.push({
            row: rowNumber,
            email,
            status: "skipped",
            message: "Invalid email domain",
          });
          return;
        }

        // Validate required fields
        if (
          !email ||
          !fullname ||
          !department ||
          !workType ||
          !role ||
          !status
        ) {
          console.log(`Row ${rowNumber}: Missing required fields`, {
            email,
            fullname,
            department,
            workType,
            role,
            status,
          });
          result.errors.push({
            row: rowNumber,
            email: email || "N/A",
            message: "Missing required fields",
          });
          result.skipped++;
          result.detailedFeedback.push({
            row: rowNumber,
            email: email || "N/A",
            status: "skipped",
            message: "Missing required fields",
          });
          return;
        }

        // Check for duplicate email
        if (existingEmails.has(email)) {
          console.log(`Row ${rowNumber}: Email already exists: ${email}`);
          result.errors.push({
            row: rowNumber,
            email,
            message: "Email already exists in the system",
          });
          result.skipped++;
          result.detailedFeedback.push({
            row: rowNumber,
            email: email || "",
            status: "skipped",
            message: "Email already exists",
          });
          return;
        }

        try {
          // Convert work type to enum
          const workTypeEnum = workType
            .toUpperCase()
            .replace(/\s+/g, "_") as WorkType;
          if (!Object.values(WorkType).includes(workTypeEnum)) {
            throw new Error(`Invalid work type: ${workType}`);
          }

          // Convert role to enum
          const roleEnum = role.toUpperCase().replace(/\s+/g, "_") as Role;
          if (!Object.values(Role).includes(roleEnum)) {
            throw new Error(`Invalid role: ${role}`);
          }

          // Convert status to enum
          const statusEnum = status
            .toUpperCase()
            .replace(/\s+/g, "_") as UserStatus;
          if (!Object.values(UserStatus).includes(statusEnum)) {
            throw new Error(`Invalid status: ${status}`);
          }

          console.log(`Creating user with data:`, {
            name: fullname,
            email,
            department,
            workType: workTypeEnum,
            role: roleEnum,
            status: statusEnum,
          });

          // Create user in database
          const user = await prisma.user.create({
            data: {
              name: fullname,
              email,
              department,
              workType: workTypeEnum,
              role: roleEnum,
              status: statusEnum,
            },
          });

          console.log(`User created successfully: ${user.id}`);
          existingEmails.add(email);
          result.imported++;
          result.importedUsers.push({
            name: fullname,
            email,
            row: rowNumber,
          });
          result.detailedFeedback.push({
            row: rowNumber,
            email,
            status: "imported",
          });
        } catch (error) {
          console.error(`Error creating user at row ${rowNumber}:`, error);
          const errorMessage =
            error instanceof Error ? error.message : "Failed to create user";
          result.errors.push({
            row: rowNumber,
            email,
            message: errorMessage,
          });
          result.skipped++;
          result.detailedFeedback.push({
            row: rowNumber,
            email,
            status: "error",
            message: errorMessage,
          });
        }
      })
    );

    result.success =
      result.imported > 0 || result.skipped > 0 || result.errors.length > 0;
    console.log("Import process completed:", result);

    // Log import operation with batch tracking
    try {
      await logAction({
        userId: session.user.id,
        action: "USERS_IMPORTED",
        module: "User Management",
        reason: `Imported ${result.imported} user(s). Skipped: ${result.skipped}, Errors: ${result.errors.length}`,
        batchId,
        status: result.errors.length > 0 ? "FAILED" : "SUCCESS",
        after: {
          imported: result.imported,
          skipped: result.skipped,
          errors: result.errors.length,
          total: result.total,
          source: "import",
        },
        metadata: {
          importType: "users",
          recordCount: result.total,
          successCount: result.imported,
          errorCount: result.errors.length,
          skippedCount: result.skipped,
          importedUsers: result.importedUsers.map((u) => ({
            name: u.name,
            email: u.email,
          })),
        },
      });
    } catch (error) {
      console.error("Error logging import:", error);
      // Don't fail import if logging fails
    }

    // Always return a 200 status with the result
    return NextResponse.json({
      success: true,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors,
      importedUsers: result.importedUsers,
      total: result.total,
      detailedFeedback: result.detailedFeedback,
    });
  } catch (error) {
    console.error("Error in import process:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to process import";
    return NextResponse.json(
      {
        success: false,
        imported: 0,
        skipped: 0,
        errors: [
          {
            row: 0,
            email: "N/A",
            message: errorMessage,
          },
        ],
        importedUsers: [],
        total: 0,
        detailedFeedback: [],
      },
      { status: 500 }
    );
  }
}
