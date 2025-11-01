"use server";

import { prisma } from "@/lib/prisma";
import { CourseStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

interface ScheduleInput {
  day: string;
  fromTime: string;
  toTime: string;
}

interface CourseInput {
  code: string;
  title: string;
  room: string;
  semester: string;
  academicYear: string;
  classNumber: number;
  section: string;
  facultyId?: string | null;
  status?: CourseStatus;
  schedules?: ScheduleInput[];
}

/** CREATE COURSE */
export async function createCourse(data: CourseInput) {
  try {
    // require at least one schedule (if you want that)
    if (!data.schedules || data.schedules.length === 0) {
      return {
        success: false,
        error: "Course must have at least one schedule",
      };
    }

    // duplicate check
    const existing = await prisma.course.findFirst({
      where: { code: data.code },
    });
    if (existing)
      return {
        success: false,
        error: "A course with this code already exists",
      };

    // optional faculty check
    if (data.facultyId) {
      const faculty = await prisma.user.findUnique({
        where: { id: data.facultyId },
      });
      if (!faculty) return { success: false, error: "Faculty not found" };
    }

    const slug = data.code.toLowerCase().replace(/\s+/g, "-");

    // Build create payload excluding schedules, then attach schedules via nested write
    const createData: any = {
      code: data.code,
      title: data.title,
      room: data.room,
      semester: data.semester,
      academicYear: data.academicYear,
      classNumber: data.classNumber,
      section: data.section,
      facultyId: data.facultyId ?? null,
      slug,
      status: data.status ?? CourseStatus.ACTIVE,
    };

    const newCourse = await prisma.course.create({
      data: {
        ...createData,
        schedules: {
          // createMany is slightly faster and fine if you don't need returned schedule IDs in this nested call,
          // but Prisma returns schedules only when you include them separately. create with nested create works too.
          createMany: {
            data: data.schedules.map((s) => ({
              day: s.day,
              fromTime: s.fromTime,
              toTime: s.toTime,
            })),
          },
        },
      },
      include: {
        schedules: true,
      },
    });

    revalidatePath("/admin/courses");

    return { success: true, data: newCourse };
  } catch (err) {
    console.error("createCourse error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create course",
    };
  }
}

/** UPDATE COURSE */
interface CourseUpdateData extends Partial<CourseInput> {}

export async function editCourse(courseId: string, data: CourseUpdateData) {
  try {
    const existingCourse = await prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!existingCourse) return { success: false, error: "Course not found" };

    // if changing code, ensure uniqueness
    if (data.code && data.code !== existingCourse.code) {
      const dup = await prisma.course.findFirst({
        where: { code: data.code, id: { not: courseId } },
      });
      if (dup)
        return {
          success: false,
          error: "A course with this code already exists",
        };
    }

    if (data.facultyId) {
      const faculty = await prisma.user.findUnique({
        where: { id: data.facultyId },
      });
      if (!faculty) return { success: false, error: "Faculty not found" };
    }

    // Build update payload for scalar fields only (exclude schedules)
    const updateData: any = {
      ...(data.code !== undefined && { code: data.code }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.room !== undefined && { room: data.room }),
      ...(data.semester !== undefined && { semester: data.semester }),
      ...(data.academicYear !== undefined && {
        academicYear: data.academicYear,
      }),
      ...(data.classNumber !== undefined && { classNumber: data.classNumber }),
      ...(data.section !== undefined && { section: data.section }),
      ...(data.facultyId !== undefined && { facultyId: data.facultyId }),
      ...(data.status !== undefined && { status: data.status }),
      // update slug if code changed
      ...(data.code
        ? { slug: data.code.toLowerCase().replace(/\s+/g, "-") }
        : {}),
      updatedAt: new Date(),
    };

    // If schedules are provided, we replace existing schedules with new ones inside a transaction
    let updatedCourse;
    if (data.schedules) {
      await prisma.$transaction(async (tx) => {
        // delete existing schedules for this course
        await tx.courseSchedule.deleteMany({ where: { courseId } });

        // insert new schedules (use createMany for performance)
        if (data.schedules && data.schedules.length > 0) {
          await tx.courseSchedule.createMany({
            data: data.schedules.map((s) => ({
              courseId,
              day: s.day,
              fromTime: s.fromTime,
              toTime: s.toTime,
            })),
          });
        }

        // update the course scalars
        updatedCourse = await tx.course.update({
          where: { id: courseId },
          data: updateData,
          include: { schedules: true },
        });
      });
    } else {
      // no schedule changes — simple update
      updatedCourse = await prisma.course.update({
        where: { id: courseId },
        data: updateData,
        include: { schedules: true },
      });
    }

    revalidatePath("/admin/courses");
    return { success: true, data: updatedCourse };
  } catch (err) {
    console.error("editCourse error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update course",
    };
  }
}
