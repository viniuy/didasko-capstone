import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
//@ts-ignore
export async function POST(request: Request, { params }: { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { course_slug, studentId } = params;

    // Verify course exists
    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Verify student exists and is enrolled in the course
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        coursesEnrolled: {
          some: {
            id: course.id,
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student not found or not enrolled in this course" },
        { status: 404 }
      );
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

    // If student already has an image, delete the old one
    if (student.image) {
      const oldFilename = student.image.split("/uploads/")[1];
      if (oldFilename) {
        const oldPath = join(process.cwd(), "public/uploads", oldFilename);
        try {
          await unlink(oldPath);
        } catch (error) {
          console.error("Error deleting old image:", error);
        }
      }
    }

    // Update the student's image in the database
    const imageUrl = `/uploads/${filename}`;
    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: { image: imageUrl },
    });

    return NextResponse.json({
      message: "Image uploaded successfully",
      imageUrl: updatedStudent.image,
    });
  } catch (error) {
    console.error("Error uploading student image:", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}
//@ts-ignore
export async function DELETE(request: Request, { params }: { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { course_slug, studentId } = params;

    // Verify course exists
    const course = await prisma.course.findUnique({
      where: { slug: course_slug },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Verify student exists and is enrolled in the course
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        coursesEnrolled: {
          some: {
            id: course.id,
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student not found or not enrolled in this course" },
        { status: 404 }
      );
    }

    if (!student.image) {
      return NextResponse.json(
        { error: "Student has no image to delete" },
        { status: 400 }
      );
    }

    // Delete the image file
    const filename = student.image.split("/uploads/")[1];
    if (filename) {
      const filePath = join(process.cwd(), "public/uploads", filename);
      try {
        await unlink(filePath);
      } catch (error) {
        console.error("Error deleting image file:", error);
      }
    }

    // Update the student's image in the database
    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: { image: null },
    });

    return NextResponse.json({
      message: "Image deleted successfully",
      student: updatedStudent,
    });
  } catch (error) {
    console.error("Error deleting student image:", error);
    return NextResponse.json(
      { error: "Failed to delete image" },
      { status: 500 }
    );
  }
}
