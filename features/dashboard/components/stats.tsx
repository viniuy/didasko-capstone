"use client";

import { User, BookOpen, GraduationCap, Users } from "lucide-react";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { useFacultyStats, useFacultyCount } from "@/lib/hooks/queries";

interface StatCardProps {
  icon: React.ReactNode;
  count: number;
  label: string;
}

const StatCard = ({ icon, count, label }: StatCardProps) => {
  return (
    <Card className="w-full">
      <CardContent className="flex items-center -mt-2 -mb-2 justify-between">
        <div>
          <CardDescription className="text-xs sm:text-sm font-semibold">
            {label}
          </CardDescription>
          <p className="text-xl sm:text-2xl md:text-3xl font-bold text-[#124A69]">
            {count}
          </p>
        </div>
        <div className="bg-[#124A69] p-2 sm:p-2.5 md:p-3 rounded-lg text-white">
          <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-6 md:h-6">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
};

interface StatsProps {
  initialFacultyStats?: {
    totalStudents: number;
    totalCourses: number;
    totalClasses: number;
  };
  initialFacultyCount?: {
    fullTime: number;
    partTime: number;
  };
  userRole?: string;
}

export default function Dashboard({
  initialFacultyStats,
  initialFacultyCount,
  userRole,
}: StatsProps) {
  // React Query hooks with initialData
  const { data: facultyStats } = useFacultyStats({
    initialData: initialFacultyStats,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  const { data: facultyCount } = useFacultyCount({
    initialData: initialFacultyCount,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const stats =
    userRole === "ACADEMIC_HEAD"
      ? {
          fullTime:
            facultyCount?.fullTime || initialFacultyCount?.fullTime || 0,
          partTime:
            facultyCount?.partTime || initialFacultyCount?.partTime || 0,
        }
      : {
          totalStudents:
            facultyStats?.totalStudents ||
            initialFacultyStats?.totalStudents ||
            0,
          totalCourses:
            facultyStats?.totalCourses ||
            initialFacultyStats?.totalCourses ||
            0,
          totalClasses:
            facultyStats?.totalClasses ||
            initialFacultyStats?.totalClasses ||
            0,
        };

  if (userRole === "ACADEMIC_HEAD") {
    return (
      <div className="pt-2 px-2 sm:px-3 md:px-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
          <StatCard
            icon={<Users className="w-full h-full" />}
            count={stats.fullTime}
            label="FACULTY FULL-TIME"
          />
          <StatCard
            icon={<Users className="w-full h-full" />}
            count={stats.partTime}
            label="FACULTY PART-TIME"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="pt-2 px-2 sm:px-3 md:px-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-3 sm:mb-4">
        <StatCard
          icon={<User className="w-full h-full" />}
          count={stats.totalStudents}
          label="TOTAL STUDENTS"
        />
        <StatCard
          icon={<BookOpen className="w-full h-full" />}
          count={stats.totalCourses}
          label="TOTAL SUBJECTS"
        />
        <StatCard
          icon={<GraduationCap className="w-full h-full" />}
          count={stats.totalClasses}
          label="TOTAL SECTIONS"
        />
      </div>
    </div>
  );
}
