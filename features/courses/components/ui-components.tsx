import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, XCircle, Circle } from "lucide-react";
import { Student, AttendanceRecord } from "../types/types";
import { getInitials } from "../utils/initials";

export function LoadingSpinner({
  mainMessage = "Loading Course Data",
  secondaryMessage = "Please sit tight while we are getting things ready for you...",
}: {
  mainMessage?: string;
  secondaryMessage?: string;
}) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm min-h-[840px] max-h-[840px]">
      <div className="flex flex-col items-center gap-4 mt-40">
        <h2 className="text-3xl font-bold text-[#124A69] animate-pulse">
          {mainMessage}
        </h2>
        <p
          className="text-lg text-gray-600 animate-pulse"
          style={{ animationDelay: "150ms" }}
        >
          {secondaryMessage}
        </p>
        <div className="flex gap-2 mt-4">
          {[0, 150, 300].map((delay, i) => (
            <div
              key={i}
              className="w-3 h-3 bg-[#124A69] rounded-full animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export const StatsCard = ({
  icon: Icon,
  title,
  value,
  subtitle,
  color = "bg-[#124A69]",
}: {
  icon: any;
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}) => (
  <Card className="border-2 border-[#124A69]/30 hover:border-[#124A69] hover:shadow-lg transition-all duration-200">
    <CardContent className="p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1 truncate">
            {title}
          </p>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs sm:text-sm text-gray-500 mt-1 truncate">
              {subtitle}
            </p>
          )}
        </div>
        <div className={`${color} p-2 sm:p-3 rounded-lg shrink-0`}>
          <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
);

export const StudentAvatar = ({ student }: { student: Student }) => (
  <div className="flex items-center gap-3">
    <Avatar className="h-8 w-8">
      <AvatarImage src={student.image} alt={student.firstName} />
      <AvatarFallback className="bg-[#124A69] text-white text-xs">
        {getInitials(student.firstName, student.lastName)}
      </AvatarFallback>
    </Avatar>
    <span className="text-sm">
      {student.lastName}, {student.firstName}{" "}
      {student.middleInitial ? `${student.middleInitial}.` : ""}
    </span>
  </div>
);

export const getAttendanceIcon = (status: string) => {
  switch (status) {
    case "PRESENT":
      return <CheckCircle2 className="w-3 h-3 text-green-600" />;
    case "LATE":
      return <Clock className="w-3 h-3 text-orange-600" />;
    case "ABSENT":
      return <XCircle className="w-3 h-3 text-red-600" />;
    case "EXCUSED":
      return <Circle className="w-3 h-3 text-blue-600" />;
    default:
      return <Circle className="w-3 h-3 text-gray-300" />;
  }
};

export const AttendanceVisualizer = ({
  records,
}: {
  records?: AttendanceRecord[];
}) => {
  if (!records || records.length === 0) {
    return <span className="text-gray-400 text-xs">No records</span>;
  }

  return (
    <div className="flex items-center gap-1 flex-wrap max-w-[200px]">
      {records.slice(0, 20).map((record) => (
        <div key={record.id} className="relative group">
          {getAttendanceIcon(record.status)}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
            {new Date(record.date).toLocaleDateString()} - {record.status}
          </div>
        </div>
      ))}
      {records.length > 20 && (
        <span className="text-xs text-gray-500 ml-1">
          +{records.length - 20}
        </span>
      )}
    </div>
  );
};

export const AttendanceLegend = () => (
  <div className="flex items-center gap-4 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg border">
    <span className="flex items-center gap-1">
      <CheckCircle2 className="w-3 h-3 text-green-600" /> Present
    </span>
    <span className="flex items-center gap-1">
      <Clock className="w-3 h-3 text-orange-600" /> Late
    </span>
    <span className="flex items-center gap-1">
      <XCircle className="w-3 h-3 text-red-600" /> Absent
    </span>
    <span className="flex items-center gap-1">
      <Circle className="w-3 h-3 text-blue-600" /> Excused
    </span>
  </div>
);
