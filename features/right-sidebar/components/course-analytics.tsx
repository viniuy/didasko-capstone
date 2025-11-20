"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, UserCheck, TrendingUp, UserX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { coursesService } from "@/lib/services/client";

interface CourseStats {
  totalStudents: number;
  attendanceRate: number;
  averageGrade: number;
  totalAbsents: number;
  totalLate: number;
  totalExcused: number;
  passingRate: number;
}

interface CourseInfo {
  code: string;
  title: string;
  section: string;
}

const LoadingSkeleton = () => (
  <Card className="bg-[#124A69] py-0 border-white/20 h-full">
    <CardContent className="p-4 h-full flex flex-col">
      {/* Course Header Skeleton */}
      <div className="mb-4 pb-3 border-b border-white/20">
        <Skeleton className="h-4 w-3/4 bg-white/20 mb-2" />
        <Skeleton className="h-3 w-1/2 bg-white/20" />
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-2 gap-3 flex-1">
        {[...Array(4)].map((_, idx) => (
          <div
            key={idx}
            className="bg-white/5 rounded-lg p-3 border border-white/10"
          >
            <div className="flex items-start justify-between mb-2">
              <Skeleton className="h-7 w-7 rounded bg-white/20" />
            </div>
            <Skeleton className="h-3 w-16 bg-white/20 mb-2" />
            <Skeleton className="h-5 w-12 bg-white/20 mb-1" />
            <Skeleton className="h-3 w-20 bg-white/20" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

export default function CourseAnalytics({
  courseSlug,
}: {
  courseSlug: string;
}) {
  const [stats, setStats] = useState<CourseStats | null>(null);
  const [courseInfo, setCourseInfo] = useState<CourseInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await coursesService.getAnalytics(courseSlug);
      setStats(response.stats);
      setCourseInfo(response.course);
    } catch (error) {
      console.error("Failed to load course stats:", error);
    } finally {
      setIsLoading(false);
    }
  }, [courseSlug]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Listen for course students updated event
  useEffect(() => {
    const handleStudentsUpdated = (event: CustomEvent) => {
      // Only refresh if the event is for this course
      if (event.detail?.courseSlug === courseSlug) {
        fetchStats();
      }
    };

    window.addEventListener(
      "courseStudentsUpdated",
      handleStudentsUpdated as EventListener
    );
    return () => {
      window.removeEventListener(
        "courseStudentsUpdated",
        handleStudentsUpdated as EventListener
      );
    };
  }, [courseSlug, fetchStats]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!stats || !courseInfo) return null;

  const statItems = [
    {
      icon: Users,
      label: "Students",
      value: stats.totalStudents,
      gradient: "from-blue-500/20 to-blue-600/10",
    },
    {
      icon: UserCheck,
      label: "Attendance",
      value: `${stats.attendanceRate.toFixed(1)}%`,
      gradient: "from-green-500/20 to-green-600/10",
    },
    {
      icon: TrendingUp,
      label: "Avg Grade",
      value: stats.averageGrade.toFixed(1),
      subtitle: `${stats.passingRate.toFixed(0)}% passing`,
      gradient: "from-purple-500/20 to-purple-600/10",
    },
    {
      icon: UserX,
      label: "Absences",
      value: stats.totalAbsents,
      subtitle: `${stats.totalLate} late`,
      gradient: "from-red-500/20 to-red-600/10",
    },
  ];

  return (
    <Card className="bg-[#124A69] border-white/20 h-full py-0 overflow-hidden">
      <CardContent className="p-4 h-full flex flex-col">
        {/* Course Header */}
        <div className="mb-4 pb-3 border-b border-white/20">
          <h3 className="text-white font-bold text-xl truncate">
            {courseInfo.code}
          </h3>
          <p className="text-white/70 text-xs truncate">
            Section {courseInfo.section}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 flex-1">
          {statItems.map((stat, idx) => (
            <div
              key={idx}
              className={`bg-gradient-to-br ${stat.gradient} rounded-xl p-3 border border-white/20 shadow-lg backdrop-blur-sm`}
            >
              {/* Icon and Label Row */}
              <div className="flex items-center gap-2 mb-3">
                <div className={`p-2 rounded-lg shadow-md`}>
                  <stat.icon className="w-4 h-4 text-white" />
                </div>
                <p className="text-white/90 text-xs font-medium">
                  {stat.label}
                </p>
              </div>

              {/* Value */}
              <div className="mt-auto">
                <p className="text-white font-bold text-2xl leading-none mb-1">
                  {stat.value}
                </p>
                {stat.subtitle && (
                  <p className="text-white/70 text-xs leading-tight">
                    {stat.subtitle}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
