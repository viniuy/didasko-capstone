"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpenText } from "lucide-react";
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
import Link from "next/link";
import axiosInstance from "@/lib/axios";
import { Skeleton } from "@/components/ui/skeleton";
import axios from "axios";

interface Course {
  id: string;
  title: string;
  code: string;
  description: string | null;
  semester: string;
  section: string;
  slug: string;
  attendanceStats?: {
    totalAbsents: number;
    lastAttendanceDate: string | null;
  };
  latestAbsents?: number;
}

interface AllCoursesProps {
  type: "attendance" | "grading";
}

const CourseCard = ({
  course,
  type,
}: {
  course: Course;
  type: "attendance" | "grading";
}) => {
  const href =
    type === "attendance"
      ? `/main/attendance/class/${course.slug}`
      : `/grading/reporting/${course.slug}`;

  return (
    <Card className="bg-[#124A69] text-white rounded-lg shadow-md w-full max-w-[440px] flex flex-col justify-between h-38">
      <div>
        <CardHeader className="-mt-4 flex justify-between items-center">
          <CardTitle className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold">
            {course.code}
          </CardTitle>
          <BookOpenText className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-[50px] lg:h-[50px]" />
        </CardHeader>
        <CardContent>
          <p className="text-xs sm:text-sm">Section {course.section}</p>
          <p className="text-xs sm:text-sm font-semibold">
            Total Number of Absents:{" "}
            {course.latestAbsents ?? course.attendanceStats?.totalAbsents ?? 0}
          </p>
          <p className="text-[10px] sm:text-xs text-gray-400">
            {course.attendanceStats?.lastAttendanceDate
              ? `Last attendance: ${new Date(
                  course.attendanceStats.lastAttendanceDate
                ).toLocaleDateString()}`
              : "No attendance yet"}
          </p>
          <div className="flex justify-end -mt-4">
            <Button
              asChild
              variant="secondary"
              className="bg-[#FAEDCB] text-black text-xs sm:text-sm"
            >
              <Link href={href}>View Details</Link>
            </Button>
          </div>
        </CardContent>
      </div>
    </Card>
  );
};

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

// Hook to get responsive items per page based on screen width
const useItemsPerPage = () => {
  const [itemsPerPage, setItemsPerPage] = useState(3);

  useEffect(() => {
    const updateItemsPerPage = () => {
      const width = window.innerWidth;

      if (width < 1521) {
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

export default function AllCourses({ type }: AllCoursesProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = useItemsPerPage();

  const fetchSchedules = async () => {
    if (!session?.user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await axiosInstance.get("/courses/active", {
        params: { facultyId: session.user.id, isCourseActive: "true" },
      });

      const courses = response.data.courses || [];

      // Fetch latest attendance absents for each course
      const coursesWithLatestAbsents = await Promise.all(
        courses.map(async (course: Course) => {
          if (!course.attendanceStats?.lastAttendanceDate) {
            return { ...course, latestAbsents: 0 };
          }

          try {
            const dateStr = new Date(course.attendanceStats.lastAttendanceDate)
              .toISOString()
              .split("T")[0];

            const attendanceResponse = await axiosInstance.get(
              `/courses/${course.slug}/attendance`,
              {
                params: {
                  date: dateStr,
                  limit: 1000,
                },
              }
            );

            const attendanceRecords = attendanceResponse.data.attendance || [];
            const absentsCount = attendanceRecords.filter(
              (record: any) => record.status === "ABSENT"
            ).length;

            return { ...course, latestAbsents: absentsCount };
          } catch (error) {
            console.error(
              `Error fetching latest attendance for ${course.code}:`,
              error
            );
            return { ...course, latestAbsents: 0 };
          }
        })
      );

      setCourses(coursesWithLatestAbsents);
    } catch (error) {
      console.error("Error fetching courses:", error);
      setCourses([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchSchedules();
    }
  }, [status, session?.user?.id]);

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
        <div className={`grid ${getGridClass()} gap-4`}>
          {[...Array(itemsPerPage)].map((_, index) => (
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
          <BookOpenText className="mx-auto mb-4 w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-[50px] lg:h-[50px]" />
          <h2 className="text-lg sm:text-xl font-semibold mb-2">No Courses</h2>
          <p className="text-sm sm:text-base text-gray-500">
            You don't have any courses assigned.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 shadow-md rounded-lg">
      <div
        className={`grid ${getGridClass()} gap-4 max-h-[600px] overflow-hidden`}
      >
        {currentCourses.map((course) => (
          <CourseCard key={course.id} course={course} type={type} />
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
  );
}
