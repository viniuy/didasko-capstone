"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimePicker } from "@/components/ui/time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Archive,
  Filter,
  X,
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
import { useRouter } from "next/navigation";
import { coursesService, usersService } from "@/lib/services/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import axiosInstance from "@/lib/axios";

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

const MAX_PREVIEW_ROWS = 100;

// Hook to get responsive items per page based on screen size
const useItemsPerPage = () => {
  const [itemsPerPage, setItemsPerPage] = useState(8);

  useEffect(() => {
    const updateItemsPerPage = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      // If both height and width are very low, show only 1 item
      if (width < 640 && height < 820) {
        setItemsPerPage(1);
        return;
      }

      // Determine items per page based on width first
      let items = 4; // default for large desktop
      if (width < 640) {
        items = 1;
      } else if (width < 1280) {
        items = 2;
      } else if (width < 1524) {
        items = 3;
      } else {
        items = 4;
      }

      // Apply height restriction only if it would reduce items (not increase)
      // On large screens (width >= 1524), only restrict if height is very small
      if (width >= 1520) {
        // Large desktop: only restrict if height is below 600px
        if (height < 600) {
          setItemsPerPage(4);
        } else {
          setItemsPerPage(items);
        }
      } else {
        // For smaller screens, apply height restriction more strictly
        if (height < 960) {
          setItemsPerPage(2);
        } else {
          setItemsPerPage(items);
        }
      }
    };

    // Set initial value
    updateItemsPerPage();

    // Update on resize
    window.addEventListener("resize", updateItemsPerPage);
    return () => window.removeEventListener("resize", updateItemsPerPage);
  }, []);

  return itemsPerPage;
};
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
    <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg shadow-sm min-h-[590px] sm:min-h-[700px] md:min-h-[840px] max-h-[840px] mt-2 sm:mt-3 md:mt-5">
      <div className="flex flex-col items-center gap-3 sm:gap-4 mt-20 sm:mt-32 md:mt-40 px-4">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#124A69] animate-pulse text-center">
          Loading Courses...
        </h2>
        <p
          className="text-sm sm:text-base md:text-lg text-gray-600 animate-pulse text-center"
          style={{ animationDelay: "150ms" }}
        >
          Please sit tight while we are getting things ready for you...
        </p>
        <div className="flex gap-2 mt-3 sm:mt-4">
          <div className="w-2 h-2 sm:w-3 sm:h-3 bg-[#124A69] rounded-full animate-bounce"></div>
          <div
            className="w-2 h-2 sm:w-3 sm:h-3 bg-[#124A69] rounded-full animate-bounce"
            style={{ animationDelay: "150ms" }}
          ></div>
          <div
            className="w-2 h-2 sm:w-3 sm:h-3 bg-[#124A69] rounded-full animate-bounce"
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
  onNavigate,
}: {
  course: Course;
  onEdit: (course: Course) => void;
  onAddSchedule: (course: Course) => void;
  onViewDetails: (course: Course) => void;
  onNavigate?: (slug: string) => void;
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
    <div className="group relative w-auto h-auto min-h-[240px] sm:h-[250px] md:h-[270px] bg-white rounded-lg border-2 border-[#124A69]/30 p-2 sm:p-3 hover:border-[#124A69] hover:shadow-xl transition-all duration-300 ease-in-out text-[#124A69] transform hover:scale-105 hover:-translate-y-1 will-change-transform overflow-hidden">
      {/* Status Stripe - Diagonal top right (backward slash) */}
      <div
        className={`absolute top-0 right-0 w-24 h-1.5 ${
          course.status === "ARCHIVED"
            ? "bg-red-500"
            : course.status === "ACTIVE"
            ? "bg-[#124A69]"
            : "bg-gray-400"
        }`}
        style={{
          transform: "rotate(45deg)",
          transformOrigin: "top right",
          marginTop: "24px",
          marginRight: "-20px",
        }}
      />
      {/* More Options Menu */}
      <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 sm:h-9 sm:w-9 p-0 hover:bg-gray-100 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
            >
              <MoreVertical className="h-4 w-4 sm:h-5 sm:w-5" />
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

      {/* Card Content - Clickable */}
      <div
        onClick={() => {
          if (onNavigate) {
            onNavigate(course.slug);
          } else {
            router.push(`/main/course/${course.slug}`);
          }
        }}
        className="cursor-pointer h-full"
      >
        <div className="mb-2 sm:mb-3 md:mb-4">
          <h3 className="text-base sm:text-lg font-bold group-hover:text-[#0C3246] transition-colors">
            {course.code} - {course.section}
          </h3>
          <p className="text-[10px] sm:text-xs opacity-80 mt-0.5 sm:mt-1 line-clamp-2">
            {course.title}
          </p>
        </div>

        <div className="flex items-center mb-2 sm:mb-3 md:mb-4 opacity-80">
          <Calendar className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
          <span className="text-[10px] sm:text-xs font-medium ml-1 sm:ml-2 truncate">
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

        <div className="flex justify-between items-center mb-2 sm:mb-3 md:mb-4 opacity-80 text-gray-700 gap-2">
          <div className="flex items-center min-w-0 flex-1">
            <CircleUserRound className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <span
              className="text-[10px] sm:text-xs font-medium ml-1 sm:ml-2 truncate max-w-[120px] sm:max-w-[150px]"
              title={course.faculty?.name || "No Instructor"}
            >
              {course.faculty?.name || "No Instructor"}
            </span>
          </div>

          <div className="flex items-center flex-shrink-0">
            <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[10px] sm:text-xs font-medium ml-1 sm:ml-2">
              {course._count?.students || 0}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-4 sm:pt-5 md:pt-7">
          <div className="rounded-lg p-2 sm:p-3 bg-[#124A69] text-white border border-[#124A69] shadow-sm">
            <div className="flex items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1 text-[10px] sm:text-xs">
              <span>Passing Rate</span>
            </div>
            <p className="text-lg sm:text-xl font-bold">{passingRate}%</p>
          </div>
          <div className="rounded-lg p-2 sm:p-3 bg-[#124A69] text-white border border-[#124A69] shadow-sm">
            <div className="flex items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1 text-[10px] sm:text-xs">
              <GraduationCap className="w-3 h-3" />
              <span>Attendance</span>
            </div>
            <p className="text-lg sm:text-xl font-bold">{attendanceRate}%</p>
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

  // Responsive items per page
  const itemsPerPage = useItemsPerPage();

  // State
  const [tableData, setTableData] = useState<Course[]>(initialCourses);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CourseStatus | "ALL">("ALL");
  const [facultyFilter, setFacultyFilter] = useState<string[]>([userId]);
  const [dayFilter, setDayFilter] = useState<string>("ALL");
  const [roomFilter, setRoomFilter] = useState<string>("");
  const [startTimeFilter, setStartTimeFilter] = useState<string>("");
  const [endTimeFilter, setEndTimeFilter] = useState<string>("");
  const [attendanceRateSort, setAttendanceRateSort] = useState<
    "asc" | "desc" | "none"
  >("none");
  const [passingRateSort, setPassingRateSort] = useState<
    "asc" | "desc" | "none"
  >("none");
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const router = useRouter();
  const [tempFacultyFilter, setTempFacultyFilter] = useState<string[]>([
    userId,
  ]);
  const [tempDayFilter, setTempDayFilter] = useState<string>("ALL");
  const [tempRoomFilter, setTempRoomFilter] = useState<string>("");
  const [tempStartTimeFilter, setTempStartTimeFilter] = useState<string>("");
  const [tempEndTimeFilter, setTempEndTimeFilter] = useState<string>("");
  const [tempAttendanceRateSort, setTempAttendanceRateSort] = useState<
    "asc" | "desc" | "none"
  >("none");
  const [tempPassingRateSort, setTempPassingRateSort] = useState<
    "asc" | "desc" | "none"
  >("none");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
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
        setIsLoading(true);

        // Batch all API calls together
        const [facultyResponse, coursesWithStats] = await Promise.all([
          // Fetch faculty
          usersService.getFaculty().catch((error) => {
            console.error("Error fetching faculty:", error);
            return [];
          }),
          // Fetch stats for all courses in parallel
          initialCourses.length > 0
            ? Promise.all(
                initialCourses.map(async (course) => {
                  try {
                    const stats = await coursesService.getStats(course.slug);
                    return {
                      ...course,
                      stats,
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
              )
            : Promise.resolve([]),
        ]);

        if (Array.isArray(facultyResponse)) {
          // Filter to only FACULTY role (exclude ACADEMIC_HEAD if needed)
          const facultyOnly = facultyResponse.filter(
            (user: any) => user.role === "FACULTY"
          );
          setFaculties(facultyOnly);
        }

        if (coursesWithStats.length > 0) {
          setTableData(coursesWithStats);
        }
      } catch (error) {
        console.error("Error loading initial data:", error);
        toast.error("Failed to load some data");
      } finally {
        setIsInitialLoading(false);
        setIsLoading(false);
      }
    };

    loadAllData();
  }, [initialCourses]);

  const refreshTableData = useCallback(async (skipStats = false) => {
    try {
      setIsRefreshing(true);
      setIsLoading(true);
      const data = await coursesService.getCourses();

      if (data && Array.isArray(data)) {
        const courses = data;
        if (skipStats) {
          // Just update the courses without fetching stats - preserve existing stats
          setTableData((prevData) =>
            courses.map((newCourse: Course) => {
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
            courses.map(async (course: Course) => {
              try {
                const stats = await coursesService.getStats(course.slug);
                return {
                  ...course,
                  stats,
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

  // Filter courses based on role and faculty (without search/status filters)
  const baseFilteredCourses = useMemo(() => {
    // For Academic Head with multiple faculty selection
    if (userRole === "ACADEMIC_HEAD") {
      if (facultyFilter.length === 0) {
        return [];
      }
      // If all faculties are selected (or "ALL" equivalent), show all courses
      const allFacultyIds = [userId, ...faculties.map((f) => f.id)];
      if (facultyFilter.length === allFacultyIds.length) {
        return tableData;
      }
      // Filter by selected faculty IDs
      return tableData.filter(
        (course) => course.facultyId && facultyFilter.includes(course.facultyId)
      );
    }
    // For Faculty, use the original function (single user)
    return filterCoursesByRole(
      tableData,
      userRole,
      userId,
      facultyFilter[0] || userId
    );
  }, [tableData, userRole, userId, facultyFilter, faculties]);

  // Helper function to convert time string to minutes for comparison
  // Handles both "HH:MM" (24-hour) and "HH:MM AM/PM" (12-hour) formats
  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;

    // Check if it's in "HH:MM AM/PM" format
    if (timeStr.includes("AM") || timeStr.includes("PM")) {
      const [time, period] = timeStr.split(" ");
      const [hours, minutes] = time.split(":").map(Number);
      let hour24 = hours;

      if (period === "PM" && hours !== 12) {
        hour24 = hours + 12;
      } else if (period === "AM" && hours === 12) {
        hour24 = 0;
      }

      return hour24 * 60 + (minutes || 0);
    }

    // Handle "HH:MM" format (24-hour)
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + (minutes || 0);
  };

  // Filter courses based on role and filters
  const filteredCourses = useMemo(() => {
    // Apply search and status filters to base filtered courses
    return baseFilteredCourses
      .filter((course) => {
        const matchesSearch =
          course.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          course.section.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus =
          statusFilter === "ALL" || course.status === statusFilter;

        // Filter by day
        const matchesDay =
          dayFilter === "ALL" ||
          (course.schedules &&
            course.schedules.some((s: { day: string }) => s.day === dayFilter));

        // Filter by room
        const matchesRoom =
          !roomFilter ||
          course.room.toLowerCase().includes(roomFilter.toLowerCase());

        // Filter by start time - show courses that start at the exact selected time
        const matchesStartTime =
          !startTimeFilter ||
          (course.schedules &&
            course.schedules.some((s: { fromTime: string }) => {
              const courseStart = timeToMinutes(s.fromTime);
              const filterStart = timeToMinutes(startTimeFilter);
              return courseStart === filterStart;
            }));

        // Filter by end time - show courses that end at the exact selected time
        const matchesEndTime =
          !endTimeFilter ||
          (course.schedules &&
            course.schedules.some((s: { toTime: string }) => {
              const courseEnd = timeToMinutes(s.toTime);
              const filterEnd = timeToMinutes(endTimeFilter);
              return courseEnd === filterEnd;
            }));

        return (
          matchesSearch &&
          matchesStatus &&
          matchesDay &&
          matchesRoom &&
          matchesStartTime &&
          matchesEndTime
        );
      })
      .sort((a, b) => {
        // Sort by attendance rate if sort is enabled
        if (attendanceRateSort !== "none") {
          const aRate = a.stats?.attendanceRate ?? 0;
          const bRate = b.stats?.attendanceRate ?? 0;
          if (aRate !== bRate) {
            return attendanceRateSort === "asc" ? aRate - bRate : bRate - aRate;
          }
        }
        // Sort by passing rate if sort is enabled (and attendance rate is equal or not sorted)
        if (passingRateSort !== "none") {
          const aRate = a.stats?.passingRate ?? 0;
          const bRate = b.stats?.passingRate ?? 0;
          if (aRate !== bRate) {
            return passingRateSort === "asc" ? aRate - bRate : bRate - aRate;
          }
        }
        return 0;
      });
  }, [
    baseFilteredCourses,
    searchQuery,
    statusFilter,
    dayFilter,
    startTimeFilter,
    endTimeFilter,
    attendanceRateSort,
    passingRateSort,
  ]);

  const totalPages = Math.ceil(filteredCourses.length / itemsPerPage);

  const paginatedCourses = filteredCourses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to page 1 when itemsPerPage changes
  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

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
      setIsLoading(true);
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

      setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnarchiveCourses = async (courseIds: string[]) => {
    try {
      setIsLoading(true);
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
    } finally {
      setIsLoading(false);
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
            (field) => (row as any)[field] && (row as any)[field].trim() !== ""
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
      setIsLoading(true);
      // Check for duplicate courses BEFORE preparing import
      const duplicates: string[] = [];
      const validCourses: any[] = [];

      // Fetch existing courses once instead of in a loop
      const existingCoursesResponse = await coursesService.getCourses();
      const existingCourses = Array.isArray(existingCoursesResponse)
        ? existingCoursesResponse
        : existingCoursesResponse.courses || [];

      for (const row of previewData) {
        const code = row["Course Code"]?.trim().toUpperCase();
        const section = row["Section"]?.trim().toUpperCase() || "A";
        const academicYear =
          row["Academic Year"]?.trim() || new Date().getFullYear().toString();
        const semester = row["Semester"]?.trim() || "1st Semester";

        // Check if course already exists in database
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
    } finally {
      setIsLoading(false);
    }
  }, [selectedFile, isValidFile, previewData]);

  const handleScheduleAssignmentComplete = useCallback(async () => {
    // Only show success message for create/import modes, not for edit mode
    // Edit mode already shows its own success message in the dialog
    if (scheduleDialogMode === "create" || scheduleDialogMode === "import") {
      toast.success("All courses have been created with schedules!");
    }

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
  }, [refreshTableData, onCourseAdded, scheduleDialogMode]);

  // Handle filter apply
  const handleApplyFilters = () => {
    setFacultyFilter(tempFacultyFilter);
    setDayFilter(tempDayFilter);
    setRoomFilter(tempRoomFilter);
    setStartTimeFilter(tempStartTimeFilter);
    setEndTimeFilter(tempEndTimeFilter);
    setAttendanceRateSort(tempAttendanceRateSort);
    setPassingRateSort(tempPassingRateSort);
    setIsFilterSheetOpen(false);
  };

  // Reset temp filters when sheet opens
  const handleFilterSheetOpen = (open: boolean) => {
    setIsFilterSheetOpen(open);
    if (open) {
      setTempFacultyFilter(facultyFilter);
      setTempDayFilter(dayFilter);
      setTempRoomFilter(roomFilter);
      setTempStartTimeFilter(startTimeFilter);
      setTempEndTimeFilter(endTimeFilter);
      setTempAttendanceRateSort(attendanceRateSort);
      setTempPassingRateSort(passingRateSort);
    }
  };

  // Check if filters are active and count them
  const getActiveFilterCount = () => {
    let count = 0;
    if (
      facultyFilter.length > 0 &&
      (facultyFilter.length !== 1 || facultyFilter[0] !== userId)
    ) {
      count++;
    }
    if (dayFilter !== "ALL") count++;
    if (roomFilter !== "") count++;
    if (startTimeFilter !== "") count++;
    if (endTimeFilter !== "") count++;
    if (attendanceRateSort !== "none") count++;
    if (passingRateSort !== "none") count++;
    return count;
  };

  const hasActiveFilters = getActiveFilterCount() > 0;
  const activeFilterCount = getActiveFilterCount();

  // Handle course navigation with fade out
  const handleCourseNavigate = (slug: string) => {
    setIsRedirecting(true);
    setTimeout(() => {
      router.push(`/main/course/${slug}`);
    }, 300);
  };

  // Get empty state message based on active filters
  const getEmptyStateMessage = () => {
    const activeFilters: string[] = [];

    // Check faculty filter
    const isFacultyFilterActive =
      facultyFilter.length > 0 &&
      (facultyFilter.length !== 1 || facultyFilter[0] !== userId);
    if (isFacultyFilterActive) {
      const selectedFacultyNames = facultyFilter
        .map((id) => {
          if (id === userId) {
            return "My Courses";
          }
          const faculty = faculties.find((f) => f.id === id);
          return faculty?.name || "Unknown";
        })
        .filter(Boolean);

      if (selectedFacultyNames.length === 1) {
        activeFilters.push(`for ${selectedFacultyNames[0]}`);
      } else if (selectedFacultyNames.length > 1) {
        activeFilters.push(
          `for ${selectedFacultyNames.length} selected faculty`
        );
      }
    }

    // Check status filter
    if (statusFilter !== "ALL") {
      activeFilters.push(`with status "${statusFilter}"`);
    }

    // Check day filter
    if (dayFilter !== "ALL") {
      activeFilters.push(`on ${dayFilter}`);
    }

    // Check room filter
    if (roomFilter) {
      activeFilters.push(`in room "${roomFilter}"`);
    }

    // Check start time filter
    if (startTimeFilter) {
      activeFilters.push(`starting from ${startTimeFilter}`);
    }

    // Check end time filter
    if (endTimeFilter) {
      activeFilters.push(`ending by ${endTimeFilter}`);
    }

    // Check search query
    if (searchQuery) {
      activeFilters.push(`matching "${searchQuery}"`);
    }

    if (activeFilters.length > 0) {
      return `No courses found ${activeFilters.join(", ")}`;
    }

    return "No courses found";
  };

  const getEmptyStateSubMessage = () => {
    const suggestions: string[] = [];

    // Check faculty filter
    const isFacultyFilterActive =
      facultyFilter.length > 0 &&
      (facultyFilter.length !== 1 || facultyFilter[0] !== userId);
    if (isFacultyFilterActive) {
      suggestions.push("try selecting different faculty");
    }

    // Check other filters
    if (dayFilter !== "ALL") {
      suggestions.push("try a different day");
    }
    if (roomFilter) {
      suggestions.push("try a different room");
    }
    if (startTimeFilter || endTimeFilter) {
      suggestions.push("adjust time filters");
    }
    if (statusFilter !== "ALL") {
      suggestions.push("try a different status");
    }
    if (searchQuery) {
      suggestions.push("adjust your search");
    }

    if (suggestions.length > 0) {
      return `Try ${suggestions.join(" or ")}`;
    }

    return "Get started by adding a new course";
  };

  return (
    <div
      className={`flex flex-col flex-grow transition-opacity duration-300 ${
        isRedirecting ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg shadow-sm min-h-[400px] sm:min-h-[500px] md:min-h-[590px] overflow-x-visible">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#124A69] mb-3 sm:mb-4 md:mb-5">
          Course Management Dashboard
        </h1>

        <div className="space-y-4 sm:space-y-5 md:space-y-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
              {/* Search Bar */}
              <div className="relative w-[300px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 sm:h-9 text-sm sm:text-base "
                />
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-start sm:justify-end">
                {/* Filter Button */}
                <Button
                  variant="outline"
                  onClick={() => setIsFilterSheetOpen(true)}
                  className="gap-1 xl:gap-2 text-xs xl:text-sm px-2 xl:px-3 py-2 min-h-[44px] sm:min-h-0 relative"
                >
                  <Filter className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden xl:inline">Filter</span>
                  {hasActiveFilters && (
                    <>
                      <span className="absolute -top-1 -right-1 bg-[#124A69] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center 2xl:hidden">
                        {activeFilterCount > 3 ? "3" : activeFilterCount}
                      </span>
                      <span className="absolute -top-1 -right-1 bg-[#124A69] text-white text-xs rounded-full w-5 h-5 items-center justify-center hidden 2xl:flex">
                        {activeFilterCount}
                      </span>
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSettingsDialog(true)}
                  className="gap-1 xl:gap-2 text-xs xl:text-sm px-2 xl:px-3 py-2 min-h-[44px] sm:min-h-0"
                >
                  <Archive className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden xl:inline">Archive</span>
                </Button>
                {permissions.canExportData && (
                  <Button
                    variant="outline"
                    onClick={() => setShowExportPreview(true)}
                    className="gap-1 xl:gap-2 text-xs xl:text-sm px-2 xl:px-3 py-2 min-h-[44px] sm:min-h-0"
                  >
                    <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden xl:inline">Export</span>
                  </Button>
                )}
                {permissions.canImportCourses && (
                  <Button
                    variant="outline"
                    onClick={() => setShowImportPreview(true)}
                    className="gap-1 xl:gap-2 text-xs xl:text-sm px-2 xl:px-3 py-2 min-h-[44px] sm:min-h-0"
                  >
                    <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden xl:inline">Import</span>
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
          </div>

          <div className="flex gap-1 sm:gap-2 border-b overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap min-h-[44px] sm:min-h-0 ${
                statusFilter === "ALL"
                  ? "text-[#124A69] border-b-2 border-[#124A69]"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              All ({baseFilteredCourses.length})
            </button>

            <button
              onClick={() => setStatusFilter("ACTIVE")}
              className={`px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap min-h-[44px] sm:min-h-0 ${
                statusFilter === "ACTIVE"
                  ? "text-[#124A69] border-b-2 border-[#124A69]"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Active (
              {baseFilteredCourses.filter((c) => c.status === "ACTIVE").length})
            </button>

            <button
              onClick={() => setStatusFilter("ARCHIVED")}
              className={`px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap min-h-[44px] sm:min-h-0 ${
                statusFilter === "ARCHIVED"
                  ? "text-[#124A69] border-b-2 border-[#124A69]"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Archived (
              {
                baseFilteredCourses.filter((c) => c.status === "ARCHIVED")
                  .length
              }
              )
            </button>
          </div>

          {isInitialLoading || isLoading ? (
            <LoadingSpinner />
          ) : isRefreshing ? (
            <div className="flex justify-center items-center h-48 sm:h-64">
              <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-[#124A69]" />
            </div>
          ) : filteredCourses.length > 0 ? (
            <div className="space-y-4 sm:space-y-6 md:space-y-8 overflow-visible">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5 md:gap-6 overflow-visible p-2">
                {paginatedCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    onEdit={handleEditCourse}
                    onAddSchedule={handleAddSchedule}
                    onViewDetails={handleViewDetails}
                    onNavigate={handleCourseNavigate}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row -mt-2 sm:-mt-3 items-center justify-between w-full gap-3 sm:gap-0">
                  <span className="text-xs sm:text-sm text-gray-600 text-center sm:text-left w-[300px]">
                    Showing{" "}
                    {Math.min(
                      (currentPage - 1) * itemsPerPage + 1,
                      filteredCourses.length
                    )}
                    –
                    {Math.min(
                      currentPage * itemsPerPage,
                      filteredCourses.length
                    )}{" "}
                    of {filteredCourses.length} courses
                  </span>

                  <Pagination className="justify-end">
                    <PaginationContent className="flex gap-1">
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() =>
                            currentPage > 1 && handlePageChange(currentPage - 1)
                          }
                          className={`min-h-[44px] sm:min-h-0 ${
                            currentPage === 1
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }`}
                        />
                      </PaginationItem>

                      {(() => {
                        const pages: number[] = [];

                        // If total pages is 5 or less, show all pages
                        if (totalPages <= 5) {
                          for (let i = 1; i <= totalPages; i++) {
                            pages.push(i);
                          }
                        } else {
                          // Always show first 2 pages
                          pages.push(1, 2);

                          // Determine which pages to show around current
                          const showAroundCurrent: number[] = [];
                          if (currentPage > 2 && currentPage < totalPages - 1) {
                            // Show current-1, current, current+1 if in middle
                            showAroundCurrent.push(
                              currentPage - 1,
                              currentPage,
                              currentPage + 1
                            );
                          } else if (currentPage <= 2) {
                            // If current is 1 or 2, show 3, 4
                            showAroundCurrent.push(3, 4);
                          } else if (currentPage >= totalPages - 1) {
                            // If current is near end, show last-3, last-2, last-1
                            showAroundCurrent.push(
                              totalPages - 3,
                              totalPages - 2,
                              totalPages - 1
                            );
                          }

                          // Remove duplicates and sort
                          const uniquePages = Array.from(
                            new Set([
                              ...pages,
                              ...showAroundCurrent,
                              totalPages,
                            ])
                          ).sort((a, b) => a - b) as number[];

                          // Build final array with ellipsis
                          const finalPages: (number | string)[] = [];
                          for (let i = 0; i < uniquePages.length; i++) {
                            const page = uniquePages[i];
                            if (i > 0 && page - uniquePages[i - 1] > 1) {
                              finalPages.push("…");
                            }
                            finalPages.push(page);
                          }

                          return finalPages;
                        }

                        return pages;
                      })().map((item, i) => (
                        <PaginationItem key={i}>
                          {item === "…" ? (
                            <span className="px-2 text-gray-500 select-none text-xs sm:text-sm">
                              …
                            </span>
                          ) : (
                            <PaginationLink
                              onClick={() => handlePageChange(item as number)}
                              isActive={currentPage === item}
                              className={`hidden sm:inline-flex min-h-[44px] sm:min-h-0 ${
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
                          className={`min-h-[44px] sm:min-h-0 ${
                            currentPage === totalPages
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }`}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 sm:h-64 text-center px-4">
              <BookOpen className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mb-2 sm:mb-3" />
              <p className="text-sm sm:text-base text-gray-600 font-medium">
                {getEmptyStateMessage()}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                {getEmptyStateSubMessage()}
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
              // Only call handleScheduleAssignmentComplete if dialog was closed after successful completion
              // The dialog will call onComplete() itself when saving, not when canceling
              if (!open) {
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

          {/* Filter Sheet */}
          <Sheet open={isFilterSheetOpen} onOpenChange={handleFilterSheetOpen}>
            <SheetContent
              side="right"
              className="w-[340px] sm:w-[400px] p-0 flex flex-col"
            >
              <div className="p-6 border-b flex-shrink-0">
                <SheetHeader>
                  <SheetTitle className="text-xl font-semibold">
                    Filter Options
                  </SheetTitle>
                </SheetHeader>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Faculty Filter - Only for Academic Head */}
                {permissions.canFilterByFaculty && (
                  <div className="w-full">
                    <FacultyFilter
                      faculties={faculties}
                      selectedFacultyIds={tempFacultyFilter}
                      onChange={setTempFacultyFilter}
                      currentUserId={userId}
                    />
                  </div>
                )}

                {/* Filter by Day */}
                <div className="space-y-2">
                  <Label htmlFor="day-filter" className="text-sm font-medium">
                    Filter by Day
                  </Label>
                  <Select
                    value={tempDayFilter}
                    onValueChange={setTempDayFilter}
                  >
                    <SelectTrigger id="day-filter" className="w-full">
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Days</SelectItem>
                      <SelectItem value="Monday">Monday</SelectItem>
                      <SelectItem value="Tuesday">Tuesday</SelectItem>
                      <SelectItem value="Wednesday">Wednesday</SelectItem>
                      <SelectItem value="Thursday">Thursday</SelectItem>
                      <SelectItem value="Friday">Friday</SelectItem>
                      <SelectItem value="Saturday">Saturday</SelectItem>
                      <SelectItem value="Sunday">Sunday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter by Room */}
                <div className="space-y-2">
                  <Label htmlFor="room-filter" className="text-sm font-medium">
                    Filter by Room
                  </Label>
                  <Input
                    id="room-filter"
                    type="text"
                    value={tempRoomFilter}
                    onChange={(e) => setTempRoomFilter(e.target.value)}
                    placeholder="Enter room name or number"
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500">
                    Filter courses by room name or number
                  </p>
                </div>

                {/* Filter by Start Time and End Time */}
                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <Label className="text-sm font-medium">
                      Filter by Start Time
                    </Label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <TimePicker
                          value={tempStartTimeFilter}
                          onChange={setTempStartTimeFilter}
                        />
                      </div>
                      {tempStartTimeFilter && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setTempStartTimeFilter("")}
                          className="h-9 w-9 p-0 flex-shrink-0"
                          title="Clear start time"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      Show courses starting at this exact time
                    </p>
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label className="text-sm font-medium">
                      Filter by End Time
                    </Label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <TimePicker
                          value={tempEndTimeFilter}
                          onChange={setTempEndTimeFilter}
                        />
                      </div>
                      {tempEndTimeFilter && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setTempEndTimeFilter("")}
                          className="h-9 w-9 p-0 flex-shrink-0"
                          title="Clear end time"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      Show courses ending at this exact time
                    </p>
                  </div>
                </div>

                {/* Sort by Attendance Rate */}
                <div className="space-y-2">
                  <Label
                    htmlFor="attendance-rate-sort"
                    className="text-sm font-medium"
                  >
                    Sort by Attendance Rate
                  </Label>
                  <Select
                    value={tempAttendanceRateSort}
                    onValueChange={(value: "asc" | "desc" | "none") =>
                      setTempAttendanceRateSort(value)
                    }
                  >
                    <SelectTrigger id="attendance-rate-sort" className="w-full">
                      <SelectValue placeholder="Select sort order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Sort</SelectItem>
                      <SelectItem value="asc">
                        Ascending (Low to High)
                      </SelectItem>
                      <SelectItem value="desc">
                        Descending (High to Low)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort by Passing Rate */}
                <div className="space-y-2">
                  <Label
                    htmlFor="passing-rate-sort"
                    className="text-sm font-medium"
                  >
                    Sort by Passing Rate
                  </Label>
                  <Select
                    value={tempPassingRateSort}
                    onValueChange={(value: "asc" | "desc" | "none") =>
                      setTempPassingRateSort(value)
                    }
                  >
                    <SelectTrigger id="passing-rate-sort" className="w-full">
                      <SelectValue placeholder="Select sort order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Sort</SelectItem>
                      <SelectItem value="asc">
                        Ascending (Low to High)
                      </SelectItem>
                      <SelectItem value="desc">
                        Descending (High to Low)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="p-6 border-t bg-white flex-shrink-0">
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setIsFilterSheetOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleApplyFilters}
                    className="flex-1 bg-[#124A69] hover:bg-[#0D3A54] text-white"
                  >
                    Apply Filters
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

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
    </div>
  );
}
