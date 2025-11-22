"use client";

import { User, BookOpen, GraduationCap, Users } from "lucide-react";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { useSession } from "next-auth/react";
import { useFacultyStats, useFacultyCount } from "@/lib/hooks/queries";

interface StatCardProps {
  icon: React.ReactNode;
  count: number;
  label: string;
  isLoading?: boolean;
}

const StatCard = ({ icon, count, label, isLoading = false }: StatCardProps) => {
  return (
    <Card className="w-full">
      <CardContent className="flex items-center -mt-2 -mb-2 justify-between">
        <div>
          <CardDescription className="text-xs sm:text-sm font-semibold">
            {label}
          </CardDescription>
          {isLoading ? (
            <div className="h-7 sm:h-8 md:h-9 w-12 sm:w-14 md:w-16 bg-gray-200 animate-pulse rounded"></div>
          ) : (
            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-[#124A69]">
              {count}
            </p>
          )}
        </div>
        <div className="bg-[#124A69] p-2 sm:p-2.5 md:p-3 rounded-lg text-white">
          <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-6 md:h-6">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function Dashboard() {
  const { data: session } = useSession();

  // React Query hooks
  const { data: facultyStats, isLoading: isLoadingStats } = useFacultyStats();
  const { data: facultyCount, isLoading: isLoadingCount } = useFacultyCount();

  const isLoading =
    session?.user?.role === "ACADEMIC_HEAD" ? isLoadingCount : isLoadingStats;

  const stats =
    session?.user?.role === "ACADEMIC_HEAD"
      ? {
          fullTime: facultyCount?.fullTime || 0,
          partTime: facultyCount?.partTime || 0,
        }
      : {
          totalStudents: facultyStats?.totalStudents || 0,
          totalCourses: facultyStats?.totalCourses || 0,
          totalClasses: facultyStats?.totalClasses || 0,
        };

  if (session?.user?.role === "ACADEMIC_HEAD") {
    return (
      <div className="pt-2 px-2 sm:px-3 md:px-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
          <StatCard
            icon={<Users className="w-full h-full" />}
            count={stats.fullTime}
            label="FACULTY FULL-TIME"
            isLoading={isLoading}
          />
          <StatCard
            icon={<Users className="w-full h-full" />}
            count={stats.partTime}
            label="FACULTY PART-TIME"
            isLoading={isLoading}
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
          isLoading={isLoading}
        />
        <StatCard
          icon={<BookOpen className="w-full h-full" />}
          count={stats.totalCourses}
          label="TOTAL SUBJECTS"
          isLoading={isLoading}
        />
        <StatCard
          icon={<GraduationCap className="w-full h-full" />}
          count={stats.totalClasses}
          label="TOTAL SECTIONS"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
