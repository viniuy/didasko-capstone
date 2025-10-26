"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import axiosInstance from "@/lib/axios";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const getAttendanceColor = (rate: number) => {
  if (rate >= 90) return "text-green-400";
  if (rate >= 75) return "text-yellow-400";
  if (rate >= 60) return "text-orange-400";
  return "text-red-400";
};

const getTrendIcon = (rate: number) => {
  if (rate >= 90) return <TrendingUp className="h-3 w-3 text-green-400" />;
  if (rate >= 75) return <Minus className="h-3 w-3 text-yellow-400" />;
  return <TrendingDown className="h-3 w-3 text-red-400" />;
};

const LeaderboardItem = ({
  student,
  rank,
}: {
  student: StudentAttendance;
  rank: number;
}) => {
  return (
    <div className="bg-white/5 hover:bg-white/10 rounded-lg p-3 border border-white/10 transition-all duration-200">
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
            {getTrendIcon(student.attendanceRate)}
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-white/50">Absent:</span>
              <span className="text-red-400 font-semibold">
                {student.totalAbsent}
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
                {student.totalExcused}
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

type SortOption = "absents" | "attendance" | "present" | "late" | "excused";

interface AttendanceLeaderboardProps {
  courseSlug?: string;
}

export default function AttendanceLeaderboard({
  courseSlug,
}: AttendanceLeaderboardProps = {}) {
  const { data: session, status } = useSession();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [allLeaderboards, setAllLeaderboards] = useState<LeaderboardData>({});
  const [sortBy, setSortBy] = useState<SortOption>("absents");
  const [isLoading, setIsLoading] = useState(true);
  const [courseTitle, setCourseTitle] = useState<string>("");

  const isSingleCourse = !!courseSlug;

  // Fetch course title if courseSlug is provided
  useEffect(() => {
    if (!courseSlug) return;

    const fetchCourseTitle = async () => {
      try {
        const response = await axiosInstance.get(`/courses/${courseSlug}`);
        setCourseTitle(response.data.title || "");
      } catch (error) {
        console.error("Error fetching course title:", error);
        setCourseTitle("");
      }
    };

    fetchCourseTitle();
  }, [courseSlug]);

  useEffect(() => {
    const fetchAllData = async () => {
      if (!session?.user?.id) return;

      try {
        if (isSingleCourse) {
          // Fetch leaderboard for specific course only
          const response = await axiosInstance.get(
            "/attendance/leaderboard/all",
            {
              params: {
                facultyId: session.user.id,
                courseSlug: courseSlug,
              },
            }
          );
          setAllLeaderboards(response.data.leaderboards || {});
        } else {
          // Fetch ALL courses and ALL leaderboards at once
          const [coursesResponse, leaderboardsResponse] = await Promise.all([
            axiosInstance.get("/courses", {
              params: { facultyId: session.user.id },
            }),
            axiosInstance.get("/attendance/leaderboard/all", {
              params: { facultyId: session.user.id },
            }),
          ]);

          setCourses(coursesResponse.data.courses || []);
          setAllLeaderboards(leaderboardsResponse.data.leaderboards || {});
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        setAllLeaderboards({});
      } finally {
        setIsLoading(false);
      }
    };

    if (status === "authenticated") {
      fetchAllData();
    }
  }, [status, session?.user?.id, courseSlug, isSingleCourse]);

  // Get current leaderboard based on selection and sort it
  const currentLeaderboard = useMemo(() => {
    let leaderboard: StudentAttendance[] = [];

    if (isSingleCourse) {
      leaderboard = allLeaderboards[courseSlug!] || [];
    } else if (selectedCourse === "all") {
      // Combine all leaderboards
      const allStudents = new Map<string, StudentAttendance>();

      Object.values(allLeaderboards).forEach((courseLb) => {
        courseLb.forEach((student) => {
          const existing = allStudents.get(student.studentId);
          if (existing) {
            existing.totalPresent += student.totalPresent;
            existing.totalAbsent += student.totalAbsent;
            existing.totalLate += student.totalLate;
            existing.totalSessions += student.totalSessions;
          } else {
            allStudents.set(student.studentId, { ...student });
          }
        });
      });

      leaderboard = Array.from(allStudents.values()).map((student) => ({
        ...student,
        attendanceRate:
          student.totalSessions > 0
            ? (student.totalPresent / student.totalSessions) * 100
            : 0,
      }));
    } else {
      leaderboard = allLeaderboards[selectedCourse] || [];
    }

    // Sort based on selected option
    return [...leaderboard].sort((a, b) => {
      switch (sortBy) {
        case "absents":
          return b.totalAbsent - a.totalAbsent;
        case "attendance":
          return b.attendanceRate - a.attendanceRate;
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
  }, [allLeaderboards, selectedCourse, isSingleCourse, courseSlug, sortBy]);

  if (isLoading) {
    return (
      <Card className="bg-[#124A69] border-white/20 h-full flex flex-col overflow-hidden">
        <CardHeader className="pb-3 flex-shrink-0">
          <CardTitle className="text-white text-lg flex items-center gap-2 -mb-8">
            <Trophy className="h-5 w-5" />
            Attendance Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <LoadingSkeleton />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#124A69] border-white/20 h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="text-white text-lg flex items-center gap-2 -mb-8">
          <Trophy className="h-5 w-5" />
          {isSingleCourse && courseTitle
            ? courseTitle
            : "Attendance Leaderboard"}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-shrink-0 space-y-3 mb-3">
          {!isSingleCourse && courses.length > 0 && (
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger className="w-full bg-white/10 border-white/20 text-white">
                <SelectValue placeholder="Select a course" />
              </SelectTrigger>
              <SelectContent className="bg-[#0f3d58] border-white/20 text-white">
                <SelectItem value="all">All Courses</SelectItem>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.slug}>
                    {course.code} - {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select
            value={sortBy}
            onValueChange={(value) => setSortBy(value as SortOption)}
          >
            <SelectTrigger className="w-full bg-white/10 border-white/20 text-white">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="bg-[#0f3d58] border-white/20 text-white">
              <SelectItem value="absents">Most Absents</SelectItem>
              <SelectItem value="attendance">Highest Attendance</SelectItem>
              <SelectItem value="present">Most Present</SelectItem>
              <SelectItem value="late">Most Late</SelectItem>
              <SelectItem value="excused">Most Excused</SelectItem>
            </SelectContent>
          </Select>
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
