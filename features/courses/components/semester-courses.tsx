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
import axiosInstance from "@/lib/axios";
import { Skeleton } from "@/components/ui/skeleton";

interface Course {
  id: string;
  title: string;
  code: string;
  description: string | null;
  semester: string;
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
  };
}

interface SemesterCoursesProps {
  semester: "1st Semester" | "2nd Semester";
  type: "attendance" | "recitation" | "quiz" | "class-record" | "reporting";
}

const CourseCard = ({
  course,
  type,
}: {
  course: Course;
  type: "attendance" | "recitation" | "quiz" | "class-record" | "reporting";
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  console.log("Course data in CourseCard:", course);
  console.log("Attendance stats in CourseCard:", course.attendanceStats);
  const href =
    type === "attendance"
      ? `/main/attendance/class/${course.slug}`
      : type === "recitation"
      ? `/main/grading/recitation/${course.slug}`
      : type === "quiz"
      ? `/main/grading/quiz/${course.slug}`
      : type === "reporting"
      ? `/main/grading/reporting/${course.slug}`
      : type === "class-record"
      ? `/main/grading/class-record/${course.slug}`
      : `/main/grading/class-record`;

  useEffect(() => {
    console.log("CourseCard - course prop updated:", course);
    console.log(
      "CourseCard - attendanceStats updated:",
      course.attendanceStats
    );
    console.log(
      "CourseCard - totalAbsents value:",
      course.attendanceStats?.totalAbsents
    );
  }, [course]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsLoading(true);
    router.push(href);
  };

  return (
    <Card className="bg-[#124A69] text-white rounded-lg shadow-md w-full max-w-[320px] sm:max-w-[360px] md:max-w-[320px] lg:max-w-[380px] xl:max-w-[440px] flex flex-col justify-between h-38">
      <div>
        <CardHeader className="-mt-4 flex justify-between items-center">
          <CardTitle className="text-2xl font-bold">{course.title}</CardTitle>
          <BookOpenText size={50} />
        </CardHeader>
        <CardContent>
          <p className="text-sm">Section {course.section}</p>
          <p className="text-sm font-semibold">
            Total Number of Absents:{" "}
            {course.attendanceStats ? course.attendanceStats.totalAbsents : 0}
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
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
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

export default function SemesterCourses({
  semester,
  type,
}: SemesterCoursesProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;
  const isCourseActive = "ACTIVE";

  const fetchSchedules = async () => {
    if (!session?.user?.id) return;
    console.log("I love savannah", isCourseActive);
    try {
      const response = await axiosInstance.get("/courses", {
        params: { facultyId: session.user.id, semester, isCourseActive },
      });
      setCourses(response.data.courses);
    } catch (error) {
      console.error(error);
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
          <h2 className="text-xl font-semibold mb-2">No {semester} Subjects</h2>
          <p className="text-gray-500">
            You don't have any subjects assigned for the{" "}
            {semester.toLowerCase()}.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 shadow-md rounded-lg">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
        {currentCourses.map((course) => (
          <CourseCard key={course.id} course={course} type={type} />
        ))}
      </div>

      {courses.length > itemsPerPage && (
        <div className="flex justify-between items-center px-2 -mt-4">
          <p className="text-sm text-gray-500 w-40">
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
  );
}
