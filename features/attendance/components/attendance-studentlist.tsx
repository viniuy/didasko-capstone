"use client";

import {
  useState,
  useMemo,
  useEffect,
  Fragment,
  useRef,
  useCallback,
  useTransition,
} from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import {
  Download,
  Search,
  ChevronLeft,
  CalendarIcon,
  MoreHorizontal,
  Filter,
  MousePointerClick,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format, isToday } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import toast from "react-hot-toast";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { StudentCard } from "./student-card";
import { FilterSheet } from "./filter-sheet";
import { LoadingSpinner } from "@/features/courses/components/ui-components";
import Link from "next/link";
import { AttendanceStatus } from "@prisma/client";
import { FilterState } from "@/shared/types/attendance";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useStudentsByCourse,
  useAttendanceByCourse,
  useAttendanceStats,
  useAttendanceDates,
  useRecordAttendance,
  useBatchAttendance,
  useClearAttendance,
  useCreateStudent,
  useImportStudentsToCourse,
} from "@/lib/hooks/queries";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/hooks/queries/queryKeys";

// Add interface for Excel data
interface ExcelRow {
  Students: string;
  Name: string;
  Status: string;
  Date: string;
}

interface AddStudentSheetProps {
  onAddStudent: (student: {
    lastName: string;
    firstName: string;
    middleInitial?: string;
    image?: string;
  }) => Promise<void>;
  onSelectExistingStudent: (student: {
    id: string;
    lastName: string;
    firstName: string;
    middleInitial?: string;
    image?: string;
  }) => Promise<void>;
  onStudentsRemoved: () => void;
}

interface Student {
  id: string;
  name: string;
  image?: string;
  rfid?: string;
  status: AttendanceStatusWithNotSet;
  attendanceRecords: AttendanceRecord[];
}

type AttendanceStatusWithNotSet = AttendanceStatus | "NOT_SET";

interface AttendanceRecord {
  id: string;
  studentId: string;
  courseId: string;
  date: string;
  status: AttendanceStatus;
  reason: string | null;
}

interface Course {
  id: string;
  title: string;
  code: string;
  description: string | null;
  semester: string;
  section: string;
  slug: string;
  academicYear: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  attendanceStats?: {
    totalAbsents: number;
    lastAttendanceDate: string | null;
  };
}

