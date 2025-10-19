import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import {
  UploadResponse,
  DeleteImageInput,
  DeleteImageResponse,
} from "@/shared/types/upload";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop();
    const filename = `${uuidv4()}.${ext}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("user-images")
      .upload(filename, file, { upsert: false });

    if (uploadError) throw uploadError;

    // Get the public URL for the uploaded file
    const { data } = supabase.storage
      .from("user-images")
      .getPublicUrl(filename);
    const response: UploadResponse = { imageUrl: data.publicUrl };

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

    // Extract filename from the image URL
    const parts = imageUrl.split("/");
    const filename = parts[parts.length - 1];

    if (!filename) {
      return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
    }

    const { error: deleteError } = await supabase.storage
      .from("user-images")
      .remove([filename]);

    if (deleteError) throw deleteError;

    const response: DeleteImageResponse = {
      message: "File deleted successfully",
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error deleting image:", error);
    return NextResponse.json(
      { error: "Failed to delete image" },
      { status: 500 }
    );
  }
}
