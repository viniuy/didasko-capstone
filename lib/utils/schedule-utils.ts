import { prisma } from "@/lib/prisma";

interface Schedule {
  day: string;
  fromTime: string;
  toTime: string;
}

/**
 * Converts time string to minutes since midnight
 * Handles both "HH:MM" (24-hour) and "HH:MM AM/PM" (12-hour) formats
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;

  // Check if it's in "HH:MM AM/PM" format
  if (timeStr.includes("AM") || timeStr.includes("PM")) {
    const [time, period] = timeStr.trim().split(" ");
    const [hours, minutes] = time.split(":").map(Number);
    let hour24 = hours;

    if (period === "PM" && hours !== 12) {
      hour24 = hours + 12;
    } else if (period === "AM" && hours === 12) {
      hour24 = 0;
    }

    return hour24 * 60 + (minutes || 0);
  }

  // Handle "HH:MM" format (24-hour)
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + (minutes || 0);
}

/**
 * Checks if two schedules overlap on the same day
 */
export function checkTimeOverlap(
  schedule1: Schedule,
  schedule2: Schedule
): boolean {
  if (schedule1.day !== schedule2.day) return false;

  const start1 = timeToMinutes(schedule1.fromTime);
  const end1 = timeToMinutes(schedule1.toTime);
  const start2 = timeToMinutes(schedule2.fromTime);
  const end2 = timeToMinutes(schedule2.toTime);

  return start1 < end2 && start2 < end1;
}

/**
 * Normalizes day name for comparison (handles both full and short names)
 */
export function normalizeDayName(day: string): string {
  const dayMap: Record<string, string> = {
    Mon: "Monday",
    Tue: "Tuesday",
    Wed: "Wednesday",
    Thu: "Thursday",
    Fri: "Friday",
    Sat: "Saturday",
    Sun: "Sunday",
    Monday: "Monday",
    Tuesday: "Tuesday",
    Wednesday: "Wednesday",
    Thursday: "Thursday",
    Friday: "Friday",
    Saturday: "Saturday",
    Sunday: "Sunday",
  };
  return dayMap[day] || day;
}

/**
 * Checks if new schedules overlap with existing active courses for a given faculty
 * @param newSchedules - Array of schedules to check
 * @param facultyId - Faculty ID to check conflicts for
 * @param excludeCourseIds - Course IDs to exclude from conflict check (e.g., courses being edited)
 * @param semester - Semester to filter active courses
 * @param academicYear - Academic year to filter active courses
 * @returns Error message if overlap found, null otherwise
 */
export async function checkScheduleOverlap(
  newSchedules: Array<{ day: string; fromTime: string; toTime: string }>,
  facultyId: string | null | undefined,
  excludeCourseIds: string[] = [],
  semester?: string,
  academicYear?: string
): Promise<string | null> {
  if (!facultyId) {
    return "Faculty ID is required for schedule overlap validation.";
  }

  if (!newSchedules || newSchedules.length === 0) {
    return null; // No schedules to check
  }

  // Fetch all active courses for this faculty, semester, and academic year
  const whereClause: any = {
    facultyId,
    status: "ACTIVE",
  };

  if (semester) {
    whereClause.semester = semester;
  }
  if (academicYear) {
    whereClause.academicYear = academicYear;
  }
  if (excludeCourseIds.length > 0) {
    whereClause.id = { notIn: excludeCourseIds };
  }

  const existingCourses = await prisma.course.findMany({
    where: whereClause,
    include: {
      schedules: true,
    },
  });

  for (const newSchedule of newSchedules) {
    const normalizedNewDay = normalizeDayName(newSchedule.day);

    for (const existingCourse of existingCourses) {
      if (!existingCourse.schedules || existingCourse.schedules.length === 0) {
        continue;
      }

      for (const existingSchedule of existingCourse.schedules) {
        const normalizedExistingDay = normalizeDayName(existingSchedule.day);

        if (normalizedNewDay === normalizedExistingDay) {
          const overlapSchedule = {
            day: normalizedExistingDay,
            fromTime: existingSchedule.fromTime,
            toTime: existingSchedule.toTime,
          };

          if (checkTimeOverlap(newSchedule, overlapSchedule)) {
            return `Schedule overlaps with existing course "${existingCourse.code} - ${existingCourse.section}" on ${normalizedNewDay} (${existingSchedule.fromTime} - ${existingSchedule.toTime}). Please adjust the time.`;
          }
        }
      }
    }
  }

  return null; // No overlap found
}
