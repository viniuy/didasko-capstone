"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Download,
  Upload,
  GraduationCap,
  Users,
  CircleUserRound,
  BookOpen,
  Calendar,
  MoreVertical,
  Edit,
  CalendarPlus,
  Settings2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CourseSheet } from "./course-sheet";
import { CourseStatus } from "@prisma/client";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import axiosInstance from "@/lib/axios";
import { useRouter } from "next/navigation";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  getCoursePermissions,
  filterCoursesByRole,
  canArchiveCourse,
  filterArchivableCourses,
  type UserRole,
} from "@/lib/permission";
import { FacultyFilter } from "./faculty-filter";
import { ExportDialog } from "../dialogs/export-dialog";
import { ImportDialog } from "../dialogs/import-dialog";
import { ImportStatusDialog } from "../dialogs/import-status-dialog";
import { ScheduleAssignmentDialog } from "../dialogs/schedule-assignment-dialog";
import { CourseSettingsDialog } from "../dialogs/course-settings-dialog"; // Adjust path as needed
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

interface CourseStats {
  passingRate: number;
  attendanceRate: number;
  totalStudents: number;
}

interface Course {
  id: string;
  code: string;
  title: string;
  room: string;
  semester: string;
  academicYear: string;
  classNumber: number;
  status: CourseStatus;
  section: string;
  slug: string;
  facultyId: string | null;
  faculty?: {
    name: string;
    email: string;
  } | null;
  _count?: {
    students: number;
  };
  schedules: {
    id: string;
    day: string;
    fromTime: string;
    toTime: string;
  }[];
  stats?: CourseStats;
  [key: string]: any;
}

interface Faculty {
  id: string;
  name: string;
  email: string;
  department: string;
}

interface CourseDataTableProps {
  courses: Course[];
  userRole: UserRole;
  userId: string;
  onCourseAdded?: () => void;
}

interface CsvRow {
  "Course Code": string;
  "Course Title": string;
  Room: string;
  Semester: string;
  "Academic Year": string;
  "Class Number": string;
  Section: string;
  Status: string;
}

interface ImportStatus {
  imported: number;
  skipped: number;
  errors: Array<{ code: string; message: string }>;
  total: number;
  detailedFeedback: Array<{
    row: number;
    code: string;
    status: string;
    message: string;
  }>;
}

const ITEMS_PER_PAGE = 8;
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

const formatEnumValue = (value: string) =>
  value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

// Loading Spinner Component
function LoadingSpinner() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm min-h-[840px] max-h-[840px] mt-5">
      <div className="flex flex-col items-center gap-4 mt-40">
        <h2 className="text-3xl font-bold text-[#124A69] animate-pulse">
          Loading Courses...
        </h2>
        <p
          className="text-lg text-gray-600 animate-pulse"
          style={{ animationDelay: "150ms" }}
        >
          Please sit tight while we are getting things ready for you...
        </p>
        <div className="flex gap-2 mt-4">
          <div className="w-3 h-3 bg-[#124A69] rounded-full animate-bounce"></div>
          <div
            className="w-3 h-3 bg-[#124A69] rounded-full animate-bounce"
            style={{ animationDelay: "150ms" }}
          ></div>
          <div
            className="w-3 h-3 bg-[#124A69] rounded-full animate-bounce"
            style={{ animationDelay: "300ms" }}
          ></div>
        </div>
      </div>
    </div>
  );
}

