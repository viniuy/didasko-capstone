"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpenText, Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { coursesService } from "@/lib/services/client";
import { Skeleton } from "@/components/ui/skeleton";

interface Course {
  id: string;
  title: string;
  code: string;
  section: string;
  slug: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  attendanceStats?: {
    totalAbsents: number;
    lastAttendanceDate: string | null;
  };
}

interface CourseShortcutsProps {
  excludeCourseSlug?: string;
  basePath?: string;
  title?: string;
  showAttendanceStats?: boolean;
}

const CourseShortcut = ({
  course,
  basePath,
  showAttendanceStats = false,
}: {
  course: Course;
  basePath: string;
  showAttendanceStats?: boolean;
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleClick = () => {
    setIsLoading(true);
    router.push(`${basePath}/${course.slug}`);
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
          {showAttendanceStats && (
            <p className="text-xs text-white/60 mt-1">
              Absents last attendance:{" "}
              {course.attendanceStats?.totalAbsents || 0}
            </p>
          )}
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

// Helper function to detect module from pathname
const getModuleConfig = (pathname: string) => {
  if (pathname.includes("/attendance/")) {
    return {
      basePath: "/main/attendance/class",
      title: "Quick Access",
      showAttendanceStats: true,
    };
  } else if (
    pathname.includes("/grading/") ||
    pathname.includes("/class-record/")
  ) {
    return {
      basePath: "/main/grading/class-record",
      title: "Quick Access",
      showAttendanceStats: false,
    };
  }
  return {
    basePath: "/main/course",
    title: "Quick Access",
    showAttendanceStats: false,
  };
};

export default function CourseShortcuts({
  excludeCourseSlug,
  basePath: propBasePath,
  title: propTitle,
  showAttendanceStats: propShowAttendanceStats,
}: CourseShortcutsProps) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const moduleConfig = getModuleConfig(pathname);
  const basePath = propBasePath || moduleConfig.basePath;
  const title = propTitle || moduleConfig.title;
  const showAttendanceStats =
    propShowAttendanceStats ?? moduleConfig.showAttendanceStats;

  useEffect(() => {
    const fetchCourses = async () => {
      if (!session?.user?.id) return;

      try {
        const response = await coursesService.getActiveCourses({
          facultyId: session.user.id,
        });

        const filteredCourses = (response.courses || []).filter(
          (course: Course) =>
            !excludeCourseSlug || course.slug !== excludeCourseSlug
        );

        setCourses(filteredCourses);
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

  if (isLoading) {
    return (
      <Card className="bg-[#124A69] border-white/20 h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {title}
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
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <BookOpenText className="mx-auto mb-2 text-white/50" size={40} />
            <p className="text-sm text-white/70">No active courses assigned</p>
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
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto flex flex-col space-y-2">
        {courses.map((course) => (
          <CourseShortcut
            key={course.id}
            course={course}
            basePath={basePath}
            showAttendanceStats={showAttendanceStats}
          />
        ))}
      </CardContent>
    </Card>
  );
}
