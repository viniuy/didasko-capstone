"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpenText, Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import axiosInstance from "@/lib/axios";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Course {
  id: string;
  title: string;
  code: string;
  section: string;
  slug: string;
  semester: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  attendanceStats?: {
    totalAbsents: number;
    lastAttendanceDate: string | null;
  };
}

interface AttendanceCourseShortcutsProps {
  excludeCourseSlug?: string;
}

const CourseShortcut = ({ course }: { course: Course }) => {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleClick = () => {
    setIsLoading(true);
    router.push(`/main/attendance/class/${course.slug}`);
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="w-full bg-white/10 hover:bg-white/20 rounded-lg p-3 text-left transition-all duration-200 border border-white/20 hover:border-white/40 disabled:opacity-50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">
            {course.title}
          </h3>
          <p className="text-xs text-white/70">Section {course.section}</p>
          <p className="text-xs text-white/60 mt-1">
            Absents last attendance: {course.attendanceStats?.totalAbsents || 0}
          </p>
        </div>
        {isLoading && (
          <Loader2 className="h-4 w-4 animate-spin text-white mt-1" />
        )}
      </div>
    </button>
  );
};

const LoadingSkeleton = () => (
  <div className="space-y-2">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="bg-white/10 rounded-lg p-3">
        <Skeleton className="h-4 w-3/4 bg-white/20 mb-2" />
        <Skeleton className="h-3 w-1/2 bg-white/20 mb-1" />
        <Skeleton className="h-3 w-1/3 bg-white/20" />
      </div>
    ))}
  </div>
);

export default function AttendanceCourseShortcuts({
  excludeCourseSlug,
}: AttendanceCourseShortcutsProps) {
  const { data: session, status } = useSession();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      if (!session?.user?.id) return;

      try {
        // Fetch both semesters
        const [firstSem, secondSem] = await Promise.all([
          axiosInstance.get("/courses", {
            params: { facultyId: session.user.id, semester: "1st Semester" },
          }),
          axiosInstance.get("/courses", {
            params: { facultyId: session.user.id, semester: "2nd Semester" },
          }),
        ]);

        // Combine and filter out excluded course
        const allCourses = [
          ...firstSem.data.courses,
          ...secondSem.data.courses,
        ].filter(
          (course) => !excludeCourseSlug || course.slug !== excludeCourseSlug
        );

        setCourses(allCourses);
      } catch (error) {
        console.error("Error fetching courses:", error);
        setCourses([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (status === "authenticated") {
      fetchCourses();
    }
  }, [status, session?.user?.id, excludeCourseSlug]);

  const firstSemCourses = courses.filter((c) => c.semester === "1st Semester");
  const secondSemCourses = courses.filter((c) => c.semester === "2nd Semester");

  if (isLoading) {
    return (
      <Card className="bg-[#124A69] border-white/20 h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Quick Access
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <LoadingSkeleton />
        </CardContent>
      </Card>
    );
  }

  if (courses.length === 0) {
    return (
      <Card className="bg-[#124A69] border-white/20 h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Quick Access
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <BookOpenText className="mx-auto mb-2 text-white/50" size={40} />
            <p className="text-sm text-white/70">No courses assigned</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#124A69] border-white/20 h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="text-white text-lg flex items-center gap-2 -mb-8">
          <Calendar className="h-5 w-5" />
          Quick Access
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col">
        <Tabs defaultValue="1st" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-2 bg-white/10">
            <TabsTrigger
              value="1st"
              className="data-[state=active]:bg-white/20 text-white"
            >
              1st Sem ({firstSemCourses.length})
            </TabsTrigger>
            <TabsTrigger
              value="2nd"
              className="data-[state=active]:bg-white/20 text-white"
            >
              2nd Sem ({secondSemCourses.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="1st"
            className="flex-1 overflow-y-auto mt-3 space-y-2"
          >
            {firstSemCourses.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-white/70">No 1st semester courses</p>
              </div>
            ) : (
              firstSemCourses.map((course) => (
                <CourseShortcut key={course.id} course={course} />
              ))
            )}
          </TabsContent>

          <TabsContent
            value="2nd"
            className="flex-1 overflow-y-auto mt-3 space-y-2"
          >
            {secondSemCourses.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-white/70">No 2nd semester courses</p>
              </div>
            ) : (
              secondSemCourses.map((course) => (
                <CourseShortcut key={course.id} course={course} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
