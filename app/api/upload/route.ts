import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { createClient } from "@supabase/supabase-js";
import { UploadResponse } from "@/shared/types/upload";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${session.user.id}.${ext}`;
    const bucket = supabase.storage.from("user-images");

    // Remove existing images before uploading new one
    await bucket.remove([
      `${session.user.id}.jpg`,
      `${session.user.id}.png`,
      `${session.user.id}.jpeg`,
    ]);

    const { error: uploadError } = await bucket.upload(filename, file, {
      cacheControl: "0",
      upsert: true,
      contentType: file.type,
    });

    if (uploadError) throw uploadError;

    const { data } = bucket.getPublicUrl(filename);
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

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: "No image URL provided" },
        { status: 400 }
      );
    }

    const bucket = supabase.storage.from("user-images");

    // Remove all possible image formats for the user
    await bucket.remove([
      `${session.user.id}.jpg`,
      `${session.user.id}.png`,
      `${session.user.id}.jpeg`,
      `${session.user.id}.webp`,
      `${session.user.id}.gif`,
    ]);

    return NextResponse.json({ message: "Image deleted successfully" });
  } catch (error) {
    console.error("Error deleting image:", error);
    return NextResponse.json(
      { error: "Failed to delete image" },
      { status: 500 }
    );
  }
}
