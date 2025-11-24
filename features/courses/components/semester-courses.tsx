"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpenText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingSpinner } from "./ui-components";
import { useActiveCourses } from "@/lib/hooks/queries";

interface Course {
  id: string;
  title: string;
  code: string;
  description?: string | null;
  section: string;
  slug: string;
  academicYear: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  attendanceStats?: {
    attendanceRate: number;
    lastAttendanceDate: string | null;
    totalAbsents: number;
    totalLate: number;
    totalPresent: number;
    totalStudents: number;
    lastAttendanceAbsents?: number; // Absents count for most recent attendance date
  };
}

interface CoursesProps {
  type: "attendance" | "recitation" | "quiz" | "class-record" | "reporting";
  initialCourses?: any;
}

const CourseCard = ({
  course,
  type,
  onNavigate,
}: {
  course: Course;
  type: "attendance" | "recitation" | "quiz" | "class-record" | "reporting";
  onNavigate: () => void;
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const href =
    type === "attendance"
      ? `/main/attendance/class/${course.slug}`
      : type === "recitation"
      ? `/main/grading/recitation/${course.slug}`
      : type === "quiz"
      ? `/main/grading/quiz/${course.slug}`
      : type === "reporting"
      ? `/main/grading/reporting/${course.slug}`
      : `/main/grading/class-record/${course.slug}`;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate();
    setIsLoading(true);
    router.push(href);
  };

  return (
    <Card className="bg-[#124A69] text-white rounded-lg shadow-md w-full max-w-[320px] sm:max-w-[360px] md:max-w-[320px] lg:max-w-[380px] xl:max-w-[440px] flex flex-col justify-between h-38">
      <div>
        <CardHeader className="-mt-4 flex justify-between items-center">
          <CardTitle className="text-2xl font-bold">{course.code}</CardTitle>
          <BookOpenText size={50} />
        </CardHeader>
        <CardContent>
          <p className="text-sm">Section {course.section}</p>
          <p className="text-sm font-semibold">
            Total Number of Absents:{" "}
            {course.attendanceStats?.lastAttendanceAbsents ??
              course.attendanceStats?.totalAbsents ??
              0}
          </p>
          <p className="text-xs text-gray-400">
            {course.attendanceStats?.lastAttendanceDate
              ? `Last attendance: ${new Date(
                  course.attendanceStats.lastAttendanceDate
                ).toLocaleDateString()}`
              : "No attendance yet"}
          </p>
          <div className="flex justify-end -mt-4">
            <Button
              onClick={handleClick}
              variant="secondary"
              className="bg-[#FAEDCB] text-black text-sm min-w-[120px] cursor-pointer"
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {type === "attendance"
                ? "View Attendance"
                : type === "recitation"
                ? "View Recitation"
                : type === "quiz"
                ? "View Quiz"
                : type === "reporting"
                ? "View Reporting"
                : "View Class Record"}
            </Button>
          </div>
        </CardContent>
      </div>
    </Card>
  );
};

// Loading Skeleton Component
const LoadingSkeleton = ({ index }: { index: number }) => (
  <Card className="bg-white text-[#124A69] rounded-lg shadow-md w-full max-w-[320px] sm:max-w-[360px] md:max-w-[320px] lg:max-w-[380px] xl:max-w-[440px] flex flex-col justify-between h-45">
    <div>
      <div className="-mt-7 p-4 flex justify-between items-center">
        <Skeleton className="h-7 w-3/4 bg-gray-200" />
        <Skeleton className="h-[50px] w-[50px] rounded-full bg-gray-200" />
      </div>
      <div className="p-4 -mt-8 space-y-2">
        <Skeleton className="h-4 w-1/4 bg-gray-200" />
        <Skeleton className="h-4 w-2/5 bg-gray-200" />
        <Skeleton className="h-3 w-1/2 bg-gray-200" />
      </div>
    </div>
    <div className="flex justify-end -mt-9 p-2">
      <Skeleton className="h-8 w-28 bg-gray-200 rounded-md" />
    </div>
  </Card>
);

