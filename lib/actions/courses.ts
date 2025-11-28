"use server";

import { prisma } from "@/lib/prisma";
import { CourseStatus } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { logAction } from "@/lib/audit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

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
export async function createCourse(data: CourseInput, isFromImport = false) {
  try {
    // require at least one schedule (if you want that)
    if (!data.schedules || data.schedules.length === 0) {
      return {
        success: false,
        error: "Course must have at least one schedule",
      };
    }

    // optional faculty check
    if (data.facultyId) {
      const faculty = await prisma.user.findUnique({
        where: { id: data.facultyId },
      });
      if (!faculty) return { success: false, error: "Faculty not found" };
    }

    // Generate slug: code-academicyear-section
    const normalizedCode = data.code.toLowerCase().replace(/\s+/g, "-");
    const normalizedAcademicYear = data.academicYear
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/\//g, "-"); // Replace slashes with dashes
    const normalizedSection = data.section.toLowerCase().replace(/\s+/g, "-");
    const slug = `${normalizedCode}-${normalizedAcademicYear}-${normalizedSection}`;

    // Check for duplicate slug before creating
    const existingSlug = await prisma.course.findUnique({
      where: { slug },
    });
    if (existingSlug) {
      return {
        success: false,
        error: "A course with this code already exists (slug conflict)",
      };
    }

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

    try {
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

      // Log course creation
      try {
        const session = await getServerSession(authOptions);
        await logAction({
          userId: session?.user?.id || null,
          action: "COURSE_CREATE",
          module: "Course",
          reason: `Course created: ${newCourse.code} - ${newCourse.title}${
            isFromImport ? " (via import)" : ""
          }`,
          status: "SUCCESS",
          after: {
            id: newCourse.id,
            code: newCourse.code,
            title: newCourse.title,
            section: newCourse.section,
            semester: newCourse.semester,
            academicYear: newCourse.academicYear,
            status: newCourse.status,
            facultyId: newCourse.facultyId,
            source: isFromImport ? "import" : "manual",
          },
          metadata: {
            entityType: "Course",
            entityId: newCourse.id,
            entityName: `${newCourse.code} - ${newCourse.title}`,
            source: isFromImport ? "import" : "manual",
            scheduleCount: newCourse.schedules?.length || 0,
          },
        });
      } catch (error) {
        console.error("Error logging course creation:", error);
        // Don't fail course creation if logging fails
      }

      return { success: true, data: newCourse };
    } catch (prismaError: any) {
      // Handle Prisma unique constraint errors gracefully
      if (prismaError.code === "P2002") {
        const target = prismaError.meta?.target;
        if (Array.isArray(target) && target.includes("slug")) {
          return {
            success: false,
            error:
              "A course with this code already exists. Please use a different course code.",
          };
        }
        if (Array.isArray(target) && target.includes("code")) {
          return {
            success: false,
            error: "A course with this code already exists.",
          };
        }
        return {
          success: false,
          error:
            "A course with these details already exists. Please check for duplicates.",
        };
      }
      // Re-throw if it's not a unique constraint error
      throw prismaError;
    }
  } catch (err) {
    console.error("createCourse error:", err);

    // Log failure
    try {
      const session = await getServerSession(authOptions);
      await logAction({
        userId: session?.user?.id || null,
        action: "COURSE_CREATE",
        module: "Course",
        reason: `Failed to create course`,
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
        metadata: {
          attemptedData: {
            code: data.code,
            title: data.title,
            section: data.section,
          },
        },
      });
    } catch (logError) {
      console.error("Error logging course creation failure:", logError);
    }

    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create course",
    };
  }
}

/** UPDATE COURSE */
interface CourseUpdateData extends Partial<CourseInput> {}

