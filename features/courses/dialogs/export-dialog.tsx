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
import { Download, Users } from "lucide-react";
import { useArchivedCourses } from "@/lib/hooks/queries";

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
  facultyId?: string | null;
}

interface Faculty {
  id: string;
  name: string;
  email: string;
  department: string;
}

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: Course[];
  allCourses: Course[]; // All courses for filtering
  onExport: (exportFilter: "ACTIVE" | "ARCHIVED", facultyId?: string) => void;
  userRole?: string;
  userId?: string;
  faculties?: Faculty[];
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
  userRole,
  userId,
  faculties = [],
}: ExportDialogProps) {
  const [exportFilter, setExportFilter] = useState<"ACTIVE" | "ARCHIVED">(
    "ACTIVE"
  );
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>(
    userId || ""
  );
  const [windowHeight, setWindowHeight] = useState(800);
  const isAcademicHead = userRole === "ACADEMIC_HEAD";

  // Find current user's faculty info
  const currentUserFaculty = useMemo(() => {
    if (!userId) return null;
    return faculties.find((f) => f.id === userId);
  }, [faculties, userId]);

  // Fetch archived courses when dialog is open and faculty is selected (for accurate counts)
  const { data: archivedCoursesData = [], isLoading: isLoadingArchived } =
    useArchivedCourses(
      open && selectedFacultyId
        ? {
            facultyId: selectedFacultyId,
          }
        : undefined
    );

  useEffect(() => {
    if (typeof window !== "undefined") {
      setWindowHeight(window.innerHeight);
      const handleResize = () => setWindowHeight(window.innerHeight);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  // Get active courses filtered by faculty (for active courses count and filtering)
  const facultyFilteredActiveCourses = useMemo(() => {
    let filtered = allCourses;

    // Filter by selected faculty
    if (selectedFacultyId) {
      filtered = filtered.filter((c) => c.facultyId === selectedFacultyId);
    }

    return filtered;
  }, [allCourses, selectedFacultyId]);

  // Filter courses based on selected option and faculty (for Academic Head)
  const filteredExportCourses = useMemo(() => {
    // If ARCHIVED filter is selected, use fetched archived courses
    if (exportFilter === "ARCHIVED") {
      return archivedCoursesData;
    }

    // For ACTIVE filter, use active courses filtered by faculty
    return facultyFilteredActiveCourses.filter(
        (c) => c.status === "ACTIVE" || c.status === "INACTIVE"
      );
  }, [exportFilter, facultyFilteredActiveCourses, archivedCoursesData]);

  // Calculate counts for radio buttons
  const activeCoursesCount = useMemo(() => {
    return facultyFilteredActiveCourses.filter(
      (c) => c.status === "ACTIVE" || c.status === "INACTIVE"
    ).length;
  }, [facultyFilteredActiveCourses]);

  const archivedCoursesCount = useMemo(() => {
    // Use fetched archived courses count
    return archivedCoursesData.length;
  }, [archivedCoursesData]);

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

        {/* Faculty Selection (Academic Head only) */}
        {isAcademicHead && (
        <div className="mt-4 space-y-2 flex-shrink-0">
          <Label
              htmlFor="faculty-filter"
              className="text-sm font-medium text-[#124A69] flex items-center gap-2"
          >
              <Users className="w-4 h-4" />
              Select Faculty
          </Label>
          <Select
              value={selectedFacultyId}
              onValueChange={setSelectedFacultyId}
          >
              <SelectTrigger id="faculty-filter" className="w-full">
                <SelectValue placeholder="Select faculty" />
            </SelectTrigger>
            <SelectContent>
                {currentUserFaculty && (
                  <SelectItem value={currentUserFaculty.id} disabled>
                    {currentUserFaculty.name} (me)
                    {currentUserFaculty.department &&
                      ` - ${currentUserFaculty.department}`}
              </SelectItem>
                )}
                {faculties
                  .filter((faculty) => faculty.id !== userId)
                  .map((faculty) => (
                    <SelectItem key={faculty.id} value={faculty.id}>
                      {faculty.name}
                      {faculty.department && ` (${faculty.department})`}
              </SelectItem>
                  ))}
            </SelectContent>
          </Select>
          </div>
        )}

        {/* Export Filter Selection - Radio Buttons */}
        <div className="mt-4 space-y-2 flex-shrink-0">
          <Label className="text-sm font-medium text-[#124A69]">
            Export Options
          </Label>
          <div className="space-y-2 border rounded-md p-3 bg-gray-50">
            <div className="flex items-center space-x-2 p-2 rounded hover:bg-white transition-colors group">
              <label className="flex items-center cursor-pointer flex-1">
                <input
                  type="radio"
                  name="export-filter"
                  checked={exportFilter === "ACTIVE"}
                  onChange={() => setExportFilter("ACTIVE")}
                  className="sr-only peer"
                />
                <div
                  className={`relative w-4 h-4 rounded-full border-2 transition-all duration-200 flex items-center justify-center group-hover:border-[#124A69]/60 peer-focus-visible:ring-2 peer-focus-visible:ring-[#124A69]/50 peer-focus-visible:ring-offset-2 peer-focus-visible:outline-none ${
                    exportFilter === "ACTIVE"
                      ? "border-[#124A69]"
                      : "border-gray-300"
                  }`}
                >
                  {exportFilter === "ACTIVE" && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#124A69] transition-all duration-200"></div>
                  )}
                </div>
                <span className="text-sm cursor-pointer flex-1 ml-2">
                  Active Courses ({activeCoursesCount})
                </span>
              </label>
            </div>
            <div className="flex items-center space-x-2 p-2 rounded hover:bg-white transition-colors group">
              <label className="flex items-center cursor-pointer flex-1">
                <input
                  type="radio"
                  name="export-filter"
                  checked={exportFilter === "ARCHIVED"}
                  onChange={() => setExportFilter("ARCHIVED")}
                  className="sr-only peer"
                />
                <div
                  className={`relative w-4 h-4 rounded-full border-2 transition-all duration-200 flex items-center justify-center group-hover:border-[#124A69]/60 peer-focus-visible:ring-2 peer-focus-visible:ring-[#124A69]/50 peer-focus-visible:ring-offset-2 peer-focus-visible:outline-none ${
                    exportFilter === "ARCHIVED"
                      ? "border-[#124A69]"
                      : "border-gray-300"
                  }`}
                >
                  {exportFilter === "ARCHIVED" && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#124A69] transition-all duration-200"></div>
                  )}
                </div>
                <span className="text-sm cursor-pointer flex-1 ml-2">
                  Archived Courses ({archivedCoursesCount})
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-4 sm:mt-6 border rounded-lg flex-1 flex flex-col min-h-0">
          {filteredExportCourses.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-gray-500 text-sm sm:text-base">
                  This faculty does not have a course
                </p>
              </div>
            </div>
          ) : (
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
          )}
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
              className="bg-[#124A69] hover:bg-[#0D3A54] text-white flex-1 sm:flex-initial disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => onExport(exportFilter, selectedFacultyId)}
              disabled={filteredExportCourses.length === 0}
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
