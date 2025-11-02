"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  semester?: string;
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
    <div className="w-full bg-white/10 hover:bg-white/20 rounded-lg p-3 text-left transition-all duration-200 border border-white/20 hover:border-white/40">
      <div className="flex items-start gap-3">
        <Trophy className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-1" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white truncate">
                {course.title}
              </h3>
              {course.section && (
                <p className="text-xs text-white/70">
                  Section {course.section}
                </p>
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

type SortOption = "absents" | "attendance" | "present" | "late" | "excused";

interface AttendanceLeaderboardProps {
  courseSlug?: string;
}

export default function AttendanceLeaderboard({
  courseSlug,
}: AttendanceLeaderboardProps = {}) {
  const { data: session, status } = useSession();
  const [courses, setCourses] = useState<Course[]>([]);
  const [allLeaderboards, setAllLeaderboards] = useState<LeaderboardData>({});
  const [sortBy, setSortBy] = useState<SortOption>("absents");
  const [isLoading, setIsLoading] = useState(true);
  const [courseTitle, setCourseTitle] = useState<string>("");
  const [courseSection, setCourseSection] = useState<string>("");

  const isSingleCourse = !!courseSlug;

  // Fetch course title if courseSlug is provided
  useEffect(() => {
    if (!courseSlug) return;

    const fetchCourseTitle = async () => {
      try {
        const response = await axiosInstance.get(`/courses/${courseSlug}`);
        setCourseTitle(response.data.title || "");
        setCourseSection(response.data.section || "");
      } catch (error) {
        console.error("Error fetching course title:", error);
        setCourseTitle("");
        setCourseSection("");
      }
    };

    fetchCourseTitle();
  }, [courseSlug]);

  useEffect(() => {
    const fetchAllData = async () => {
      if (!session?.user?.id) return;

      try {
        if (isSingleCourse) {
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
          // Fetch both semesters
          const [firstSem, secondSem, leaderboardsResponse] = await Promise.all(
            [
              axiosInstance.get("/courses", {
                params: {
                  facultyId: session.user.id,
                  semester: "1st Semester",
                },
              }),
              axiosInstance.get("/courses", {
                params: {
                  facultyId: session.user.id,
                  semester: "2nd Semester",
                },
              }),
              axiosInstance.get("/attendance/leaderboard/all", {
                params: { facultyId: session.user.id },
              }),
            ]
          );

          const allCourses = [
            ...firstSem.data.courses,
            ...secondSem.data.courses,
          ];

          setCourses(allCourses);
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

  const firstSemCourses = courses.filter((c) => c.semester === "1st Semester");
  const secondSemCourses = courses.filter((c) => c.semester === "2nd Semester");

  const currentLeaderboard = useMemo(() => {
    if (!isSingleCourse) return [];

    const leaderboard: StudentAttendance[] = allLeaderboards[courseSlug!] || [];

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

  // Render semester tabs view when no courseSlug
  if (!isSingleCourse) {
    return (
      <Card className="bg-[#124A69] border-white/20 h-full flex flex-col overflow-hidden">
        <CardHeader className="pb-3 flex-shrink-0">
          <CardTitle className="text-white text-lg flex items-center gap-2 -mb-8">
            <Trophy className="h-5 w-5" />
            Attendance Overview
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
                  <Trophy className="mx-auto mb-2 text-white/30" size={40} />
                  <p className="text-sm text-white/70">
                    No 1st semester courses
                  </p>
                </div>
              ) : (
                firstSemCourses.map((course) => (
                  <CourseAttendanceCard
                    key={course.id}
                    course={course}
                    leaderboard={allLeaderboards[course.slug] || []}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent
              value="2nd"
              className="flex-1 overflow-y-auto mt-3 space-y-2"
            >
              {secondSemCourses.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="mx-auto mb-2 text-white/30" size={40} />
                  <p className="text-sm text-white/70">
                    No 2nd semester courses
                  </p>
                </div>
              ) : (
                secondSemCourses.map((course) => (
                  <CourseAttendanceCard
                    key={course.id}
                    course={course}
                    leaderboard={allLeaderboards[course.slug] || []}
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    );
  }

  // Original single course view
  return (
    <Card className="bg-[#124A69] border-white/20 h-full flex flex-col overflow-hidden">
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
      <CardContent className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-shrink-0 space-y-3 mb-3">
          <Select
            value={sortBy}
            onValueChange={(value) => setSortBy(value as SortOption)}
          >
            <SelectTrigger className="w-full bg-white/10 border-white/20 text-white flex items-center justify-between">
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
