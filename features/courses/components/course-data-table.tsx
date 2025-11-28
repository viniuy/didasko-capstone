"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { usersService } from "@/lib/services/client";
import {
  useCourses,
  useCoursesStatsBatch,
  useFaculty,
  useBulkArchiveCourses,
  useArchivedCourses,
} from "@/lib/hooks/queries";
import { CourseResponse } from "@/shared/types/course";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/hooks/queries/queryKeys";
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
import { CourseSettingsDialog } from "../dialogs/course-settings-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import axiosInstance from "@/lib/axios";
import axios from "@/lib/axios";
import AnimatedContent from "@/components/ui/AnimatedContent";
import SplitText from "@/components/ui/SplitText";
import { checkActiveRfidSession } from "@/lib/utils/rfid-session";

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
const MAX_ACTIVE_COURSES = 15;

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
      } else if (width < 1536) {
        items = 3;
      } else {
        items = 4;
      }

      setItemsPerPage(items);
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

// Course Card Component
const CourseCard = ({
  course,
  onEdit,
  onAddSchedule,
  onViewDetails,
  onNavigate,
  itemsPerPage,
  userRole,
  facultyFilter,
  userId,
}: {
  course: Course;
  onEdit: (course: Course) => void;
  onAddSchedule: (course: Course) => void;
  onViewDetails: (course: Course) => void;
  onNavigate?: (slug: string) => void;
  itemsPerPage: number;
  userRole?: UserRole;
  facultyFilter?: string[];
  userId?: string;
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

  // Hide ellipsis menu if academic head is filtering by a specific faculty (viewing other faculty's courses)
  // Show ellipsis if: not ACADEMIC_HEAD, or no filter, or viewing own courses only
  const shouldHideEllipsis =
    userRole === "ACADEMIC_HEAD" &&
    facultyFilter &&
    facultyFilter.length === 1 &&
    userId &&
    facultyFilter[0] !== userId;

  return (
    <div className="group relative w-auto h-auto min-h-[280px] sm:min-h-[300px] md:min-h-[320px] bg-white rounded-lg border-2 border-[#124A69]/30 p-4 sm:p-5 md:p-6 hover:border-[#124A69] hover:shadow-xl transition-all duration-300 ease-in-out text-[#124A69] transform hover:scale-105 hover:-translate-y-1 will-change-transform overflow-hidden flex flex-col">
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
      {/* More Options Menu - Hidden when academic head filters by faculty */}
      {!shouldHideEllipsis && (
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
      )}

      {/* Card Content - Clickable */}
      <div
        onClick={() => {
          // Check if there's an active RFID session for this course
          // Academic heads can always access (view-only)
          if (userRole !== "ACADEMIC_HEAD") {
            const activeSession = checkActiveRfidSession(course.slug);
            if (activeSession) {
              toast.error(
                `Cannot access course: RFID attendance is currently active for this course. Please wait until the attendance session ends.`,
                {
                  id: `rfid-block-${course.slug}`,
                  duration: 5000,
                }
              );
              return;
            }
          }

          if (onNavigate) {
            onNavigate(course.slug);
          } else {
            router.push(`/main/course/${course.slug}`);
          }
        }}
        className="cursor-pointer h-full flex flex-col"
      >
        {/* Course Code and Title Section */}
        <div className="mb-4 sm:mb-5 md:mb-6 flex-shrink-0">
          <p
            className={`font-bold group-hover:text-[#0C3246] transition-colors flex items-center gap-2 mb-2 ${
              itemsPerPage === 3
                ? "text-base sm:text-lg"
                : "text-lg sm:text-xl md:text-2xl"
            }`}
            title={`${course.code} - ${course.section}`}
          >
            <span className="truncate max-w-[140px] sm:max-w-[180px] md:max-w-[220px]">
              {course.code}
            </span>
            <span className="flex-shrink-0 text-[#124A69]/70">
              - {course.section}
            </span>
          </p>
          <p
            className={`opacity-90 mt-1 sm:mt-2 truncate leading-relaxed ${
              itemsPerPage === 3
                ? "text-[10px] sm:text-xs"
                : "text-xs sm:text-sm md:text-base"
            }`}
            title={course.title}
          >
            {course.title}
          </p>
        </div>

        {/* Schedule and Room Section */}
        <div className="flex items-start mb-4 sm:mb-5 md:mb-6 opacity-90 flex-shrink-0">
          <Calendar
            className={`flex-shrink-0 mt-0.5 ${
              itemsPerPage === 3
                ? "w-3 h-3 sm:w-4 sm:h-4"
                : "w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6"
            }`}
          />
          <div className="ml-2 sm:ml-3 flex-1 min-w-0">
            <span
              className={`font-semibold block truncate ${
                itemsPerPage === 3
                  ? "text-[10px] sm:text-xs"
                  : "text-xs sm:text-sm md:text-base"
              }`}
            >
              Room: {course.room}
            </span>
            {hasNoSchedule ? (
              <span
                className={`text-amber-600 font-semibold mt-1 block ${
                  itemsPerPage === 3
                    ? "text-[9px] sm:text-[10px]"
                    : "text-[10px] sm:text-xs"
                }`}
              >
                No schedule set
              </span>
            ) : (
              <span
                className={`text-gray-600 mt-1 block ${
                  itemsPerPage === 3
                    ? "text-[9px] sm:text-[10px]"
                    : "text-[10px] sm:text-xs md:text-sm"
                }`}
              >
                {course.schedules
                  .map(
                    (s) =>
                      `${s.day.slice(0, 3)} ${formatTo12Hour(
                        s.fromTime
                      )}–${formatTo12Hour(s.toTime)}`
                  )
                  .join(", ")}
              </span>
            )}
          </div>
        </div>

        {/* Faculty and Students Section */}
        <div className="mt-auto pt-4 sm:pt-5 border-t border-gray-200/50 flex-shrink-0">
          <div className="bg-[#124A69] rounded-lg p-3 sm:p-4 border border-[#124A69]/10">
            <div className="flex justify-between items-center gap-3">
              <div className="flex items-center min-w-0 flex-1">
                <CircleUserRound
                  className={`flex-shrink-0 text-white ${
                    itemsPerPage === 3
                      ? "w-3 h-3 sm:w-4 sm:h-4"
                      : "w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6"
                  }`}
                />
                <span
                  className={`font-semibold ml-2 sm:ml-3 truncate max-w-[140px] sm:max-w-[180px] text-white ${
                    itemsPerPage === 3
                      ? "text-[10px] sm:text-xs"
                      : "text-xs sm:text-sm md:text-base"
                  }`}
                  title={course.faculty?.name || "No Instructor"}
                >
                  {course.faculty?.name || "No Instructor"}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Users
                  className={`text-white ${
                    itemsPerPage === 3
                      ? "w-3 h-3 sm:w-4 sm:h-4"
                      : "w-4 h-4 sm:w-5 sm:h-5"
                  }`}
                />
                <span
                  className={`font-bold text-white ${
                    itemsPerPage === 3
                      ? "text-xs sm:text-sm"
                      : "text-sm sm:text-base md:text-lg"
                  }`}
                >
                  {course._count?.students || 0}
                </span>
              </div>
            </div>
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
  const [facultyFilter, setFacultyFilter] = useState<string[]>([userId]);
  const [sectionFilter, setSectionFilter] = useState<string[]>([]);
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
  const [showRedirectingMessage, setShowRedirectingMessage] = useState(false);
  const router = useRouter();
  const [tempFacultyFilter, setTempFacultyFilter] = useState<string[]>([
    userId,
  ]);
  const [tempSectionFilter, setTempSectionFilter] = useState<string[]>([]);
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
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [scheduleDialogCourse, setScheduleDialogCourse] =
    useState<Course | null>(null);
  const [newCourseForSchedule, setNewCourseForSchedule] = useState<any>(null);
  const [pendingCourseData, setPendingCourseData] = useState<any>(null);
  const [scheduleDialogMode, setScheduleDialogMode] = useState<
    "create" | "edit" | "import"
  >("import");
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);

  // Import/Export State
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [showImportStatus, setShowImportStatus] = useState(false);
  const [showValidatingDialog, setShowValidatingDialog] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [preImportValidationErrors, setPreImportValidationErrors] = useState<
    Array<{ row: number; code: string; status: string; message: string }>
  >([]);
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

  // React Query hooks
  const queryClient = useQueryClient();
  const {
    data: coursesData,
    isLoading: isLoadingCourses,
    refetch: refetchCourses,
  } = useCourses();
  const { data: facultyData } = useFaculty();
  const bulkArchiveMutation = useBulkArchiveCourses();

  // Get course slugs for batch stats
  // Use coursesData from React Query if available, otherwise fall back to initialCourses
  const coursesForStats = coursesData?.courses || initialCourses;
  const courseSlugs = useMemo(
    () => coursesForStats.map((c) => c.slug),
    [coursesForStats]
  );
  const { data: statsData, isLoading: isLoadingStats } =
    useCoursesStatsBatch(courseSlugs);

  // Sync faculty data from React Query
  useEffect(() => {
    if (facultyData && Array.isArray(facultyData)) {
      const facultyOnly = facultyData.filter(
        (user: any) => user.role === "FACULTY"
      );
      setFaculties(facultyOnly);
    }
  }, [facultyData]);

  // Helper function to map courses with stats
  const mapCoursesWithStats = useCallback(
    (courses: any[]): Course[] => {
      if (courses.length === 0) {
        return [];
      }

      // Map stats from batch response to courses
      const defaultStats: CourseStats = {
        passingRate: 0,
        attendanceRate: 0,
        totalStudents: 0,
      };

      const statsMap = new Map<string, CourseStats>();
      (statsData?.stats || []).forEach((item: any) => {
        if (item.slug && item.stats) {
          statsMap.set(item.slug, {
            passingRate: item.stats.passingRate ?? 0,
            attendanceRate: item.stats.attendanceRate ?? 0,
            totalStudents: item.stats.totalStudents ?? 0,
          });
        }
      });

      return courses.map((course: any) => {
        const stats: CourseStats = statsMap.get(course.slug) || defaultStats;

        return {
          ...course,
          stats,
          // Ensure _count is preserved if it exists, otherwise calculate from available data
          _count: course._count || {
            students:
              course.attendanceStats?.totalStudents ||
              (Array.isArray(course.students) ? course.students.length : 0),
          },
        };
      });
    },
    [statsData]
  );

  // Sync courses with stats from React Query
  // Prefer coursesData from React Query (after mutations) over initialCourses (from SSR)
  useEffect(() => {
    // Use coursesData from React Query if available, otherwise fall back to initialCourses
    const coursesToUse = coursesData?.courses || initialCourses;

    if (coursesToUse.length === 0) {
      setTableData([]);
      return;
    }

    const coursesWithStats = mapCoursesWithStats(coursesToUse);
    setTableData(coursesWithStats);
    setHasLoadedOnce(true);
  }, [coursesData, initialCourses, mapCoursesWithStats]);

  // Update loading state based on query
  useEffect(() => {
    setIsInitialLoading(isLoadingStats && !hasLoadedOnce);
    setIsLoading(isLoadingStats);
  }, [isLoadingStats, hasLoadedOnce]);

  const refreshTableData = useCallback(
    async (skipStats = false) => {
      try {
        setIsRefreshing(true);
        // Invalidate all course-related queries to ensure fresh data
        // Invalidating the parent key will invalidate all child queries (lists, archived, active, etc.)
        await queryClient.invalidateQueries({
          queryKey: queryKeys.courses.all,
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.stats.all,
        });

        // Invalidate specific course queries that might be cached
        await queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey;
            return (
              Array.isArray(key) && key.length >= 1 && key[0] === "courses"
            );
          },
        });

        // Refetch all course queries to get fresh data
        await queryClient.refetchQueries({
          queryKey: queryKeys.courses.all,
        });

        // Force refetch active courses to ensure UI updates
        await queryClient.refetchQueries({
          predicate: (query) => {
            const key = query.queryKey;
            return (
              Array.isArray(key) &&
              key.length >= 2 &&
              key[0] === "courses" &&
              (key[1] === "list" || key[1] === "active")
            );
          },
        });

        // Stats will be refetched automatically via useCoursesStatsBatch when courseSlugs change
      } catch (error: any) {
        console.error("Error refreshing table data:", error);
        toast.error("Failed to refresh course data");
      } finally {
        setIsRefreshing(false);
      }
    },
    [queryClient]
  );

  // Handle tab visibility - refresh data when tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && hasLoadedOnce) {
        // When tab becomes visible, refresh data silently
        refreshTableData(false).catch((error) => {
          console.error("Error refreshing data on tab visibility:", error);
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hasLoadedOnce, refreshTableData]);

  // Count active courses (ACTIVE and INACTIVE) for the current faculty
  const activeCoursesCount = useMemo(() => {
    return tableData.filter((course) => {
      // Check if course is active or inactive
      const isActiveOrInactive =
        course.status === "ACTIVE" || course.status === "INACTIVE";

      if (!isActiveOrInactive) return false;

      // For ACADEMIC_HEAD, count courses matching the selected faculty filter (single selection)
      if (userRole === "ACADEMIC_HEAD") {
        if (facultyFilter.length === 0) return false;
        const selectedFacultyId = facultyFilter[0];
        return course.facultyId === selectedFacultyId;
      }

      // For regular faculty, only count courses belonging to the current user
      return course.facultyId === userId;
    }).length;
  }, [tableData, userRole, userId, facultyFilter, faculties]);

  const hasReachedMaxActiveCourses = activeCoursesCount >= MAX_ACTIVE_COURSES;

  // Filter courses based on role and faculty (without search/status filters)
  const baseFilteredCourses = useMemo(() => {
    // For Academic Head with single faculty selection (radio button)
    if (userRole === "ACADEMIC_HEAD") {
      if (facultyFilter.length === 0) {
        return [];
      }
      // Filter by selected faculty ID (single selection)
      const selectedFacultyId = facultyFilter[0];
      return tableData.filter(
        (course) => course.facultyId === selectedFacultyId
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

  // Get unique sections from baseFilteredCourses
  const availableSections = useMemo(() => {
    const sections = new Set<string>();
    baseFilteredCourses.forEach((course) => {
      if (course.section) {
        // Store the original section value (preserve case for display)
        sections.add(course.section.trim());
      }
    });
    return Array.from(sections).sort();
  }, [baseFilteredCourses]);

  // Filter courses based on role and filters
  const filteredCourses = useMemo(() => {
    // Apply search and status filters to base filtered courses
    return baseFilteredCourses
      .filter((course) => {
        const matchesSearch =
          course.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          course.section.toLowerCase().includes(searchQuery.toLowerCase());

        // Show only ACTIVE and INACTIVE courses (ARCHIVED are handled via backtrack dialog)
        const matchesStatus =
          course.status === "ACTIVE" || course.status === "INACTIVE";

        // Filter by section (case-insensitive and trimmed)
        const matchesSection =
          sectionFilter.length === 0 ||
          sectionFilter.some(
            (filterSection) =>
              filterSection.trim().toUpperCase() ===
              (course.section || "").trim().toUpperCase()
          );

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
          matchesSection &&
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
    sectionFilter,
    dayFilter,
    roomFilter,
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

  // Disable animation after initial load
  useEffect(() => {
    if (hasLoadedOnce && !isLoading) {
      // Allow animation only on first render after loading
      const timer = setTimeout(() => {
        setShouldAnimate(false);
      }, 2000); // Disable animation after 2 seconds (enough time for initial animation)
      return () => clearTimeout(timer);
    }
  }, [hasLoadedOnce, isLoading]);

  // Re-enable animation when courses actually change (not just page change)
  useEffect(() => {
    if (hasLoadedOnce && !isLoading) {
      setShouldAnimate(true);
      const timer = setTimeout(() => {
        setShouldAnimate(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [tableData.length, hasLoadedOnce, isLoading]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Course action handlers
  const handleEditCourse = (course: Course) => {
    setEditingCourse(course);
    // Don't set loading state here - only when user confirms
  };

  const handleAddSchedule = (course: Course) => {
    setScheduleDialogCourse(course);
    setImportedCoursesForSchedule([course]);
    setScheduleDialogMode("edit");
    setShowScheduleAssignment(true);
    // Don't set loading state here - only when user confirms
  };

  const handleViewDetails = (course: Course) => {
    window.open(`/main/course/${course.slug}`, "_blank");
  };

  const handleArchiveCourses = async (courseIds: string[]) => {
    // Validate input
    if (!courseIds || courseIds.length === 0) {
      toast.error("No courses selected for archiving");
      return;
    }

    // Remove duplicates
    const uniqueCourseIds = Array.from(new Set(courseIds));

    // Close the dialog immediately
    setShowSettingsDialog(false);

    // Show loading toast
    const loadingToast = toast.loading(
      `Archiving ${uniqueCourseIds.length} course(s)...`,
      {
        style: {
          background: "#fff",
          color: "#124A69",
          border: "1px solid #e5e7eb",
          boxShadow:
            "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          borderRadius: "0.5rem",
          padding: "1rem",
        },
      }
    );

    try {
      setIsLoading(true);

      // Filter courses to only include those owned by current user and are not already archived
      const coursesToArchive = tableData
        .filter(
          (course) =>
            uniqueCourseIds.includes(course.id) &&
            course.facultyId === userId &&
            course.status !== "ARCHIVED"
        )
        .map((course) => course.id);

      // Find courses that couldn't be archived
      const invalidCourses = uniqueCourseIds.filter(
        (id) => !coursesToArchive.includes(id)
      );
      const invalidCourseDetails = tableData.filter((course) =>
        invalidCourses.includes(course.id)
      );

      if (coursesToArchive.length === 0) {
        if (invalidCourses.length > 0) {
          const reasons: string[] = [];
          const notOwned = invalidCourseDetails.filter(
            (c) => c.facultyId !== userId
          );
          const alreadyArchived = invalidCourseDetails.filter(
            (c) => c.status === "ARCHIVED"
          );

          if (notOwned.length > 0) {
            reasons.push(`${notOwned.length} course(s) not owned by you`);
          }
          if (alreadyArchived.length > 0) {
            reasons.push(
              `${alreadyArchived.length} course(s) already archived`
            );
          }

          toast.error(
            `Cannot archive selected courses: ${reasons.join(", ")}`,
            {
              id: loadingToast,
            }
          );
        } else {
          toast.error("No valid courses found to archive", {
            id: loadingToast,
          });
        }
        return;
      }

      // If some courses couldn't be archived, show a warning but continue
      if (invalidCourses.length > 0) {
        const reasons: string[] = [];
        const notOwned = invalidCourseDetails.filter(
          (c) => c.facultyId !== userId
        );
        const alreadyArchived = invalidCourseDetails.filter(
          (c) => c.status === "ARCHIVED"
        );

        if (notOwned.length > 0) {
          reasons.push(`${notOwned.length} course(s) not owned by you`);
        }
        if (alreadyArchived.length > 0) {
          reasons.push(`${alreadyArchived.length} course(s) already archived`);
        }

        toast.loading(
          `Archiving ${coursesToArchive.length} course(s). ${reasons.join(
            ", "
          )} will be skipped.`,
          { id: loadingToast }
        );
      }

      // Perform bulk archive operation
      await bulkArchiveMutation.mutateAsync({
        courseIds: coursesToArchive,
        status: "ARCHIVED",
      });

      // Optimistically remove archived courses from tableData immediately
      setTableData((prevData) =>
        prevData.filter((course) => !coursesToArchive.includes(course.id))
      );

      // Then refetch to get fresh data from server
      try {
        // Invalidate to mark as stale
        queryClient.invalidateQueries({
          queryKey: queryKeys.courses.list(undefined),
        });

        // Invalidate and refetch all archived courses queries (for settings dialog and backtrack dialog)
        // Use a broader pattern to catch all variations with different filters
        await queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey;
            return (
              Array.isArray(key) &&
              key.length >= 2 &&
              key[0] === "courses" &&
              key[1] === "archived"
            );
          },
        });

        // Force refetch of all active archived queries (in case dialog is open)
        await queryClient.refetchQueries({
          predicate: (query) => {
            const key = query.queryKey;
            return (
              Array.isArray(key) &&
              key.length >= 2 &&
              key[0] === "courses" &&
              key[1] === "archived"
            );
          },
        });

        // Refetch using the hook's refetch method
        await refetchCourses();
      } catch (refetchError) {
        // Log but don't fail - the query will retry automatically
        console.warn("Error refetching courses after archive:", refetchError);
      }

      // Update loading toast to success
      const successMessage =
        invalidCourses.length > 0
          ? `Successfully archived ${coursesToArchive.length} of ${uniqueCourseIds.length} course(s)`
          : `Successfully archived ${coursesToArchive.length} course(s)`;

      toast.success(successMessage, {
        id: loadingToast,
        style: {
          background: "#fff",
          color: "#124A69",
          border: "1px solid #e5e7eb",
          boxShadow:
            "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          borderRadius: "0.5rem",
          padding: "1rem",
        },
        iconTheme: {
          primary: "#124A69",
          secondary: "#fff",
        },
      });

      if (onCourseAdded) onCourseAdded();
    } catch (error: any) {
      console.error("Error archiving courses:", error);

      // Extract error message
      const errorMessage =
        error?.response?.data?.error ||
        error?.message ||
        "Failed to archive courses. Please try again.";

      // Update loading toast to error
      toast.error(errorMessage, {
        id: loadingToast,
        style: {
          background: "#fff",
          color: "#dc2626",
          border: "1px solid #e5e7eb",
          boxShadow:
            "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          borderRadius: "0.5rem",
          padding: "1rem",
        },
        iconTheme: {
          primary: "#dc2626",
          secondary: "#fff",
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnarchiveCourses = async (courseIds: string[]) => {
    // Validate input
    if (!courseIds || courseIds.length === 0) {
      toast.error("No courses selected for unarchiving");
      return;
    }

    // Remove duplicates
    const uniqueCourseIds = Array.from(new Set(courseIds));

    // Close the dialog immediately
    setShowSettingsDialog(false);

    // Show loading toast
    const loadingToast = toast.loading(
      `Unarchiving ${uniqueCourseIds.length} course(s)...`,
      {
        style: {
          background: "#fff",
          color: "#124A69",
          border: "1px solid #e5e7eb",
          boxShadow:
            "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          borderRadius: "0.5rem",
          padding: "1rem",
        },
      }
    );

    try {
      setIsLoading(true);

      // Fetch archived courses to verify ownership
      const archivedCoursesResponse = await fetch(
        `/api/courses/archived?facultyId=${userId}`
      );
      const archivedCoursesData = archivedCoursesResponse.ok
        ? await archivedCoursesResponse.json()
        : [];

      // Filter courses to only include those owned by current user and are actually archived
      // Keep the full course objects for optimistic update
      const coursesToUnarchiveData = archivedCoursesData.filter(
        (course: any) =>
          uniqueCourseIds.includes(course.id) &&
          course.facultyId === userId &&
          course.status === "ARCHIVED"
      );
      const coursesToUnarchive = coursesToUnarchiveData.map(
        (course: any) => course.id
      );

      // Find courses that couldn't be unarchived
      const invalidCourses = uniqueCourseIds.filter(
        (id) => !coursesToUnarchive.includes(id)
      );
      const invalidCourseDetails = archivedCoursesData.filter((course: any) =>
        invalidCourses.includes(course.id)
      );

      if (coursesToUnarchive.length === 0) {
        if (invalidCourses.length > 0) {
          const reasons: string[] = [];
          const notOwned = invalidCourseDetails.filter(
            (c: any) => c.facultyId !== userId
          );
          const notArchived = invalidCourseDetails.filter(
            (c: any) => c.status !== "ARCHIVED"
          );

          if (notOwned.length > 0) {
            reasons.push(`${notOwned.length} course(s) not owned by you`);
          }
          if (notArchived.length > 0) {
            reasons.push(`${notArchived.length} course(s) not archived`);
          }

          toast.error(
            `Cannot unarchive selected courses: ${reasons.join(", ")}`,
            {
              id: loadingToast,
            }
          );
        } else {
          toast.error("No valid archived courses found to unarchive", {
            id: loadingToast,
          });
        }
        return;
      }

      // Check if unarchiving would exceed the active course limit
      const currentActiveCount = tableData.filter(
        (c) =>
          c.facultyId === userId &&
          (c.status === "ACTIVE" || c.status === "INACTIVE")
      ).length;
      const remainingSlots = MAX_ACTIVE_COURSES - currentActiveCount;

      if (coursesToUnarchive.length > remainingSlots) {
        toast.error(
          `Cannot unarchive ${coursesToUnarchive.length} course(s). You can only activate ${remainingSlots} more course(s) (maximum ${MAX_ACTIVE_COURSES} active courses allowed).`,
          { id: loadingToast }
        );
        return;
      }

      // If some courses couldn't be unarchived, show a warning but continue
      if (invalidCourses.length > 0) {
        const reasons: string[] = [];
        const notOwned = invalidCourseDetails.filter(
          (c: any) => c.facultyId !== userId
        );
        const notArchived = invalidCourseDetails.filter(
          (c: any) => c.status !== "ARCHIVED"
        );

        if (notOwned.length > 0) {
          reasons.push(`${notOwned.length} course(s) not owned by you`);
        }
        if (notArchived.length > 0) {
          reasons.push(`${notArchived.length} course(s) not archived`);
        }

        toast.loading(
          `Unarchiving ${coursesToUnarchive.length} course(s). ${reasons.join(
            ", "
          )} will be skipped.`,
          { id: loadingToast }
        );
      }

      // Fetch full course data with schedules before unarchiving
      // This ensures we have complete data for the optimistic update
      const coursesWithSchedules = await Promise.all(
        coursesToUnarchiveData.map(async (course: any) => {
          if (!course.slug) {
            // If no slug, return the basic course data (shouldn't happen, but handle gracefully)
            return course;
          }
          try {
            const response = await fetch(`/api/courses/${course.slug}`);
            if (response.ok) {
              const fullCourse = await response.json();
              return fullCourse;
            }
          } catch (error) {
            console.warn(
              `Failed to fetch full data for course ${course.slug}:`,
              error
            );
          }
          // Fallback to basic course data if fetch fails
          return course;
        })
      );

      // Perform bulk unarchive operation
      await bulkArchiveMutation.mutateAsync({
        courseIds: coursesToUnarchive,
        status: "ACTIVE",
      });

      // Optimistically add unarchived courses to tableData immediately
      // Map the full course data to the Course format with updated status
      const coursesToAdd = coursesWithSchedules.map((course: any) => {
        // Use default stats for optimistic update (will be updated after refetch)
        const stats: CourseStats = {
          passingRate: 0,
          attendanceRate: 0,
          totalStudents: 0,
        };

        return {
          ...course,
          status: "ACTIVE" as const,
          stats,
          // Ensure schedules are preserved from the full course data
          // Schedules should be an array - handle both array and undefined/null cases
          schedules: Array.isArray(course.schedules) ? course.schedules : [],
          _count: course._count || {
            students:
              course.attendanceStats?.totalStudents ||
              (Array.isArray(course.students) ? course.students.length : 0),
          },
        };
      });

      // Add the courses to tableData immediately
      setTableData((prevData) => {
        // Filter out any existing courses with the same IDs (in case they exist)
        const filtered = prevData.filter(
          (c) => !coursesToUnarchive.includes(c.id)
        );
        // Add the newly activated courses
        return [...filtered, ...coursesToAdd];
      });

      // Then refetch to get fresh data from server
      try {
        // Invalidate all course-related queries to ensure fresh data
        queryClient.invalidateQueries({
          queryKey: queryKeys.courses.all,
        });

        // Invalidate and refetch all archived courses queries (for settings dialog and backtrack dialog)
        // Use a broader pattern to catch all variations with different filters
        await queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey;
            return (
              Array.isArray(key) &&
              key.length >= 2 &&
              key[0] === "courses" &&
              key[1] === "archived"
            );
          },
        });

        // Force refetch of all active archived queries (in case dialog is open)
        await queryClient.refetchQueries({
          predicate: (query) => {
            const key = query.queryKey;
            return (
              Array.isArray(key) &&
              key.length >= 2 &&
              key[0] === "courses" &&
              key[1] === "archived"
            );
          },
        });

        // Invalidate active courses query
        queryClient.invalidateQueries({
          queryKey: queryKeys.courses.active({ facultyId: userId }),
        });

        // Invalidate stats queries so they refetch with new courses
        queryClient.invalidateQueries({
          queryKey: queryKeys.stats.all,
        });

        // Refetch using the hook's refetch method
        await refetchCourses();
      } catch (refetchError) {
        // Log but don't fail - the query will retry automatically
        console.warn("Error refetching courses after unarchive:", refetchError);
      }

      // Update loading toast to success
      const successMessage =
        invalidCourses.length > 0
          ? `Successfully unarchived ${coursesToUnarchive.length} of ${uniqueCourseIds.length} course(s)`
          : `Successfully unarchived ${coursesToUnarchive.length} course(s)`;

      toast.success(successMessage, {
        id: loadingToast,
        style: {
          background: "#fff",
          color: "#124A69",
          border: "1px solid #e5e7eb",
          boxShadow:
            "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          borderRadius: "0.5rem",
          padding: "1rem",
        },
        iconTheme: {
          primary: "#124A69",
          secondary: "#fff",
        },
      });

      if (onCourseAdded) onCourseAdded();
    } catch (error: any) {
      console.error("Error unarchiving courses:", error);

      // Handle schedule conflicts
      if (error?.response?.status === 400 && error?.response?.data?.conflicts) {
        const conflicts = error?.response?.data?.conflicts || [];
        const conflictMessages = conflicts.map((conflict: any) => {
          const courseLabel = conflict.courseSection
            ? `${conflict.courseCode} - ${conflict.courseSection}`
            : conflict.courseCode;
          return `${courseLabel}: ${conflict.error}`;
        });

        toast.error(
          `Cannot unarchive ${
            conflicts.length
          } course(s) due to schedule conflicts:\n${conflictMessages.join(
            "\n"
          )}`,
          {
            id: loadingToast,
            duration: 10000, // Show longer for multiple conflicts
            style: {
              background: "#fff",
              color: "#dc2626",
              border: "1px solid #e5e7eb",
              boxShadow:
                "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
              borderRadius: "0.5rem",
              padding: "1rem",
              whiteSpace: "pre-line", // Allow line breaks
              maxWidth: "500px",
            },
            iconTheme: {
              primary: "#dc2626",
              secondary: "#fff",
            },
          }
        );
        return;
      }

      // Extract error message for other errors
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to unarchive courses. Please try again.";

      // Update loading toast to error
      toast.error(errorMessage, {
        id: loadingToast,
        style: {
          background: "#fff",
          color: "#dc2626",
          border: "1px solid #e5e7eb",
          boxShadow:
            "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          borderRadius: "0.5rem",
          padding: "1rem",
        },
        iconTheme: {
          primary: "#dc2626",
          secondary: "#fff",
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Export handler
  const handleExport = useCallback(
    async (exportFilter: "ACTIVE" | "ARCHIVED", facultyId?: string) => {
      try {
        // Filter courses based on export option and faculty
        let coursesToExport: Course[];

        if (exportFilter === "ARCHIVED") {
          // For archived courses, fetch them from the API
          const archivedResponse = await fetch(
            `/api/courses/archived?${facultyId ? `facultyId=${facultyId}` : ""}`
          );
          if (archivedResponse.ok) {
            coursesToExport = await archivedResponse.json();
          } else {
            coursesToExport = [];
          }
        } else {
          // For active courses, filter from baseFilteredCourses
          // First filter by faculty if specified (for Academic Head)
          if (facultyId) {
            coursesToExport = baseFilteredCourses.filter(
              (c) => c.facultyId === facultyId
            );
          } else if (userRole === "ACADEMIC_HEAD") {
            // Academic Head without faculty selection - export all courses
            coursesToExport = baseFilteredCourses;
          } else {
            // Regular faculty - only their own courses
            coursesToExport = baseFilteredCourses.filter(
              (c) => c.facultyId === userId
            );
          }

          // Then filter by status (ACTIVE/INACTIVE)
          coursesToExport = coursesToExport.filter(
            (c) => c.status === "ACTIVE" || c.status === "INACTIVE"
          );
        }

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
        coursesToExport.forEach((course: Course) => {
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
        const filterSuffix = exportFilter === "ACTIVE" ? "active" : "archived";
        const facultySuffix = facultyId
          ? `_${
              faculties
                .find((f) => f.id === facultyId)
                ?.name.replace(/\s+/g, "_") || "faculty"
            }`
          : "";
        const filename = `courses_${filterSuffix}${facultySuffix}_${
          new Date().toISOString().split("T")[0]
        }.xlsx`;
        saveAs(blob, filename);

        // Log course export
        try {
          await axiosInstance.post("/courses/export", {
            filter: exportFilter,
            count: coursesToExport.length,
            exportedAt: new Date().toISOString(),
          });
        } catch (logError) {
          console.error("Error logging course export:", logError);
          // Don't fail export if logging fails
        }

        toast.success(
          `Successfully exported ${coursesToExport.length} ${filterSuffix} course(s)`
        );
        setShowExportPreview(false);
      } catch (error) {
        console.error("Export error:", error);
        toast.error("Failed to export courses");
      }
    },
    [baseFilteredCourses, userRole, userId, faculties]
  );

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

    // Check if limit is reached
    if (hasReachedMaxActiveCourses) {
      toast.error(
        `Maximum limit of ${MAX_ACTIVE_COURSES} active courses reached. Please archive some courses before importing new ones.`
      );
      return;
    }

    // Close import preview dialog immediately
    setShowImportPreview(false);

    // Show validating dialog
    setShowValidatingDialog(true);

    try {
      setIsLoading(true);
      // Check for duplicate courses BEFORE preparing import
      const validationErrors: Array<{
        row: number;
        code: string;
        status: string;
        message: string;
      }> = [];
      const validCourses: any[] = [];

      // Fetch existing courses once instead of in a loop
      // Use React Query hook data if available
      let existingCourses: any[] = [];
      if (coursesData?.courses) {
        existingCourses = coursesData.courses;
      } else {
        // Fallback: fetch directly if hook data not available
        // This should rarely happen as useCourses should provide the data
        const response = await axios.get("/courses");
        existingCourses = Array.isArray(response.data)
          ? response.data
          : response.data.courses || [];
      }

      for (let rowIndex = 0; rowIndex < previewData.length; rowIndex++) {
        const row = previewData[rowIndex];
        const code = row["Course Code"]?.trim().toUpperCase() || "";
        const title = row["Course Title"]?.trim() || "";
        const section = row["Section"]?.trim().toUpperCase() || "";
        let academicYear = row["Academic Year"]?.trim() || "";
        let semester = row["Semester"]?.trim() || "";
        let room = row["Room"]?.trim() || "";
        const classNumberStr = row["Class Number"]?.toString().trim() || "";
        const status = row["Status"]?.trim() || "";

        // Remove "Room:" prefix if present
        room = room.replace(/^room:\s*/i, "").trim();

        // Validation errors
        const errors: string[] = [];

        // Validate course code
        if (!code) {
          errors.push("Course Code is required");
        } else if (code.length > 15) {
          errors.push("Course Code must be 15 characters or less");
        }

        // Validate course title
        if (!title) {
          errors.push("Course Title is required");
        } else if (title.length > 80) {
          errors.push("Course Title must be 80 characters or less");
        }

        // Validate section
        if (!section) {
          errors.push("Section is required");
        } else if (section.length > 10) {
          errors.push("Section must be 10 characters or less");
        }

        // Validate room
        if (!room) {
          errors.push("Room is required");
        } else if (room.length > 15) {
          errors.push("Room must be 15 characters or less");
        }

        // Validate semester
        if (!semester) {
          errors.push("Semester is required");
        } else if (semester !== "1st Semester" && semester !== "2nd Semester") {
          errors.push(
            'Semester must be exactly "1st Semester" or "2nd Semester"'
          );
        }

        // Validate academic year
        if (!academicYear) {
          errors.push("Academic Year is required");
        } else if (!/^\d{4}-\d{4}$/.test(academicYear)) {
          errors.push(
            "Academic Year must be in format YYYY-YYYY (e.g., 2024-2025)"
          );
        } else {
          const [firstYear, secondYear] = academicYear.split("-").map(Number);
          if (firstYear >= secondYear) {
            errors.push(
              "First year must be less than second year (e.g., 2024-2025)"
            );
          } else if (secondYear - firstYear !== 1) {
            errors.push(
              "Academic year must have exactly 1 year difference (e.g., 2024-2025)"
            );
          }
        }

        // Validate class number
        if (!classNumberStr) {
          errors.push("Class Number is required");
        } else {
          const classNumber = parseInt(classNumberStr, 10);
          if (isNaN(classNumber) || classNumber < 1) {
            errors.push("Class Number must be a positive number");
          } else if (classNumber > 9999999999999) {
            errors.push("Class Number cannot exceed 9999999999999");
          }
        }

        // Validate status
        const normalizedStatus = status.toLowerCase();
        const validStatuses = ["active", "inactive", "archived"];
        if (!status) {
          errors.push("Status is required");
        } else if (!validStatuses.includes(normalizedStatus)) {
          errors.push(
            'Status must be exactly "Active", "Inactive", or "Archived"'
          );
        }

        // If there are validation errors, collect them (no toast)
        if (errors.length > 0) {
          validationErrors.push({
            row: rowIndex + 2, // +2 because Excel starts at 1 and has header row
            code: code || "N/A",
            status: "error",
            message: errors.join(", "),
          });
          continue;
        }

        // Check if course already exists in database (case-insensitive comparison)
        const isDuplicate = existingCourses.some(
          (c: any) =>
            c.code?.trim().toUpperCase() === code &&
            c.section?.trim().toUpperCase() === section &&
            c.academicYear?.trim() === academicYear &&
            c.semester?.trim() === semester
        );

        if (isDuplicate) {
          validationErrors.push({
            row: rowIndex + 2,
            code: code || "N/A",
            status: "skipped",
            message: `Course already exists (${code}-${section} for ${academicYear} ${semester})`,
          });
        } else {
          // Normalize status to enum format (ACTIVE, INACTIVE, ARCHIVED)
          const normalizedStatus = status
            ? status.trim().toUpperCase()
            : "ACTIVE";

          // Use cleaned and normalized values
          validCourses.push({
            ...row,
            "Course Code": code,
            "Course Title": title.trim(),
            Section: section,
            Room: room.toUpperCase(),
            Semester: semester,
            "Academic Year": academicYear,
            "Class Number": classNumberStr,
            Status: normalizedStatus,
          });
        }
      }

      // Store validation errors for later display
      setPreImportValidationErrors(validationErrors);

      // Check if adding valid courses would exceed the limit
      // Count active courses for the current faculty only
      const currentActiveCount = tableData.filter((c) => {
        // Check if course is active or inactive
        const isActiveOrInactive =
          c.status === "ACTIVE" || c.status === "INACTIVE";

        if (!isActiveOrInactive) return false;

        // For ACADEMIC_HEAD, count courses matching the selected faculty filter (single selection)
        if (userRole === "ACADEMIC_HEAD") {
          if (facultyFilter.length === 0) return false;
          const selectedFacultyId = facultyFilter[0];
          return c.facultyId === selectedFacultyId;
        }

        // For regular faculty, only count courses belonging to the current user
        return c.facultyId === userId;
      }).length;
      const remainingSlots = MAX_ACTIVE_COURSES - currentActiveCount;

      if (validCourses.length > remainingSlots) {
        toast.error(
          `Cannot import ${validCourses.length} course(s). You can only add ${remainingSlots} more active course(s) (maximum ${MAX_ACTIVE_COURSES} active courses allowed).`
        );
        setShowValidatingDialog(false);
        setShowImportPreview(true);
        return;
      }

      // If ALL courses have errors or are duplicates, show summary and return
      if (validCourses.length === 0) {
        const status: ImportStatus = {
          imported: 0,
          skipped: validationErrors.filter((e) => e.status === "skipped")
            .length,
          errors: validationErrors
            .filter((e) => e.status === "error")
            .map((e) => ({ code: e.code, message: e.message })),
          total: previewData.length,
          detailedFeedback: validationErrors,
        };
        setImportStatus(status);
        setShowValidatingDialog(false);
        setTimeout(() => {
          setShowImportStatus(true);
        }, 300);
        setShowImportPreview(false);
        return;
      }

      // If there are validation errors/duplicates, ask user if they want to continue
      if (validationErrors.length > 0) {
        const shouldContinue = confirm(
          `${validationErrors.length} course(s) have errors or already exist. Do you want to continue importing the ${validCourses.length} valid course(s)? All errors will be shown in the import summary.`
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

      // Set courses for schedule assignment
      setImportedCoursesForSchedule(coursesToImport);

      // Close validating dialog and open schedule assignment dialog
      setShowValidatingDialog(false);
      setTimeout(() => {
        setShowScheduleAssignment(true);
      }, 300);
    } catch (error: any) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to prepare courses for import";

      console.error("Import preparation error:", error);
      toast.error(errorMessage);
      setShowValidatingDialog(false);
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedFile,
    isValidFile,
    previewData,
    hasReachedMaxActiveCourses,
    tableData,
    userRole,
    userId,
    facultyFilter,
    faculties,
  ]);

  const handleScheduleAssignmentComplete = useCallback(
    async (importResults?: any) => {
      // Set loading state when user confirms (for edit mode)
      if (scheduleDialogMode === "edit") {
        setIsEditingSchedule(true);
      } else if (scheduleDialogMode === "create") {
        setIsEditingCourse(true);
        setIsEditingSchedule(true);
      }

      // If import results are provided, show detailed status
      if (importResults && scheduleDialogMode === "import") {
        // Merge pre-import validation errors with API import results
        const apiFeedback = importResults.detailedFeedback || [];
        const allFeedback = [...preImportValidationErrors, ...apiFeedback];

        // Calculate totals
        const imported = importResults.success || 0;
        const skippedFromApi = importResults.skipped || 0;
        const skippedFromValidation = preImportValidationErrors.filter(
          (e) => e.status === "skipped"
        ).length;
        const totalSkipped = skippedFromApi + skippedFromValidation;

        const errorsFromApi = importResults.errors || [];
        const errorsFromValidation = preImportValidationErrors
          .filter((e) => e.status === "error")
          .map((e) => ({ code: e.code, message: e.message }));
        const allErrors = [...errorsFromValidation, ...errorsFromApi];

        const total =
          importResults.total ||
          preImportValidationErrors.length +
            (importResults.success || 0) +
            (importResults.failed || 0) +
            skippedFromApi ||
          imported + (importResults.failed || 0) + totalSkipped;

        // Map the results to match ImportStatus interface
        const status: ImportStatus = {
          imported,
          skipped: totalSkipped,
          errors: allErrors,
          total,
          detailedFeedback: allFeedback,
        };

        // Set import status and show dialog after a small delay to ensure schedule dialog is closed
        setImportStatus(status);
        setTimeout(() => {
          setShowImportStatus(true);
        }, 300);

        // Clear pre-import errors
        setPreImportValidationErrors([]);
      }
      // Note: Success toast for create mode is handled by the mutation itself

      // Show loading state
      setIsRefreshing(true);
      setIsLoading(true);

      // Small delay for visual feedback
      await new Promise((resolve) => setTimeout(resolve, 300));

      try {
        // For edit mode, ensure comprehensive invalidation and refetch
        if (scheduleDialogMode === "edit") {
          // Invalidate all course-related queries
          await queryClient.invalidateQueries({
            queryKey: queryKeys.courses.all,
          });
          await queryClient.invalidateQueries({
            queryKey: queryKeys.stats.all,
          });

          // Invalidate specific course queries
          await queryClient.invalidateQueries({
            predicate: (query) => {
              const key = query.queryKey;
              return (
                Array.isArray(key) && key.length >= 1 && key[0] === "courses"
              );
            },
          });

          // Force refetch all course queries
          await queryClient.refetchQueries({
            queryKey: queryKeys.courses.all,
          });

          // Force refetch active courses to ensure UI updates immediately
          await queryClient.refetchQueries({
            predicate: (query) => {
              const key = query.queryKey;
              return (
                Array.isArray(key) &&
                key.length >= 2 &&
                key[0] === "courses" &&
                (key[1] === "list" || key[1] === "active")
              );
            },
          });
        } else {
          // For create/import mode, use the standard refresh
          await refreshTableData(false);
        }

        if (onCourseAdded) onCourseAdded();

        // Reset all state
        setImportedCoursesForSchedule([]);
        setShowScheduleAssignment(false);
        setSelectedFile(null);
        setPreviewData([]);
        setIsValidFile(false);
        setPreImportValidationErrors([]);
      } finally {
        // Clear editing states after everything is complete
        setIsEditingSchedule(false);
        if (scheduleDialogMode === "create") {
          setIsEditingCourse(false);
        }

        // Ensure loading states are cleared
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [
      refreshTableData,
      onCourseAdded,
      scheduleDialogMode,
      preImportValidationErrors,
      queryClient,
    ]
  );

  // Handle filter apply
  const handleApplyFilters = () => {
    setFacultyFilter(tempFacultyFilter);
    setSectionFilter(tempSectionFilter);
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
    if (open) {
      // When opening, set temp filters to current filter values
      setTempFacultyFilter(facultyFilter);
      setTempSectionFilter(sectionFilter);
      setTempDayFilter(dayFilter);
      setTempRoomFilter(roomFilter);
      setTempStartTimeFilter(startTimeFilter);
      setTempEndTimeFilter(endTimeFilter);
      setTempAttendanceRateSort(attendanceRateSort);
      setTempPassingRateSort(passingRateSort);
    } else {
      // When closing without applying, revert temp filters to current filter values
      setTempFacultyFilter(facultyFilter);
      setTempSectionFilter(sectionFilter);
      setTempDayFilter(dayFilter);
      setTempRoomFilter(roomFilter);
      setTempStartTimeFilter(startTimeFilter);
      setTempEndTimeFilter(endTimeFilter);
      setTempAttendanceRateSort(attendanceRateSort);
      setTempPassingRateSort(passingRateSort);
    }
    setIsFilterSheetOpen(open);
  };

  // Handle cancel - revert temp filters and close sheet
  const handleCancelFilters = () => {
    // Revert temp filters to current filter values
    setTempFacultyFilter(facultyFilter);
    setTempSectionFilter(sectionFilter);
    setTempDayFilter(dayFilter);
    setTempRoomFilter(roomFilter);
    setTempStartTimeFilter(startTimeFilter);
    setTempEndTimeFilter(endTimeFilter);
    setTempAttendanceRateSort(attendanceRateSort);
    setTempPassingRateSort(passingRateSort);
    setIsFilterSheetOpen(false);
  };

  // Check if filters are active and count them
  const getActiveFilterCount = () => {
    let count = 0;
    if (facultyFilter.length > 0 && facultyFilter[0] !== userId) {
      count++;
    }
    if (sectionFilter.length > 0) count++;
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

  // Check if academic head is viewing another faculty's courses
  const isViewingOtherFaculty =
    userRole === "ACADEMIC_HEAD" &&
    facultyFilter.length > 0 &&
    facultyFilter[0] !== userId;

  // Handle course navigation with fade out
  const handleCourseNavigate = (slug: string) => {
    // Check if there's an active RFID session for this course
    // Academic heads can always access (view-only)
    if (userRole !== "ACADEMIC_HEAD") {
      const activeSession = checkActiveRfidSession(slug);
      if (activeSession) {
        toast.error(
          `Cannot access course: RFID attendance is currently active for this course. Please wait until the attendance session ends.`,
          {
            id: `rfid-block-${slug}`,
            duration: 5000,
          }
        );
        return;
      }
    }

    setIsRedirecting(true);
    setShowRedirectingMessage(true);
    router.push(`/main/course/${slug}`);
  };

  // Get empty state message based on active filters
  const getEmptyStateMessage = () => {
    const activeFilters: string[] = [];

    // Check faculty filter
    const isFacultyFilterActive =
      facultyFilter.length > 0 && facultyFilter[0] !== userId;
    if (isFacultyFilterActive) {
      const selectedFacultyId = facultyFilter[0];
      const faculty = faculties.find((f) => f.id === selectedFacultyId);
      const facultyName = faculty?.name || "Unknown";
      activeFilters.push(`for ${facultyName}`);
    }

    // Check section filter
    if (sectionFilter.length > 0) {
      if (sectionFilter.length === 1) {
        activeFilters.push(`in section "${sectionFilter[0]}"`);
      } else {
        activeFilters.push(`in ${sectionFilter.length} selected sections`);
      }
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
      facultyFilter.length > 0 && facultyFilter[0] !== userId;
    if (isFacultyFilterActive) {
      suggestions.push("try selecting a different faculty");
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
    if (searchQuery) {
      suggestions.push("adjust your search");
    }

    if (suggestions.length > 0) {
      return `Try ${suggestions.join(" or ")}`;
    }
  };

  return (
    <div className="flex flex-col flex-grow relative">
      {/* Redirecting Message - fades in after fade-out */}
      {showRedirectingMessage && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-white/95 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
            <div className="flex gap-2">
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
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#124A69] text-center">
              Redirecting
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-gray-600 text-center">
              Please wait while we take you to the course
            </p>
          </div>
        </div>
      )}

      <div
        className={`flex flex-col flex-grow transition-opacity duration-200 relative ${
          isRedirecting ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg shadow-sm min-h-[400px] sm:min-h-[500px] md:min-h-[590px] overflow-x-visible">
          <h1 className="pl-1 sm:pl-2 pb-1 text-lg sm:text-xl md:text-2xl font-bold text-muted-foreground">
            Course Management Dashboard
          </h1>

          <div className="space-y-4 sm:space-y-5 md:space-y-6">
            {/* Search Bar and Action Buttons - Always Visible */}
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                {/* Search Bar */}
                <div className="relative w-[300px]">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search courses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={isInitialLoading || isLoading || !hasLoadedOnce}
                    className="pl-9 pr-9 h-10 sm:h-9 text-sm sm:text-base "
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      disabled={isInitialLoading || isLoading || !hasLoadedOnce}
                      className="absolute right-3 top-2.5 h-4 w-4 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-start sm:justify-end">
                  {/* Filter Button */}
                  <Button
                    variant="outline"
                    onClick={() => setIsFilterSheetOpen(true)}
                    disabled={
                      isInitialLoading ||
                      isLoading ||
                      !hasLoadedOnce ||
                      activeCoursesCount === 0
                    }
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
                    disabled={
                      isInitialLoading ||
                      isLoading ||
                      !hasLoadedOnce ||
                      activeCoursesCount === 0
                    }
                    className="gap-1 xl:gap-2 text-xs xl:text-sm px-2 xl:px-3 py-2 min-h-[44px] sm:min-h-0"
                  >
                    <Archive className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden xl:inline">Archive</span>
                  </Button>
                  {permissions.canExportData && (
                    <Button
                      variant="outline"
                      onClick={() => setShowExportPreview(true)}
                      disabled={
                        isViewingOtherFaculty ||
                        isInitialLoading ||
                        isLoading ||
                        !hasLoadedOnce ||
                        activeCoursesCount === 0
                      }
                      className="gap-1 xl:gap-2 text-xs xl:text-sm px-2 xl:px-3 py-2 min-h-[44px] sm:min-h-0"
                      title={
                        isViewingOtherFaculty
                          ? "Cannot export courses for other faculties"
                          : "Export courses"
                      }
                    >
                      <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden xl:inline">Export</span>
                    </Button>
                  )}
                  {permissions.canImportCourses && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (hasReachedMaxActiveCourses) {
                          toast.error(
                            `Maximum limit of ${MAX_ACTIVE_COURSES} active courses reached. Please archive some courses before importing new ones.`
                          );
                          return;
                        }
                        setShowImportPreview(true);
                      }}
                      disabled={
                        isViewingOtherFaculty ||
                        hasReachedMaxActiveCourses ||
                        isInitialLoading ||
                        isLoading ||
                        !hasLoadedOnce ||
                        activeCoursesCount === 0
                      }
                      className="gap-1 xl:gap-2 text-xs xl:text-sm px-2 xl:px-3 py-2 min-h-[44px] sm:min-h-0"
                      title={
                        isViewingOtherFaculty
                          ? "Cannot import courses for other faculties"
                          : hasReachedMaxActiveCourses
                          ? `Maximum ${MAX_ACTIVE_COURSES} active courses reached`
                          : "Import courses"
                      }
                    >
                      <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden xl:inline">Import</span>
                    </Button>
                  )}
                  {permissions.canCreateCourse && (
                    <CourseSheet
                      mode="add"
                      onSuccess={async (courseData) => {
                        // Check if limit is reached before proceeding
                        if (hasReachedMaxActiveCourses) {
                          toast.error(
                            `Maximum limit of ${MAX_ACTIVE_COURSES} active courses reached. Please archive some courses before adding new ones.`
                          );
                          return;
                        }
                        // Store course data and open schedule dialog
                        // Course is NOT created yet - waiting for schedules
                        if (courseData) {
                          setPendingCourseData(courseData);
                          setImportedCoursesForSchedule([courseData]);
                          setScheduleDialogMode("create");
                          setShowScheduleAssignment(true);
                          // Don't set loading state here - only when user confirms
                        }
                      }}
                      faculties={faculties}
                      userId={userId}
                      userRole={userRole}
                      disabled={
                        isViewingOtherFaculty ||
                        hasReachedMaxActiveCourses ||
                        isInitialLoading ||
                        isLoading ||
                        !hasLoadedOnce ||
                        activeCoursesCount === 0
                      }
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Content Area - Conditionally Rendered */}
            {isInitialLoading || isLoading || !hasLoadedOnce ? (
              <div className="space-y-4 sm:space-y-6 md:space-y-8 overflow-visible">
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#124A69] mb-4"></div>
                  <p className="text-sm text-gray-600">Loading courses...</p>
                </div>
              </div>
            ) : activeCoursesCount === 0 ? (
              // Check if academic head is viewing another faculty's courses
              (() => {
                const isViewingOtherFaculty =
                  userRole === "ACADEMIC_HEAD" &&
                  facultyFilter.length > 0 &&
                  facultyFilter[0] !== userId;

                const selectedFacultyId = isViewingOtherFaculty
                  ? facultyFilter[0]
                  : null;
                const selectedFaculty = selectedFacultyId
                  ? faculties.find((f) => f.id === selectedFacultyId)
                  : null;
                const facultyName = selectedFaculty?.name || "this faculty";

                // Show fancy empty state when there are no active courses (first time or after loading)
                return (
                  <div className="flex flex-col items-center justify-center flex-1 min-h-[400px] mb-4 rounded-md border border-dashed border-gray-300 bg-gray-50/50 relative overflow-hidden">
                    <div className="text-center px-4 pb-8 z-10 relative">
                      <div className="mb-8">
                        <SplitText
                          text={
                            isViewingOtherFaculty
                              ? `No Courses for ${facultyName}`
                              : "Welcome to your Course Management"
                          }
                          className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#124A69]"
                          delay={0.2}
                          duration={0.6}
                          stagger={0.03}
                        />
                      </div>
                      <AnimatedContent
                        container={null}
                        delay={1.5}
                        duration={0.8}
                        direction="vertical"
                        distance={30}
                        initialOpacity={0}
                        className="mt-6"
                        onComplete={() => {}}
                        onDisappearanceComplete={() => {}}
                      >
                        <p className="text-lg sm:text-xl text-gray-600 mb-4">
                          {isViewingOtherFaculty
                            ? `${facultyName} has no active courses yet.`
                            : hasReachedMaxActiveCourses
                            ? `Maximum limit of ${MAX_ACTIVE_COURSES} active courses reached. Please archive some courses before adding new ones.`
                            : "Get started by adding your first course!"}
                        </p>
                        {!isViewingOtherFaculty && (
                          <p className="text-sm sm:text-base text-gray-500">
                            {getEmptyStateSubMessage()}
                          </p>
                        )}
                      </AnimatedContent>
                      {!hasReachedMaxActiveCourses &&
                        !isViewingOtherFaculty && (
                          <div className="flex items-center justify-center mt-8 gap-3 flex-wrap">
                            {permissions.canCreateCourse && (
                              <CourseSheet
                                mode="add"
                                onSuccess={async (courseData) => {
                                  if (courseData) {
                                    setIsEditingCourse(true);
                                    setPendingCourseData(courseData);
                                    setImportedCoursesForSchedule([courseData]);
                                    setScheduleDialogMode("create");
                                    setShowScheduleAssignment(true);
                                    setIsEditingSchedule(true);
                                  }
                                }}
                                faculties={faculties}
                                userId={userId}
                                userRole={userRole}
                                disabled={
                                  isViewingOtherFaculty ||
                                  hasReachedMaxActiveCourses
                                }
                              />
                            )}
                            {permissions.canImportCourses && (
                              <>
                                <span className="text-gray-500">or</span>
                                <Button
                                  onClick={() => {
                                    if (hasReachedMaxActiveCourses) {
                                      toast.error(
                                        `Maximum limit of ${MAX_ACTIVE_COURSES} active courses reached. Please archive some courses before importing new ones.`
                                      );
                                      return;
                                    }
                                    setShowImportPreview(true);
                                  }}
                                  variant="outline"
                                  disabled={
                                    isViewingOtherFaculty ||
                                    hasReachedMaxActiveCourses
                                  }
                                  className="border-[#124A69] text-[#124A69] hover:bg-[#124A69] hover:text-white gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Upload className="w-4 h-4" />
                                  Import Courses
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                );
              })()
            ) : tableData.length > 0 ? (
              <>
                {filteredCourses.length > 0 ? (
                  <div className="space-y-4 sm:space-y-6 md:space-y-8 overflow-visible">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5 md:gap-6 overflow-visible p-2">
                      {paginatedCourses.map((course, index) =>
                        shouldAnimate ? (
                          <AnimatedContent
                            key={course.id}
                            distance={150}
                            direction="horizontal"
                            reverse={true}
                            duration={1.2}
                            ease="power3.out"
                            initialOpacity={0.2}
                            animateOpacity
                            threshold={0.1}
                            delay={0.2 + index * 0.08}
                            container="snap-main-container"
                            onComplete={() => {}}
                            onDisappearanceComplete={() => {}}
                          >
                            <CourseCard
                              course={course}
                              onEdit={handleEditCourse}
                              onAddSchedule={handleAddSchedule}
                              onViewDetails={handleViewDetails}
                              onNavigate={handleCourseNavigate}
                              itemsPerPage={itemsPerPage}
                              userRole={userRole}
                              facultyFilter={facultyFilter}
                              userId={userId}
                            />
                          </AnimatedContent>
                        ) : (
                          <CourseCard
                            key={course.id}
                            course={course}
                            onEdit={handleEditCourse}
                            onAddSchedule={handleAddSchedule}
                            onViewDetails={handleViewDetails}
                            onNavigate={handleCourseNavigate}
                            itemsPerPage={itemsPerPage}
                            userRole={userRole}
                            facultyFilter={facultyFilter}
                            userId={userId}
                          />
                        )
                      )}
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
                          out of {filteredCourses.length} courses
                        </span>

                        <Pagination className="justify-end">
                          <PaginationContent className="flex gap-1">
                            <PaginationItem>
                              <PaginationPrevious
                                onClick={() =>
                                  !shouldAnimate &&
                                  currentPage > 1 &&
                                  handlePageChange(currentPage - 1)
                                }
                                className={`min-h-[44px] sm:min-h-0 ${
                                  currentPage === 1 || shouldAnimate
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
                                if (
                                  currentPage > 2 &&
                                  currentPage < totalPages - 1
                                ) {
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
                                    onClick={() =>
                                      !shouldAnimate &&
                                      handlePageChange(item as number)
                                    }
                                    isActive={currentPage === item}
                                    className={`hidden sm:inline-flex min-h-[44px] sm:min-h-0 ${
                                      shouldAnimate
                                        ? "pointer-events-none opacity-50"
                                        : currentPage === item
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
                                  !shouldAnimate &&
                                  currentPage < totalPages &&
                                  handlePageChange(currentPage + 1)
                                }
                                className={`min-h-[44px] sm:min-h-0 ${
                                  currentPage === totalPages || shouldAnimate
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
              </>
            ) : null}

            {/* Export Dialog */}
            <ExportDialog
              open={showExportPreview}
              onOpenChange={setShowExportPreview}
              courses={filteredCourses}
              allCourses={baseFilteredCourses}
              onExport={handleExport}
              userRole={userRole}
              userId={userId}
              faculties={faculties}
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

            {/* Validating Dialog */}
            <Dialog open={showValidatingDialog} onOpenChange={() => {}}>
              <DialogContent className="w-[90vw] sm:w-[80vw] md:w-[70vw] lg:w-[60vw] max-w-[500px] p-4 sm:p-6">
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold text-[#124A69]">
                    Validating Courses
                  </DialogTitle>
                  <DialogDescription>
                    Please wait while we validate your import data...
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-6 flex items-center justify-center gap-4 py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#124A69]" />
                  <p className="text-sm font-medium text-gray-700">
                    Checking for duplicates and validation errors...
                  </p>
                </div>
              </DialogContent>
            </Dialog>

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
                // Only clear state if dialog is being closed AND we're not in the middle of creating/editing
                // The dialog closes itself before calling onComplete, so we need to keep loading state
                // until onComplete finishes (which happens after the mutation completes)
                if (!open && !isEditingSchedule) {
                  // Only clear if we're not currently processing (user canceled)
                  setPendingCourseData(null);
                  if (scheduleDialogMode === "create") {
                    setIsEditingCourse(false);
                  }
                }
              }}
              courses={
                scheduleDialogMode === "create"
                  ? [pendingCourseData]
                  : importedCoursesForSchedule
              }
              onComplete={async (importResults) => {
                // Keep loading state true during course creation
                // Loading states will be cleared in handleScheduleAssignmentComplete after everything is done
                await handleScheduleAssignmentComplete(importResults);
              }}
              mode={scheduleDialogMode}
              maxActiveCourses={MAX_ACTIVE_COURSES}
              currentActiveCount={activeCoursesCount}
            />

            <CourseSettingsDialog
              open={showSettingsDialog}
              onOpenChange={setShowSettingsDialog}
              courses={filterArchivableCourses(
                tableData.filter((course) => course.facultyId === userId),
                userId
              )}
              onArchiveCourses={handleArchiveCourses}
              onUnarchiveCourses={handleUnarchiveCourses}
              userId={userId}
              userRole={userRole}
              faculties={faculties}
            />

            {/* Filter Sheet */}
            <Sheet
              open={isFilterSheetOpen}
              onOpenChange={handleFilterSheetOpen}
            >
              <SheetContent
                side="right"
                className="w-[340px] sm:w-[400px] p-0 flex flex-col"
              >
                <div className="p-6 border-b flex-shrink-0 bg-[#124A69]/5">
                  <SheetHeader>
                    <SheetTitle className="text-xl font-semibold text-[#124A69]">
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

                  {/* Filter by Section */}
                  {availableSections.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-[#124A69]">
                        Filter by Section
                      </Label>
                      <div className="space-y-2 max-h-48 overflow-y-auto border-2 border-[#124A69]/20 rounded-md p-3 bg-gray-50/50">
                        <div className="flex items-center space-x-2 p-1.5 rounded hover:bg-[#124A69]/5 transition-colors">
                          <Checkbox
                            id="section-all"
                            checked={
                              tempSectionFilter.length === 0 ||
                              availableSections.every((section) =>
                                tempSectionFilter.some(
                                  (s) =>
                                    s.trim().toUpperCase() ===
                                    section.trim().toUpperCase()
                                )
                              )
                            }
                            onCheckedChange={(checked) => {
                              if (checked) {
                                // Normalize sections when setting all
                                setTempSectionFilter(
                                  availableSections.map((s) => s.trim())
                                );
                              } else {
                                setTempSectionFilter([]);
                              }
                            }}
                            className="data-[state=checked]:bg-[#124A69] data-[state=checked]:border-[#124A69] border-[#124A69]/30"
                          />
                          <Label
                            htmlFor="section-all"
                            className="text-sm font-medium cursor-pointer text-[#124A69]"
                          >
                            All Sections ({availableSections.length})
                          </Label>
                        </div>
                        {availableSections.map((section) => (
                          <div
                            key={section}
                            className="flex items-center space-x-2 p-1.5 rounded hover:bg-[#124A69]/5 transition-colors"
                          >
                            <Checkbox
                              id={`section-${section}`}
                              checked={tempSectionFilter.some(
                                (s) =>
                                  s.trim().toUpperCase() ===
                                  section.trim().toUpperCase()
                              )}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  // Add section if not already in filter (case-insensitive check)
                                  setTempSectionFilter((prev) => {
                                    const normalizedSection = section.trim();
                                    const alreadyExists = prev.some(
                                      (s) =>
                                        s.trim().toUpperCase() ===
                                        normalizedSection.toUpperCase()
                                    );
                                    if (alreadyExists) return prev;
                                    return [...prev, normalizedSection];
                                  });
                                } else {
                                  // Remove section (case-insensitive)
                                  setTempSectionFilter((prev) =>
                                    prev.filter(
                                      (s) =>
                                        s.trim().toUpperCase() !==
                                        section.trim().toUpperCase()
                                    )
                                  );
                                }
                              }}
                              className="data-[state=checked]:bg-[#124A69] data-[state=checked]:border-[#124A69] border-[#124A69]/30"
                            />
                            <Label
                              htmlFor={`section-${section}`}
                              className="text-sm cursor-pointer text-gray-700 hover:text-[#124A69] transition-colors"
                            >
                              {section}
                            </Label>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500">
                        Select one or more sections to filter courses
                      </p>
                    </div>
                  )}

                  {/* Filter by Day */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="day-filter"
                      className="text-sm font-medium text-[#124A69]"
                    >
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
                    <Label
                      htmlFor="room-filter"
                      className="text-sm font-medium text-[#124A69]"
                    >
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
                      <Label className="text-sm font-medium text-[#124A69]">
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
                      <Label className="text-sm font-medium text-[#124A69]">
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
                      className="text-sm font-medium text-[#124A69]"
                    >
                      Sort by Attendance Rate
                    </Label>
                    <Select
                      value={tempAttendanceRateSort}
                      onValueChange={(value: "asc" | "desc" | "none") =>
                        setTempAttendanceRateSort(value)
                      }
                    >
                      <SelectTrigger
                        id="attendance-rate-sort"
                        className="w-full"
                      >
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
                      className="text-sm font-medium text-[#124A69]"
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
                <div className="p-6 border-t bg-[#124A69]/5 flex-shrink-0">
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={handleCancelFilters}
                      className="flex-1 border-[#124A69]/30 text-[#124A69] hover:bg-[#124A69]/10"
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
                onSuccess={async () => {
                  // Set loading state when user confirms the edit
                  setIsEditingCourse(true);
                  setIsLoading(true);

                  try {
                    await refreshTableData(true);
                  } catch (error) {
                    toast.error("Failed to refresh course data");
                  } finally {
                    setIsEditingCourse(false);
                    setIsLoading(false);
                    setEditingCourse(null);
                  }
                }}
                onClose={() => {
                  setIsEditingCourse(false);
                }}
                faculties={faculties}
                userId={userId}
                userRole={userRole}
                open={!!editingCourse}
                onOpenChange={(open) => {
                  if (!open) {
                    setIsEditingCourse(false);
                    setEditingCourse(null);
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
