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
      ? `/attendance/class/${course.slug}`
      : `/grading/reporting/${course.slug}`;

  return (
    <Card className="bg-[#124A69] text-white rounded-lg shadow-md w-full max-w-[440px] flex flex-col justify-between h-45">
      <div>
        <CardHeader className="-mt-4 flex justify-between items-center">
          <CardTitle className="text-2xl font-bold">{course.title}</CardTitle>
          <BookOpenText size={50} />
        </CardHeader>
        <CardContent>
          <p className="text-sm">Section {course.section}</p>
          <p className="text-sm font-semibold">
            Total Number of Absents: {course.attendanceStats?.totalAbsents || 0}
          </p>
          <p className="text-xs text-gray-400">
            {course.attendanceStats?.lastAttendanceDate
              ? `Last attendance: ${new Date(
                  course.attendanceStats.lastAttendanceDate
                ).toLocaleDateString()}`
              : "No attendance yet"}
          </p>
        </CardContent>
      </div>
      <div className="flex justify-end -mt-4 p-2">
        <Button
          asChild
          variant="secondary"
          className="bg-[#FAEDCB] text-black text-sm"
        >
          <Link href={href}>View Details</Link>
        </Button>
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

export default function AllCourses({ type }: AllCoursesProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;

  const fetchSchedules = async () => {
    if (!session?.user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      console.log("Fetching courses for faculty ID:", session.user.id);
      const response = await axiosInstance.get("/courses", {
        params: {
          facultyId: session.user.id,
        },
      });
      console.log("Raw API Response:", response.data);
      const courses = response.data.courses || [];
      console.log(
        "Courses before stats:",
        courses.map((c: Course) => ({ id: c.id, title: c.title }))
      );

      const coursesWithStats = await Promise.all(
        courses.map(async (course: Course) => {
          try {
            const stats = await fetchAttendanceStats(course.slug);
            return {
              ...course,
              attendanceStats: stats,
            };
          } catch (error) {
            console.error(
              `Failed to fetch stats for course ${course.slug}:`,
              error
            );
            return {
              ...course,
              attendanceStats: null,
            };
          }
        })
      );
      console.log(
        "Final courses with stats:",
        coursesWithStats.map((c) => ({ id: c.id, title: c.title }))
      );
      setCourses(coursesWithStats);
    } catch (error) {
      console.error("Error in fetchSchedules:", error);
      if (axios.isAxiosError(error)) {
        console.error("API Error Details:", {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
      }
      setCourses([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAttendanceStats = async (courseSlug: string) => {
    try {
      const response = await axiosInstance.get(
        `/courses/${courseSlug}/attendance/stats`
      );
      if (response.status !== 200 || !response.data)
        throw new Error("Failed to fetch attendance stats");
      return response.data;
    } catch (error) {
      console.error("Error fetching attendance stats:", error);
      return null;
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchSchedules();
    }
  }, [status, session?.user?.id]);

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
          <h2 className="text-xl font-semibold mb-2">No Courses</h2>
          <p className="text-gray-500">You don't have any courses assigned.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 shadow-md rounded-lg">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-hidden">
        {currentCourses.map((course) => (
          <CourseCard key={course.id} course={course} type={type} />
        ))}
      </div>

      {courses.length > itemsPerPage && (
        <div className="flex justify-between items-center px-2 -mt-4">
          <p className="text-sm text-gray-500 w-100">
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
