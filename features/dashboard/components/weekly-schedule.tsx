"use client";
import { useSession } from "next-auth/react";
import { CourseSchedule } from "@prisma/client";
import { ScheduleResponse } from "@/shared/types/schedule";
import { useFacultySchedules } from "@/lib/hooks/queries";

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

  // React Query hook
  const {
    data: schedulesData,
    isLoading: loading,
    error: queryError,
  } = useFacultySchedules(teacherInfo?.id, { limit: 100 });

  const schedules = (schedulesData?.schedules || []) as ScheduleWithCourse[];
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : "Failed to load schedules"
    : null;

  // Group schedules by course ID
  const groupedByCourse = schedules.reduce((acc, schedule) => {
    const courseId = schedule.course.id;
    if (!acc[courseId]) {
      acc[courseId] = {
        course: schedule.course,
        schedules: [],
      };
    }
    acc[courseId].schedules.push(schedule);
    return acc;
  }, {} as Record<string, { course: ScheduleWithCourse["course"]; schedules: ScheduleWithCourse[] }>);

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

    const fullDayName = dayMap[dayName];

    // Get courses that have schedules on this day
    const coursesForDay = Object.values(groupedByCourse)
      .filter((group) =>
        group.schedules.some(
          (s) => s.day.toLowerCase() === fullDayName.toLowerCase()
        )
      )
      .map((group) => {
        // Get the schedule for this specific day
        const daySchedule = group.schedules.find(
          (s) => s.day.toLowerCase() === fullDayName.toLowerCase()
        );
        return {
          ...group,
          daySchedule, // The specific schedule for this day
          allDays: group.schedules.map((s) => {
            const dayAbbr = Object.keys(dayMap).find(
              (key) => dayMap[key].toLowerCase() === s.day.toLowerCase()
            );
            return dayAbbr || s.day.substring(0, 3);
          }),
        };
      })
      .sort((a, b) => {
        if (!a.daySchedule || !b.daySchedule) return 0;
        return a.daySchedule.fromTime.localeCompare(b.daySchedule.fromTime);
      });

    return coursesForDay;
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const period = hour >= 12 ? "PM" : "AM";
    const formattedHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${formattedHour}:${minutes} ${period}`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4 min-h-[430px]">
        <div className="border-b pb-4 mb-4">
          <h2 className="text-base sm:text-lg md:text-xl font-bold text-center text-[#124A69]">
            MY WEEKLY SCHEDULE
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
    <div className="bg-white rounded-lg shadow-sm min-h-[430px]">
      <div className="p-4 border-b">
        <h2 className="text-base sm:text-lg md:text-xl font-bold text-center text-[#124A69]">
          MY WEEKLY SCHEDULE
        </h2>
      </div>
      {schedules.length === 0 ? (
        <div className="p-4 sm:p-6 md:p-8 flex items-center justify-center min-h-[400px]">
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
        <div className="grid grid-cols-7 gap-2 sm:gap-3 md:gap-4 p-2 sm:p-3 md:p-4 overflow-x-auto">
          {days.map((day) => (
            <div
              key={day}
              className={`${day === currentDay ? "bg-blue-50 rounded-lg" : ""}`}
            >
              <div className="text-center font-semibold mb-2 sm:mb-3 md:mb-4 text-[#124A69] text-xs sm:text-sm">
                {day}
              </div>
              <div className="space-y-1 sm:space-y-2">
                {getSchedulesForDay(day).map((courseGroup) => {
                  if (!courseGroup.daySchedule) return null;
                  const hasMultipleDays = courseGroup.allDays.length > 1;
                  return (
                    <div
                      key={courseGroup.course.id}
                      className="group perspective"
                    >
                      <div className="preserve-3d">
                        {/* Front of card */}
                        <div className="backface-hidden">
                          <div className="bg-[#FAEDCB] rounded-lg p-1.5 sm:p-2 text-[#124A69] shadow-sm text-center h-[70px] sm:h-[75px] md:h-[80px] flex flex-col justify-center relative">
                            <div className="font-bold text-[10px] sm:text-xs md:text-sm">
                              {courseGroup.course.code}
                            </div>
                            <div className="text-[9px] sm:text-[10px] md:text-xs mt-0.5 sm:mt-1">
                              {formatTime(courseGroup.daySchedule.fromTime)} -{" "}
                              {formatTime(courseGroup.daySchedule.toTime)}
                            </div>
                            {hasMultipleDays && (
                              <div className="absolute top-1 right-1 flex gap-0.5">
                                {courseGroup.allDays.map((d, idx) => (
                                  <span
                                    key={idx}
                                    className={`text-[7px] px-0.5 py-0.5 rounded ${
                                      d === day
                                        ? "bg-[#124A69] text-white"
                                        : "bg-[#124A69]/20 text-[#124A69]"
                                    }`}
                                    title={`Also on ${d}`}
                                  >
                                    {d}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Back of card */}
                        <div className="backface-hidden rotate-y-180">
                          <div className="bg-[#124A69] rounded-lg p-1.5 sm:p-2 text-white shadow-sm text-center h-[70px] sm:h-[75px] md:h-[80px] flex flex-col justify-center">
                            <div className="text-[9px] sm:text-[10px] md:text-xs space-y-0.5 sm:space-y-1">
                              <div className="font-semibold">
                                {courseGroup.course.code}
                              </div>
                              <div>Section: {courseGroup.course.section}</div>
                              <div>Room: {courseGroup.course.room}</div>
                              {hasMultipleDays && (
                                <div className="text-[8px] mt-1 opacity-75">
                                  Days: {courseGroup.allDays.join(", ")}
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
