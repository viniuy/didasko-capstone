"use client";
import { useEffect, useState } from "react";
import { Role, WorkType } from "@prisma/client";
import { Users, GraduationCap, Clock, UserCircle2 } from "lucide-react";

interface Course {
  id: string;
  code: string;
  title: string;
  description: string | null;
  semester: string;
  status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  schedules: {
    id: string;
    day: Date;
    fromTime: string;
    toTime: string;
  }[];
  students: {
    id: string;
  }[];
}

interface FacultyMember {
  id: string;
  name: string;
  email: string;
  department: string;
  workType: WorkType;
  image: string | null;
  role: Role;
  coursesTeaching: Course[];
}

interface FacultyDetailsProps {
  faculty: FacultyMember;
  onBack: () => void;
}

export default function FacultyDetails({
  faculty,
  onBack,
}: FacultyDetailsProps) {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalClasses: 0,
    totalTeachingHours: 0,
  });
  const [isNavigating, setIsNavigating] = useState(false);

  const sanitizeText = (text: string) => {
    return text.replace(/_/g, " ").toUpperCase();
  };

  useEffect(() => {
    // Filter to only include active courses
    const activeCourses = faculty.coursesTeaching.filter(
      (course) => course.status === "ACTIVE" || !course.status
    );

    // Calculate total unique students across all active courses
    const uniqueStudents = new Set();
    let totalClasses = 0;
    let totalTeachingHours = 0;

    activeCourses.forEach((course) => {
      // Count students
      course.students?.forEach((student) => {
        uniqueStudents.add(student.id);
      });
      // Count classes (schedules)
      totalClasses += course.schedules?.length || 0;

      // Calculate teaching hours per week
      course.schedules?.forEach((schedule) => {
        if (!schedule.fromTime || !schedule.toTime) return;
        
        try {
          const fromParts = schedule.fromTime.split(":");
          const toParts = schedule.toTime.split(":");
          
          if (fromParts.length !== 2 || toParts.length !== 2) return;
          
          const fromHours = parseInt(fromParts[0], 10);
          const fromMinutes = parseInt(fromParts[1], 10);
          const toHours = parseInt(toParts[0], 10);
          const toMinutes = parseInt(toParts[1], 10);
          
          if (isNaN(fromHours) || isNaN(fromMinutes) || isNaN(toHours) || isNaN(toMinutes)) {
            return;
          }
          
          const fromTotalMinutes = fromHours * 60 + fromMinutes;
          const toTotalMinutes = toHours * 60 + toMinutes;
          
          const durationHours = (toTotalMinutes - fromTotalMinutes) / 60;
          
          if (durationHours > 0 && !isNaN(durationHours)) {
            totalTeachingHours += durationHours;
          }
        } catch (error) {
          // Skip invalid schedule times
          console.warn("Invalid schedule time format:", schedule);
        }
      });
    });

    setStats({
      totalStudents: uniqueStudents.size,
      totalClasses: totalClasses,
      totalTeachingHours: Math.round(totalTeachingHours * 10) / 10, // Round to 1 decimal place
    });
  }, [faculty]);

  const handleBack = () => {
    setIsNavigating(true);
    setTimeout(() => {
      onBack();
    }, 200);
  };

  return (
    <div
      className={`bg-white rounded-lg shadow-sm mb-6 transition-opacity duration-200 ${
        isNavigating ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="p-6">
        <div className="flex items-start space-x-6">
          {/* Back Button */}
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-[#124A69] hover:text-[#0d3550] transition-colors mt-10"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          {/* Faculty Image */}
          <div className="flex-shrink-0">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-[#124A69] flex items-center justify-center text-white">
              {faculty.image ? (
                <img
                  src={faculty.image}
                  alt={faculty.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl font-semibold">
                  {faculty.name.charAt(0)}
                </span>
              )}
            </div>
          </div>

          {/* Faculty Info */}
          <div className="flex-grow">
            <h1 className="text-2xl font-bold text-gray-900">{faculty.name}</h1>
            <p className="text-gray-600">{faculty.department}</p>
            <div className="flex items-center space-x-2 mt-1">
              <span className="px-2 py-1 text-xs rounded-full bg-[#124A69] text-white">
                {sanitizeText(faculty.role)}
              </span>
              <span className="px-2 py-1 text-xs rounded-full bg-[#FAEDCB] text-[#124A69]">
                {sanitizeText(faculty.workType)}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-[#F8F9FA] rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2 text-[#124A69]">
              <Users size={24} />
            </div>
            <div className="text-2xl font-bold text-[#124A69]">
              {stats.totalStudents}
            </div>
            <div className="text-sm text-gray-600">STUDENTS</div>
          </div>

          <div className="bg-[#F8F9FA] rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2 text-[#124A69]">
              <GraduationCap size={24} />
            </div>
            <div className="text-2xl font-bold text-[#124A69]">
              {stats.totalClasses}
            </div>
            <div className="text-sm text-gray-600">SECTIONS</div>
          </div>

          <div className="bg-[#F8F9FA] rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2 text-[#124A69]">
              <Clock size={24} />
            </div>
            <div className="text-2xl font-bold text-[#124A69]">
              {stats.totalTeachingHours}
            </div>
            <div className="text-sm text-gray-600">HOURS/WEEK</div>
          </div>
        </div>
      </div>
    </div>
  );
}