// Helper function for debouncing
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export default function StudentList({ courseSlug }: { courseSlug: string }) {
  const [showExcuseModal, setShowExcuseModal] = useState(false);
  const [showBacktrackConfirm, setShowBacktrackConfirm] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    index: number;
    status: AttendanceStatus;
  } | null>(null);
  const [excuseReason, setExcuseReason] = useState("");
  const [pendingExcusedStudent, setPendingExcusedStudent] = useState<{
    index: number;
    status: AttendanceStatus;
  } | null>(null);
  const [isBulkExcuse, setIsBulkExcuse] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [studentList, setStudentList] = useState<Student[]>([]);
  const [open, setOpen] = useState(false);
  const [courseInfo, setCourseInfo] = useState<Course | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortDate] = useState<"newest" | "oldest" | "">("");
  const [windowDimensions, setWindowDimensions] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  });
  const itemsPerPage = useMemo(() => {
    if (windowDimensions.height < 740) {
      return 5;
    }
    if (windowDimensions.width < 1025 && windowDimensions.height > 740) {
      return 6;
    }
    return 10;
  }, [windowDimensions.width, windowDimensions.height]);

  const gridColsClass = useMemo(() => {
    if (windowDimensions.width < 1025 && windowDimensions.height > 740) {
      return "grid grid-cols-3 gap-4";
    }
    return "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4";
  }, [windowDimensions.width, windowDimensions.height]);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    status: [],
  });
  const [tempFilters, setTempFilters] = useState<FilterState>({
    status: [],
  });
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const [isLoading, setIsLoading] = useState(true);
  const [unsavedChanges, setUnsavedChanges] = useState<{
    [key: string]: AttendanceStatus;
  }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState<{
    [key: number]: boolean;
  }>({});
  const [isDateLoading, setIsDateLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [attendanceStats, setAttendanceStats] = useState<{
    totalAbsents: number;
    lastAttendanceDate: string | null;
  }>({
    totalAbsents: 0,
    lastAttendanceDate: null,
  });
  const [showMarkAllConfirm, setShowMarkAllConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [attendanceDates, setAttendanceDates] = useState<Date[]>([]);
  const [previousAttendance, setPreviousAttendance] = useState<Record<
    string,
    AttendanceStatus
  > | null>(null);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [cooldownMap, setCooldownMap] = useState<{ [key: string]: boolean }>(
    {}
  );
  const [savingStudents, setSavingStudents] = useState<Set<string>>(new Set());
  const [isUpdating, setIsUpdating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [isSavingRfidAttendance, setIsSavingRfidAttendance] = useState(false);
  const isSavingRfidAttendanceRef = useRef(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [showTimeSetupModal, setShowTimeSetupModal] = useState(false);
  const [graceMinutes, setGraceMinutes] = useState<number>(5);
  const [gracePeriodError, setGracePeriodError] = useState<string>("");
  const [restoredFromStorage, setRestoredFromStorage] = useState(false);
  const [attendanceStartTime, setAttendanceStartTime] = useState<Date | null>(
    null
  );
  const [isSelecting, setIsSelecting] = useState(false);
  const [timeoutTimer, setTimeoutTimer] = useState<NodeJS.Timeout | null>(null);
  const [gracePeriodTimer, setGracePeriodTimer] =
    useState<NodeJS.Timeout | null>(null);
  const [isInGracePeriod, setIsInGracePeriod] = useState(false);
  const [graceTimeoutTimer, setGraceTimeoutTimer] =
    useState<NodeJS.Timeout | null>(null);
  const [graceCountdown, setGraceCountdown] = useState<string>("");
  const [rfidInput, setRfidInput] = useState("");
  const [isProcessingRfid, setIsProcessingRfid] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const rfidInputRef = useRef<HTMLInputElement>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastKeyTimeRef = useRef<number>(0);
  const isRfidScanRef = useRef<boolean>(false);
  const batchSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [timeIn, setTimeIn] = useState<string>("");
  const [timeOut, setTimeOut] = useState<string>("");

  const [pendingAttendanceUpdates, setPendingAttendanceUpdates] = useState<{
    [studentId: string]: {
      status: AttendanceStatus;
      timestamp: Date;
      rfid: string;
    };
  }>({});
  const pendingUpdatesRef = useRef(pendingAttendanceUpdates);
  useEffect(() => {
    pendingUpdatesRef.current = pendingAttendanceUpdates;
  }, [pendingAttendanceUpdates]);
  const [rfidPreviewStudent, setRfidPreviewStudent] = useState<{
    name: string;
    image?: string;
    studentId?: string;
  } | null>(null);
  const [localTimeInMap, setLocalTimeInMap] = useState<{
    [studentId: string]: string;
  }>({});

  const [isPending, startTransition] = useTransition();

  const getStorageKey = (name: string) =>
    courseSlug ? `attendance:${courseSlug}:${name}` : `attendance::${name}`;

  // Helper function to dispatch attendance update event
  const dispatchAttendanceUpdate = useCallback(() => {
    const event = new CustomEvent("attendanceUpdated", {
      detail: { courseSlug },
    });
    window.dispatchEvent(event);
  }, [courseSlug]);

  const selectedDateStr = useMemo(
    () => (selectedDate ? format(selectedDate, "yyyy-MM-dd") : null),
    [selectedDate]
  );

  const attendanceDateSet = useMemo(() => {
    return new Set(attendanceDates.map((d) => format(d, "yyyy-MM-dd")));
  }, [attendanceDates]);

  const hasAttendanceForSelectedDate = useMemo(() => {
    return selectedDateStr ? attendanceDateSet.has(selectedDateStr) : false;
  }, [selectedDateStr, attendanceDateSet]);

  const attendanceTimeout = useMemo(() => {
    if (!timeIn || !timeOut || !attendanceStartTime) return 0;

    const today = new Date();
    const timeInDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const [hours, minutes] = timeIn.split(":").map(Number);
    timeInDate.setHours(hours, minutes, 0, 0);

    const timeOutDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const [outHours, outMinutes] = timeOut.split(":").map(Number);
    timeOutDate.setHours(outHours, outMinutes, 0, 0);

    const timeoutMs = timeOutDate.getTime() - timeInDate.getTime();
    return Math.floor(timeoutMs / (1000 * 60));
  }, [timeIn, timeOut, attendanceStartTime]);

  const gracePeriod = useMemo(() => {
    // Grace period is 5 minutes after timeout
    return 5;
  }, []);

  const toggleSelectMode = () => {
    setIsSelecting((prev) => !prev);
    if (isSelecting) setSelectedStudents([]);
  };

  const handleSelectStudent = (id: string) => {
    setSelectedStudents((prev) =>
      prev.includes(id)
        ? prev.filter((studentId) => studentId !== id)
        : [...prev, id]
    );
  };

  // React Query hooks for data fetching
  const queryClient = useQueryClient();

  // Helper function to refetch all attendance data (used after mutations)
  const refetchAllAttendance = useCallback(() => {
    queryClient.refetchQueries({
      queryKey: [...queryKeys.attendance.byCourse(courseSlug), "all"],
    });
    queryClient.refetchQueries({
      queryKey: queryKeys.attendance.dates(courseSlug),
    });
    queryClient.refetchQueries({
      queryKey: queryKeys.attendance.stats(courseSlug),
    });
  }, [courseSlug, queryClient]);

  const { data: studentsData, isLoading: isLoadingStudents } =
    useStudentsByCourse(courseSlug, selectedDate || undefined);

  // Fetch attendance only for the selected date
  const { data: attendanceData, isLoading: isLoadingAttendance } =
    useAttendanceByCourse(
      courseSlug,
      selectedDateStr || "",
      { limit: 1000 } // Fetch all records for the date
    );

  const { data: attendanceStatsData } = useAttendanceStats(courseSlug);
  const { data: attendanceDatesData } = useAttendanceDates(courseSlug);

  // React Query mutations
  const recordAttendanceMutation = useRecordAttendance();
  const batchAttendanceMutation = useBatchAttendance();
  const clearAttendanceMutation = useClearAttendance();
  const createStudentMutation = useCreateStudent();
  const importStudentsMutation = useImportStudentsToCourse();

  // Update local state when React Query data changes
  useEffect(() => {
    if (studentsData?.students) {
      // Initialize attendance map from attendanceData if available
      const attendanceMap = new Map<string, AttendanceRecord>();
      if (
        attendanceData?.attendance &&
        Array.isArray(attendanceData.attendance) &&
        selectedDateStr
      ) {
        attendanceData.attendance.forEach((record: any) => {
          attendanceMap.set(record.studentId, record);
        });
      }

      const students = studentsData.students.map((student: any) => {
        const record = attendanceMap.get(student.id);

        // Convert rfid_id (Int? - nullable integer) to rfid (string) for RFID scanner compatibility
        // Schema: rfid_id is Int? (nullable integer) in the database
        let rfid: string | undefined = undefined;

        // Check if rfid_id exists and is a valid number
        if (student.rfid_id != null) {
          // rfid_id is Int? so it should be a number when not null
          // Convert to string for RFID scanner (scanners typically send strings)
          const rfidValue =
            typeof student.rfid_id === "number"
              ? student.rfid_id
              : typeof student.rfid_id === "string"
              ? parseInt(student.rfid_id, 10)
              : null;

          // Only set rfid if we have a valid number
          if (rfidValue != null && !isNaN(rfidValue)) {
            rfid = String(rfidValue);
          }
        }

        // Debug: Log rfid_id to see what we're getting (only in development)
        if (process.env.NODE_ENV === "development") {
          console.log("Student RFID mapping:", {
            studentId: student.studentId,
            name: `${student.lastName}, ${student.firstName}`,
            rfid_id_raw: student.rfid_id,
            rfid_id_type: typeof student.rfid_id,
            rfid_id_is_null: student.rfid_id === null,
            rfid_id_is_undefined: student.rfid_id === undefined,
            rfid_final: rfid,
            has_rfid: !!rfid,
          });
        }

        return {
          ...student,
          name: `${student.lastName}, ${student.firstName}${
            student.middleInitial ? ` ${student.middleInitial}.` : ""
          }`,
          rfid: rfid,
          status: (record?.status || "NOT_SET") as AttendanceStatusWithNotSet,
          attendanceRecords: record
            ? [
                {
                  id: record.id,
                  studentId: student.id,
                  courseId: studentsData.course?.id || "",
                  status: record.status,
                  date: selectedDateStr || "",
                  reason: record.reason,
                },
              ]
            : [],
        };
      });

      // Debug: Log final student list to verify rfid is set
      if (process.env.NODE_ENV === "development") {
        console.log(
          "Final student list with RFID:",
          students.map((s: Student) => ({
            name: s.name,
            rfid: s.rfid,
            hasRfid: !!s.rfid,
          }))
        );
      }

      setStudentList(students);
      if (studentsData.course) {
        setCourseInfo({
          id: studentsData.course.id,
          code: studentsData.course.code,
          title: studentsData.course.title,
          description: studentsData.course.description,
          semester: studentsData.course.semester,
          section: studentsData.course.section,
          slug: studentsData.course.slug,
          academicYear: studentsData.course.academicYear,
          status: studentsData.course.status,
        });
      }
    }
  }, [studentsData, attendanceData, selectedDateStr]);

  // Create RFID map after studentsData is available
  const studentByRfidMap = useMemo(() => {
    const map = new Map<string, Student>();
    studentList.forEach((student) => {
      // Use rfid from student (which is mapped from rfid_id)
      if (student.rfid) {
        const normalized = student.rfid.replace(/\s+/g, "").toUpperCase();
        // Store both the normalized version and the numeric version (without leading zeros)
        // to handle different RFID scanner formats
        map.set(normalized, student);
        const numeric = normalized.replace(/^0+/, "") || normalized;
        if (numeric !== normalized) {
          map.set(numeric, student);
        }
      }
      // Also check raw rfid_id from studentsData if available (fallback)
      if (studentsData?.students) {
        const rawStudent = studentsData.students.find(
          (s: any) => s.id === student.id
        );
        if (rawStudent?.rfid_id && !student.rfid) {
          // If student.rfid is missing but rfid_id exists, use it
          const rfidStr = String(rawStudent.rfid_id);
          const normalized = rfidStr.replace(/\s+/g, "").toUpperCase();
          map.set(normalized, student);
          const numeric = normalized.replace(/^0+/, "") || normalized;
          if (numeric !== normalized) {
            map.set(numeric, student);
          }
        }
      }
    });
    return map;
  }, [studentList, studentsData]);

  useEffect(() => {
    // Always update student list when attendance data changes, even if empty
    // This ensures attendance status is properly set on first load
    if (selectedDateStr && studentList.length > 0) {
      const attendanceMap = new Map<string, AttendanceRecord>();

      // Only create map if attendance data exists
      if (
        attendanceData?.attendance &&
        Array.isArray(attendanceData.attendance)
      ) {
        attendanceData.attendance.forEach((record: any) => {
          attendanceMap.set(record.studentId, record);
        });
      }

      setStudentList((prevStudents) =>
        prevStudents.map((student) => {
          const record = attendanceMap.get(student.id);
          return {
            ...student,
            status: record?.status || "NOT_SET",
            attendanceRecords: record
              ? [
                  {
                    id: record.id,
                    studentId: student.id,
                    courseId: courseInfo?.id || "",
                    status: record.status,
                    date: selectedDateStr,
                    reason: record.reason,
                  },
                ]
              : [],
          };
        })
      );
      setUnsavedChanges({});
    }
  }, [attendanceData, selectedDateStr, courseInfo?.id, studentList.length]);

  useEffect(() => {
    if (attendanceStatsData) {
      setAttendanceStats(attendanceStatsData);
    }
  }, [attendanceStatsData]);

  useEffect(() => {
    if (attendanceDatesData?.dates) {
      const uniqueDates = attendanceDatesData.dates
        .map((dateStr: string) => {
          const date = new Date(dateStr);
          return isNaN(date.getTime()) ? null : date;
        })
        .filter((date: Date | null): date is Date => date !== null)
        .sort((a: Date, b: Date) => a.getTime() - b.getTime());
      setAttendanceDates(uniqueDates);
    }
  }, [attendanceDatesData]);

  useEffect(() => {
    // Only set loading to true if it's the initial load
    // After initial load, we don't want to show the full loading spinner
    if (isInitialLoad) {
      setIsLoading(isLoadingStudents || isLoadingAttendance);
    } else {
      // After initial load, only set date loading for individual button states
      setIsLoading(false);
    }
    setIsDateLoading(isLoadingAttendance);

    // Track initial load - once data is loaded, we're past initial load
    // Only set to false once, never reset it back to true
    if (!isLoadingStudents && !isLoadingAttendance && isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [isLoadingStudents, isLoadingAttendance, isInitialLoad]);

  // No need to refetch when date changes - we filter client-side now
  // Only refetch all attendance data when new attendance is recorded (handled in mutations)

  // Data fetching is now handled by React Query hooks above

  // Track window dimensions for responsive itemsPerPage
  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // Set initial dimensions
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Restore persisted times and session state
  useEffect(() => {
    try {
      const savedTimeIn = localStorage.getItem(getStorageKey("timeIn"));
      const savedTimeOut = localStorage.getItem(getStorageKey("timeOut"));
      const savedSession = localStorage.getItem(getStorageKey("session"));
      const savedSelectedDate = localStorage.getItem(getStorageKey("date"));

      if (savedTimeIn) setTimeIn(savedTimeIn);
      if (savedTimeOut) setTimeOut(savedTimeOut);
      if (savedSelectedDate) {
        const parsed = new Date(savedSelectedDate);
        if (!isNaN(parsed.getTime())) setSelectedDate(parsed);
      }

      if (savedSession) {
        const session = JSON.parse(savedSession) as {
          startedAt: string;
          isInGrace: boolean;
        };
        const startedAt = new Date(session.startedAt);
        if (!isNaN(startedAt.getTime())) {
          setAttendanceStartTime(startedAt);
          setShowTimeoutModal(true);
          setIsInGracePeriod(session.isInGrace || false);

          if (timeIn && timeOut) {
            const today = new Date();
            const [hIn, mIn] = timeIn.split(":").map(Number);
            const [hOut, mOut] = timeOut.split(":").map(Number);
            const tIn = new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate(),
              hIn,
              mIn,
              0,
              0
            );
            const tOut = new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate(),
              hOut,
              mOut,
              0,
              0
            );
            const totalMs = tOut.getTime() - tIn.getTime();
            const elapsedMs = Date.now() - startedAt.getTime();
            const remainingMs = Math.max(0, totalMs - elapsedMs);

            if (remainingMs > 0) {
              const timeout = setTimeout(() => {
                handleAttendanceTimeout();
              }, remainingMs);
              setTimeoutTimer(timeout);

              const graceRemainingMs = remainingMs + gracePeriod * 60 * 1000;
              const grace = setTimeout(() => {
                handleGracePeriodEnd();
              }, graceRemainingMs);
              setGracePeriodTimer(grace);
            } else {
              const pastByMs = Math.abs(remainingMs);
              if (pastByMs < gracePeriod * 60 * 1000) {
                setIsInGracePeriod(true);
                const leftMs = gracePeriod * 60 * 1000 - pastByMs;
                const grace = setTimeout(() => {
                  handleGracePeriodEnd();
                }, leftMs);
                setGracePeriodTimer(grace);
              } else {
                setIsInGracePeriod(false);
              }
            }
          }
        }
      }
    } catch (e) {
      // ignore
    } finally {
      setRestoredFromStorage(true);
    }
  }, [courseSlug]);

  const getAttendanceForDate = (student: Student, date: Date | undefined) => {
    if (!date) return null;
    const dateStr = format(date, "yyyy-MM-dd");
    const record = student.attendanceRecords.find((record) => {
      const recordDate = record.date.split("T")[0];
      return recordDate === dateStr;
    });
    return record;
  };

  const filteredStudents = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();

    return studentList
      .filter((student) => {
        if (searchQuery && !student.name.toLowerCase().includes(searchLower)) {
          return false;
        }
        if (
          filters.status.length > 0 &&
          !filters.status.includes(student.status)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Primary sort: Alphabetical by name
        const nameComparison = a.name.localeCompare(b.name);
        if (nameComparison !== 0) return nameComparison;

        // Secondary sort: By date (if sortDate is set)
        if (sortDate) {
          const aAttendance = getAttendanceForDate(a, selectedDate);
          const bAttendance = getAttendanceForDate(b, selectedDate);
          if (sortDate === "newest") {
            return (bAttendance?.date || "").localeCompare(
              aAttendance?.date || ""
            );
          }
          return (aAttendance?.date || "").localeCompare(
            bAttendance?.date || ""
          );
        }

        return 0;
      });
  }, [studentList, searchQuery, selectedDate, filters.status, sortDate]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredStudents.length / itemsPerPage)),
    [filteredStudents.length, itemsPerPage]
  );

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    startTransition(() => {
      setSearchQuery(value);
      setCurrentPage(1);
    });
  }, []);

  const bulkUpdateStatus = async (status: AttendanceStatus) => {
    if (selectedStudents.length === 0) return;

    // Clear selection immediately when user picks a status
    const studentsToUpdate = [...selectedStudents];
    setSelectedStudents([]);

    if (status === "EXCUSED") {
      setIsBulkExcuse(true);
      setShowExcuseModal(true);
      // For EXCUSED, we need to keep the selection until modal is submitted
      // So restore it temporarily - it will be cleared in updateBulkExcusedStatuses
      setSelectedStudents(studentsToUpdate);
      return;
    }

    // Exit selection mode after picking a status
    setIsSelecting(false);

    studentsToUpdate.forEach((id) => {
      const index = filteredStudents.findIndex((s) => s.id === id);
      if (index !== -1) {
        updateStatusContinue(index, status);
      }
    });
  };

  const updateBulkExcusedStatuses = async (
    studentIds: string[],
    reason: string
  ) => {
    if (studentIds.length === 0 || !reason.trim()) return;

    setIsUpdating(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    // 1. IMMEDIATELY update local studentList array
      setStudentList((prev) =>
        prev.map((s) => {
        if (studentIds.includes(s.id)) {
            const existingRecordIndex = s.attendanceRecords.findIndex(
              (r) => r.date === dateStr
            );
          const newRecord: AttendanceRecord = {
            id:
              existingRecordIndex >= 0
                ? s.attendanceRecords[existingRecordIndex].id
                : crypto.randomUUID(),
            studentId: s.id,
            courseId: courseSlug,
            status: "EXCUSED",
            date: dateStr,
            reason: reason.trim(),
          };

            return {
              ...s,
            status: "EXCUSED",
              attendanceRecords:
                existingRecordIndex >= 0
                  ? s.attendanceRecords.map((r, idx) =>
                    idx === existingRecordIndex ? newRecord : r
                    )
                : [...s.attendanceRecords, newRecord],
            };
          }
          return s;
        })
      );

    // 2. Save to database
    setSavingStudents(new Set(studentIds));
    try {
      await recordAttendanceMutation.mutateAsync({
        courseSlug,
        date: dateStr,
        attendance: studentIds.map((id) => ({
          studentId: id,
          status: "EXCUSED" as AttendanceStatus,
          reason: reason.trim(),
        })),
      });

      // Dispatch event to update right sidebar
      dispatchAttendanceUpdate();

      toast.success(
        `Excused ${studentIds.length} student${
          studentIds.length > 1 ? "s" : ""
        }`,
        {
          id: "attendance-update",
        }
      );
    } catch (error) {
      console.error("Bulk excuse error:", error);
      // Revert on error
      setStudentList((prev) =>
        prev.map((s) => {
          if (studentIds.includes(s.id)) {
            const record = s.attendanceRecords.find((r) => r.date === dateStr);
            return {
              ...s,
              status: record?.status || "NOT_SET",
            };
          }
          return s;
        })
      );
      toast.dismiss("error-toast");
      toast.error("Failed to bulk excuse students", {
        id: "error-toast",
      });
    } finally {
      setIsUpdating(false);
      setSelectedStudents([]);
      setSavingStudents(new Set());
    }
  };

  const handleExcusedSubmit = () => {
    if (!excuseReason.trim()) return;

    if (isBulkExcuse && selectedStudents.length > 0) {
      updateBulkExcusedStatuses(selectedStudents, excuseReason.trim());

      setIsBulkExcuse(false);
      setShowExcuseModal(false);
      setExcuseReason("");
      setPendingExcusedStudent(null);
      setSelectedStudents([]);
      // Exit selection mode after submitting excuse
      setIsSelecting(false);
      return;
    }

    if (!pendingExcusedStudent) return;

    const { index, status } = pendingExcusedStudent;
    updateStatusContinue(index, status, excuseReason.trim());

    setShowExcuseModal(false);
    setExcuseReason("");
    setPendingExcusedStudent(null);
  };

  // Simple debounce ref for batching rapid updates
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSavesRef = useRef<
    Map<string, { status: AttendanceStatus; reason?: string | null }>
  >(new Map());

  const updateStatusContinue = async (
    index: number,
    newStatus: AttendanceStatus,
    reason?: string
  ) => {
    const actualIndex = (currentPage - 1) * itemsPerPage + index;
    const student = filteredStudents[actualIndex];
    if (!student) return;

    const dateStr = format(selectedDate, "yyyy-MM-dd");

    // 1. IMMEDIATELY update local studentList array
    setStudentList((prev) =>
      prev.map((s) => {
        if (s.id === student.id) {
          // Create or update attendance record
          const existingRecordIndex = s.attendanceRecords.findIndex(
            (r) => r.date === dateStr
          );
          const newRecord: AttendanceRecord = {
            id:
              existingRecordIndex >= 0
                ? s.attendanceRecords[existingRecordIndex].id
                : crypto.randomUUID(),
            studentId: s.id,
            courseId: courseSlug,
      status: newStatus,
            date: dateStr,
      reason: reason ?? null,
    };

          return {
            ...s,
            status: newStatus,
            attendanceRecords:
              existingRecordIndex >= 0
                ? s.attendanceRecords.map((r, idx) =>
                    idx === existingRecordIndex ? newRecord : r
                  )
                : [...s.attendanceRecords, newRecord],
          };
        }
        return s;
      })
    );

    // 2. Track this update for batching
    pendingSavesRef.current.set(student.id, {
      status: newStatus,
      reason: reason ?? null,
    });

    // 3. Mark student as saving
    setSavingStudents((prev) => new Set(prev).add(student.id));

    // 4. Clear existing timeout and set new one (debounce for batching)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const updatesToSave = Array.from(pendingSavesRef.current.entries()).map(
        ([studentId, data]) => ({
          studentId,
          status: data.status,
          reason: data.reason ?? undefined,
        })
      );

      if (updatesToSave.length === 0) {
        setSavingStudents(new Set());
          return;
        }

      // Mark all students as saving
      const savingIds = new Set(updatesToSave.map((u) => u.studentId));
      setSavingStudents(savingIds);

      try {
        // Save to database
        await recordAttendanceMutation.mutateAsync({
          courseSlug,
          date: dateStr,
          attendance: updatesToSave,
        });

        // Clear pending saves
        pendingSavesRef.current.clear();

        // Clear saving state
        setSavingStudents(new Set());

        // Dispatch event to update right sidebar
        dispatchAttendanceUpdate();
      } catch (error) {
        console.error("Error saving attendance:", error);
        toast.dismiss("error-toast");
        toast.error("Failed to save attendance", {
          id: "error-toast",
        });
        // Revert local state on error
        setStudentList((prev) =>
          prev.map((s) => {
            const update = updatesToSave.find((u) => u.studentId === s.id);
            if (update) {
              // Revert to previous status (NOT_SET or find from attendanceRecords)
              const record = s.attendanceRecords.find(
                (r) => r.date === dateStr
              );
              return {
                ...s,
                status: record?.status || "NOT_SET",
              };
            }
            return s;
          })
        );
        // Clear saving state on error
        setSavingStudents(new Set());
      }
    }, 500); // 500ms debounce for batching
  };

  const updateStatus = async (index: number, newStatus: AttendanceStatus) => {
    // Check if we're backtracking (viewing a past date)
    const isBacktracking = selectedDate && !isToday(selectedDate);

    if (isBacktracking) {
      // Show confirmation dialog for past dates
      setPendingStatusChange({ index, status: newStatus });
      setShowBacktrackConfirm(true);
      return;
    }

    // For today's date, proceed normally
    if (newStatus === "EXCUSED") {
      setPendingExcusedStudent({ index, status: newStatus });
      setShowExcuseModal(true);
      return;
    }

    await updateStatusContinue(index, newStatus);
  };

  const handleBacktrackStatusConfirm = async () => {
    if (!pendingStatusChange) return;

    const { index, status } = pendingStatusChange;
    setShowBacktrackConfirm(false);

    if (status === "EXCUSED") {
      setPendingExcusedStudent({ index, status });
      setShowExcuseModal(true);
    } else {
      await updateStatusContinue(index, status);
    }

    setPendingStatusChange(null);
  };

  useEffect(() => {
    const timers = [
      timeoutTimer,
      gracePeriodTimer,
      graceTimeoutTimer,
      scanTimeoutRef.current,
      batchSaveTimeoutRef.current,
      saveTimeoutRef.current,
    ].filter(Boolean);

    return () => {
      timers.forEach((timer) => timer && clearTimeout(timer));
    };
  }, [timeoutTimer, gracePeriodTimer, graceTimeoutTimer]);

  const currentStudents = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredStudents.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredStudents, currentPage, itemsPerPage]);

  // Check if any student's attendance is being saved
  const isAnyStudentSaving = useMemo(() => {
    return savingStudents.size > 0;
  }, [savingStudents]);

  const handleExport = async () => {
    if (!selectedDate) {
      toast.dismiss("error-toast");
      toast.error("Please select a date before exporting", {
        id: "error-toast",
      });
      return;
    }

    if (filteredStudents.some((student) => student.status === "NOT_SET")) {
      toast.dismiss("error-toast");
      toast.error(
        "Please set attendance status for all students before exporting",
        { id: "error-toast" }
      );
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Attendance");

      const formattedDate = format(selectedDate, "MMMM d, yyyy");

      // Title row
      worksheet.mergeCells("A1:B1");
      const titleRow = worksheet.getCell("A1");
      titleRow.value = "ATTENDANCE RECORD";
      titleRow.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
      titleRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF124A69" },
      };
      titleRow.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(1).height = 30;

      // Date row
      worksheet.mergeCells("A2:B2");
      const dateRow = worksheet.getCell("A2");
      dateRow.value = `Export Date: ${new Date().toLocaleDateString()}`;
      dateRow.font = { italic: true, size: 11 };
      dateRow.alignment = { vertical: "middle", horizontal: "center" };

      worksheet.addRow([]);

      // Course info rows
      worksheet.addRow(["Date:", formattedDate]);
      worksheet.addRow(["Course:", courseInfo?.code || ""]);
      worksheet.addRow(["Section:", courseInfo?.section || ""]);

      worksheet.addRow([]);

      // Header row
      const headerRow = worksheet.addRow(["Student Name", "Attendance Status"]);
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

      // Student rows
      filteredStudents.forEach((student, index) => {
        const row = worksheet.addRow([
          student.name,
          student.status === "NOT_SET" ? "No Status" : student.status,
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

        // Alternating row colors for easier reading
        if (index % 2 === 1) {
          row.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF9FAFB" },
          };
        }
      });

      // Set column widths
      worksheet.getColumn(1).width = 40;
      worksheet.getColumn(2).width = 20;

      // Generate file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const filename = `attendance_${courseInfo?.code || "course"}_${format(
        selectedDate,
        "yyyy-MM-dd"
      )}.xlsx`;

      saveAs(blob, filename);
      toast.success("Attendance data exported successfully");
      setShowExportPreview(false);
    } catch (error) {
      console.error("Export error:", error);
      toast.dismiss("error-toast");
      toast.error("Failed to export attendance data", {
        id: "error-toast",
      });
    }
  };

  const handleImportExcel = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        toast.dismiss("error-toast");
        toast.error("No worksheet found in the Excel file", {
          id: "error-toast",
        });
        return;
      }

      const jsonData: ExcelRow[] = [];
      let headerRowFound = false;

      worksheet.eachRow((row, rowNumber) => {
        const values = row.values as any[];
        // ExcelJS row.values has undefined at index 0, so actual data starts at index 1
        const rowData = values.slice(1);

        // Look for header row (contains "Students", "Name", "Status", "Date")
        if (!headerRowFound) {
          const hasHeader = rowData.some((cell) => {
            const cellStr = String(cell || "").toLowerCase();
            return (
              cellStr.includes("student") ||
              cellStr.includes("name") ||
              cellStr.includes("status")
            );
          });
          if (hasHeader) {
            headerRowFound = true;
            return; // Skip header row
          }
        }

        // Skip empty rows or rows without enough data
        if (!headerRowFound || !rowData || rowData.length < 4) {
          return;
        }

        // Map columns: Students, Name, Status, Date
        jsonData.push({
          Students: String(rowData[0] || "").trim(),
          Name: String(rowData[1] || "").trim(),
          Status: String(rowData[2] || "").trim(),
          Date: String(rowData[3] || "").trim(),
        });
      });

      if (jsonData.length === 0) {
        toast.dismiss("error-toast");
        toast.error("No valid data found in the Excel file", {
          id: "error-toast",
        });
        return;
      }

      const newStudents = jsonData.map(
        (row) =>
          ({
            id: row.Students,
            name: row.Name,
            status: "NOT_SET" as AttendanceStatusWithNotSet,
            attendanceRecords: [
              {
                id: crypto.randomUUID(),
                studentId: row.Students,
                courseId: courseSlug || "",
                status: row.Status as AttendanceStatus,
                date: row.Date,
                reason: null,
              },
            ] satisfies AttendanceRecord[],
          } satisfies Student)
      );

      setStudentList(newStudents);
      setShowImportDialog(false);
      toast.success("Excel file imported successfully");
    } catch (error) {
      console.error("Error importing Excel file:", error);
      toast.dismiss("error-toast");
      toast.error("Failed to import Excel file", {
        id: "error-toast",
      });
    }
  };

  const handleAddStudent = async (student: {
    lastName: string;
    firstName: string;
    middleInitial?: string;
    image?: string;
  }) => {
    try {
      // Generate a temporary studentId if not provided
      const studentId = `TEMP-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      const newStudent = await createStudentMutation.mutateAsync({
        ...student,
        studentId,
        courseId: courseSlug,
      });

      const fullName = `${newStudent.lastName}, ${newStudent.firstName}${
        newStudent.middleInitial ? ` ${newStudent.middleInitial}.` : ""
      }`;

      setStudentList((prev) => [
        ...prev,
        {
          id: newStudent.id,
          name: fullName,
          image: newStudent.image ?? undefined,
          status: "NOT_SET" as AttendanceStatusWithNotSet,
          attendanceRecords: [],
        },
      ]);

      toast.success("Student added successfully");
    } catch (error) {
      console.error("Error adding student:", error);
      toast.dismiss("error-toast");
      toast.error("Failed to add student", {
        id: "error-toast",
      });
    }
  };

  const handleSelectExistingStudent = async (student: {
    id: string;
    lastName: string;
    firstName: string;
    middleInitial?: string;
    image?: string;
  }) => {
    try {
      await importStudentsMutation.mutateAsync({
        courseSlug,
        students: [{ studentId: student.id }],
      });

      const fullName = `${student.lastName}, ${student.firstName}${
        student.middleInitial ? ` ${student.middleInitial}.` : ""
      }`;

      const newStudent: Student = {
        id: student.id,
        name: fullName,
        image: student.image,
        status: "NOT_SET" as AttendanceStatusWithNotSet,
        attendanceRecords: [],
      };

      setStudentList((prev) => [...prev, newStudent]);
      toast.success("Student added successfully");
    } catch (error) {
      console.error("Error adding existing student:", error);
      toast.dismiss("error-toast");
      toast.error(
        error instanceof Error ? error.message : "Failed to add student",
        { id: "error-toast" }
      );
    }
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const clearAllAttendance = async () => {
    if (!selectedDate || !courseSlug) {
      toast.dismiss("error-toast");
      toast.error("Please select a date before clearing attendance", {
        id: "error-toast",
      });
      return;
    }

    setIsClearing(true);

    const allStudentCooldowns = studentList.reduce((acc, student) => {
      acc[student.id] = true;
      return acc;
    }, {} as { [key: string]: boolean });
    setCooldownMap(allStudentCooldowns);

    const dateStr = format(selectedDate, "yyyy-MM-dd");

    const recordsToDelete = studentList
      .filter((student) => student.status !== "NOT_SET")
      .map((student) => {
        const record = student.attendanceRecords.find(
          (r) => r.date === dateStr
        );
        return record?.id;
      })
      .filter((id): id is string => !!id);

    if (recordsToDelete.length === 0) {
      toast.dismiss("error-toast");
      toast.error("No attendance records to clear", {
        id: "error-toast",
      });
      setIsClearing(false);
      setCooldownMap({});
      return;
    }

    try {
      // Clear any pending saves for this date
      pendingSavesRef.current.clear();
      setPendingAttendanceUpdates({});

      // Optimistically update UI first
      setStudentList((prev) =>
        prev.map((student) => ({
          ...student,
          status: "NOT_SET",
          attendanceRecords: student.attendanceRecords.filter(
            (record) => record.date !== dateStr
          ),
        }))
      );

      // Clear attendance via mutation (this clears in the database)
      await clearAttendanceMutation.mutateAsync({
        courseSlug,
        date: dateStr,
      });

      // Invalidate the attendance query for this specific date to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.attendance.byCourse(courseSlug), dateStr],
      });
      // Invalidate attendance dates to remove the cleared date from the list
      // Use refetchType: 'active' to only refetch active queries, preventing errors from cancelled queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.dates(courseSlug),
        refetchType: "active", // Only refetch active queries
      });

      setShowClearConfirm(false);
      setClearConfirmText("");

      // Show success toast
      toast.success("Attendance cleared successfully");

      // Update local attendance dates list
      setAttendanceDates((prev) =>
        prev.filter((d) => format(d, "yyyy-MM-dd") !== dateStr)
      );

      // Only reset attendance session if clearing today's attendance
      const isClearingToday = isToday(selectedDate);
      if (isClearingToday) {
        setAttendanceStartTime(null);
        setShowTimeoutModal(false);
        setIsInGracePeriod(false);
        pendingSavesRef.current.clear();
        setCurrentPage(1);
        setShowTimeSetupModal(true);
      }

      // Navigate back to today's date after clearing
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setSelectedDate(today);

      // Dispatch event to update right sidebar
      dispatchAttendanceUpdate();
    } catch (error) {
      console.error("Error clearing attendance:", error);
      setStudentList((prev) =>
        prev.map((student) => ({
          ...student,
          status:
            student.attendanceRecords.find((record) => record.date === dateStr)
              ?.status || "NOT_SET",
        }))
      );
    } finally {
      setIsClearing(false);
      setCooldownMap({});
    }
  };

  // Removed - data is now fetched via React Query hooks
  // useEffect(() => {
  //   if (courseSlug && selectedDateStr) {
  //     fetchAttendance(selectedDate!);
  //     fetchAttendanceDates();
  //   }
  // }, [selectedDateStr, courseSlug]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters.status, sortDate, itemsPerPage]);

  useEffect(() => {
    return () => {
      document.body.style.removeProperty("pointer-events");
      document.body.style.removeProperty("overflow");
      document.body.style.removeProperty("position");
      document.body.style.removeProperty("width");
      document.body.style.removeProperty("height");
      document.body.style.removeProperty("top");
      document.body.style.removeProperty("left");
      document.body.style.removeProperty("right");
      document.body.style.removeProperty("bottom");
    };
  }, []);

  useEffect(() => {
    if (!attendanceStartTime || !showTimeoutModal) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const timeDiff = now - attendanceStartTime.getTime();
      const minutesRemaining =
        attendanceTimeout - Math.floor(timeDiff / (1000 * 60));

      setStudentList((prev) => [...prev]);

      if (minutesRemaining <= 0 && timeoutTimer) {
        handleAttendanceTimeout();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [attendanceStartTime, showTimeoutModal, attendanceTimeout, timeoutTimer]);

  useEffect(() => {
    if (!attendanceStartTime) {
      setGraceCountdown("");
      return;
    }
    const tick = () => {
      const now = Date.now();
      const started = attendanceStartTime.getTime();
      const remainingMs = Math.max(
        0,
        graceMinutes * 60 * 1000 - (now - started)
      );
      const m = Math.floor(remainingMs / 60000);
      const s = Math.floor((remainingMs % 60000) / 1000);
      setGraceCountdown(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [attendanceStartTime, graceMinutes]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "r") {
        e.preventDefault();
        if (attendanceStartTime) {
          setShowTimeoutModal(true);
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (Object.keys(pendingAttendanceUpdates).length > 0) {
          batchUpdateAttendance();
        }
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [attendanceStartTime, pendingAttendanceUpdates]);

  const handleApplyFilters = () => {
    setFilters(tempFilters); // Apply temporary filters to actual filters
    setCurrentPage(1);
    setIsFilterSheetOpen(false);
  };

  const handleCancelFilters = () => {
    setTempFilters(filters); // Revert temporary filters to current filters
    setIsFilterSheetOpen(false);
  };

  const handleFilterOpen = (open: boolean) => {
    setIsFilterSheetOpen(open);
    if (open) {
      setTempFilters(filters); // Initialize temp filters with current filters
    }
  };

  const startAttendance = async () => {
    if (!selectedDate || !courseSlug) {
      toast.dismiss("error-toast");
      toast.error("Please select a date before starting attendance", {
        id: "error-toast",
      });
      return;
    }

    setShowTimeSetupModal(true);
  };

  const confirmAttendanceStart = async () => {
    try {
      const started = new Date();
      setAttendanceStartTime(started);
      setIsInGracePeriod(true);
      setGraceCountdown(`${graceMinutes}:00`);
      setShowTimeSetupModal(false);
      setShowTimeoutModal(true);

      localStorage.setItem(
        getStorageKey("session"),
        JSON.stringify({
          startedAt: started.toISOString(),
          graceMinutes: graceMinutes,
        })
      );

      const grace = setTimeout(() => {
        setIsInGracePeriod(false);
        toast.success(
          "Grace period ended. Late arrivals will be marked as LATE"
        );
      }, graceMinutes * 60 * 1000);
      setGracePeriodTimer(grace);

      toast.success("Attendance session started successfully");
    } catch (error) {
      console.error("Error starting attendance:", error);
      toast.dismiss("error-toast");
      toast.error("Failed to start attendance", {
        id: "error-toast",
      });
    }
  };

  const handleAttendanceTimeout = async () => {
    // This is called when the actual timeout expires - end the session
    await endAttendanceSession();
  };

  const handleDoneClick = async () => {
    // End the attendance session - this will:
    // 1. Mark all NOT_SET students as ABSENT
    // 2. Save all pending RFID attendance updates (scanned students)
    // 3. Save all absent students
    // 4. Close the modal and end the session
    await endAttendanceSession();
  };

  const handleGracePeriodEnd = () => {
    try {
      localStorage.setItem(
        getStorageKey("session"),
        JSON.stringify({
          startedAt:
            attendanceStartTime?.toISOString() || new Date().toISOString(),
          isInGrace: false,
        })
      );
    } catch {}

    toast.success("Grace period ended. Late arrivals will be marked as LATE");
    setIsInGracePeriod(false);

    if (gracePeriodTimer) {
      clearTimeout(gracePeriodTimer);
      setGracePeriodTimer(null);
    }
  };

  const processRfidAttendance = useCallback(
    async (rfid: string) => {
      if (!attendanceStartTime || !selectedDate || isProcessingRfid) return;

      // Debug: Log the RFID value received
      if (process.env.NODE_ENV === "development") {
        console.log("processRfidAttendance called with:", {
          rfid,
          length: rfid.length,
          type: typeof rfid,
        });
      }

      setIsProcessingRfid(true);

      try {
        // Normalize scanned RFID: remove spaces, convert to uppercase, and handle numeric strings
        const normalized = rfid.replace(/\s+/g, "").toUpperCase();

        // Debug: Log normalized value
        if (process.env.NODE_ENV === "development") {
          console.log("Normalized RFID:", {
            original: rfid,
            normalized,
            length: normalized.length,
          });
        }
        // Also try numeric comparison (remove leading zeros for comparison)
        const numericScanned = normalized.replace(/^0+/, "") || normalized;

        // First, try to find in the map (fastest lookup)
        let student = studentByRfidMap.get(normalized);

        // If not found in map, search through studentList directly
        // This handles cases where RFID might not be set initially or format differences
        if (!student) {
          student = studentList.find((s) => {
            // Check both rfid (mapped from rfid_id) and also check studentsData for raw rfid_id
            const studentRfid = s.rfid;
            if (!studentRfid) return false;

            const studentRfidNormalized = studentRfid
              .replace(/\s+/g, "")
              .toUpperCase();
            const numericStudent =
              studentRfidNormalized.replace(/^0+/, "") || studentRfidNormalized;

            // Try both exact match and numeric match (handles leading zeros)
            const matches =
              studentRfidNormalized === normalized ||
              numericStudent === numericScanned ||
              studentRfidNormalized === numericScanned ||
              numericStudent === normalized;

            // Also check raw rfid_id from studentsData if available
            if (!matches && studentsData?.students) {
              const rawStudent = studentsData.students.find(
                (st: any) => st.id === s.id
              );
              if (rawStudent?.rfid_id) {
                const rawRfidStr = String(rawStudent.rfid_id);
                const rawRfidNormalized = rawRfidStr
                  .replace(/\s+/g, "")
                  .toUpperCase();
                const rawNumeric =
                  rawRfidNormalized.replace(/^0+/, "") || rawRfidNormalized;
                return (
                  rawRfidNormalized === normalized ||
                  rawNumeric === numericScanned ||
                  rawRfidNormalized === numericScanned ||
                  rawNumeric === normalized
                );
              }
            }

            return matches;
          });

          // If found, update the student's RFID in the list to ensure consistency
          if (student && (!student.rfid || student.rfid !== rfid)) {
            setStudentList((prev) =>
              prev.map((s) => (s.id === student!.id ? { ...s, rfid } : s))
            );
          }
        }

        if (!student) {
          // Log for debugging
          console.log("RFID scan failed:", {
            scannedRfid: rfid,
            normalized,
            numericScanned,
            studentListRfids: studentList.map((s) => ({
              id: s.id,
              name: s.name,
              rfid: s.rfid,
            })),
            studentsDataRfids: studentsData?.students?.map((s: any) => ({
              id: s.id,
              name: `${s.lastName}, ${s.firstName}`,
              rfid_id: s.rfid_id,
            })),
          });
          toast.dismiss("error-toast");
          toast.error("Student not found in this course for this RFID", {
            id: "error-toast",
            duration: 2000,
          });
          return;
        }

        if (student.status !== "NOT_SET") {
          toast.dismiss("error-toast");
          toast.error(`${student.name} already marked as ${student.status}`, {
            id: "error-toast",
            duration: 2000,
          });
          return;
        }

        const status: AttendanceStatus = isInGracePeriod ? "PRESENT" : "LATE";
        const now = new Date();

        // Use startTransition for non-blocking updates
        startTransition(() => {
          setStudentList((prev) =>
            prev.map((s) => (s.id === student!.id ? { ...s, status } : s))
          );
          setLocalTimeInMap((prev) => ({
            ...prev,
            [student!.id]: now.toISOString(),
          }));
          setPendingAttendanceUpdates((prev) => ({
            ...prev,
            [student!.id]: { status, timestamp: now, rfid },
          }));
        });

        const statusText = status === "PRESENT" ? "Present" : "Late";
        toast.success(`${student.name} marked as ${statusText}`, {
          duration: 2000,
          id: `rfid-${student.id}`,
          style: {
            background: status === "LATE" ? "#fef3c7" : "#f0fdf4",
            color: status === "LATE" ? "#92400e" : "#166534",
            border:
              status === "LATE" ? "1px solid #f59e0b" : "1px solid #22c55e",
          },
        });

        setRfidInput("");
        // Don't set isScanning to false here - keep it true if input is still focused
        // Only set to false on blur

        // Removed automatic batch update - will only update when DONE is clicked
        // This optimizes performance by batching all updates at once
      } catch (error) {
        console.error("RFID processing error:", error);
        toast.dismiss("error-toast");
        toast.error("Failed to process RFID", {
          id: "error-toast",
          duration: 2000,
        });
      } finally {
        setIsProcessingRfid(false);
      }
    },
    [
      attendanceStartTime,
      selectedDate,
      isProcessingRfid,
      studentByRfidMap,
      isInGracePeriod,
      studentList,
      studentsData,
    ]
  );

  const handleRfidInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const now = Date.now();
    const timeSinceLastKey = now - lastKeyTimeRef.current;

    // RFID scanners send data very quickly (< 1ms between characters)
    // Keyboard typing is much slower (> 1ms between characters)
    // If time between keystrokes is too long, it's keyboard typing - ignore it
    if (lastKeyTimeRef.current > 0 && timeSinceLastKey > 100) {
      // This is keyboard typing, not RFID scanner - reset and ignore
      if (rfidInputRef.current) {
        rfidInputRef.current.value = "";
      }
      setRfidInput("");
      isRfidScanRef.current = false;
      lastKeyTimeRef.current = 0;
      return;
    }

    // Update last key time
    lastKeyTimeRef.current = now;

    // If this is the first character, mark as potential RFID scan
    if (value.length === 1) {
      isRfidScanRef.current = true;
      setIsScanning(true);
    }

    // If not a valid RFID scan, ignore
    if (!isRfidScanRef.current) {
      return;
    }

    // Clear any existing timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    // Update the input value
    setRfidInput(value);

    // RFID scanners send complete data quickly, then usually send Enter key
    // Wait a short time after last character to process complete scan
    scanTimeoutRef.current = setTimeout(async () => {
      const currentValue = rfidInputRef.current?.value || value;

      // Only process if we have a value and it was a valid RFID scan
      if (currentValue && currentValue.length > 0 && isRfidScanRef.current) {
        // Process the complete RFID value
        await processRfidAttendance(currentValue);
      }

      // Reset everything
      setRfidInput("");
      isRfidScanRef.current = false;
      lastKeyTimeRef.current = 0;

      if (rfidInputRef.current) {
        rfidInputRef.current.value = "";
        // Keep scanning state if input is still focused
        if (document.activeElement !== rfidInputRef.current) {
          setIsScanning(false);
        }
      } else {
      setIsScanning(false);
      }
    }, 100); // Short timeout - RFID scanners send data very quickly
  };

  const batchUpdateAttendance = async (overrideUpdates?: {
    [studentId: string]: {
      status: AttendanceStatus;
      timestamp: Date;
      rfid: string;
    };
  }) => {
    const sourceUpdates =
      overrideUpdates ?? pendingUpdatesRef.current ?? pendingAttendanceUpdates;
    if (Object.keys(sourceUpdates).length === 0) {
      // If no updates, ensure state is reset
      isSavingRfidAttendanceRef.current = false;
      setIsSavingRfidAttendance(false);
      return;
    }

    // Prevent concurrent calls
    if (isSavingRfidAttendanceRef.current) {
      console.log("Already saving RFID attendance, skipping...");
      return;
    }

    isSavingRfidAttendanceRef.current = true;
    setIsSavingRfidAttendance(true);
    const toastId = toast.loading("Saving RFID attendance...", {
      id: "rfid-attendance-saving",
    });

    try {
      const dateStr = format(selectedDate!, "yyyy-MM-dd");

      const updatePromise = batchAttendanceMutation.mutateAsync({
        courseSlug,
        date: dateStr,
        attendance: Object.entries(sourceUpdates).map(
          ([studentId, update]) => ({
            studentId,
            status: update.status,
            reason: undefined,
          })
        ),
      });

      // Update local state with attendance records before awaiting the promise
      const records = Object.entries(sourceUpdates).map(
        ([studentId, update]) => ({
          id: crypto.randomUUID(),
          studentId,
          courseId: courseSlug,
          status: update.status,
          date: dateStr,
          reason: null,
        })
      );

      setStudentList((prev) =>
        prev.map((s) => {
          const record = records.find((r) => r.studentId === s.id);
          if (record) {
            // Check if record already exists for this date
            const existingRecordIndex = s.attendanceRecords.findIndex(
              (r) => r.date === dateStr
            );
            return {
              ...s,
              status: record.status,
              attendanceRecords:
                existingRecordIndex >= 0
                  ? s.attendanceRecords.map((r, idx) =>
                      idx === existingRecordIndex ? record : r
                    )
                  : [...s.attendanceRecords, record],
            };
          }
          return s;
        })
      );

      setPendingAttendanceUpdates({});

      const dateOnly = new Date(format(selectedDate!, "yyyy-MM-dd"));
      setAttendanceDates((prev) => {
        const exists = prev.some(
          (d) => format(d, "yyyy-MM-dd") === format(dateOnly, "yyyy-MM-dd")
        );
        return exists ? prev : [...prev, dateOnly];
      });

      await updatePromise;

      // Note: Don't refetch attendance data - mutations already handle invalidations
      // Data will be refetched when components need it

      // Dispatch event to update right sidebar
      dispatchAttendanceUpdate();
    } catch (error) {
      console.error("Error batch updating attendance:", error);
      toast.dismiss("error-toast");
      toast.error("Failed to batch update attendance", {
        id: "error-toast",
      });
      // Attendance will be refetched automatically by React Query
    } finally {
      // Always re-enable buttons - reset both ref and state immediately
      isSavingRfidAttendanceRef.current = false;
      setIsSavingRfidAttendance(false);
    }
  };

  const endAttendanceSession = async () => {
    const notSetStudents = studentList.filter((s) => s.status === "NOT_SET");
    if (notSetStudents.length > 0) {
      const now = new Date();
      setStudentList((prev) =>
        prev.map((s) =>
          s.status === "NOT_SET" ? { ...s, status: "ABSENT" } : s
        )
      );
      setPendingAttendanceUpdates((prev) => ({
        ...prev,
        ...notSetStudents.reduce((acc, s) => {
          acc[s.id] = { status: "ABSENT", timestamp: now, rfid: "" };
          return acc;
        }, {} as typeof prev),
      }));
    }

    try {
      localStorage.removeItem(getStorageKey("session"));
    } catch {}

    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      setTimeoutTimer(null);
    }
    if (gracePeriodTimer) {
      clearTimeout(gracePeriodTimer);
      setGracePeriodTimer(null);
    }
    if (graceTimeoutTimer) {
      clearTimeout(graceTimeoutTimer);
      setGraceTimeoutTimer(null);
    }

    setAttendanceStartTime(null);
    setShowTimeoutModal(false);
    setIsInGracePeriod(false);

    const now = new Date();
    const remainingNotSet = studentList
      .filter((s) => s.status === "NOT_SET")
      .reduce((acc, s) => {
        acc[s.id] = {
          status: "ABSENT" as AttendanceStatus,
          timestamp: now,
          rfid: "",
        };
        return acc;
      }, {} as { [studentId: string]: { status: AttendanceStatus; timestamp: Date; rfid: string } });

    const hasPending = Object.keys(pendingAttendanceUpdates).length > 0;
    const hasRemaining = Object.keys(remainingNotSet).length > 0;

    if (hasPending || hasRemaining) {
      await batchUpdateAttendance({
        ...pendingAttendanceUpdates,
        ...remainingNotSet,
      });
    }
  };

  const markAllAsPresent = async () => {
    if (!selectedDate || !courseSlug) {
      toast.error("Please select a date before marking attendance");
      return;
    }

    setIsMarkingAll(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    // 1. IMMEDIATELY update local studentList array
      setStudentList((prev) =>
      prev.map((student) => {
        const existingRecordIndex = student.attendanceRecords.findIndex(
          (r) => r.date === dateStr
        );
        const newRecord: AttendanceRecord = {
          id:
            existingRecordIndex >= 0
              ? student.attendanceRecords[existingRecordIndex].id
              : crypto.randomUUID(),
              studentId: student.id,
              courseId: courseSlug,
              status: "PRESENT",
              date: dateStr,
              reason: null,
        };

        return {
          ...student,
          status: "PRESENT",
          attendanceRecords:
            existingRecordIndex >= 0
              ? student.attendanceRecords.map((r, idx) =>
                  idx === existingRecordIndex ? newRecord : r
                )
              : [...student.attendanceRecords, newRecord],
        };
      })
    );

    // 2. Save to database
    const allStudentIds = new Set(studentList.map((s) => s.id));
    setSavingStudents(allStudentIds);
    try {
      await recordAttendanceMutation.mutateAsync({
        courseSlug,
        date: dateStr,
        attendance: studentList.map((student) => ({
          studentId: student.id,
          status: "PRESENT" as AttendanceStatus,
        })),
      });

      setShowMarkAllConfirm(false);

      // Dispatch event to update right sidebar
      dispatchAttendanceUpdate();

      toast.success("All students marked as present");
    } catch (error) {
      console.error("Error marking all as present:", error);
      // Revert on error
      setStudentList((prev) =>
        prev.map((student) => {
          const record = student.attendanceRecords.find(
            (r) => r.date === dateStr
          );
          return {
          ...student,
            status: record?.status || "NOT_SET",
          };
        })
      );
      toast.dismiss("error-toast");
      toast.error("Failed to mark students as present", {
        id: "error-toast",
      });
    } finally {
      setIsMarkingAll(false);
      setCooldownMap({});
      setSavingStudents(new Set());
    }
  };

  const markAllLateAsPresent = async () => {
    if (!selectedDate || !courseSlug) {
      toast.error("Please select a date before marking attendance");
      return;
    }

    const lateStudents = studentList.filter((s) => s.status === "LATE");
    if (lateStudents.length === 0) {
      toast.dismiss("error-toast");
      toast.error("No late students to mark as present", {
        id: "error-toast",
      });
      return;
    }

    setIsMarkingAll(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    // 1. IMMEDIATELY update local studentList array
      setStudentList((prev) =>
      prev.map((student) => {
        if (student.status === "LATE") {
          const existingRecordIndex = student.attendanceRecords.findIndex(
            (r) => r.date === dateStr
          );
          const newRecord: AttendanceRecord = {
            id:
              existingRecordIndex >= 0
                ? student.attendanceRecords[existingRecordIndex].id
                : crypto.randomUUID(),
                    studentId: student.id,
            courseId: courseSlug,
                    status: "PRESENT",
                    date: dateStr,
                    reason: null,
          };

          return {
            ...student,
            status: "PRESENT",
            attendanceRecords:
              existingRecordIndex >= 0
                ? student.attendanceRecords.map((r, idx) =>
                    idx === existingRecordIndex ? newRecord : r
                  )
                : [...student.attendanceRecords, newRecord],
          };
        }
        return student;
      })
    );

    // 2. Save to database
    const lateStudentIds = new Set(lateStudents.map((s) => s.id));
    setSavingStudents(lateStudentIds);
    try {
      await recordAttendanceMutation.mutateAsync({
        courseSlug,
        date: dateStr,
        attendance: lateStudents.map((student) => ({
          studentId: student.id,
          status: "PRESENT" as AttendanceStatus,
        })),
      });

      // Dispatch event to update right sidebar
      dispatchAttendanceUpdate();
    } catch (error) {
      console.error("Error marking late as present:", error);
      // Revert on error
      setStudentList((prev) =>
        prev.map((student) => {
          if (lateStudents.find((ls) => ls.id === student.id)) {
            const record = student.attendanceRecords.find(
              (r) => r.date === dateStr
            );
            return {
              ...student,
              status: record?.status || "LATE",
            };
          }
          return student;
        })
      );
      toast.dismiss("error-toast");
      toast.error("Failed to mark late students as present", {
        id: "error-toast",
      });
    } finally {
      setIsMarkingAll(false);
      setSavingStudents(new Set());
    }
  };

  const renderStudentCards = useMemo(() => {
    console.log("Current Students:", currentStudents);
    return currentStudents.map((student, index) => (
      <div key={student.id} className="relative">
        <StudentCard
          student={{
            ...student,
            attendanceRecord: student.attendanceRecords || [],
          }}
          index={index}
          onStatusChange={(index, status: AttendanceStatus) =>
            updateStatus(index, status)
          }
          isInCooldown={cooldownMap[student.id] || false}
          isSelected={selectedStudents.includes(student.id)}
          onSelect={isSelecting ? handleSelectStudent : undefined}
          isSelecting={isSelecting}
          disableStatusChange={isSelecting || savingStudents.has(student.id)}
          isSavingRfidAttendance={isSavingRfidAttendance}
          isLoading={savingStudents.has(student.id) || isDateLoading}
        />
      </div>
    ));
  }, [
    currentStudents,
    cooldownMap,
    selectedStudents,
    isSelecting,
    isSavingRfidAttendance,
    isDateLoading,
    isInitialLoad,
    savingStudents,
  ]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen">
        <LoadingSpinner
          mainMessage="Loading Course Attendance"
          secondaryMessage="Please sit tight while we are getting things ready for you..."
        />
      </div>
    );
  }

  // Continuing final part with JSX return...

  if (studentList.length === 0) {
    return (
      <div className="flex flex-col h-screen">
        <div className="flex items-center gap-4 p-4 border-b bg-white">
          <Link href="/main/attendance">
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-gray-100"
              disabled={isSavingRfidAttendance}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-[#124A69] font-bold text-xl">
                No Students Found
              </h1>
              <p className="text-gray-500 text-sm">
                There are no students enrolled in this course.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen ">
      <div className="p-4 border-b bg-white">
        <div className="flex items-center gap-2">
          <Link href="/main/attendance">
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-gray-100"
              disabled={isSavingRfidAttendance}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-[#124A69] font-bold text-xl">
                {courseInfo?.code || "Course"}
              </h1>
              <p className="text-gray-500 text-sm">
                {courseInfo?.section || "N/A"}
              </p>
            </div>
          </div>
        </div>
        <div className="p-3">
          <div className="flex items-center gap-3 ml-6 grow">
            <div className="flex items-center gap-3">
              <div className="relative grow max-w-[300px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search a name"
                  className="w-full pl-9 pr-8 bg-white border-gray-200 rounded-full h-10"
                  value={searchQuery}
                  onChange={handleSearch}
                  disabled={
                    !hasAttendanceForSelectedDate ||
                    isSavingRfidAttendance ||
                    isAnyStudentSaving
                  }
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    disabled={
                      !hasAttendanceForSelectedDate ||
                      isSavingRfidAttendance ||
                      isAnyStudentSaving
                    }
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                )}
              </div>
              <Popover
                open={open && !attendanceStartTime}
                onOpenChange={(open) => {
                  // Prevent opening the popover if attendance is ongoing
                  if (attendanceStartTime && open) {
                    toast.dismiss("error-toast");
                    toast.error(
                      "Cannot change date while attendance is ongoing. Please end the session first.",
                      {
                        id: "error-toast",
                        duration: 3000,
                      }
                    );
                    return;
                  }
                  setOpen(open);
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="rounded-full h-10 pl-3 pr-2 flex items-center gap-2 w-[230px] justify-between relative"
                    disabled={
                      isDateLoading ||
                      isUpdating ||
                      isClearing ||
                      isMarkingAll ||
                      isSavingRfidAttendance ||
                      !!attendanceStartTime ||
                      isAnyStudentSaving
                    }
                  >
                    <span className="truncate">
                      {selectedDate
                        ? format(selectedDate, "MMMM d, yyyy")
                        : "Pick a date"}
                    </span>
                    {isDateLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                    ) : (
                      <CalendarIcon className="h-4 w-4 shrink-0" />
                    )}
                  </Button>
                </PopoverTrigger>

                <PopoverContent
                  className="w-auto p-0"
                  align="start"
                  side="bottom"
                  sideOffset={8}
                >
                  <div className="[&_button.rdp-day]:transition-colors [&_button.rdp-day]:duration-200 [&_button.rdp-day:hover]:bg-[#124A69]/10 [&_button.rdp-day:focus]:bg-[#124A69]/10">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        // Prevent date selection if attendance is ongoing
                        if (attendanceStartTime) {
                          toast.dismiss("error-toast");
                          toast.error(
                            "Cannot change date while attendance is ongoing. Please end the session first.",
                            {
                              id: "error-toast",
                              duration: 3000,
                            }
                          );
                          setOpen(false);
                          return;
                        }
                        if (date) {
                          setSelectedDate(date);
                          setOpen(false);
                        }
                      }}
                      disabled={(date) => {
                        // If attendance is ongoing, disable all dates
                        if (attendanceStartTime) {
                          return true;
                        }
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const jan2025 = new Date(2025, 0, 1);
                        const dateStr = format(date, "yyyy-MM-dd");
                        const hasAttendance = attendanceDateSet.has(dateStr);

                        // Disable dates before Jan 2025 or after today
                        if (date < jan2025 || date > today) {
                          return true;
                        }

                        // For dates in the past (before today), disable if they don't have attendance
                        const isPastDate = date < today;
                        if (isPastDate && !hasAttendance) {
                          return true;
                        }

                        return false;
                      }}
                      modifiers={{
                        hasAttendance: (date) =>
                          attendanceDates.some(
                            (attDate) =>
                              attDate.getFullYear() === date.getFullYear() &&
                              attDate.getMonth() === date.getMonth() &&
                              attDate.getDate() === date.getDate()
                          ),
                      }}
                      modifiersStyles={{
                        hasAttendance: {
                          border: "1px solid #124A69",
                          color: "#000000",
                          borderRadius: "50%",
                        },
                        selected: {
                          backgroundColor: "#124A69",
                          color: "#ffffff",
                        },
                      }}
                      modifiersClassNames={{
                        selected:
                          "bg-[#124A69] text-white hover:bg-[#124A69] focus:bg-[#124A69]",
                        hasAttendance:
                          "border border-[#124A69] rounded-full text-black",
                      }}
                      initialFocus
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  disabled={
                    isUpdating ||
                    isDateLoading ||
                    isClearing ||
                    isMarkingAll ||
                    isSavingRfidAttendance ||
                    isAnyStudentSaving
                  }
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setShowMarkAllConfirm(true)}
                  className="text-[#22C55E] focus:text-[#22C55E] focus:bg-[#22C55E]/10"
                  disabled={
                    isUpdating ||
                    isDateLoading ||
                    isClearing ||
                    isMarkingAll ||
                    isSavingRfidAttendance ||
                    !hasAttendanceForSelectedDate ||
                    isAnyStudentSaving
                  }
                >
                  Mark All as Present
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={markAllLateAsPresent}
                  className="text-[#3B82F6] focus:text-[#3B82F6] focus:bg-[#3B82F6]/10"
                  disabled={
                    isUpdating ||
                    isDateLoading ||
                    isClearing ||
                    isMarkingAll ||
                    isSavingRfidAttendance ||
                    !hasAttendanceForSelectedDate ||
                    isAnyStudentSaving
                  }
                >
                  Mark All Late as Present
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowClearConfirm(true)}
                  disabled={
                    isSaving ||
                    isUpdating ||
                    isDateLoading ||
                    isClearing ||
                    isMarkingAll ||
                    isSavingRfidAttendance ||
                    !hasAttendanceForSelectedDate
                  }
                  className="text-[#EF4444] focus:text-[#EF4444] focus:bg-[#EF4444]/10"
                >
                  {isSaving ? "Clearing..." : "Clear Attendance"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {selectedStudents.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="rounded-full shadow-md bg-[#FAEDCB] border-gray-200 hover:bg-[#f1deb1]"
                    disabled={
                      isSaving ||
                      isUpdating ||
                      isSavingRfidAttendance ||
                      isAnyStudentSaving
                    }
                  >
                    Mark Selected Students as...
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => bulkUpdateStatus("PRESENT")}
                    disabled={isSavingRfidAttendance || isAnyStudentSaving}
                  >
                    Present
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => bulkUpdateStatus("LATE")}
                    disabled={isSavingRfidAttendance || isAnyStudentSaving}
                  >
                    Late
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => bulkUpdateStatus("ABSENT")}
                    disabled={isSavingRfidAttendance || isAnyStudentSaving}
                  >
                    Absent
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => bulkUpdateStatus("EXCUSED")}
                    disabled={isSavingRfidAttendance || isAnyStudentSaving}
                  >
                    Excused
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <div className="flex items-center gap-3 ml-auto">
              {attendanceStartTime && isToday(selectedDate || new Date()) && (
                <Button
                  className="rounded-full bg-[#124A69] hover:bg-[#0a2f42] text-white"
                  onClick={() => setShowTimeoutModal(true)}
                  disabled={isSavingRfidAttendance}
                >
                  Ongoing Attendance • Grace:{" "}
                  {graceCountdown || `${graceMinutes}:00`}
                </Button>
              )}
              <Button
                onClick={toggleSelectMode}
                className={`rounded-full flex items-center gap-2 transition-colors duration-200 ${
                  isSelecting
                    ? "bg-white text-black border border-[#124A69] hover:bg-gray-100"
                    : "bg-[#124A69] text-white hover:bg-[#0D3A54]"
                }`}
                disabled={
                  !hasAttendanceForSelectedDate ||
                  isSavingRfidAttendance ||
                  isClearing ||
                  isMarkingAll ||
                  isAnyStudentSaving
                }
              >
                <MousePointerClick
                  className={isSelecting ? "text-[#124A69]" : "text-white"}
                />
                {isSelecting ? "Cancel Selection" : "Select Students"}
              </Button>
              <Button
                variant="outline"
                className="rounded-full relative flex items-center gap-2 px-3"
                onClick={() => handleFilterOpen(true)}
                disabled={
                  isUpdating ||
                  isDateLoading ||
                  isClearing ||
                  isMarkingAll ||
                  isSavingRfidAttendance ||
                  !hasAttendanceForSelectedDate ||
                  isAnyStudentSaving
                }
              >
                <Filter className="h-4 w-4" />
                <span>Filter</span>
                {filters.status.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#124A69] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {filters.status.length}
                  </span>
                )}
              </Button>
              <FilterSheet
                isOpen={isFilterSheetOpen}
                onOpenChange={handleFilterOpen}
                filters={tempFilters}
                onFiltersChange={setTempFilters}
                onApplyFilters={handleApplyFilters}
                onCancel={handleCancelFilters}
                statusLabels={{
                  NOT_SET: "No Status",
                  PRESENT: "Present",
                  ABSENT: "Absent",
                  LATE: "Late",
                  EXCUSED: "Excused",
                }}
              />
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => setShowExportPreview(true)}
                title="Export to Excel"
                disabled={
                  isUpdating ||
                  isDateLoading ||
                  isClearing ||
                  isMarkingAll ||
                  isSavingRfidAttendance ||
                  !hasAttendanceForSelectedDate ||
                  isAnyStudentSaving
                }
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 bg-white">
        {!hasAttendanceForSelectedDate &&
        selectedDate &&
        !attendanceStartTime &&
        isToday(selectedDate) ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-center max-w-md">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CalendarIcon className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Start Attendance for {format(selectedDate, "MMMM d, yyyy")}
              </h3>
              <p className="text-gray-500 mb-6">
                Begin an attendance session to record student presence.
              </p>
              <Button
                onClick={startAttendance}
                className="bg-[#124A69] hover:bg-[#0D3A54] text-white px-6 py-3 text-lg"
                size="lg"
                disabled={isSavingRfidAttendance}
              >
                Start Attendance
              </Button>
            </div>
          </div>
        ) : (
          <div className={gridColsClass}>
            {isDateLoading && isInitialLoad ? (
              // Only show skeleton cards on initial load
              Array.from({ length: itemsPerPage }).map((_, index) => (
                <div
                  key={index}
                  className="w-full bg-white p-6 rounded-lg shadow-sm border border-gray-100 animate-pulse"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
                    <div className="w-2/3 h-4 bg-gray-200 rounded"></div>
                    <div className="w-full h-8 bg-gray-200 rounded-full"></div>
                  </div>
                </div>
              ))
            ) : currentStudents.length > 0 ? (
              // Show student cards with individual loading states when backtracking
              renderStudentCards
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-12">
                <div className="text-gray-500 text-lg font-medium mb-2">
                  No students found
                </div>
                <p className="text-gray-400 text-sm">
                  Try adjusting your search or filters
                </p>
              </div>
            )}
          </div>
        )}

        {totalPages > 1 &&
          currentStudents.length > 0 &&
          hasAttendanceForSelectedDate && (
            <div className="flex justify-between items-center px-2 mt-10">
              <p className="text-sm text-gray-500 w-60  ">
                {currentPage * itemsPerPage - (itemsPerPage - 1)}-
                {Math.min(currentPage * itemsPerPage, filteredStudents.length)}{" "}
                out of {filteredStudents.length} students
              </p>
              <Pagination className="flex justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      className={
                        currentPage === 1
                          ? "pointer-events-none opacity-50"
                          : ""
                      }
                    />
                  </PaginationItem>
                  {[...Array(totalPages)].map((_, i) => (
                    <PaginationItem key={i}>
                      <PaginationLink
                        isActive={currentPage === i + 1}
                        onClick={() => setCurrentPage(i + 1)}
                        className={
                          currentPage === i + 1 ? "bg-[#124A69] text-white" : ""
                        }
                      >
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      className={
                        currentPage === totalPages
                          ? "pointer-events-none opacity-50 "
                          : ""
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
      </div>

      {/* All Dialog Components - Export Preview */}
      <Dialog open={showExportPreview} onOpenChange={setShowExportPreview}>
        <DialogContent className="max-w-[600px] p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#124A69]">
              Export to Excel
            </DialogTitle>
            <DialogDescription>
              {selectedDate
                ? `Preview of attendance data for ${format(
                    selectedDate,
                    "MMMM d, yyyy"
                  )}:`
                : "Please select a date to export attendance data."}
            </DialogDescription>
          </DialogHeader>
          {selectedDate && hasAttendanceForSelectedDate ? (
            <>
              {filteredStudents.some(
                (student) => student.status === "NOT_SET"
              ) && (
                <div className="mt-2 text-sm text-red-500">
                  {
                    filteredStudents.filter(
                      (student) => student.status === "NOT_SET"
                    ).length
                  }{" "}
                  student
                  {filteredStudents.filter(
                    (student) => student.status === "NOT_SET"
                  ).length !== 1
                    ? "s"
                    : ""}
                  {filteredStudents.filter(
                    (student) => student.status === "NOT_SET"
                  ).length !== 1
                    ? " have"
                    : " "}{" "}
                  no attendance status yet
                </div>
              )}
              <div className="mt-6 max-h-[400px] overflow-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">
                        Student Name
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">
                        Attendance Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student) => (
                      <tr key={student.id} className="border-t">
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {student.name}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {student.status === "NOT_SET"
                            ? "NO STATUS"
                            : student.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-6 flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={() => setShowExportPreview(false)}
                  disabled={isSavingRfidAttendance}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-[#124A69] hover:bg-[#0D3A54] text-white"
                  onClick={handleExport}
                  disabled={
                    isSavingRfidAttendance ||
                    !selectedDate ||
                    filteredStudents.some(
                      (student) => student.status === "NOT_SET"
                    )
                  }
                >
                  {filteredStudents.some(
                    (student) => student.status === "NOT_SET"
                  )
                    ? "Complete Attendance First"
                    : "Export to Excel"}
                </Button>
              </div>
            </>
          ) : selectedDate && !hasAttendanceForSelectedDate ? (
            <div className="mt-6 flex flex-col items-center justify-center py-12">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CalendarIcon className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Attendance Data
                </h3>
                <p className="text-gray-500 mb-4">
                  There is no attendance data for{" "}
                  {format(selectedDate, "MMMM d, yyyy")}. Start taking
                  attendance first to export data.
                </p>
                <Button
                  onClick={() => {
                    setShowExportPreview(false);
                    startAttendance();
                  }}
                  className="bg-[#124A69] hover:bg-[#0D3A54] text-white"
                  disabled={isSavingRfidAttendance}
                >
                  Start Attendance
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex justify-center">
              <p className="text-gray-500">Please select a date first</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-[400px] p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#124A69]">
              Import from Excel
            </DialogTitle>
            <DialogDescription>
              Select an Excel file to import student data.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6">
            <Input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleImportExcel}
              className="mb-4"
            />
            <Button
              className="w-full bg-[#124A69] hover:bg-[#0D3A54] text-white"
              onClick={() => setShowImportDialog(false)}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mark All Confirm Alert */}
      {hasAttendanceForSelectedDate && (
        <AlertDialog
          open={showMarkAllConfirm}
          onOpenChange={(open) => {
            setShowMarkAllConfirm(open);
            if (!open) {
              document.body.style.removeProperty("pointer-events");
            }
          }}
        >
          <AlertDialogContent className="sm:max-w-[425px]">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-[#124A69] text-xl font-bold">
                Mark All as Present
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-500">
                Are you sure you want to mark all students as present for{" "}
                {selectedDate
                  ? format(selectedDate, "MMMM d, yyyy")
                  : "this date"}
                ? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-2">
              <AlertDialogCancel
                onClick={() => {
                  setShowMarkAllConfirm(false);
                  document.body.style.removeProperty("pointer-events");
                }}
                className="border-gray-200"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  markAllAsPresent();
                  document.body.style.removeProperty("pointer-events");
                }}
                className="bg-[#124A69] hover:bg-[#0a2f42] text-white"
                disabled={isMarkingAll}
              >
                {isMarkingAll ? "Marking..." : "Mark All as Present"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Backtrack Status Change Confirm Alert */}
      <AlertDialog
        open={showBacktrackConfirm}
        onOpenChange={(open) => {
          setShowBacktrackConfirm(open);
          if (!open) {
            setPendingStatusChange(null);
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-[425px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#124A69] text-xl font-bold">
              Confirm Status Change
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500">
              You are about to change attendance status for{" "}
              <span className="font-semibold text-[#124A69]">
                {selectedDate
                  ? format(selectedDate, "MMMM d, yyyy")
                  : "this date"}
              </span>
              , which is a past date. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel
              onClick={() => {
                setShowBacktrackConfirm(false);
                setPendingStatusChange(null);
              }}
              className="border-gray-200"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBacktrackStatusConfirm}
              className="bg-[#124A69] hover:bg-[#0a2f42] text-white"
            >
              Confirm Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Confirm Alert */}
      {hasAttendanceForSelectedDate && (
        <AlertDialog
          open={showClearConfirm}
          onOpenChange={(open) => {
            setShowClearConfirm(open);
            if (!open) {
              setClearConfirmText("");
              document.body.style.removeProperty("pointer-events");
            }
          }}
        >
          <AlertDialogContent className="sm:max-w-[425px] border-red-500">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-red-600 text-xl font-bold">
                Clear Attendance
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-500">
                You are about to clear all attendance records for{" "}
                <span className="font-semibold text-red-500">
                  {selectedDate
                    ? format(selectedDate, "MMMM d, yyyy")
                    : "this date"}
                </span>
                . This action cannot be undone.{" "}
                <span className="font-semibold text-red-600">
                  You will not be able to modify or backtrack to this date after
                  clearing.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Type{" "}
                  <span className="font-mono font-semibold text-red-600">
                    clear attendance
                  </span>{" "}
                  to confirm:
                </label>
                <Input
                  type="text"
                  value={clearConfirmText}
                  onChange={(e) => setClearConfirmText(e.target.value)}
                  placeholder="clear attendance"
                  className="w-full border-red-300 focus:border-red-500 focus:ring-red-500"
                  autoFocus
                />
              </div>
            </div>
            <AlertDialogFooter className="gap-2 sm:gap-2">
              <AlertDialogCancel
                onClick={() => {
                  setShowClearConfirm(false);
                  setClearConfirmText("");
                  document.body.style.removeProperty("pointer-events");
                }}
                className="border-gray-200"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  clearAllAttendance();
                  setShowClearConfirm(false);
                  setClearConfirmText("");
                  document.body.style.removeProperty("pointer-events");
                }}
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={
                  isClearing ||
                  clearConfirmText.toLowerCase() !== "clear attendance"
                }
              >
                {isClearing ? "Clearing..." : "Clear Attendance"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Reset Confirmation*/}
      {hasAttendanceForSelectedDate && (
        <div className="flex justify-end mt-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (previousAttendance) {
                const restoredAttendance = { ...previousAttendance };
                setUnsavedChanges({});
                setTimeout(() => {
                  setUnsavedChanges(restoredAttendance);
                  setPreviousAttendance(null);
                  toast.success("Attendance restored", {
                    duration: 3000,
                  });
                }, 0);
              } else {
                setShowResetConfirmation(true);
              }
            }}
            className={
              previousAttendance
                ? "h-9 px-4 bg-[#124A69] text-white hover:bg-[#0d3a56] border-none"
                : "h-9 px-4 border-gray-200 text-gray-600 hover:bg-gray-50"
            }
            disabled={
              isSavingRfidAttendance ||
              isLoading ||
              (!previousAttendance && Object.keys(unsavedChanges).length === 0)
            }
          >
            {previousAttendance ? "Undo Reset" : "Reset Attendance"}
          </Button>
        </div>
      )}

      {/* Reset Dialog */}
      {hasAttendanceForSelectedDate && (
        <Dialog
          open={showResetConfirmation}
          onOpenChange={setShowResetConfirmation}
        >
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-[#124A69] text-xl font-bold">
                Reset Attendance
              </DialogTitle>
              <DialogDescription className="text-gray-500">
                Are you sure you want to reset all attendance records? This
                action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setShowResetConfirmation(false)}
                className="border-gray-200"
                disabled={isSavingRfidAttendance}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setPreviousAttendance(unsavedChanges);
                  setUnsavedChanges({});
                  setStudentList((prevStudents) =>
                    prevStudents.map((student) => ({
                      ...student,
                      status: "NOT_SET",
                    }))
                  );
                  setShowResetConfirmation(false);
                  toast.success("Attendance reset successfully", {
                    duration: 5000,
                  });
                }}
                className="bg-[#124A69] hover:bg-[#0d3a56] text-white"
                disabled={isSavingRfidAttendance}
              >
                Reset Attendance
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Floating RFID Button */}
      {attendanceStartTime && !showTimeoutModal && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            onClick={() => setShowTimeoutModal(true)}
            className="bg-[#124A69] hover:bg-[#0D3A54] text-white rounded-full w-16 h-16 shadow-lg"
            size="icon"
          >
            <div className="text-center">
              <div className="text-xs font-bold">RFID</div>
              <div className="text-xs">Tap</div>
            </div>
          </Button>
        </div>
      )}

      {/* Time Setup Modal */}
      <Dialog open={showTimeSetupModal} onOpenChange={setShowTimeSetupModal}>
        <DialogContent className="max-w-[600px] p-8">
          <DialogHeader className="text-center space-y-2">
            <DialogTitle className="text-2xl font-bold text-[#124A69]">
              Start Attendance Session
            </DialogTitle>
            <DialogDescription className="text-base text-gray-600">
              Configure your attendance session settings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-8 py-4">
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#124A69] flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <label className="text-base font-semibold text-gray-900 block mb-1">
                      Grace Period
                </label>
                    <p className="text-sm text-gray-600 mb-3">
                      Students arriving within this time will be marked as LATE
                      instead of ABSENT
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-4">
                <Input
                  type="number"
                  min={1}
                          max={45}
                          step={1}
                  value={graceMinutes}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                            setGracePeriodError(""); // Clear error on change
                    if (isNaN(v) || v <= 0) {
                      setGraceMinutes(1);
                              setGracePeriodError(
                                "Grace period must be at least 1 minute"
                              );
                            } else if (v > 45) {
                              setGraceMinutes(45);
                              setGracePeriodError(
                                "Grace period cannot exceed 45 minutes"
                              );
                    } else {
                              setGraceMinutes(Math.floor(v)); // Ensure it's a whole number
                    }
                  }}
                          className={`w-24 text-center text-lg font-semibold ${
                            gracePeriodError
                              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                              : ""
                          }`}
                  required
                />
                        <span className="text-base text-gray-700 font-medium">
                          {graceMinutes === 1 ? "minute" : "minutes"}
                        </span>
                      </div>
                      {gracePeriodError && (
                        <p className="text-sm text-red-600 font-medium">
                          {gracePeriodError}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        Maximum: 45 minutes
                </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => setShowTimeSetupModal(false)}
                variant="outline"
                className="flex-1 h-12 text-base"
                disabled={isSavingRfidAttendance}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmAttendanceStart}
                disabled={
                  isSavingRfidAttendance || !graceMinutes || graceMinutes <= 0
                }
                className="flex-1 h-12 text-base bg-[#124A69] hover:bg-[#0D3A54] text-white font-semibold"
              >
                Start Session
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* RFID Timeout Modal - Continuation */}
      <Dialog
        open={showTimeoutModal}
        onOpenChange={(open) => {
          // Prevent closing if attendanceStartTime is null (session not started properly)
          if (!open && !attendanceStartTime) {
            // If trying to close but session isn't started, show time setup modal instead
            setShowTimeoutModal(false);
            setShowTimeSetupModal(true);
            return;
          }
          // Only allow closing if session is properly started or explicitly closed via DONE button
          if (!open && attendanceStartTime) {
            // User is closing the modal - don't end the session, just close the modal
            setIsScanning(false);
            setRfidPreviewStudent(null);
            // Clear input when closing
            if (rfidInputRef.current) {
              rfidInputRef.current.value = "";
            }
            setRfidInput("");
            // Reset RFID scan detection
            isRfidScanRef.current = false;
            lastKeyTimeRef.current = 0;
            setShowTimeoutModal(false);
            return;
          }
          // Opening the modal
          if (open) {
            // Ensure session is started before opening
            if (!attendanceStartTime) {
              setShowTimeoutModal(false);
              setShowTimeSetupModal(true);
              return;
            }
            setIsScanning(true);
            setRfidInput("");
            setRfidPreviewStudent({
              name: "",
              image: undefined,
              studentId: "",
            });
            // Reset RFID scan detection
            isRfidScanRef.current = false;
            lastKeyTimeRef.current = 0;
            // Clear grace period error when opening modal
            setGracePeriodError("");
            // Focus the input with multiple attempts to ensure it works
            const focusInput = () => {
              if (rfidInputRef.current) {
                rfidInputRef.current.focus();
                rfidInputRef.current.select();
              }
            };
            // Try focusing immediately and after a short delay
            focusInput();
            setTimeout(focusInput, 50);
            setTimeout(focusInput, 100);
            setTimeout(focusInput, 200);
          }
        }}
      >
        <DialogContent className="w-[1200px] p-6 max-w-none">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-[#124A69] text-center">
              RFID ATTENDANCE
            </DialogTitle>
            <DialogDescription className="text-center text-gray-500">
              Grace Period: {graceCountdown || `${graceMinutes}:00`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-6 justify-center">
            <div className="flex-1 max-w-[760px] space-y-6">
              <div className="space-y-3 ">
                {/* Hidden RFID input for reader */}
                <input
                  ref={rfidInputRef}
                  type="text"
                  autoFocus
                  value={rfidInput}
                  onChange={handleRfidInput}
                  onKeyDown={(e) => {
                    // Handle Enter key to process RFID immediately (scanners often send Enter at the end)
                    if (
                      e.key === "Enter" &&
                      rfidInputRef.current &&
                      isRfidScanRef.current
                    ) {
                      e.preventDefault();
                      const value = rfidInputRef.current.value.trim();
                      if (value) {
                        // Clear any pending timeout
                        if (scanTimeoutRef.current) {
                          clearTimeout(scanTimeoutRef.current);
                        }
                        processRfidAttendance(value);
                        rfidInputRef.current.value = "";
                        setRfidInput("");
                        isRfidScanRef.current = false;
                        lastKeyTimeRef.current = 0;
                        // Keep scanning state if input is still focused
                        if (document.activeElement !== rfidInputRef.current) {
                          setIsScanning(false);
                        }
                      }
                    }
                  }}
                  onFocus={() => {
                    // Start scanning when input receives focus
                    setIsScanning(true);
                    // Reset RFID scan detection
                    isRfidScanRef.current = false;
                    lastKeyTimeRef.current = 0;
                  }}
                  onBlur={() => {
                    // Stop scanning when input loses focus
                    setIsScanning(false);
                    // Clear any pending timeout
                    if (scanTimeoutRef.current) {
                      clearTimeout(scanTimeoutRef.current);
                      scanTimeoutRef.current = null;
                    }
                    // Reset RFID scan detection
                    isRfidScanRef.current = false;
                    lastKeyTimeRef.current = 0;
                  }}
                  style={{
                    position: "absolute",
                    left: "-9999px",
                    width: "1px",
                    height: "1px",
                    opacity: 0,
                    pointerEvents: "auto",
                  }}
                  placeholder="RFID input"
                />

                <div className="flex justify-center">
                  <div className="flex gap-3">
                    <Button
                      disabled={isScanning}
                      onClick={() => {
                        // Refocus the input when button is clicked
                        if (rfidInputRef.current) {
                          rfidInputRef.current.focus();
                          setIsScanning(true);
                        }
                      }}
                      size="lg"
                      className="min-w-[200px] h-16 text-lg bg-[#124A69] hover:bg-[#0a2f42] text-white disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2">
                        {isScanning ? (
                          <>
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                            Please Scan Student RFID
                          </>
                        ) : (
                          "Click to Scan Student RFID"
                        )}
                      </div>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Scanned Students List */}
              <div className="space-y-4 min-h-[460px] max-h-[460px] overflow-auto px-1">
                {studentList
                  .filter((s) => s.status !== "NOT_SET")
                  .map((s) => {
                    const tsIso = localTimeInMap[s.id];
                    const timeInText = tsIso
                      ? new Date(tsIso).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "--:--";
                    return (
                      <div
                        key={s.id}
                        className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex items-center gap-4"
                      >
                        <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#F4C430] flex items-center justify-center">
                          {s.image ? (
                            <img
                              src={s.image}
                              alt={s.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs text-gray-500">
                              IMG
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 truncate">
                            {s.name}
                          </div>
                          <div className="text-sm text-gray-600">
                            Status:{" "}
                            <span
                              className={
                                s.status === "PRESENT"
                                  ? "text-green-600 font-semibold"
                                  : s.status === "LATE"
                                  ? "text-yellow-600 font-semibold"
                                  : "text-red-600 font-semibold"
                              }
                            >
                              {s.status}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">
                            Time In: {timeInText}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                {studentList.filter((s) => s.status !== "NOT_SET").length ===
                  0 && (
                  <div className="text-center text-sm text-gray-500">
                    No scans yet
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="flex items-center gap-4 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 h-11"
                  onClick={() => setShowTimeoutModal(false)}
                  disabled={isSavingRfidAttendance}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 h-11 bg-[#124A69] hover:bg-[#0a2f42] text-white"
                  onClick={handleDoneClick}
                  disabled={isSavingRfidAttendance}
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Excuse Modal */}
      <Dialog
        open={showExcuseModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowExcuseModal(false);
            setExcuseReason("");
            setPendingExcusedStudent(null);
            setIsBulkExcuse(false); // reset bulk state
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-[#124A69] text-xl font-bold">
              {isBulkExcuse ? "Excuse Selected Students" : "Excuse Reason"}
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              {isBulkExcuse
                ? "Please provide a reason for excusing all selected students."
                : "Please provide a reason for marking this student as excused."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Input
              placeholder={
                isBulkExcuse
                  ? "Enter reason for all selected..."
                  : "Enter reason..."
              }
              value={excuseReason}
              onChange={(e) => setExcuseReason(e.target.value)}
              className="w-full border-gray-200 focus:border-[#124A69] focus:ring-[#124A69]"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowExcuseModal(false);
                setExcuseReason("");
                setPendingExcusedStudent(null);
                setIsBulkExcuse(false);
              }}
              disabled={isSavingRfidAttendance}
              className="border-gray-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleExcusedSubmit}
              disabled={isSavingRfidAttendance || !excuseReason.trim()}
              className="bg-[#124A69] hover:bg-[#0D3A54] text-white"
            >
              Save Reason
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
