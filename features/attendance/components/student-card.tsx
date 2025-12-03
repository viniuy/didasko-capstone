import { AttendanceStatus } from "@prisma/client";
import { AttendanceStatusWithNotSet } from "@/shared/types/attendance";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";

interface StudentCardProps {
  student: {
    id: string;
    name: string;
    status: AttendanceStatusWithNotSet;
    image?: string;
    date?: string;
    semester?: string;
    attendanceRecord: AttendanceRecord[];
  };
  index: number;
  onStatusChange: (index: number, status: AttendanceStatus) => void;
  isInCooldown?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  isSelecting?: boolean;
  disableStatusChange?: boolean;
  isSavingRfidAttendance?: boolean;
  isLoading?: boolean;
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  courseId: string;
  date: string;
  status: AttendanceStatus;
  reason: string | null;
}

const statusStyles: Record<AttendanceStatusWithNotSet, string> = {
  LATE: "bg-[#FFF7E6] text-[#D4A017] border-[#D4A017]",
  ABSENT: "bg-[#FFEFEF] text-[#BA6262] border-[#BA6262]",
  PRESENT: "bg-[#EEFFF3] text-[#62BA7D] border-[#62BA7D]",
  EXCUSED: "bg-[#EEF2FF] text-[#8F9FDA] border-[#8F9FDA]",
  NOT_SET: "bg-white text-gray-500 border-gray-200",
};

export function StudentCard({
  student,
  index,
  onStatusChange,
  isInCooldown = false,
  isSelected = false,
  onSelect,
  disableStatusChange = false,
  isSavingRfidAttendance = false,
  isLoading = false,
}: StudentCardProps) {
  const excusedReason =
    student.attendanceRecord.find((r) => r.status === "EXCUSED")?.reason ||
    "No reason provided";

  return (
    <div className="w-full bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <div className="flex flex-col items-center gap-3 relative">
        {onSelect && (
          <div className="absolute left-3">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onSelect(student.id)}
              className="w-4 h-4 accent-[#124A69] cursor-pointer"
            />
          </div>
        )}
        <div className="relative group">
          {student.image ? (
            <img
              src={student.image}
              alt={student.name}
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <span className="inline-flex w-16 h-16 rounded-full bg-gray-200 text-gray-400 items-center justify-center">
              <svg
                width="32"
                height="32"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M6 20c0-2.2 3.6-4 6-4s6 1.8 6 4" />
              </svg>
            </span>
          )}
        </div>

        <h3
          className="text-sm font-medium text-gray-900 w-full truncate text-center"
          title={student.name}
        >
          {student.name}
        </h3>
        <div className="w-full">
          {isLoading ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-full px-4 py-1.5 text-sm font-medium border bg-white text-gray-500 border-gray-200"
              disabled
            >
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-3 w-3 border-2 border-gray-400 border-t-transparent"></div>
                <span>Loading...</span>
              </div>
            </Button>
          ) : (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`w-full rounded-full px-4 py-1.5 text-sm font-medium border ${
                        statusStyles[student.status]
                      } ${
                        isInCooldown || disableStatusChange
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                      disabled={isInCooldown || disableStatusChange}
                    >
                      {student.status === "NOT_SET"
                        ? "Select status"
                        : student.status}
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                {student.status === "EXCUSED" && (
                  <TooltipContent>
                    <p>{excusedReason}</p>
                  </TooltipContent>
                )}
              </Tooltip>
              <DropdownMenuContent align="center">
                <DropdownMenuItem
                  onClick={() => onStatusChange(index, "PRESENT")}
                  disabled={isInCooldown || disableStatusChange}
                >
                  Present
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onStatusChange(index, "LATE")}
                  disabled={isInCooldown || disableStatusChange}
                >
                  Late
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onStatusChange(index, "ABSENT")}
                  disabled={isInCooldown || disableStatusChange}
                >
                  Absent
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onStatusChange(index, "EXCUSED")}
                  disabled={isInCooldown || disableStatusChange}
                >
                  Excused
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}