export async function editCourse(
  courseId: string,
  data: CourseUpdateData,
  isFromImport = false
) {
  try {
    const existingCourse = await prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!existingCourse) return { success: false, error: "Course not found" };

    // Check for duplicate slug if code, academicYear, or section changed
    const codeChanged = data.code && data.code !== existingCourse.code;
    const academicYearChanged =
      data.academicYear && data.academicYear !== existingCourse.academicYear;
    const sectionChanged =
      data.section && data.section !== existingCourse.section;

    if (codeChanged || academicYearChanged || sectionChanged) {
      // Generate slug from updated values (use new values if provided, otherwise existing)
      const codeToUse = data.code || existingCourse.code;
      const academicYearToUse =
        data.academicYear || existingCourse.academicYear;
      const sectionToUse = data.section || existingCourse.section;

      const normalizedCode = codeToUse.toLowerCase().replace(/\s+/g, "-");
      const normalizedAcademicYear = academicYearToUse
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/\//g, "-");
      const normalizedSection = sectionToUse.toLowerCase().replace(/\s+/g, "-");
      const newSlug = `${normalizedCode}-${normalizedAcademicYear}-${normalizedSection}`;

      // Check for duplicate slug
      const dupSlug = await prisma.course.findUnique({
        where: { slug: newSlug },
      });
      if (dupSlug && dupSlug.id !== courseId) {
        return {
          success: false,
          error:
            "A course with this code, section, and academic year already exists",
        };
      }
    }

    if (data.facultyId) {
      const faculty = await prisma.user.findUnique({
        where: { id: data.facultyId },
      });
      if (!faculty) return { success: false, error: "Faculty not found" };
    }

    // Generate slug if code, academicYear, or section changed
    let newSlug: string | undefined;
    if (codeChanged || academicYearChanged || sectionChanged) {
      const codeToUse = data.code || existingCourse.code;
      const academicYearToUse =
        data.academicYear || existingCourse.academicYear;
      const sectionToUse = data.section || existingCourse.section;

      const normalizedCode = codeToUse.toLowerCase().replace(/\s+/g, "-");
      const normalizedAcademicYear = academicYearToUse
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/\//g, "-");
      const normalizedSection = sectionToUse.toLowerCase().replace(/\s+/g, "-");
      newSlug = `${normalizedCode}-${normalizedAcademicYear}-${normalizedSection}`;
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
      // update slug if code, academicYear, or section changed
      ...(newSlug ? { slug: newSlug } : {}),
      updatedAt: new Date(),
    };

    // If schedules are provided, we replace existing schedules with new ones inside a transaction
    let updatedCourse;
    try {
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

      // Ensure updatedCourse is defined before proceeding
      if (!updatedCourse) {
        return { success: false, error: "Failed to update course" };
      }

      revalidatePath("/admin/courses");
      // Also invalidate cache tags for consistency with API routes
      revalidateTag("courses");
      if (updatedCourse.slug) {
        revalidateTag(`course-${updatedCourse.slug}`);
      }

      // Log course edit
      try {
        const session = await getServerSession(authOptions);
        await logAction({
          userId: session?.user?.id || null,
          action: "COURSE_EDITED",
          module: "Course Management",
          reason: `Course edited: ${updatedCourse.code} - ${
            updatedCourse.title
          }${isFromImport ? " (via import)" : ""}`,
          status: "SUCCESS",
          before: {
            code: existingCourse.code,
            title: existingCourse.title,
            section: existingCourse.section,
            status: existingCourse.status,
            facultyId: existingCourse.facultyId,
          },
          after: {
            code: updatedCourse.code,
            title: updatedCourse.title,
            section: updatedCourse.section,
            status: updatedCourse.status,
            facultyId: updatedCourse.facultyId,
            source: isFromImport ? "import" : "manual",
          },
          metadata: {
            entityType: "Course",
            entityId: updatedCourse.id,
            entityName: `${updatedCourse.code} - ${updatedCourse.title}`,
            source: isFromImport ? "import" : "manual",
            scheduleUpdated: !!data.schedules,
          },
        });
      } catch (error) {
        console.error("Error logging course edit:", error);
        // Don't fail course edit if logging fails
      }

      return { success: true, data: updatedCourse };
    } catch (prismaError: any) {
      // Handle Prisma unique constraint errors gracefully
      if (prismaError.code === "P2002") {
        const target = prismaError.meta?.target;
        if (Array.isArray(target) && target.includes("slug")) {
          return {
            success: false,
            error:
              "A course with this code already exists. Please use a different course code.",
          };
        }
        if (Array.isArray(target) && target.includes("code")) {
          return {
            success: false,
            error: "A course with this code already exists.",
          };
        }
        return {
          success: false,
          error:
            "A course with these details already exists. Please check for duplicates.",
        };
      }
      // Re-throw if it's not a unique constraint error
      throw prismaError;
    }
  } catch (err) {
    console.error("editCourse error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update course",
    };
  }
}

/** CHECK IF COURSE SLUG EXISTS */
export async function checkCourseSlugExists(
  code: string,
  academicYear: string,
  section: string,
  excludeCourseId?: string
): Promise<boolean> {
  try {
    // Generate slug: code-academicyear-section
    const normalizedCode = code.toLowerCase().replace(/\s+/g, "-");
    const normalizedAcademicYear = academicYear
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/\//g, "-"); // Replace slashes with dashes
    const normalizedSection = section.toLowerCase().replace(/\s+/g, "-");
    const slug = `${normalizedCode}-${normalizedAcademicYear}-${normalizedSection}`;

    // Check if slug exists
    const existingCourse = await prisma.course.findUnique({
      where: { slug },
    });

    // If checking for edit mode, exclude the current course
    if (
      existingCourse &&
      excludeCourseId &&
      existingCourse.id === excludeCourseId
    ) {
      return false;
    }

    return !!existingCourse;
  } catch (error) {
    console.error("Error checking course slug:", error);
    // Return false on error to allow form submission (server will catch it)
    return false;
  }
}
