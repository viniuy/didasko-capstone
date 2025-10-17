import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import {
  UploadResponse,
  DeleteImageInput,
  DeleteImageResponse,
} from "@/shared/types/upload";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No image file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const ext = file.name.split(".").pop();
    const filename = `${uuidv4()}.${ext}`;

    // Create uploads directory if it doesn't exist
    const uploadDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    // Convert file to buffer and write to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    const fullPath = join(uploadDir, filename);
    await writeFile(fullPath, buffer);

    // Return the URL for the uploaded image
    const response: UploadResponse = {
      imageUrl: `/uploads/${filename}`,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error uploading image:", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { imageUrl } = body as DeleteImageInput;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "No image URL provided" },
        { status: 400 }
      );
    }

    // Extract filename from the URL
    const filename = imageUrl.split("/uploads/")[1];
    if (!filename) {
      return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
    }

    // Construct the full path to the file
    const filePath = join(process.cwd(), "public/uploads", filename);

    // Delete the file
    try {
      await unlink(filePath);
      const response: DeleteImageResponse = {
        message: "File deleted successfully",
      };
      return NextResponse.json(response);
    } catch (error) {
      console.error("Error deleting file:", error);
      return NextResponse.json(
        { error: "File not found or could not be deleted" },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Error deleting image:", error);
    return NextResponse.json(
      { error: "Failed to delete image" },
      { status: 500 }
    );
  }
}