export default function ActiveCourses({ type, initialCourses }: CoursesProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [currentPage, setCurrentPage] = useState(1);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showRedirectSpinner, setShowRedirectSpinner] = useState(false);
  const itemsPerPage = 3;

  // React Query hook with initialData
  const { data: coursesData, isLoading } = useActiveCourses({
    filters: session?.user?.id ? { facultyId: session.user.id } : undefined,
    initialData: initialCourses ? { courses: initialCourses } : undefined,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  // Transform courses to match local Course interface (convert Date to string for lastAttendanceDate)
  const courses: Course[] = (coursesData?.courses || []).map((course: any) => ({
    id: course.id,
    title: course.title,
    code: course.code,
    description: null, // Course type doesn't have description
    section: course.section,
    slug: course.slug,
    academicYear: course.academicYear,
    status: course.status as "ACTIVE" | "INACTIVE" | "ARCHIVED",
    attendanceStats: course.attendanceStats
      ? {
          attendanceRate: course.attendanceStats.attendanceRate,
          lastAttendanceDate: course.attendanceStats.lastAttendanceDate
            ? course.attendanceStats.lastAttendanceDate instanceof Date
              ? course.attendanceStats.lastAttendanceDate.toISOString()
              : String(course.attendanceStats.lastAttendanceDate)
            : null,
          totalAbsents: course.attendanceStats.totalAbsents,
          totalLate: course.attendanceStats.totalLate,
          totalPresent: course.attendanceStats.totalPresent,
          totalStudents: course.attendanceStats.totalStudents,
          lastAttendanceAbsents:
            course.attendanceStats.lastAttendanceAbsents ?? undefined,
        }
      : undefined,
  }));

  // Get loading messages based on type
  const getLoadingMessages = () => {
    switch (type) {
      case "attendance":
        return {
          main: "Loading Attendance...",
          secondary: "Please wait while we prepare the attendance page...",
        };
      case "recitation":
        return {
          main: "Loading Recitation...",
          secondary: "Please wait while we prepare the recitation page...",
        };
      case "quiz":
        return {
          main: "Loading Quiz...",
          secondary: "Please wait while we prepare the quiz page...",
        };
      case "class-record":
        return {
          main: "Loading Class Record...",
          secondary: "Please wait while we prepare the class record page...",
        };
      case "reporting":
        return {
          main: "Loading Reporting...",
          secondary: "Please wait while we prepare the reporting page...",
        };
      default:
        return {
          main: "Loading...",
          secondary: "Please wait while we redirect you...",
        };
    }
  };

  const totalPages = Math.ceil(courses.length / itemsPerPage);
  const currentCourses = courses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (status === "loading" || isLoading) {
    return (
      <Card className="p-4 shadow-md rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, index) => (
            <LoadingSkeleton key={index} index={index} />
          ))}
        </div>
      </Card>
    );
  }

  if (courses.length === 0) {
    return (
      <Card className="p-4 shadow-md rounded-lg">
        <div className="text-center py-8">
          <BookOpenText className="mx-auto mb-4" size={50} />
          <h2 className="text-xl font-semibold mb-2">No Active Subjects</h2>
          <p className="text-gray-500">
            You don't have any active subjects assigned currently.
          </p>
        </div>
      </Card>
    );
  }

  const handleNavigate = () => {
    setIsNavigating(true);
    // After fade-out completes, show loading spinner
    setTimeout(() => {
      setShowRedirectSpinner(true);
    }, 200);
  };

  // Show loading spinner after fade-out
  if (showRedirectSpinner) {
    const messages = getLoadingMessages();
    return (
      <LoadingSpinner
        mainMessage={messages.main}
        secondaryMessage={messages.secondary}
      />
    );
  }

  return (
    <div
      className={`transition-opacity duration-200 ${
        isNavigating ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="mb-2">
        <h2 className="pl-2 pb-1 text-3xl font-bold text-muted-foreground">
          Courses
        </h2>
      </div>
      <Card className="p-4 shadow-md rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
          {currentCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              type={type}
              onNavigate={handleNavigate}
            />
          ))}
        </div>

        {courses.length > itemsPerPage && (
          <div className="flex justify-between items-center px-2 -mt-4">
            <p className="text-sm text-gray-500 w-90">
              {currentPage * itemsPerPage - (itemsPerPage - 1)}-
              {Math.min(currentPage * itemsPerPage, courses.length)} out of{" "}
              {courses.length} classes
            </p>
            <Pagination className="flex justify-end">
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
                {[...Array(totalPages || 1)].map((_, i) => (
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
                      setCurrentPage((prev) =>
                        Math.min(prev + 1, totalPages || 1)
                      )
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
    </div>
  );
}
