"use client";

import { Card } from "@/components/ui/card";
import { CalendarClock } from "lucide-react";
import { useState } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useFacultySchedules } from "@/lib/hooks/queries";

interface Course {
  id: string;
  title: string;
  code: string;
  description: string | null;
  semester: string;
  section: string;
  slug: string;
}

interface Schedule {
  id: string;
  courseId: string;
  day: string;
  fromTime: string;
  toTime: string;
  course: Course;
}

// Day order mapping for sorting
const dayOrder: { [key: string]: number } = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

// Course Card Component
const CourseCard = ({ schedule }: { schedule: Schedule }) => {
  const router = useRouter();
  const dayStr = schedule.day;

  // Format times to 12-hour format
  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(":");
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, "h:mm a");
  };

  const timeStr = `${formatTime(schedule.fromTime)} - ${formatTime(
    schedule.toTime
  )}`;

  const handleClick = () => {
    router.push(`/main/attendance/class/${schedule.course.slug}`);
  };

  return (
    <Card
      className="bg-[#FAEDCB] text-[#124A69] rounded-lg shadow-md p-4 w-full cursor-pointer hover:bg-[#F5E5B8] transition-colors"
      onClick={handleClick}
    >
      <h2 className="text-lg font-bold">{schedule.course.title}</h2>
      <p className="text-sm font-semibold -mt-3">{schedule.course.section}</p>
      <div className="flex items-center -mt-2 text-gray-600">
        <CalendarClock size={20} className="mr-2" color="#E1BB56" />
        <p className="text-sm">
          {dayStr} {timeStr}
        </p>
      </div>
    </Card>
  );
};

// Loading Skeleton Component
const LoadingSkeleton = ({ index }: { index: number }) => (
  <Card key={`skeleton-${index}`} className="animate-pulse">
    <div className="p-4 space-y-3">
      <div className="h-6 w-3/4 bg-gray-200 rounded"></div>
      <div className="h-4 w-1/2 bg-gray-200 rounded"></div>
      <div className="h-4 w-2/3 bg-gray-200 rounded"></div>
    </div>
  </Card>
);

// Courses Component with Pagination
export default function AttendanceSchedule({
  courseSlug,
  semester,
}: {
  courseSlug?: string;
  semester?: string;
}) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  // React Query hook
  const { data: schedulesData, isLoading } = useFacultySchedules(
    session?.user?.id,
    {
      semester,
      courseSlug,
      limit: 100,
    }
  );

  // Sort schedules by day of the week
  const schedules = (schedulesData?.schedules || []).sort(
    (a: Schedule, b: Schedule) => {
      return (dayOrder[a.day] || 0) - (dayOrder[b.day] || 0);
    }
  );

  // Calculate pagination
  const totalPages = Math.ceil(schedules.length / itemsPerPage);
  const currentSchedules = schedules.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (status === "loading" || isLoading) {
    return (
      <Card className="w-full p-3 shadow-md rounded-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, index) => (
            <LoadingSkeleton key={index} index={index} />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full p-3 shadow-md rounded-lg">
      <div className="flex flex-wrap justify-center min-w-0 ">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
          {currentSchedules.map((schedule: Schedule) => (
            <CourseCard key={schedule.id} schedule={schedule} />
          ))}
        </div>
      </div>

      {schedules.length > itemsPerPage && (
        <div className="flex justify-between items-center px-2 -mt-4">
          <p className="text-sm text-gray-500 w-full">
            {`${(currentPage - 1) * itemsPerPage + 1}-${Math.min(
              currentPage * itemsPerPage,
              schedules.length
            )} out of ${schedules.length} classes`}
          </p>
          <Pagination className=" flex justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  className={
                    currentPage === 1 ? "pointer-events-none opacity-50" : ""
                  }
                />
              </PaginationItem>
              {[...Array(totalPages)].map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink
                    isActive={currentPage === i + 1}
                    onClick={() => setCurrentPage(i + 1)}
                    className={
                      currentPage === i + 1 ? "bg-[#124A69] text-white" : ""
                    }
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  className={
                    currentPage === totalPages
                      ? "pointer-events-none opacity-50"
                      : ""
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </Card>
  );
}