// Course Card Component
const CourseCard = ({
  course,
  onEdit,
  onAddSchedule,
  onViewDetails,
}: {
  course: Course;
  onEdit: (course: Course) => void;
  onAddSchedule: (course: Course) => void;
  onViewDetails: (course: Course) => void;
}) => {
  const router = useRouter();

  const formatTo12Hour = (time: string) => {
    if (!time) return "";

    let raw = time.trim().toLowerCase();

    // Case 1: Already 12-hour format: "2:00 pm"
    if (raw.includes("am") || raw.includes("pm")) {
      let [hm, suffix] = raw.split(/(am|pm)/);
      let [h, m] = hm.trim().split(":").map(Number);

      if (suffix === "pm" && h !== 12) h += 12;
      if (suffix === "am" && h === 12) h = 0;

      const hour12 = h % 12 || 12;
      const finalSuffix = suffix.toUpperCase();

      return `${hour12}:${m.toString().padStart(2, "0")} ${finalSuffix}`;
    }

    // Case 2: 24-hour format: "14:00"
    const [hours, minutes] = raw.split(":").map(Number);
    const suffix = hours >= 12 ? "PM" : "AM";
    const normalizedHour = hours % 12 || 12;

    return `${normalizedHour}:${minutes.toString().padStart(2, "0")} ${suffix}`;
  };

  const getStatusColor = (status: CourseStatus) => {
    switch (status) {
      case "ACTIVE":
        return "bg-blue-200 text-blue-900 border-blue-300";
      case "INACTIVE":
        return "bg-gray-300 text-gray-700 border-gray-400";
      case "ARCHIVED":
        return "bg-red-300 text-red-800 border-red-400";
      default:
        return "bg-gray-200 text-gray-700 border-gray-300";
    }
  };

  const hasNoSchedule = !course.schedules || course.schedules.length === 0;
  const passingRate = course.stats?.passingRate ?? 0;
  const attendanceRate = course.stats?.attendanceRate ?? 0;

  return (
    <div className="group relative w-auto h-[270px] bg-white rounded-lg border-2 border-[#124A69]/30 p-3 hover:border-[#124A69] hover:shadow-lg transition-all duration-200 text-[#124A69]">
      {/* More Options Menu */}
      <div className="absolute top-2 right-2 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-gray-100"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Course Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onEdit(course);
              }}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit Course
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onAddSchedule(course);
              }}
            >
              <CalendarPlus className="mr-2 h-4 w-4" />
              {hasNoSchedule ? "Add Schedule" : "Edit Schedule"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Status Badge */}
      <div className="absolute top-4 right-12">
        <Badge className={`${getStatusColor(course.status)} border`}>
          {formatEnumValue(course.status)}
        </Badge>
      </div>

      {/* Card Content - Clickable */}
      <div
        onClick={() => router.push(`/main/course/${course.slug}`)}
        className="cursor-pointer h-full"
      >
        <div className="mb-4">
          <h3 className="text-lg font-bold group-hover:text-[#0C3246] transition-colors">
            {course.code} - {course.section}
          </h3>
          <p className="text-xs opacity-80 mt-1">{course.title}</p>
        </div>

        <div className="flex items-center mb-4 opacity-80">
          <Calendar className="w-5 h-5" />
          <span className="text-xs font-medium ml-2 truncate">
            {course.room} |{" "}
            {hasNoSchedule ? (
              <span className="text-amber-600 font-semibold">
                No schedule set
              </span>
            ) : (
              course.schedules
                .map(
                  (s) =>
                    `${s.day.slice(0, 3)} ${formatTo12Hour(
                      s.fromTime
                    )}–${formatTo12Hour(s.toTime)}`
                )
                .join(", ")
            )}
          </span>
        </div>

        <div className="flex justify-between items-center mb-4 opacity-80 text-gray-700">
          <div className="flex items-center min-w-0">
            <CircleUserRound className="w-5 h-5 flex-shrink-0" />
            <span
              className="text-xs font-medium ml-2 truncate max-w-[150px]"
              title={course.faculty?.name || "No Instructor"}
            >
              {course.faculty?.name || "No Instructor"}
            </span>
          </div>

          <div className="flex items-center flex-shrink-0">
            <Users className="w-5 h-5" />
            <span className="text-xs font-medium ml-2">
              {course._count?.students || 0} Students
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-7">
          <div className="rounded-lg p-3 bg-[#124A69] text-white border border-[#124A69] shadow-sm">
            <div className="flex items-center gap-2 mb-1 text-xs">
              <span>Passing Rate</span>
            </div>
            <p className="text-xl font-bold">{passingRate}%</p>
          </div>
          <div className="rounded-lg p-3 bg-[#124A69] text-white border border-[#124A69] shadow-sm">
            <div className="flex items-center gap-2 mb-1 text-xs">
              <GraduationCap className="w-3 h-3" />
              <span>Attendance</span>
            </div>
            <p className="text-xl font-bold">{attendanceRate}%</p>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 rounded-lg border-2 border-[#124A69] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  );
};

