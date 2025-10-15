import { PrismaClient, WorkType, Role } from "@prisma/client";

const prisma = new PrismaClient();

type FacultyMember = {
  name: string;
  email: string;
  department: string;
  workType: WorkType;
  role: Role;
  studentId: string;
};

type FacultyMap = {
  [key: string]: FacultyMember;
};

const faculty: FacultyMap = {
  vincent: {
    name: "Vincent Dizon",
    email: "dizon.292363@alabang.sti.edu.ph",
    department: "IT Department",
    workType: WorkType.FULL_TIME,
    role: Role.FACULTY,
    studentId: "2024-0012",
  },
  arley: {
    name: "Arley Mae Marabut",
    email: "marabut.284909@alabang.sti.edu.ph",
    department: "IT Department",
    workType: WorkType.FULL_TIME,
    role: Role.FACULTY,
    studentId: "2024-0023",
  },
  denys: {
    name: "Denys John Santayana",
    email: "santayana.309310@alabang.sti.edu.ph",
    department: "IT Department",
    workType: WorkType.FULL_TIME,
    role: Role.FACULTY,
    studentId: "2024-0029",
  },
  jonathan: {
    name: "Jonathan Francis Corpuz",
    email: "corpuz.301620@alabang.sti.edu.ph",
    department: "IT Department",
    workType: WorkType.FULL_TIME,
    role: Role.FACULTY,
    studentId: "2024-0006",
  },
};

async function initializeFaculty(facultyMember: FacultyMember) {
  const user = await prisma.user.create({
    data: {
      name: facultyMember.name,
      email: facultyMember.email,
      department: facultyMember.department,
      workType: facultyMember.workType,
      role: facultyMember.role,
      permission: "GRANTED",
    },
  });
  console.log(`Created user account for ${facultyMember.email}`);
  return user;
}

async function assignCoursesToFaculty(userId: string) {
  // Get all students
  const allStudents = await prisma.student.findMany();

  // Get all courses
  const allCourses = await prisma.course.findMany();

  // Assign faculty to all courses
  for (const course of allCourses) {
    await prisma.course.update({
      where: { id: course.id },
      data: {
        faculty: {
          connect: { id: userId },
        },
      },
    });
  }

  // Enroll all students in all courses
  for (const student of allStudents) {
    for (const course of allCourses) {
      await prisma.course.update({
        where: { id: course.id },
        data: {
          students: {
            connect: { id: student.id },
          },
        },
      });
    }
  }

  return { allCourses };
}

async function main() {
  console.log("Welcome to Didasko Faculty Initialization! 🎓");
  console.log("----------------------------------------");

  const facultyName = process.argv[2]?.toLowerCase();

  if (!facultyName) {
    console.error(
      "Please provide a faculty name: vincent, arley, denys, jonathan, or all"
    );
    process.exit(1);
  }

  try {
    if (facultyName === "all") {
      console.log("Initializing all faculty members...");
      const createdUsers = [];

      // Initialize all faculty members
      for (const [key, member] of Object.entries(faculty)) {
        const user = await initializeFaculty(member);
        createdUsers.push({ key, user });
      }

      // Assign courses only to Vincent
      const vincent = createdUsers.find((u) => u.key === "vincent");
      if (vincent) {
        console.log("\nAssigning courses to Vincent Dizon...");
        const { allCourses } = await assignCoursesToFaculty(vincent.user.id);
        console.log(
          `Successfully set up Vincent Dizon as faculty for all ${allCourses.length} courses`
        );
        console.log("All students have been enrolled in all courses");
        console.log("\n🎓 Good luck on your defense! 🎓");
      }
    } else if (faculty[facultyName]) {
      const selectedFaculty = faculty[facultyName];
      console.log(`Initializing ${selectedFaculty.name}...`);

      const user = await initializeFaculty(selectedFaculty);

      // Assign courses to the selected faculty member
      console.log(`\nAssigning courses to ${selectedFaculty.name}...`);
      const { allCourses } = await assignCoursesToFaculty(user.id);
      console.log(
        `Successfully set up ${selectedFaculty.name} as faculty for all ${allCourses.length} courses`
      );
      console.log("All students have been enrolled in all courses");
    } else {
      console.error(
        "Please provide a valid faculty name: vincent, arley, denys, jonathan, or all"
      );
      process.exit(1);
    }
  } catch (error) {
    console.error("Error seeding data:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
