"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/svdialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download } from "lucide-react";

const MAX_PREVIEW_ROWS = 100;
const EXPECTED_HEADERS = [
  "Course Code",
  "Course Title",
  "Room",
  "Semester",
  "Academic Year",
  "Class Number",
  "Section",
  "Status",
];

interface Course {
  code: string;
  title: string;
  room: string;
  semester: string;
  academicYear: string;
  classNumber: number;
  section: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED" | string;
}

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: Course[];
  allCourses: Course[]; // All courses for filtering
  onExport: (exportFilter: "ALL" | "ACTIVE" | "ARCHIVED") => void;
}

const formatEnumValue = (value: string) =>
  value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

export function ExportDialog({
  open,
  onOpenChange,
  courses,
  allCourses,
  onExport,
}: ExportDialogProps) {
  const [exportFilter, setExportFilter] = useState<
    "ALL" | "ACTIVE" | "ARCHIVED"
  >("ALL");
  const [windowHeight, setWindowHeight] = useState(800);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setWindowHeight(window.innerHeight);
      const handleResize = () => setWindowHeight(window.innerHeight);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  // Filter courses based on selected option
  const filteredExportCourses = useMemo(() => {
    if (exportFilter === "ALL") {
      return allCourses;
    } else if (exportFilter === "ACTIVE") {
      return allCourses.filter(
        (c) => c.status === "ACTIVE" || c.status === "INACTIVE"
      );
    } else {
      return allCourses.filter((c) => c.status === "ARCHIVED");
    }
  }, [exportFilter, allCourses]);

  // Calculate dynamic table height based on content
  const previewCount = Math.min(filteredExportCourses.length, MAX_PREVIEW_ROWS);
  const tableHeight =
    previewCount > 0
      ? Math.min(Math.max(previewCount * 50 + 100, 200), windowHeight * 0.5)
      : 200;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] sm:w-[80vw] md:w-[70vw] lg:w-[60vw] max-w-[1200px] max-h-[90vh] p-4 sm:p-6 flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl font-semibold text-[#124A69]">
            Export Courses to Excel
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Choose which courses to export and preview the data
          </DialogDescription>
        </DialogHeader>

        {/* Export Filter Selection */}
        <div className="mt-4 space-y-2 flex-shrink-0">
          <Label
            htmlFor="export-filter"
            className="text-sm font-medium text-[#124A69]"
          >
            Export Options
          </Label>
          <Select
            value={exportFilter}
            onValueChange={(value: "ALL" | "ACTIVE" | "ARCHIVED") =>
              setExportFilter(value)
            }
          >
            <SelectTrigger id="export-filter" className="w-full">
              <SelectValue placeholder="Select export option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">
                All Courses ({allCourses.length})
              </SelectItem>
              <SelectItem value="ACTIVE">
                Active Courses (
                {
                  allCourses.filter(
                    (c) => c.status === "ACTIVE" || c.status === "INACTIVE"
                  ).length
                }
                )
              </SelectItem>
              <SelectItem value="ARCHIVED">
                Archived Courses (
                {allCourses.filter((c) => c.status === "ARCHIVED").length})
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 sm:mt-6 border rounded-lg flex-1 flex flex-col min-h-0">
          <div
            className="flex-1 overflow-auto min-h-0"
            style={{ maxHeight: `${tableHeight}px` }}
          >
            <table className="w-full border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 border-b">
                    #
                  </th>
                  {EXPECTED_HEADERS.map((header) => (
                    <th
                      key={header}
                      className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 border-b whitespace-nowrap"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredExportCourses
                  .slice(0, MAX_PREVIEW_ROWS)
                  .map((course, index) => (
                    <tr
                      key={index}
                      className="border-b hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-2 sm:px-4 py-2 text-xs text-gray-500">
                        {index + 1}
                      </td>
                      <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm text-gray-900 font-medium">
                        {course.code}
                      </td>
                      <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm text-gray-900 max-w-[150px] sm:max-w-[250px] truncate">
                        {course.title}
                      </td>
                      <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm text-gray-900">
                        {course.room}
                      </td>
                      <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm text-gray-900">
                        {course.semester}
                      </td>
                      <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm text-gray-900">
                        {course.academicYear}
                      </td>
                      <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm text-gray-900">
                        {course.classNumber}
                      </td>
                      <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm text-gray-900">
                        {course.section}
                      </td>
                      <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm text-gray-900">
                        {formatEnumValue(course.status)}
                      </td>
                    </tr>
                  ))}
                {filteredExportCourses.length > MAX_PREVIEW_ROWS && (
                  <tr className="border-t bg-gray-50">
                    <td
                      colSpan={9}
                      className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 text-center font-medium"
                    >
                      + {filteredExportCourses.length - MAX_PREVIEW_ROWS} more{" "}
                      {filteredExportCourses.length - MAX_PREVIEW_ROWS === 1
                        ? "course"
                        : "courses"}{" "}
                      will be exported
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 pt-4 border-t flex-shrink-0">
          <p className="text-xs sm:text-sm text-gray-600">
            Total courses to export:{" "}
            <span className="font-semibold">
              {filteredExportCourses.length}
            </span>
          </p>
          <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button
              className="bg-[#124A69] hover:bg-[#0D3A54] text-white flex-1 sm:flex-initial"
              onClick={() => onExport(exportFilter)}
            >
              <Download className="h-4 w-4 mr-2" />
              Export to Excel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
