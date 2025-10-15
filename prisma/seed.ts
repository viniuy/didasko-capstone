import { PrismaClient, Role, WorkType, Permission } from "@prisma/client";

const prisma = new PrismaClient();

const facultyMembers = [
  {
    name: "Ricson Ricardo",
    email: "ricson.ricardo@alabang.sti.edu.ph",
    department: "IT Department",
    workType: WorkType.FULL_TIME,
    role: Role.ACADEMIC_HEAD,
    permission: Permission.GRANTED,
  },
  {
    name: "Darryl Pauline Nietes",
    email: "darryl.nietes@alabang.sti.edu.ph",
    department: "BA Department",
    workType: WorkType.FULL_TIME,
    role: Role.FACULTY,
    permission: Permission.GRANTED,
  },
  {
    name: "Rod Mark Rufino",
    email: "rod.rufino@alabang.sti.edu.ph",
    department: "TM Department",
    workType: WorkType.FULL_TIME,
    role: Role.FACULTY,
    permission: Permission.GRANTED,
  },
  {
    name: "Jerryfel Laraga",
    email: "jerryfel.laraga@alabang.sti.edu.ph",
    department: "HM Department",
    workType: WorkType.FULL_TIME,
    role: Role.FACULTY,
    permission: Permission.GRANTED,
  },
  {
    name: "Justin Joseph Gorospe",
    email: "justin.gorospe@alabang.sti.edu.ph",
    department: "SHS Department",
    workType: WorkType.FULL_TIME,
    role: Role.FACULTY,
    permission: Permission.GRANTED,
  },
  {
    name: "Manuel Jojo Simon",
    email: "manuel.simon@alabang.sti.edu.ph",
    department: "IT Department",
    workType: WorkType.FULL_TIME,
    role: Role.FACULTY,
    permission: Permission.GRANTED,
  },
  {
    name: "Arvin Marlin",
    email: "arvin.marlin@alabang.sti.edu.ph",
    department: "BA Department",
    workType: WorkType.FULL_TIME,
    role: Role.FACULTY,
    permission: Permission.GRANTED,
  },
  {
    name: "John Renaund Baybay",
    email: "john.baybay@alabang.sti.edu.ph",
    department: "TM Department",
    workType: WorkType.FULL_TIME,
    role: Role.FACULTY,
    permission: Permission.GRANTED,
  },
  {
    name: "Ma. Diana Moral",
    email: "diana.moral@alabang.sti.edu.ph",
    department: "HM Department",
    workType: WorkType.FULL_TIME,
    role: Role.FACULTY,
    permission: Permission.GRANTED,
  },
  {
    name: "Redmond Laurel",
    email: "redmond.laurel@alabang.sti.edu.ph",
    department: "SHS Department",
    workType: WorkType.FULL_TIME,
    role: Role.FACULTY,
    permission: Permission.GRANTED,
  },
];

