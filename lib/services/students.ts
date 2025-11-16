import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Get students with filters
export async function getStudents(filters: {
  page?: number;
  limit?: number;
  search?: string;
  courseId?: string;
}) {
  const { page = 1, limit = 10, search, courseId } = filters;
  const skip = (page - 1) * limit;

  const where: Prisma.StudentWhereInput = {};

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { studentId: { contains: search, mode: "insensitive" } },
      { id: { contains: search, mode: "insensitive" } },
    ];
  }

  if (courseId) {
    where.coursesEnrolled = {
      some: {
        id: courseId,
      },
    };
  }

  const [total, students] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      skip,
      take: limit,
      include: {
        coursesEnrolled: {
          select: {
            id: true,
            code: true,
            title: true,
            section: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  return {
    students,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// Get student by ID
export async function getStudentById(id: string) {
  return prisma.student.findUnique({
    where: { id },
    include: {
      coursesEnrolled: {
        select: {
          id: true,
          code: true,
          title: true,
          section: true,
        },
      },
    },
  });
}

// Get student by studentId
export async function getStudentByStudentId(studentId: string) {
  return prisma.student.findUnique({
    where: { studentId },
    select: {
      id: true,
      studentId: true,
      firstName: true,
      lastName: true,
      middleInitial: true,
      rfid_id: true,
    },
  });
}

// Create student
export async function createStudent(data: {
  lastName: string;
  firstName: string;
  middleInitial?: string | null;
  image?: string | null;
  studentId: string;
  rfid_id?: number;
  courseId?: string;
}) {
  // Check if studentId already exists
  const existingStudent = await prisma.student.findUnique({
    where: { studentId: data.studentId },
  });

  if (existingStudent) {
    throw new Error("Student ID already exists");
  }

  // Check if rfid_id already exists (if provided)
  if (data.rfid_id !== undefined && !isNaN(data.rfid_id)) {
    const existingRfid = await prisma.student.findUnique({
      where: { rfid_id: data.rfid_id },
    });

    if (existingRfid) {
      throw new Error("RFID UID already registered to another student");
    }
  }

  const studentData: any = {
    lastName: data.lastName,
    firstName: data.firstName,
    middleInitial: data.middleInitial,
    image: data.image || null,
    studentId: data.studentId,
  };

  if (data.rfid_id !== undefined && !isNaN(data.rfid_id)) {
    studentData.rfid_id = data.rfid_id;
  }

  if (data.courseId) {
    const course = await prisma.course.findUnique({
      where: { id: data.courseId },
    });

    if (!course) {
      throw new Error("Course not found");
    }

    studentData.coursesEnrolled = {
      connect: {
        id: data.courseId,
      },
    };
  }

  return prisma.student.create({
    data: studentData,
    include: {
      coursesEnrolled: {
        select: {
          id: true,
          code: true,
          title: true,
          section: true,
        },
      },
    },
  });
}

// Update student
export async function updateStudent(
  id: string,
  data: {
    lastName?: string;
    firstName?: string;
    middleInitial?: string | null;
    image?: string | null;
    studentId?: string;
    rfid_id?: number;
  }
) {
  return prisma.student.update({
    where: { id },
    data,
    include: {
      coursesEnrolled: {
        select: {
          id: true,
          code: true,
          title: true,
          section: true,
        },
      },
    },
  });
}

// Delete student
export async function deleteStudent(id: string) {
  return prisma.student.delete({
    where: { id },
  });
}

// Assign RFID to student
export async function assignRfidToStudent(studentId: string, rfid: number) {
  // Check if RFID is already assigned
  const existingStudent = await prisma.student.findUnique({
    where: { rfid_id: rfid },
  });

  if (existingStudent && existingStudent.id !== studentId) {
    throw new Error("RFID is already assigned to another student");
  }

  return prisma.student.update({
    where: { id: studentId },
    data: { rfid_id: rfid },
  });
}

// Import students to course (batch operation)
export async function importStudentsToCourse(
  courseSlug: string,
  studentsData: Array<{
    "Student ID": string;
    "First Name": string;
    "Last Name": string;
    "Middle Initial"?: string;
  }>
) {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    select: {
      id: true,
      students: {
        select: { id: true, studentId: true },
      },
    },
  });

  if (!course) {
    throw new Error("Course not found");
  }

  const courseId = course.id;
  const existingStudentIds = new Set(course.students.map((s) => s.studentId));

  let imported = 0;
  let skipped = 0;
  const errors: Array<{ studentId: string; message: string }> = [];
  const detailedFeedback: Array<{
    row: number;
    studentId: string;
    status: string;
    message: string;
    id?: string;
  }> = [];

  for (let index = 0; index < studentsData.length; index++) {
    const studentData = studentsData[index];
    const rowNumber = index + 1;

    try {
      const studentId = studentData["Student ID"]?.toString().trim();
      const firstName = studentData["First Name"]?.toString().trim();
      const lastName = studentData["Last Name"]?.toString().trim();
      const middleInitial =
        studentData["Middle Initial"]?.toString().trim() || null;

      if (!studentId || !firstName || !lastName) {
        skipped++;
        const missingFields = [];
        if (!studentId) missingFields.push("Student ID");
        if (!firstName) missingFields.push("First Name");
        if (!lastName) missingFields.push("Last Name");

        errors.push({
          studentId: studentId || "N/A",
          message: `Missing required fields: ${missingFields.join(", ")}`,
        });

        detailedFeedback.push({
          row: rowNumber,
          studentId: studentId || "N/A",
          status: "error",
          message: `Missing required fields: ${missingFields.join(", ")}`,
        });
        continue;
      }

      if (existingStudentIds.has(studentId)) {
        skipped++;
        detailedFeedback.push({
          row: rowNumber,
          studentId: studentId,
          status: "skipped",
          message: "Already enrolled in this course",
        });
        continue;
      }

      const existingStudent = await getStudentByStudentId(studentId);

      if (!existingStudent) {
        skipped++;
        detailedFeedback.push({
          row: rowNumber,
          studentId: studentId,
          status: "skipped",
          message: "Student not found in database",
        });
        continue;
      }

      if (!existingStudent.rfid_id) {
        skipped++;
        detailedFeedback.push({
          row: rowNumber,
          studentId: studentId,
          status: "skipped",
          message: "Student does not have RFID registration",
        });
        continue;
      }

      await prisma.course.update({
        where: { id: courseId },
        data: {
          students: {
            connect: { id: existingStudent.id },
          },
        },
      });

      imported++;
      existingStudentIds.add(studentId);

      detailedFeedback.push({
        row: rowNumber,
        studentId: studentId,
        status: "imported",
        message: "Successfully added to course",
        id: existingStudent.id,
      });
    } catch (err: any) {
      const studentId = studentData["Student ID"]?.toString() || "N/A";
      const errorMessage = err?.message || "Unknown error occurred";

      errors.push({
        studentId: studentId,
        message: errorMessage,
      });

      detailedFeedback.push({
        row: rowNumber,
        studentId: studentId,
        status: "error",
        message: errorMessage,
      });
    }
  }

  return {
    total: studentsData.length,
    imported,
    skipped,
    errors,
    detailedFeedback,
  };
}
