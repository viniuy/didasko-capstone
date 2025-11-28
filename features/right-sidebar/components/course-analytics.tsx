"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, UserCheck, TrendingUp, UserX, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCourseAnalytics } from "@/lib/hooks/queries";

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
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [termAverageGrade, setTermAverageGrade] = useState<{
    averageGrade: number;
    passingRate: number;
    hasGrades: boolean;
    isLoading: boolean;
  }>({
    averageGrade: 0,
    passingRate: 0,
    hasGrades: false,
    isLoading: false,
  });

  // React Query hook
  const {
    data: analyticsData,
    isLoading,
    isRefetching,
  } = useCourseAnalytics(courseSlug);

  const stats = analyticsData?.stats || null;
  const courseInfo = analyticsData?.course || null;

  // Listen for tab changes and computed averages from course-dashboard
  useEffect(() => {
    const handleTabChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const {
        courseSlug: eventCourseSlug,
        activeTab: newTab,
        termAverageGrade: computedGrade,
      } = customEvent.detail || {};
      // Only update if this event is for our course
      if (eventCourseSlug === courseSlug) {
        console.log(`[CourseAnalytics] Received event for ${courseSlug}`, {
          newTab,
          computedGrade,
        });
        if (newTab) {
          setActiveTab(newTab);
        }
        if (computedGrade) {
          console.log(
            `[CourseAnalytics] Setting termAverageGrade:`,
            computedGrade
          );
          setTermAverageGrade(computedGrade);
        } else if (newTab === "overview") {
          // Fallback to overall stats for overview
          setTermAverageGrade({
            averageGrade: stats?.averageGrade || 0,
            passingRate: stats?.passingRate || 0,
            hasGrades: true,
            isLoading: false,
          });
        }
      }
    };

    window.addEventListener("courseTabChanged", handleTabChange);

    return () => {
      window.removeEventListener("courseTabChanged", handleTabChange);
    };
  }, [courseSlug, stats]);

  // Initialize with overall stats on mount
  useEffect(() => {
    if (stats && !termAverageGrade.hasGrades && activeTab === "overview") {
      setTermAverageGrade({
        averageGrade: stats.averageGrade || 0,
        passingRate: stats.passingRate || 0,
        hasGrades: true,
        isLoading: false,
      });
    }
  }, [stats, activeTab, termAverageGrade.hasGrades]);

  if (isLoading && !isRefetching) {
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
      value: termAverageGrade.isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin text-white" />
      ) : activeTab === "overview" || termAverageGrade.hasGrades ? (
        termAverageGrade.averageGrade.toFixed(1)
      ) : (
        "N/A"
      ),
      subtitle: termAverageGrade.isLoading
        ? "Loading..."
        : activeTab === "overview" || termAverageGrade.hasGrades
        ? `${termAverageGrade.passingRate.toFixed(0)}% passing`
        : "No grades yet",
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
                <div className="text-white font-bold text-2xl leading-none mb-1 flex items-center gap-2 min-h-[28px]">
                  {stat.value}
                </div>
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