const mockSchedules = [
  // First Semester Courses
  {
    day: "Monday",
    course: "IT CAPSTONE",
    section: "BSIT-611",
    classNumber: 12345,
    time: "8:00 AM - 10:30 AM",
    room: "Room: 401",
    semester: "1st Semester",
  },
  {
    day: "Monday",
    course: "OOP",
    section: "BSIT-611",
    classNumber: 67890,
    time: "11:00 AM - 2:00 PM",
    room: "Room: 402",
    semester: "1st Semester",
  },
  {
    day: "Tuesday",
    course: "IAS",
    section: "BSIT-611",
    classNumber: 11223,
    time: "8:00 AM - 10:30 AM",
    room: "Room: 403",
    semester: "1st Semester",
  },
  {
    day: "Wednesday",
    course: "MOBSTECH",
    section: "BSIT-611",
    classNumber: 44556,
    time: "10:30 AM - 1:30 PM",
    room: "LAB 1",
    semester: "1st Semester",
  },
  {
    day: "Thursday",
    course: "ETHICS",
    section: "BSIT-611",
    classNumber: 77889,
    time: "8:00 AM - 10:30 AM",
    room: "Room: 404",
    semester: "1st Semester",
  },
  {
    day: "Friday",
    course: "COMPRO 2",
    section: "BSIT-611",
    classNumber: 99001,
    time: "9:30 AM - 12:00 PM",
    room: "LAB 2",
    semester: "1st Semester",
  },
  // Second Semester Courses
  {
    day: "Monday",
    course: "PIIST",
    section: "BSIT-611",
    classNumber: 33445,
    time: "3:00 PM - 5:30 PM",
    room: "Room: 401",
    semester: "2nd Semester",
  },
  {
    day: "Tuesday",
    course: "EUTHENICS",
    section: "BSIT-611",
    classNumber: 55667,
    time: "11:00 AM - 2:00 PM",
    room: "Room: 402",
    semester: "2nd Semester",
  },
  {
    day: "Wednesday",
    course: "MIS",
    section: "BSIT-611",
    classNumber: 88990,
    time: "2:00 PM - 4:30 PM",
    room: "Room: 403",
    semester: "2nd Semester",
  },
  {
    day: "Thursday",
    course: "GREAT BOOKS",
    section: "BSIT-611",
    classNumber: 10112,
    time: "11:30 AM - 2:30 PM",
    room: "Room: 404",
    semester: "2nd Semester",
  },
  {
    day: "Thursday",
    course: "WEBSTECH",
    section: "BSIT-611",
    classNumber: 13141,
    time: "11:00 AM - 2:00 PM",
    room: "LAB 1",
    semester: "2nd Semester",
  },
  {
    day: "Friday",
    course: "PROLANS",
    section: "BSIT-611",
    classNumber: 51617,
    time: "5:30 PM - 7:30 PM",
    room: "LAB 2",
    semester: "2nd Semester",
  },
];

async function main() {
  try {
    // Create faculty members
    for (const faculty of facultyMembers) {
      await prisma.user.create({
        data: faculty,
      });
    }
    console.log("Faculty members seeded successfully");

    // Create courses and schedules
    const courses = await Promise.all(
      mockSchedules.map(async (schedule) => {
        const courseCode = schedule.course.replace(/\s+/g, "").toUpperCase();
        const academicYear = "2024-2025";
        const slug =
          `${courseCode}-${academicYear}-${schedule.section}`.toLowerCase();
        return prisma.course.upsert({
          where: { slug },
          update: {
            semester: schedule.semester,
          },
          create: {
            code: courseCode,
            title: schedule.course,
            room: schedule.room,
            semester: schedule.semester,
            section: schedule.section,
            classNumber: schedule.classNumber,
            slug,
            academicYear,
            status: "ACTIVE",
          } as any,
        });
      })
    );

    // Create schedules
    await Promise.all(
      mockSchedules.map(async (schedule, index) => {
        const [fromTime, toTime] = schedule.time.split(" - ").map((t) => {
          const [time, period] = t.split(" ");
          const [hours, minutes] = time.split(":");
          let hour = parseInt(hours);
          if (period === "PM" && hour !== 12) hour += 12;
          if (period === "AM" && hour === 12) hour = 0;
          return `${hour.toString().padStart(2, "0")}:${minutes}`;
        });

        // Get the next occurrence of the day
        const today = new Date();
        const dayOfWeek = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ].indexOf(schedule.day);
        const daysUntilNext = (dayOfWeek - today.getDay() + 7) % 7;
        const nextDay = new Date(today);
        nextDay.setDate(today.getDate() + daysUntilNext);

        return prisma.courseSchedule.create({
          data: {
            courseId: courses[index].id,
            day: schedule.day,
            fromTime,
            toTime,
          },
        });
      })
    );
    console.log("Schedules have been seeded successfully! 🌱");
  } catch (error) {
    console.error("Error seeding data:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
