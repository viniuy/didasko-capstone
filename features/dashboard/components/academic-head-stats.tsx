"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface FacultyLoad {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  courseCount: number;
  totalStudents: number;
}

interface WorstAttendanceCourse {
  id: string;
  courseCode: string;
  courseName: string;
  facultyName: string;
  facultyImage?: string | null;
  attendanceRate: number;
  totalStudents: number;
}

interface AcademicHeadStatsProps {
  highestLoadFaculty: FacultyLoad[];
  worstAttendanceCourses: WorstAttendanceCourse[];
}

export default function AcademicHeadStats({
  highestLoadFaculty,
  worstAttendanceCourses,
}: AcademicHeadStatsProps) {
  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-5 mb-8 sm:mb-12 lg:mb-16">
      {/* Faculty with Highest Load */}
      <Card className="border-[#124A69]/20 shadow-sm">
        <CardHeader className="pb-3 sm:pb-4 border-b bg-gradient-to-r from-[#124A69]/5 to-transparent">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-[#124A69] rounded-lg">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <CardTitle className="text-sm sm:text-base lg:text-lg font-semibold text-[#124A69]">
              Faculty with Highest Load
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pb-4 sm:pb-5 lg:pb-6">
          {highestLoadFaculty.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No faculty data available
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
              {highestLoadFaculty.slice(0, 3).map((faculty, index) => (
                <div
                  key={faculty.id}
                  className="group bg-gradient-to-br from-white to-gray-50/50 rounded-lg sm:rounded-xl p-4 sm:p-5 border border-[#124A69]/10 hover:border-[#124A69]/30 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <div className="relative flex-shrink-0">
                      <div className="absolute -top-0.5 sm:-top-1 -left-0.5 sm:-left-1 w-4 h-4 sm:w-5 sm:h-5 bg-[#124A69] rounded-full text-[9px] sm:text-[10px] text-white flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                      <Avatar className="h-10 w-10 sm:h-12 sm:w-12 ring-2 ring-[#124A69]/10">
                        <AvatarImage
                          src={faculty.image || undefined}
                          alt={faculty.name}
                        />
                        <AvatarFallback className="bg-gradient-to-br from-[#124A69] to-[#0D3A54] text-white text-xs sm:text-sm">
                          {faculty.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-gray-900 leading-tight truncate">
                        {faculty.name}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                        {faculty.email}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-3 border-t border-[#124A69]/10">
                    <div className="bg-[#124A69]/5 rounded-lg p-2 sm:p-3 text-center">
                      <p className="text-xl sm:text-2xl font-bold text-[#124A69]">
                        {faculty.courseCount}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                        Courses
                      </p>
                    </div>
                    <div className="bg-[#124A69]/5 rounded-lg p-2 sm:p-3 text-center">
                      <p className="text-xl sm:text-2xl font-bold text-[#124A69]">
                        {faculty.totalStudents}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                        Students
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Courses with Lowest Attendance */}
      <Card className="border-[#124A69]/20 shadow-sm">
        <CardHeader className="pb-3 sm:pb-4 border-b bg-gradient-to-r from-[#124A69]/5 to-transparent">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-[#124A69] rounded-lg">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <CardTitle className="text-sm sm:text-base lg:text-lg font-semibold text-[#124A69]">
              Courses with Lowest Attendance
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pb-4 sm:pb-5 lg:pb-6">
          {worstAttendanceCourses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No attendance data available
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
              {worstAttendanceCourses.slice(0, 3).map((course, index) => (
                <div
                  key={course.id}
                  className="group bg-gradient-to-br from-white to-gray-50/50 rounded-lg sm:rounded-xl p-4 sm:p-5 border border-[#124A69]/10 hover:border-[#124A69]/30 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 bg-[#124A69] rounded-full text-white flex items-center justify-center text-[10px] sm:text-xs font-bold flex-shrink-0">
                        {index + 1}
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-gray-900 leading-tight">
                        {course.courseCode}
                      </p>
                    </div>
                    <Badge
                      variant={
                        course.attendanceRate < 50
                          ? "destructive"
                          : course.attendanceRate < 70
                          ? "secondary"
                          : "default"
                      }
                      className="text-[10px] sm:text-xs font-semibold shadow-sm"
                    >
                      {course.attendanceRate.toFixed(1)}%
                    </Badge>
                  </div>
                  <p className="text-[11px] sm:text-xs text-muted-foreground mb-3 sm:mb-4 line-clamp-2 min-h-[2rem] sm:min-h-[2rem]">
                    {course.courseName}
                  </p>
                  <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-[#124A69]/10">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                      <Avatar className="h-6 w-6 sm:h-7 sm:w-7 flex-shrink-0 ring-2 ring-[#124A69]/10">
                        <AvatarImage
                          src={course.facultyImage || undefined}
                          alt={course.facultyName}
                        />
                        <AvatarFallback className="bg-gradient-to-br from-[#124A69] to-[#0D3A54] text-white text-[9px] sm:text-[10px]">
                          {course.facultyName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                        {course.facultyName}
                      </p>
                    </div>
                    <div className="flex-shrink-0 ml-2 sm:ml-3 bg-[#124A69]/5 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5">
                      <p className="text-xs sm:text-sm font-bold text-[#124A69]">
                        {course.totalStudents}
                      </p>
                      <p className="text-[9px] sm:text-[10px] text-muted-foreground">
                        students
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
