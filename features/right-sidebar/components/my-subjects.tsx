"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpenText, Loader2, Calendar } from "lucide-react";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useActiveCourses } from "@/lib/hooks/queries";
import { Skeleton } from "@/components/ui/skeleton";
import AnimatedContent from "@/components/ui/AnimatedContent";

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
    lastAttendanceAbsents?: number; // Absents count for most recent attendance date
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
  showAttendanceStats = false,
  onNavigate,
  isLoading,
  disabled,
}: {
  course: Course;
  showAttendanceStats?: boolean;
  onNavigate: () => void;
  isLoading: boolean;
  disabled: boolean;
}) => {
  return (
    <button
      onClick={onNavigate}
      disabled={disabled || isLoading}
      className="w-full bg-white/10 hover:bg-white/20 rounded-lg p-3 text-left transition-all duration-200 border border-white/20 hover:border-white/40 disabled:opacity-50 disabled:cursor-not-allowed"
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
              {course.attendanceStats?.lastAttendanceAbsents ??
                course.attendanceStats?.totalAbsents ??
                0}
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
  if (pathname.includes("/main/attendance")) {
    return {
      basePath: "/main/attendance/class",
      title: "Quick Access - Attendance",
      showAttendanceStats: true,
    };
  } else if (
    pathname.includes("/grading") ||
    pathname.includes("/class-record")
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
  const router = useRouter();
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);

  const moduleConfig = getModuleConfig(pathname);
  const basePath = propBasePath || moduleConfig.basePath;
  const title = propTitle || moduleConfig.title;
  const showAttendanceStats =
    propShowAttendanceStats ?? moduleConfig.showAttendanceStats;

  // React Query hook
  const { data: coursesData, isLoading } = useActiveCourses(
    status === "authenticated" && session?.user?.id
      ? { filters: { facultyId: session.user.id } }
      : undefined
  );

  // Transform and filter courses to match local Course interface
  const courses: Course[] = (coursesData?.courses || [])
    .filter(
      (course: any) => !excludeCourseSlug || course.slug !== excludeCourseSlug
    )
    .map((course: any) => ({
      id: course.id,
      title: course.title,
      code: course.code,
      section: course.section,
      slug: course.slug,
      status: course.status as "ACTIVE" | "INACTIVE" | "ARCHIVED",
      attendanceStats: course.attendanceStats
        ? {
            totalAbsents: course.attendanceStats.totalAbsents,
            lastAttendanceDate: course.attendanceStats.lastAttendanceDate
              ? course.attendanceStats.lastAttendanceDate instanceof Date
                ? course.attendanceStats.lastAttendanceDate.toISOString()
                : String(course.attendanceStats.lastAttendanceDate)
              : null,
            lastAttendanceAbsents:
              course.attendanceStats.lastAttendanceAbsents ?? undefined,
          }
        : undefined,
    }));

  useEffect(() => {
    // Reset loading state when route changes
    setLoadingSlug(null);
  }, [pathname]);

  const handleCourseNavigate = (slug: string) => {
    if (loadingSlug && loadingSlug !== slug) return;
    setLoadingSlug(slug);
    router.push(`${basePath}/${slug}`);
  };

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
        {courses.map((course, index) => (
          <AnimatedContent
            key={course.id}
            distance={150}
            direction="horizontal"
            reverse={true}
            duration={1.2}
            ease="power3.out"
            initialOpacity={0.2}
            animateOpacity
            scale={1.1}
            threshold={0.2}
            delay={0.3 + index * 0.1}
            container="snap-main-container"
            onComplete={() => {}}
            onDisappearanceComplete={() => {}}
          >
            <CourseShortcut
              course={course}
              showAttendanceStats={showAttendanceStats}
              onNavigate={() => handleCourseNavigate(course.slug)}
              isLoading={loadingSlug === course.slug}
              disabled={loadingSlug !== null && loadingSlug !== course.slug}
            />
          </AnimatedContent>
        ))}
      </CardContent>
    </Card>
  );
}
