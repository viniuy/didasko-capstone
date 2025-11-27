"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  useCourse,
  useActiveCourses,
  useAttendanceLeaderboardAll,
} from "@/lib/hooks/queries";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { checkActiveRfidSession } from "@/lib/utils/rfid-session";

interface StudentAttendance {
  studentId: string;
  studentName: string;
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  totalExcused: number;
  totalSessions: number;
  attendanceRate: number;
}

interface Course {
  id: string;
  title: string;
  code: string;
  slug: string;
  section?: string;
}

interface LeaderboardData {
  [courseSlug: string]: StudentAttendance[];
}

const getMedalColor = (rank: number) => {
  if (rank === 1) return "text-yellow-400";
  if (rank === 2) return "text-gray-300";
  if (rank === 3) return "text-amber-600";
  return "text-white/40";
};

const LeaderboardItem = ({
  student,
  rank,
}: {
  student: StudentAttendance;
  rank: number;
}) => {
  // Calculate bonus absents: every 3 lates = +1 absent
  const bonusAbsents = Math.floor(student.totalLate / 3);
  const displayAbsent =
    bonusAbsents > 0
      ? `${student.totalAbsent} (+${bonusAbsents})`
      : student.totalAbsent;

  return (
    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 flex-shrink-0 mt-1">
          {rank <= 3 ? (
            <Trophy className={`h-4 w-4 ${getMedalColor(rank)}`} />
          ) : (
            <span className="text-xs font-bold text-white/60">#{rank}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold text-white truncate">
              {student.studentName}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-white/50">Absent:</span>
              <span className="text-red-400 font-semibold">
                {displayAbsent}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-white/50">Present:</span>
              <span className="text-green-400 font-semibold">
                {student.totalPresent}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-white/50">Late:</span>
              <span className="text-yellow-400 font-semibold">
                {student.totalLate}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-white/50">Excused:</span>
              <span className="text-blue-400 font-semibold">
                {student.totalExcused ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const LoadingSkeleton = () => (
  <div className="space-y-2">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="bg-white/5 rounded-lg p-3 border border-white/10">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full bg-white/20" />
          <div className="flex-1">
            <Skeleton className="h-4 w-3/4 bg-white/20 mb-2" />
            <Skeleton className="h-3 w-1/2 bg-white/20" />
          </div>
          <Skeleton className="h-6 w-12 bg-white/20" />
        </div>
      </div>
    ))}
  </div>
);

const CourseAttendanceCard = ({
  course,
  leaderboard,
}: {
  course: Course;
  leaderboard: StudentAttendance[];
}) => {
  const avgAttendance = useMemo(() => {
    if (!leaderboard || leaderboard.length === 0) return null;

    const totalRate = leaderboard.reduce((sum, student) => {
      const totalTaken = student.totalPresent + student.totalAbsent;
      if (totalTaken === 0) return sum;
      const rate = (student.totalPresent / totalTaken) * 100;
      return sum + rate;
    }, 0);

    const validStudents = leaderboard.filter(
      (s) => s.totalPresent + s.totalAbsent > 0
    ).length;

    if (validStudents === 0) return null;

    return totalRate / validStudents;
  }, [leaderboard]);

  return (
    <div className="w-full bg-white/10 rounded-lg p-3 text-left border border-white/20">
      <div className="flex items-start gap-3">
        <Trophy className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-1" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white truncate max-w-[90px]">
                {course.code}
              </h3>
              {course.section && (
                <p className="text-xs text-white/70">{course.section}</p>
              )}
            </div>

            <div className="flex-shrink-0 ml-2">
              {avgAttendance === null ? (
                <span className="text-xs italic text-white/70 whitespace-nowrap">
                  No attendance yet
                </span>
              ) : (
                <span className="text-sm font-bold text-green-400 whitespace-nowrap">
                  {avgAttendance.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

type SortOption = "absents" | "present" | "late" | "excused";

interface AttendanceLeaderboardProps {
  courseSlug?: string;
}

export default function AttendanceLeaderboard({
  courseSlug,
}: AttendanceLeaderboardProps = {}) {
  const { data: session, status } = useSession();
  const [sortBy, setSortBy] = useState<SortOption>("absents");
  const [hasActiveRfidSession, setHasActiveRfidSession] = useState(false);

  const isSingleCourse = !!courseSlug;

  // Check for active RFID session
  useEffect(() => {
    if (!courseSlug) {
      setHasActiveRfidSession(false);
      return;
    }

    const checkSession = () => {
      const activeSession = checkActiveRfidSession(courseSlug);
      setHasActiveRfidSession(!!activeSession);
    };

    // Initial check
    checkSession();

    // Set up periodic checks (every 1 second)
    const interval = setInterval(checkSession, 1000);

    // Listen for storage changes (cross-tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "attendance:global:activeRfidSession" || e.key === null) {
        checkSession();
      }
    };

    // Listen for custom events (same-tab)
    const handleCustomChange = () => {
      checkSession();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("rfid-session-changed", handleCustomChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("rfid-session-changed", handleCustomChange);
    };
  }, [courseSlug]);

  // React Query hooks
  const { data: courseData } = useCourse(courseSlug || "");
  const { data: activeCoursesData, isLoading: isLoadingCourses } =
    useActiveCourses(
      status === "authenticated" && !isSingleCourse && session?.user?.id
        ? { filters: { facultyId: session.user.id } }
        : undefined
    );
  const { data: leaderboardData, isLoading: isLoadingLeaderboard } =
    useAttendanceLeaderboardAll(
      status === "authenticated"
        ? {
            facultyId: session?.user?.id,
            courseSlug: isSingleCourse ? courseSlug : undefined,
          }
        : undefined
    );

  const courses = activeCoursesData?.courses || [];
  const allLeaderboards = leaderboardData?.leaderboards || {};
  const courseTitle = courseData?.title || "";
  const courseSection = courseData?.section || "";

  const isLoading = isLoadingCourses || isLoadingLeaderboard;

  // Single course view remains unchanged
  const currentLeaderboard = useMemo(() => {
    if (!isSingleCourse) return [];

    const leaderboard: StudentAttendance[] = allLeaderboards[courseSlug!] || [];

    return [...leaderboard].sort((a, b) => {
      switch (sortBy) {
        case "absents":
          return b.totalAbsent - a.totalAbsent;
        case "present":
          return b.totalPresent - a.totalPresent;
        case "late":
          return b.totalLate - a.totalLate;
        case "excused":
          return b.totalExcused - a.totalExcused;
        default:
          return b.totalAbsent - a.totalAbsent;
      }
    });
  }, [allLeaderboards, isSingleCourse, courseSlug, sortBy]);

  if (isLoading) {
    return (
      <Card className="bg-[#124A69] border-white/20 h-full flex flex-col overflow-hidden">
        <CardHeader className="pb-3 flex-shrink-0">
          <CardTitle className="text-white text-lg flex items-center gap-2 -mb-8">
            <Trophy className="h-5 w-5" />
            {isSingleCourse ? "Attendance Leaderboard" : "Attendance Overview"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <LoadingSkeleton />
        </CardContent>
      </Card>
    );
  }

  if (!isSingleCourse) {
    return (
      <Card className="bg-[#124A69] border-white/20 h-full flex flex-col overflow-hidden">
        <CardHeader className="pb-3 flex-shrink-0">
          <CardTitle className="text-white text-lg flex items-center gap-2 -mb-8">
            <Trophy className="h-5 w-5" />
            Attendance Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto flex flex-col space-y-2">
          {courses.length === 0 ? (
            <div className="text-center py-8">
              <Trophy className="mx-auto mb-2 text-white/30" size={40} />
              <p className="text-sm text-white/70">
                No active courses assigned
              </p>
            </div>
          ) : (
            courses.map((course: Course) => (
              <CourseAttendanceCard
                key={course.id}
                course={course}
                leaderboard={allLeaderboards[course.slug] || []}
              />
            ))
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#124A69] border-white/20 h-full w-full flex flex-col overflow-hidden">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="text-white text-lg flex flex-col gap-1 -mb-8">
          {isSingleCourse && courseTitle ? (
            <>
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                <span className="text-xl text-gray-300">{courseTitle}</span>
                {courseSection && (
                  <span className="text-xs text-gray-400 ml-3">
                    {courseSection}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              <span>Attendance Leaderboard</span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 w-full overflow-hidden flex flex-col">
        <div className="flex-shrink-0 space-y-3 mb-3">
          <Select
            value={sortBy}
            onValueChange={(value) => setSortBy(value as SortOption)}
            disabled={hasActiveRfidSession}
          >
            <SelectTrigger
              className="w-full bg-white/10 border-white/20 text-white flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={hasActiveRfidSession}
            >
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="bg-[#0f3d58] border-white/20 text-white">
              <SelectItem value="absents">Most Absents</SelectItem>
              <SelectItem value="present">Most Present</SelectItem>
              <SelectItem value="late">Most Late</SelectItem>
              <SelectItem value="excused">Most Excused</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveRfidSession && (
            <p className="text-xs text-yellow-400 italic">
              Sort disabled: RFID attendance is active
            </p>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
          {currentLeaderboard.length === 0 ? (
            <div className="text-center py-8">
              <Trophy className="mx-auto mb-2 text-white/30" size={40} />
              <p className="text-sm text-white/70">No attendance data yet</p>
            </div>
          ) : (
            currentLeaderboard
              .slice(0, 10)
              .map((student, index) => (
                <LeaderboardItem
                  key={student.studentId}
                  student={student}
                  rank={index + 1}
                />
              ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