export function CourseDataTable({
  courses: initialCourses,
  userRole,
  userId,
  onCourseAdded,
}: CourseDataTableProps) {
  // Get permissions based on role
  const permissions = useMemo(() => getCoursePermissions(userRole), [userRole]);

  // State
  const [tableData, setTableData] = useState<Course[]>(initialCourses);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CourseStatus | "ALL">("ALL");
  const [facultyFilter, setFacultyFilter] = useState<string>(userId);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [scheduleDialogCourse, setScheduleDialogCourse] =
    useState<Course | null>(null);
  const [newCourseForSchedule, setNewCourseForSchedule] = useState<any>(null);
  const [pendingCourseData, setPendingCourseData] = useState<any>(null);
  const [scheduleDialogMode, setScheduleDialogMode] = useState<
    "create" | "edit" | "import"
  >("import");

  // Import/Export State
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [showImportStatus, setShowImportStatus] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [previewData, setPreviewData] = useState<CsvRow[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isValidFile, setIsValidFile] = useState(false);
  const [showScheduleAssignment, setShowScheduleAssignment] = useState(false);
  const [importedCoursesForSchedule, setImportedCoursesForSchedule] = useState<
    any[]
  >([]);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    status: string;
    error?: string;
    hasError?: boolean;
  } | null>(null);

  // Load initial data
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setIsInitialLoading(true);

        const [facultyResponse] = await Promise.all([
          axiosInstance.get("/users?role=FACULTY"),
        ]);

        if (Array.isArray(facultyResponse.data)) {
          setFaculties(facultyResponse.data);
        }

        // Fetch stats for all courses
        if (initialCourses.length > 0) {
          const coursesWithStats = await Promise.all(
            initialCourses.map(async (course) => {
              try {
                const statsResponse = await axiosInstance.get(
                  `/courses/${course.slug}/courses-stats`
                );
                return {
                  ...course,
                  stats: statsResponse.data,
                };
              } catch (error: any) {
                // Silently handle 404s (courses without stats yet)
                if (error?.response?.status !== 404) {
                  console.error(
                    `Error fetching stats for course ${course.code}:`,
                    error
                  );
                }
                return {
                  ...course,
                  stats: {
                    passingRate: 0,
                    attendanceRate: 0,
                    totalStudents: 0,
                  },
                };
              }
            })
          );
          setTableData(coursesWithStats);
        }

        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        console.error("Error loading initial data:", error);
        toast.error("Failed to load some data");
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadAllData();
  }, [initialCourses]);

  const refreshTableData = useCallback(async (skipStats = false) => {
    try {
      setIsRefreshing(true);
      const response = await axiosInstance.get("/courses");
      const data = response.data;

      if (data.courses) {
        if (skipStats) {
          // Just update the courses without fetching stats - preserve existing stats
          setTableData((prevData) =>
            data.courses.map((newCourse: Course) => {
              const existingCourse = prevData.find(
                (c) => c.id === newCourse.id
              );
              return existingCourse
                ? { ...newCourse, stats: existingCourse.stats }
                : {
                    ...newCourse,
                    stats: {
                      passingRate: 0,
                      attendanceRate: 0,
                      totalStudents: 0,
                    },
                  };
            })
          );
        } else {
          // Fetch stats only if explicitly requested
          const coursesWithStats = await Promise.all(
            data.courses.map(async (course: Course) => {
              try {
                // Fix the URL - it should be /stats not /course-stats
                const statsResponse = await axiosInstance.get(
                  `/courses/${course.slug}/courses-stats`
                );
                return {
                  ...course,
                  stats: statsResponse.data,
                };
              } catch (error: any) {
                // Silently handle 404s - course has no stats yet
                if (error?.response?.status === 404) {
                  return {
                    ...course,
                    stats: {
                      passingRate: 0,
                      attendanceRate: 0,
                      totalStudents: 0,
                    },
                  };
                }

                // Log other errors but still return default stats
                console.warn(
                  `Could not fetch stats for course ${course.code}:`,
                  error?.response?.status
                );

                return {
                  ...course,
                  stats: {
                    passingRate: 0,
                    attendanceRate: 0,
                    totalStudents: 0,
                  },
                };
              }
            })
          );
          setTableData(coursesWithStats);
        }
      }
    } catch (error: any) {
      console.error("Error refreshing table data:", error);
      toast.error("Failed to refresh course data");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Filter courses based on role and filters
  const filteredCourses = useMemo(() => {
    // First filter by role and faculty
    let courses = filterCoursesByRole(
      tableData,
      userRole,
      userId,
      facultyFilter
    );

    // Then apply search and status filters
    return courses.filter((course) => {
      const matchesSearch =
        course.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.section.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" || course.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [tableData, userRole, userId, facultyFilter, searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredCourses.length / ITEMS_PER_PAGE);

  const paginatedCourses = filteredCourses.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Course action handlers
  const handleEditCourse = (course: Course) => {
    setEditingCourse(course);
  };

  const handleAddSchedule = (course: Course) => {
    setScheduleDialogCourse(course);
    setImportedCoursesForSchedule([course]);
    setScheduleDialogMode("edit");
    setShowScheduleAssignment(true);
  };

  const handleViewDetails = (course: Course) => {
    window.open(`/main/course/${course.slug}`, "_blank");
  };

  const handleArchiveCourses = async (courseIds: string[]) => {
    try {
      // Filter courses to only include those owned by current user
      const coursesToArchive = tableData
        .filter(
          (course) =>
            courseIds.includes(course.id) && course.facultyId === userId
        )
        .map((course) => course.id);

      if (coursesToArchive.length === 0) {
        toast.error("You can only archive your own courses");
        return;
      }

      if (coursesToArchive.length < courseIds.length) {
        toast.error(
          `Only archiving ${coursesToArchive.length} of ${courseIds.length} courses (you can only archive your own courses)`
        );
      }

      await axiosInstance.patch("/courses/bulk-archive", {
        courseIds: coursesToArchive,
        status: "ARCHIVED",
      });

      toast.success(
        `Successfully archived ${coursesToArchive.length} course(s)`
      );

      // Refresh table data
      await refreshTableData(true);
      if (onCourseAdded) onCourseAdded();
    } catch (error) {
      console.error("Error archiving courses:", error);
      throw error;
    }
  };

  const handleUnarchiveCourses = async (courseIds: string[]) => {
    try {
      await axiosInstance.patch("/courses/bulk-archive", {
        courseIds,
        status: "ACTIVE",
      });

      // Refresh table data
      await refreshTableData(true);
      if (onCourseAdded) onCourseAdded();
    } catch (error) {
      console.error("Error unarchiving courses:", error);
      throw error;
    }
  };

  // Export handler
  const handleExport = useCallback(async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Courses");

      // Add title row
      worksheet.mergeCells("A1:H1");
      const titleRow = worksheet.getCell("A1");
      titleRow.value = "COURSE MANAGEMENT DATA";
      titleRow.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
      titleRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF124A69" },
      };
      titleRow.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(1).height = 30;

      // Add date row
      worksheet.mergeCells("A2:H2");
      const dateRow = worksheet.getCell("A2");
      dateRow.value = `Export Date: ${new Date().toLocaleDateString()}`;
      dateRow.font = { italic: true, size: 11 };
      dateRow.alignment = { vertical: "middle", horizontal: "center" };

      worksheet.addRow([]);

      // Add header row
      const headerRow = worksheet.addRow([
        "Course Code",
        "Course Title",
        "Room",
        "Semester",
        "Academic Year",
        "Class Number",
        "Section",
        "Status",
      ]);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF124A69" },
      };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.height = 25;

      headerRow.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      // Add data rows
      filteredCourses.forEach((course: Course) => {
        const row = worksheet.addRow([
          course.code,
          course.title,
          course.room,
          course.semester,
          course.academicYear,
          course.classNumber.toString(),
          course.section,
          formatEnumValue(course.status),
        ]);

        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFD3D3D3" } },
            left: { style: "thin", color: { argb: "FFD3D3D3" } },
            bottom: { style: "thin", color: { argb: "FFD3D3D3" } },
            right: { style: "thin", color: { argb: "FFD3D3D3" } },
          };
          cell.alignment = { vertical: "middle" };
        });

        if (row.number % 2 === 0) {
          row.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF9FAFB" },
          };
        }
      });

      // Set column widths
      worksheet.columns = [
        { width: 15 },
        { width: 35 },
        { width: 12 },
        { width: 18 },
        { width: 18 },
        { width: 15 },
        { width: 12 },
        { width: 15 },
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const filename = `courses_${new Date().toISOString().split("T")[0]}.xlsx`;
      saveAs(blob, filename);

      toast.success(`Successfully exported ${filteredCourses.length} courses`);
      setShowExportPreview(false);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export courses");
    }
  }, [filteredCourses]);

  // Import template handler
  const handleImportTemplate = useCallback(async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Template");

      // Title
      worksheet.mergeCells("A1:H1");
      const titleRow = worksheet.getCell("A1");
      titleRow.value = "COURSE IMPORT TEMPLATE";
      titleRow.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
      titleRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF124A69" },
      };
      titleRow.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(1).height = 30;

      // Instructions
      worksheet.mergeCells("A3:H3");
      const instructionTitle = worksheet.getCell("A3");
      instructionTitle.value = "IMPORTANT INSTRUCTIONS";
      instructionTitle.font = {
        bold: true,
        size: 12,
        color: { argb: "FFD97706" },
      };
      instructionTitle.alignment = { vertical: "middle", horizontal: "left" };

      const instructions = [
        "1. Course Code must be unique (e.g., CS101, MATH201)",
        "2. Semester must be exactly: 1st Semester or 2nd Semester",
        "3. Status must be exactly: Active, Inactive, or Archived",
        "4. All fields are required - do not leave any cell empty",
        "5. Do not modify or delete the header row",
        "6. Delete these instruction rows before importing",
        "7. Courses without schedules will be automatically set to INACTIVE status",
      ];

      instructions.forEach((instruction, index) => {
        worksheet.mergeCells(`A${4 + index}:H${4 + index}`);
        const cell = worksheet.getCell(`A${4 + index}`);
        cell.value = instruction;
        cell.font = { size: 10 };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFFACD" },
        };
      });

      worksheet.addRow([]);

      // Header
      const headerRow = worksheet.addRow([
        "Course Code",
        "Course Title",
        "Room",
        "Semester",
        "Academic Year",
        "Class Number",
        "Section",
        "Status",
      ]);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF124A69" },
      };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.height = 25;

      headerRow.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      // Examples
      const examples = [
        [
          "CS101",
          "Introduction to Programming",
          "A101",
          "1st Semester",
          "2024-2025",
          "1",
          "A",
          "Active",
        ],
        [
          "MATH201",
          "Calculus I",
          "B205",
          "1st Semester",
          "2024-2025",
          "1",
          "B",
          "Active",
        ],
        [
          "ENG101",
          "English Communication",
          "C103",
          "2nd Semester",
          "2024-2025",
          "2",
          "A",
          "Inactive",
        ],
      ];

      examples.forEach((example) => {
        const row = worksheet.addRow(example);
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFD3D3D3" } },
            left: { style: "thin", color: { argb: "FFD3D3D3" } },
            bottom: { style: "thin", color: { argb: "FFD3D3D3" } },
            right: { style: "thin", color: { argb: "FFD3D3D3" } },
          };
          cell.alignment = { vertical: "middle" };
        });
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE8F4F8" },
        };
      });

      worksheet.columns = [
        { width: 15 },
        { width: 35 },
        { width: 12 },
        { width: 18 },
        { width: 18 },
        { width: 15 },
        { width: 12 },
        { width: 15 },
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const filename = `course_import_template_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      saveAs(blob, filename);

      toast.success("Template downloaded successfully");
    } catch (error) {
      console.error("Template error:", error);
      toast.error("Failed to generate template");
    }
  }, []);

  // File reader
  const readFile = useCallback(async (file: File): Promise<CsvRow[]> => {
    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new Error("No worksheet found in file");
      }

      const rows: any[][] = [];
      worksheet.eachRow((row) => {
        const rowValues = row.values as any[];
        rows.push(rowValues.slice(1));
      });

      let headerRowIndex = -1;
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

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < EXPECTED_HEADERS.length) continue;

        const isHeaderRow = EXPECTED_HEADERS.every((header, index) => {
          const cellValue =
            typeof row[index] === "string"
              ? row[index].trim().toLowerCase()
              : "";
          return cellValue === header.toLowerCase();
        });

        if (isHeaderRow) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) {
        throw new Error(
          "Could not find header row. Please use the template format."
        );
      }

      const dataRows = rows.slice(headerRowIndex + 1).filter((row) => {
        return (
          row &&
          row.some(
            (cell) =>
              cell !== null && cell !== undefined && String(cell).trim() !== ""
          )
        );
      });

      const formattedData: CsvRow[] = dataRows
        .map((row) => {
          const rowData: any = {};
          EXPECTED_HEADERS.forEach((header, index) => {
            const value = row[index];
            rowData[header] =
              value !== null && value !== undefined ? String(value).trim() : "";
          });
          return rowData as CsvRow;
        })
        .filter((row) => {
          return EXPECTED_HEADERS.every(
            (field) => row[field] && row[field].trim() !== ""
          );
        });

      if (formattedData.length === 0) {
        throw new Error(
          "No valid data rows found. Please ensure all required fields are filled."
        );
      }

      return formattedData;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "Error reading file. Please ensure it is a valid Excel file."
      );
    }
  }, []);

  const handleFilePreview = useCallback(
    async (file: File) => {
      try {
        const data = await readFile(file);
        if (data.length > 0) {
          setPreviewData(data.slice(0, MAX_PREVIEW_ROWS));
          setIsValidFile(true);
          toast.success("File loaded successfully");
        } else {
          setIsValidFile(false);
          setPreviewData([]);
          toast.error("No valid data found in file");
        }
      } catch (error) {
        setIsValidFile(false);
        setPreviewData([]);
        toast.error(
          error instanceof Error ? error.message : "Error reading file"
        );
      }
    },
    [readFile]
  );

  const validateFile = useCallback((file: File): boolean => {
    const extension = file.name.toLowerCase().split(".").pop();
    const validExtensions = ["xlsx", "xls", "csv"];

    if (!validExtensions.includes(extension || "")) {
      toast.error(
        "Invalid file type. Please upload an Excel (.xlsx, .xls) or CSV file."
      );
      return false;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File size too large. Maximum size is 5MB.");
      return false;
    }

    return true;
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        if (validateFile(file)) {
          setSelectedFile(file);
          handleFilePreview(file);
        } else {
          setSelectedFile(null);
          setPreviewData([]);
          setIsValidFile(false);
        }
      }
    },
    [validateFile, handleFilePreview]
  );

  const handleImport = useCallback(async () => {
    if (!selectedFile || !isValidFile || previewData.length === 0) {
      if (!selectedFile) toast.error("Please select a file first.");
      else if (!isValidFile) toast.error("Selected file is not valid.");
      else if (previewData.length === 0)
        toast.error("No valid data rows found in the file preview.");
      return;
    }

    try {
      // Check for duplicate courses BEFORE preparing import
      const duplicates: string[] = [];
      const validCourses: any[] = [];

      for (const row of previewData) {
        const code = row["Course Code"]?.trim().toUpperCase();
        const section = row["Section"]?.trim().toUpperCase() || "A";
        const academicYear =
          row["Academic Year"]?.trim() || new Date().getFullYear().toString();
        const semester = row["Semester"]?.trim() || "1st Semester";

        // Check if course already exists in database
        const response = await axiosInstance.get("/courses");
        const existingCourses = response.data.courses || [];

        const isDuplicate = existingCourses.some(
          (c: any) =>
            c.code === code &&
            c.section === section &&
            c.academicYear === academicYear &&
            c.semester === semester
        );

        if (isDuplicate) {
          duplicates.push(`${code}-${section} (${academicYear} ${semester})`);
        } else {
          validCourses.push(row);
        }
      }

      // If there are duplicates, show error
      if (duplicates.length > 0) {
        toast.error(
          `${duplicates.length} course(s) already exist: ${duplicates.join(
            ", "
          )}`,
          { duration: 6000 }
        );

        // If ALL courses are duplicates, stop here
        if (validCourses.length === 0) {
          toast.error("All courses already exist. Nothing to import.");
          return;
        }

        // Ask user if they want to continue with non-duplicate courses
        const shouldContinue = confirm(
          `${duplicates.length} duplicate course(s) found. Do you want to continue importing the ${validCourses.length} valid course(s)?`
        );

        if (!shouldContinue) {
          return;
        }
      }

      // Prepare courses for schedule assignment (NO database import yet)
      const coursesToImport = validCourses.map((row, index) => ({
        tempId: `temp-${index}`,
        code: row["Course Code"],
        title: row["Course Title"],
        section: row["Section"],
        room: row["Room"],
        semester: row["Semester"],
        academicYear: row["Academic Year"],
        classNumber: row["Class Number"],
        status: row["Status"],
      }));

      // Close import preview
      setShowImportPreview(false);

      // Set courses for schedule assignment
      setImportedCoursesForSchedule(coursesToImport);

      // Show info message
      toast.success(
        `${coursesToImport.length} courses ready. Add schedules to complete import.`,
        { duration: 4000 }
      );

      // Open schedule assignment dialog
      setTimeout(() => {
        setShowScheduleAssignment(true);
      }, 500);
    } catch (error: any) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to prepare courses for import";

      console.error("Import preparation error:", error);
      toast.error(errorMessage);
    }
  }, [selectedFile, isValidFile, previewData]);

  const handleScheduleAssignmentComplete = useCallback(async () => {
    toast.success("All courses have been created with schedules!");

    // Show loading state
    setIsRefreshing(true);

    // Small delay for visual feedback
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Refresh table data
    await refreshTableData(false);
    if (onCourseAdded) onCourseAdded();

    // Reset all state
    setImportedCoursesForSchedule([]);
    setShowScheduleAssignment(false);
    setSelectedFile(null);
    setPreviewData([]);
    setIsValidFile(false);

    // Also reset import status
    setShowImportStatus(false);
    setImportStatus(null);
  }, [refreshTableData, onCourseAdded]);
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm min-h-[840px] max-h-[840px] mt-5">
      <h1 className="text-2xl sm:text-3xl font-bold text-[#124A69] mb-5">
        Course Management Dashboard
      </h1>

      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex">
            {/* Faculty Filter - Only for Academic Head */}
            <div className="pr-5">
              {permissions.canFilterByFaculty && (
                <FacultyFilter
                  faculties={faculties}
                  selectedFacultyId={facultyFilter}
                  onChange={setFacultyFilter}
                  currentUserId={userId}
                />
              )}
            </div>
            <div className="relative w-full sm:w-[400px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search courses by code, title, or section..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSettingsDialog(true)}
              className="gap-2"
            >
              <Settings2 className="h-4 w-4" />
              Settings
            </Button>
            {permissions.canExportData && (
              <Button
                variant="outline"
                onClick={() => setShowExportPreview(true)}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            )}
            {permissions.canImportCourses && (
              <Button
                variant="outline"
                onClick={() => setShowImportPreview(true)}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Import
              </Button>
            )}
            {permissions.canCreateCourse && (
              <CourseSheet
                mode="add"
                onSuccess={async (courseData) => {
                  // Store course data and open schedule dialog
                  // Course is NOT created yet - waiting for schedules
                  if (courseData) {
                    setPendingCourseData(courseData);
                    setImportedCoursesForSchedule([courseData]);
                    setScheduleDialogMode("create");
                    setShowScheduleAssignment(true);
                  }
                }}
                faculties={faculties}
                userId={userId}
                userRole={userRole}
              />
            )}
          </div>
        </div>

        <div className="flex gap-2 border-b">
          <button
            onClick={() => setStatusFilter("ALL")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === "ALL"
                ? "text-[#124A69] border-b-2 border-[#124A69]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            All Courses ({filteredCourses.length})
          </button>

          <button
            onClick={() => setStatusFilter("ACTIVE")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === "ACTIVE"
                ? "text-[#124A69] border-b-2 border-[#124A69]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Active ({tableData.filter((c) => c.status === "ACTIVE").length})
          </button>

          <button
            onClick={() => setStatusFilter("INACTIVE")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === "INACTIVE"
                ? "text-[#124A69] border-b-2 border-[#124A69]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Inactive ({tableData.filter((c) => c.status === "INACTIVE").length})
          </button>

          <button
            onClick={() => setStatusFilter("ARCHIVED")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === "ARCHIVED"
                ? "text-[#124A69] border-b-2 border-[#124A69]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Archived ({tableData.filter((c) => c.status === "ARCHIVED").length})
          </button>
        </div>

        {isRefreshing ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#124A69]" />
          </div>
        ) : filteredCourses.length > 0 ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6 min-h-[555px]">
              {paginatedCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  onEdit={handleEditCourse}
                  onAddSchedule={handleAddSchedule}
                  onViewDetails={handleViewDetails}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex -mt-3 items-center justify-between w-full">
                <span className="text-sm text-gray-600 w-[1100%]">
                  {Math.min(
                    (currentPage - 1) * ITEMS_PER_PAGE + 1,
                    filteredCourses.length
                  )}
                  –
                  {Math.min(
                    currentPage * ITEMS_PER_PAGE,
                    filteredCourses.length
                  )}{" "}
                  of {filteredCourses.length} courses
                </span>

                <Pagination>
                  <PaginationContent className="flex gap-1">
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() =>
                          currentPage > 1 && handlePageChange(currentPage - 1)
                        }
                        className={
                          currentPage === 1
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>

                    {Array.from({ length: totalPages })
                      .map((_, i) => i + 1)
                      .filter((page) => {
                        return (
                          page === 1 ||
                          page === totalPages ||
                          Math.abs(page - currentPage) <= 1
                        );
                      })
                      .reduce((acc: (number | string)[], page, index, arr) => {
                        if (index > 0) {
                          const prevPage = arr[index - 1] as number;
                          if ((page as number) - prevPage > 1) acc.push("…");
                        }
                        acc.push(page);
                        return acc;
                      }, [])
                      .map((item, i) => (
                        <PaginationItem key={i}>
                          {item === "…" ? (
                            <span className="px-2 text-gray-500 select-none">
                              …
                            </span>
                          ) : (
                            <PaginationLink
                              onClick={() => handlePageChange(item as number)}
                              isActive={currentPage === item}
                              className={`hidden xs:inline-flex ${
                                currentPage === item
                                  ? "bg-[#124A69] text-white hover:bg-[#0d3a56]"
                                  : ""
                              }`}
                            >
                              {item}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() =>
                          currentPage < totalPages &&
                          handlePageChange(currentPage + 1)
                        }
                        className={
                          currentPage === totalPages
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <BookOpen className="w-12 h-12 text-gray-400 mb-3" />
            <p className="text-gray-600 font-medium">No courses found</p>
            <p className="text-sm text-gray-500 mt-1">
              {searchQuery
                ? "Try adjusting your search"
                : "Get started by adding a new course"}
            </p>
          </div>
        )}

        {/* Export Dialog */}
        <ExportDialog
          open={showExportPreview}
          onOpenChange={setShowExportPreview}
          courses={filteredCourses}
          onExport={handleExport}
        />

        {/* Import Dialog */}
        <ImportDialog
          open={showImportPreview}
          onOpenChange={(open) => {
            setShowImportPreview(open);
            if (!open) {
              setSelectedFile(null);
              setPreviewData([]);
              setIsValidFile(false);
              setImportProgress(null);
            }
          }}
          previewData={previewData}
          selectedFile={selectedFile}
          isValidFile={isValidFile}
          onFileChange={handleFileChange}
          onImport={handleImport}
          onDownloadTemplate={handleImportTemplate}
          importProgress={importProgress}
        />

        {/* Import Status Dialog */}
        <ImportStatusDialog
          open={showImportStatus}
          onOpenChange={setShowImportStatus}
          importStatus={importStatus}
          importProgress={importProgress}
          onClose={() => {
            setShowImportStatus(false);
            setImportProgress(null);
          }}
          onImportMore={() => {
            setShowImportStatus(false);
            setShowImportPreview(true);
          }}
        />

        {/* Schedule Assignment Dialog */}
        <ScheduleAssignmentDialog
          open={showScheduleAssignment}
          onOpenChange={(open) => {
            setShowScheduleAssignment(open);
            if (!open) {
              handleScheduleAssignmentComplete();
              setPendingCourseData(null);
            }
          }}
          courses={
            scheduleDialogMode === "create"
              ? [pendingCourseData]
              : importedCoursesForSchedule
          }
          onComplete={handleScheduleAssignmentComplete}
          mode={scheduleDialogMode}
        />

        <CourseSettingsDialog
          open={showSettingsDialog}
          onOpenChange={setShowSettingsDialog}
          courses={filterArchivableCourses(tableData, userId)}
          onArchiveCourses={handleArchiveCourses}
          onUnarchiveCourses={handleUnarchiveCourses}
          userId={userId}
          userRole={userRole}
        />

        {/* Edit Course Sheet */}
        {editingCourse && (
          <CourseSheet
            mode="edit"
            course={editingCourse}
            onSuccess={() => {
              refreshTableData(true);
              setEditingCourse(null);
            }}
            faculties={faculties}
            userId={userId}
            userRole={userRole}
            open={!!editingCourse}
            onOpenChange={(open) => !open && setEditingCourse(null)}
          />
        )}
      </div>
    </div>
  );
}
