"use client";
import { useSession } from "next-auth/react";
import { CourseSchedule } from "@prisma/client";
import { ScheduleResponse } from "@/shared/types/schedule";
import { useFacultySchedules, useActiveCourses } from "@/lib/hooks/queries";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface ScheduleWithCourse extends CourseSchedule {
  course: {
    id: string;
    code: string;
    title: string;
    room: string;
    semester: string;
    section: string;
  };
}

interface Teacher {
  id: string;
}

interface WeeklyScheduleProps {
  teacherInfo: Teacher;
  isViewingOtherTeacher?: boolean;
}

export default function WeeklySchedule({
  teacherInfo,
  isViewingOtherTeacher = false,
}: WeeklyScheduleProps) {
  const { data: session, status } = useSession();
  const currentDay = new Date().toLocaleDateString("en-US", {
    weekday: "short",
  });

  // Fetch all courses for the faculty member
  const {
    data: coursesData,
    isLoading: coursesLoading,
    error: coursesError,
  } = useActiveCourses({
    filters: { facultyId: teacherInfo?.id },
  });

  // Fetch all schedules for the faculty member
  const {
    data: schedulesData,
    isLoading: schedulesLoading,
    error: queryError,
  } = useFacultySchedules(teacherInfo?.id, { limit: 1000 });

  const loading = coursesLoading || schedulesLoading;
  const error =
    queryError || coursesError
      ? queryError instanceof Error
        ? queryError.message
        : coursesError instanceof Error
        ? coursesError.message
        : "Failed to load data"
      : null;

  const schedules = (schedulesData?.schedules || []) as ScheduleWithCourse[];
  const allCourses = (coursesData?.courses || []) as Array<{
    id: string;
    code: string;
    title: string;
    room: string;
    semester: string;
    section: string;
  }>;

  // Create a map of course IDs to schedules
  const schedulesByCourseId = schedules.reduce((acc, schedule) => {
    const courseId = schedule.course.id;
    if (!acc[courseId]) {
      acc[courseId] = [];
    }
    acc[courseId].push(schedule);
    return acc;
  }, {} as Record<string, ScheduleWithCourse[]>);

  // Group by course ID, including courses without schedules
  const groupedByCourse = allCourses.reduce(
    (
      acc: Record<
        string,
        {
          course: ScheduleWithCourse["course"];
          schedules: ScheduleWithCourse[];
        }
      >,
      course: {
        id: string;
        code: string;
        title: string;
        room: string;
        semester: string;
        section: string;
      }
    ) => {
      const courseId = course.id;
      const courseSchedules = schedulesByCourseId[courseId] || [];

      // Only include courses that have at least one schedule
      // (since the weekly schedule is meant to show scheduled classes)
      if (courseSchedules.length > 0) {
        acc[courseId] = {
          course: {
            id: course.id,
            code: course.code,
            title: course.title,
            room: course.room,
            semester: course.semester,
            section: course.section,
          },
          schedules: courseSchedules,
        };
      }
      return acc;
    },
    {} as Record<
      string,
      {
        course: ScheduleWithCourse["course"];
        schedules: ScheduleWithCourse[];
      }
    >
  );

  const getSchedulesForDay = (dayName: string) => {
    // Map abbreviated day names to full day names for comparison
    const dayMap: { [key: string]: string } = {
      Sun: "Sunday",
      Mon: "Monday",
      Tue: "Tuesday",
      Wed: "Wednesday",
      Thu: "Thursday",
      Fri: "Friday",
      Sat: "Saturday",
    };

    // Get all schedules for this day, including multiple schedules per course
    const schedulesForDay: Array<{
      course: ScheduleWithCourse["course"];
      schedule: ScheduleWithCourse;
      allDays: string[];
    }> = [];

    Object.values(groupedByCourse).forEach(
      (group: {
        course: ScheduleWithCourse["course"];
        schedules: ScheduleWithCourse[];
      }) => {
        // Get all schedules for this course on this specific day
        // Compare abbreviated day names directly (database stores "Mon", "Tue", etc.)
        const daySchedules = group.schedules.filter(
          (s: ScheduleWithCourse) =>
            s.day.toLowerCase() === dayName.toLowerCase()
        );

        // Get all days this course appears on
        const allDays = group.schedules.map((s: ScheduleWithCourse) => {
          const dayAbbr = Object.keys(dayMap).find(
            (key) => dayMap[key].toLowerCase() === s.day.toLowerCase()
          );
          return dayAbbr || s.day.substring(0, 3);
        });

        // Add each schedule for this day
        daySchedules.forEach((schedule: ScheduleWithCourse) => {
          schedulesForDay.push({
            course: group.course,
            schedule,
            allDays: [...new Set(allDays)] as string[], // Remove duplicates
          });
        });
      }
    );

    // Sort by time (convert to minutes for proper chronological sorting)
    schedulesForDay.sort((a, b) => {
      const timeA = timeToMinutes(a.schedule.fromTime);
      const timeB = timeToMinutes(b.schedule.fromTime);
      return timeA - timeB;
    });

    return schedulesForDay;
  };

  // Convert time string to minutes since midnight for proper sorting
  const timeToMinutes = (time: string): number => {
    if (!time) return 0;

    // Check if time already has AM/PM (12-hour format)
    if (time.includes("AM") || time.includes("PM")) {
      const match = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (match) {
        let hour = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const period = match[3].toUpperCase();

        if (period === "PM" && hour !== 12) {
          hour += 12;
        } else if (period === "AM" && hour === 12) {
          hour = 0;
        }

        return hour * 60 + minutes;
      }
    }

    // Parse 24-hour format (HH:MM)
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours, 10);
    const min = parseInt(minutes, 10);

    if (isNaN(hour) || isNaN(min)) {
      return 0;
    }

    return hour * 60 + min;
  };

  const formatTime = (time: string) => {
    if (!time) return "";

    // Check if time already has AM/PM
    if (time.includes("AM") || time.includes("PM")) {
      // Already formatted, return as is (but clean up any double spaces or extra AM/PM)
      return time.trim().replace(/\s+/g, " ");
    }

    // Parse 24-hour format (HH:MM)
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours, 10);

    if (isNaN(hour) || isNaN(parseInt(minutes, 10))) {
      return time; // Return original if parsing fails
    }

    const period = hour >= 12 ? "PM" : "AM";
    const formattedHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${formattedHour}:${minutes} ${period}`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4 min-h-[430px]">
        <div className="border-b pb-4 mb-4">
          <h2 className="text-base sm:text-lg md:text-xl font-bold text-center text-[#124A69]">
            {isViewingOtherTeacher ? "WEEKLY SCHEDULE" : "MY WEEKLY SCHEDULE"}
          </h2>
        </div>

        <div className="grid grid-cols-7 gap-4 animate-pulse">
          {days.map((day) => (
            <div key={day}>
              {/* Day title skeleton */}
              <div className="h-4 w-10 bg-gray-200 mx-auto mb-4 rounded"></div>

              {/* Simulate a few schedule cards */}
              <div className="space-y-3">
                <div className="h-[80px] bg-gray-200 rounded-lg"></div>
                <div className="h-[80px] bg-gray-200 rounded-lg"></div>
                <div className="h-[80px] bg-gray-200 rounded-lg"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm sm:text-base text-red-500 text-center">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm min-h-[430px] max-h-[600px] flex flex-col">
      <div className="p-4 border-b flex-shrink-0">
        <h2 className="text-base sm:text-lg md:text-xl font-bold text-center text-[#124A69]">
          {isViewingOtherTeacher ? "WEEKLY SCHEDULE" : "MY WEEKLY SCHEDULE"}
        </h2>
      </div>
      {schedules.length === 0 ? (
        <div className="p-4 sm:p-6 md:p-8 flex items-center justify-center min-h-[400px] flex-1">
          <div className="text-center space-y-4">
            <div className="text-4xl sm:text-5xl md:text-6xl text-[#124A69] opacity-20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 mx-auto"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                />
              </svg>
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-[#124A69]">
              No Schedule Found
            </h3>
            <p className="text-sm sm:text-base text-gray-500 max-w-md mx-auto">
              {isViewingOtherTeacher
                ? "This teacher doesn't have any scheduled class for this week, Check back later for updates"
                : "You don't have any scheduled classes for this week. Check back later for updates."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2 sm:gap-3 md:gap-4 p-2 sm:p-3 md:p-4 overflow-x-auto overflow-y-auto flex-1">
          {days.map((day) => (
            <div
              key={day}
              className={`${day === currentDay ? "bg-blue-50 rounded-lg" : ""}`}
            >
              <div className="text-center font-semibold mb-2 sm:mb-3 md:mb-4 text-[#124A69] text-xs sm:text-sm">
                {day}
              </div>
              <div className="space-y-1 sm:space-y-2">
                {getSchedulesForDay(day).map((item, index) => {
                  const hasMultipleDays = item.allDays.length > 1;
                  // Check if this course has multiple schedules on this day
                  const schedulesForThisCourse = getSchedulesForDay(day).filter(
                    (s) => s.course.id === item.course.id
                  );
                  const hasMultipleSchedulesToday =
                    schedulesForThisCourse.length > 1;

                  return (
                    <div
                      key={`${item.course.id}-${item.schedule.id}-${index}`}
                      className="group perspective"
                    >
                      <div className="preserve-3d">
                        {/* Front of card */}
                        <div className="backface-hidden">
                          <div className="bg-[#FAEDCB] rounded-lg p-1.5 sm:p-2 text-[#124A69] shadow-sm text-center h-[70px] sm:h-[75px] md:h-[80px] flex flex-col justify-center relative">
                            <div className="font-bold text-[10px] sm:text-xs md:text-sm">
                              {item.course.code}
                            </div>
                            <div className="text-[9px] sm:text-[10px] md:text-xs mt-0.5 sm:mt-1">
                              {formatTime(item.schedule.fromTime)} -{" "}
                              {formatTime(item.schedule.toTime)}
                            </div>
                            {hasMultipleSchedulesToday && (
                              <div className="absolute bottom-1 left-1 text-[7px] text-[#124A69] opacity-75">
                                {schedulesForThisCourse.indexOf(item) + 1}/
                                {schedulesForThisCourse.length}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Back of card */}
                        <div className="backface-hidden rotate-y-180">
                          <div className="bg-[#124A69] rounded-lg p-1.5 sm:p-2 text-white shadow-sm text-center h-[70px] sm:h-[75px] md:h-[80px] flex flex-col justify-center">
                            <div className="text-[9px] sm:text-[10px] md:text-xs space-y-0.5 sm:space-y-1">
                              <div className="font-semibold">
                                {item.course.code}
                              </div>
                              <div>Section: {item.course.section}</div>
                              <div>Room: {item.course.room}</div>
                              {hasMultipleDays && (
                                <div className="text-[8px] mt-1 opacity-75">
                                  Days: {item.allDays.join(", ")}
                                </div>
                              )}
                              {hasMultipleSchedulesToday && (
                                <div className="text-[8px] mt-1 opacity-75">
                                  {schedulesForThisCourse.length} sessions today
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
