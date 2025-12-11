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
  isDisabled,
  isRedirecting,
}: {
  course: Course;
  type: "attendance" | "recitation" | "quiz" | "class-record" | "reporting";
  onNavigate: () => void;
  isDisabled: boolean;
  isRedirecting: boolean;
}) => {
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
    if (isDisabled || isRedirecting) return;
    onNavigate();
    router.push(href);
  };

  return (
    <Card className="bg-[#124A69] text-white rounded-lg shadow-md w-full max-w-[440px] flex flex-col justify-between">
      <div>
        <CardHeader className="-mt-4 flex justify-between items-center">
          <CardTitle className="text-sm sm:text-base md:text-lg lg:text-xl font-bold">
            {course.code}
          </CardTitle>
          <BookOpenText className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 lg:w-12 lg:h-12" />
        </CardHeader>
        <CardContent>
          <p className="text-[11px] sm:text-xs md:text-sm">
            Section {course.section}
          </p>
          <p className="text-[11px] sm:text-xs md:text-sm font-semibold">
            Total Number of Absents:{" "}
            {course.attendanceStats?.lastAttendanceAbsents ??
              course.attendanceStats?.totalAbsents ??
              0}
          </p>
          <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-400">
            {course.attendanceStats?.lastAttendanceDate
              ? `Last attendance: ${new Date(
                  course.attendanceStats.lastAttendanceDate
                ).toLocaleDateString()}`
              : "No attendance yet"}
          </p>
          <div className="flex justify-end mt-2 -mb-3">
            <Button
              onClick={handleClick}
              variant="secondary"
              className="bg-[#FAEDCB] text-black text-[11px] sm:text-xs md:text-sm min-w-[120px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isRedirecting || isDisabled}
            >
              {isRedirecting ? (
                <span className="flex items-center">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Redirecting...
                </span>
              ) : type === "attendance" ? (
                "View Attendance"
              ) : type === "recitation" ? (
                "View Recitation"
              ) : type === "quiz" ? (
                "View Quiz"
              ) : type === "reporting" ? (
                "View Reporting"
              ) : (
                "View Class Record"
              )}
            </Button>
          </div>
        </CardContent>
      </div>
    </Card>
  );
};

// Loading Skeleton Component
const LoadingSkeleton = ({ index }: { index: number }) => (
  <Card className="bg-white text-[#124A69] rounded-lg shadow-md w-full max-w-[440px] flex flex-col justify-between">
    <div>
      <div className="-mt-7 p-4 flex justify-between items-center">
        <Skeleton className="h-6 w-3/4 bg-gray-200" />
        <Skeleton className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 rounded-full bg-gray-200" />
      </div>
      <div className="p-4 -mt-8 space-y-2">
        <Skeleton className="h-3 w-1/4 bg-gray-200" />
        <Skeleton className="h-3 w-2/5 bg-gray-200" />
        <Skeleton className="h-2 w-1/2 bg-gray-200" />
      </div>
    </div>
    <div className="flex justify-end -mt-9 p-2">
      <Skeleton className="h-7 w-28 bg-gray-200 rounded-md" />
    </div>
  </Card>
);

// Hook to get responsive items per page based on screen width
const useItemsPerPage = () => {
  const [itemsPerPage, setItemsPerPage] = useState(3);

  useEffect(() => {
    const updateItemsPerPage = () => {
      const width = window.innerWidth;

      if (width < 860) {
        setItemsPerPage(1);
      } else if (width < 1600) {
        setItemsPerPage(2);
      } else if (width >= 2500) {
        setItemsPerPage(5);
      } else if (width >= 1956) {
        setItemsPerPage(4);
      } else {
        setItemsPerPage(3);
      }
    };

    // Set initial value
    updateItemsPerPage();

    // Update on resize
    window.addEventListener("resize", updateItemsPerPage);
    return () => window.removeEventListener("resize", updateItemsPerPage);
  }, []);

  return itemsPerPage;
};

export default function ActiveCourses({ type, initialCourses }: CoursesProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [currentPage, setCurrentPage] = useState(1);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showRedirectSpinner, setShowRedirectSpinner] = useState(false);
  const [redirectingSlug, setRedirectingSlug] = useState<string | null>(null);
  const itemsPerPage = useItemsPerPage();

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
          main: "Loading Course Attendance",
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

  // Reset to page 1 when itemsPerPage changes
  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

  // Get grid class based on itemsPerPage
  const getGridClass = () => {
    switch (itemsPerPage) {
      case 2:
        return "grid-cols-1 sm:grid-cols-2";
      case 3:
        return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
      case 4:
        return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
      case 5:
        return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5";
      default:
        return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
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

  const handleNavigate = (slug: string) => {
    if (redirectingSlug) return;
    setRedirectingSlug(slug);
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
        <div
          className={`grid ${getGridClass()} gap-4 max-h-[600px] overflow-hidden`}
        >
          {currentCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              type={type}
              onNavigate={() => handleNavigate(course.slug)}
              isDisabled={
                redirectingSlug !== null && redirectingSlug !== course.slug
              }
              isRedirecting={redirectingSlug === course.slug}
            />
          ))}
        </div>

        {courses.length > itemsPerPage && (
          <div className="flex flex-col sm:flex-row justify-between items-center px-2 -mt-4 gap-2 sm:gap-0">
            <p className="text-xs sm:text-sm text-gray-500 w-100">
              Showing {currentPage * itemsPerPage - (itemsPerPage - 1)}-
              {Math.min(currentPage * itemsPerPage, courses.length)} of{" "}
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

                {(() => {
                  const pages: number[] = [];

                  // If total pages is 5 or less, show all pages
                  if (totalPages <= 5) {
                    for (let i = 1; i <= totalPages; i++) {
                      pages.push(i);
                    }
                    return pages;
                  } else {
                    // Always show first 2 pages
                    pages.push(1, 2);

                    // Determine which pages to show around current
                    const showAroundCurrent: number[] = [];
                    if (currentPage > 2 && currentPage < totalPages - 1) {
                      // Show current-1, current, current+1 if in middle
                      showAroundCurrent.push(
                        currentPage - 1,
                        currentPage,
                        currentPage + 1
                      );
                    } else if (currentPage <= 2) {
                      // If current is 1 or 2, show 3, 4
                      showAroundCurrent.push(3, 4);
                    } else if (currentPage >= totalPages - 1) {
                      // If current is near end, show last-3, last-2, last-1
                      showAroundCurrent.push(
                        totalPages - 3,
                        totalPages - 2,
                        totalPages - 1
                      );
                    }

                    // Remove duplicates and sort
                    const uniquePages = Array.from(
                      new Set([...pages, ...showAroundCurrent, totalPages])
                    ).sort((a, b) => a - b) as number[];

                    // Build final array with ellipsis
                    const finalPages: (number | string)[] = [];
                    for (let i = 0; i < uniquePages.length; i++) {
                      const page = uniquePages[i];
                      if (i > 0 && page - uniquePages[i - 1] > 1) {
                        finalPages.push("…");
                      }
                      finalPages.push(page);
                    }

                    return finalPages;
                  }
                })().map((item, i) => (
                  <PaginationItem key={i}>
                    {item === "…" ? (
                      <span className="px-0.5 text-gray-500 select-none text-xs sm:text-sm">
                        …
                      </span>
                    ) : (
                      <PaginationLink
                        isActive={currentPage === item}
                        onClick={() => setCurrentPage(item as number)}
                        className={
                          currentPage === item ? "bg-[#124A69] text-white" : ""
                        }
                      >
                        {item}
                      </PaginationLink>
                    )}
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
    </div>
  );
}
