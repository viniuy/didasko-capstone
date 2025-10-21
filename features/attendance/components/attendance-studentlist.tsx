"use client";

import { useState, useMemo, useEffect, Fragment, useRef } from "react";
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
  Scan,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
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
import toast, { Toaster } from "react-hot-toast";
import * as XLSX from "xlsx";
import { StudentCard } from "./student-card";
import { FilterSheet } from "./filter-sheet";
import Link from "next/link";
import { AttendanceStatus } from "@prisma/client";
import { FilterState } from "@/shared/types/attendance";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import axiosInstance from "@/lib/axios";
import axios from "axios";

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

export default function StudentList({ courseSlug }: { courseSlug: string }) {
  const [studentList, setStudentList] = useState<Student[]>([]);
  const [open, setOpen] = useState(false);
  const [courseInfo, setCourseInfo] = useState<Course | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortDate] = useState<"newest" | "oldest" | "">("");
  const itemsPerPage = 10;
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    status: [],
  });
  const [tempImage, setTempImage] = useState<{
    index: number;
    dataUrl: string;
  } | null>(null);
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
  const [attendanceStats, setAttendanceStats] = useState<{
    totalAbsents: number;
    lastAttendanceDate: string | null;
  }>({
    totalAbsents: 0,
    lastAttendanceDate: null,
  });
  const [showMarkAllConfirm, setShowMarkAllConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
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
  const [pendingUpdates, setPendingUpdates] = useState<{
    [key: string]: {
      studentId: string;
      status: AttendanceStatus;
    };
  }>({});
  const [toastTimeout, setToastTimeout] = useState<NodeJS.Timeout | null>(null);
  const latestUpdateRef = useRef<{
    studentId: string;
    status: AttendanceStatus;
  } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [showTimeSetupModal, setShowTimeSetupModal] = useState(false);
  const [graceMinutes, setGraceMinutes] = useState<number>(5);
  const [restoredFromStorage, setRestoredFromStorage] = useState(false);
  const [attendanceStartTime, setAttendanceStartTime] = useState<Date | null>(
    null
  );
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

  // Storage key helper
  const getStorageKey = (name: string) =>
    courseSlug ? `attendance:${courseSlug}:${name}` : `attendance::${name}`;

  // Check if there's attendance for the selected date
  const hasAttendanceForSelectedDate = useMemo(() => {
    if (!selectedDate) return false;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    return attendanceDates.some((date) => {
      const attendanceDateStr = format(date, "yyyy-MM-dd");
      return attendanceDateStr === dateStr;
    });
  }, [selectedDate, attendanceDates]);

  // Calculate timeout and grace period in minutes based on time difference
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

  // Helper function to get current attendance status
  const getCurrentAttendanceStatus = useMemo(() => {
    if (!attendanceStartTime || !timeIn || !timeOut) return null;

    const now = new Date();
    const today = new Date();
    const [inHours, inMinutes] = timeIn.split(":").map(Number);
    const [outHours, outMinutes] = timeOut.split(":").map(Number);

    const timeInDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      inHours,
      inMinutes,
      0,
      0
    );
    const timeOutDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      outHours,
      outMinutes,
      0,
      0
    );

    const timeDiff = now.getTime() - timeInDate.getTime();
    const minutesLate = Math.floor(timeDiff / (1000 * 60));
    const timeoutMinutes = Math.floor(
      (timeOutDate.getTime() - timeInDate.getTime()) / (1000 * 60)
    );

    if (minutesLate <= timeoutMinutes) {
      return { status: "REGULAR", message: "Regular attendance period" };
    } else if (minutesLate <= timeoutMinutes + gracePeriod) {
      return {
        status: "GRACE",
        message: `Grace period (${minutesLate - timeoutMinutes} min late)`,
      };
    } else {
      return { status: "LATE", message: "Late period - mark as absent" };
    }
  }, [attendanceStartTime, timeIn, timeOut, gracePeriod]);

  const fetchStudents = async () => {
    if (!courseSlug) return;

    try {
      setIsLoading(true);
      const response = await axiosInstance.get(
        `/courses/${courseSlug}/students`
      );
      const students = response.data.students.map((student: any) => ({
        ...student,
        name: `${student.lastName}, ${student.firstName}${
          student.middleInitial ? ` ${student.middleInitial}.` : ""
        }`,
        status: "NOT_SET" as AttendanceStatusWithNotSet,
        attendanceRecords: [],
      }));
      setStudentList(students);
      setCourseInfo({
        id: response.data.course.id,
        code: response.data.course.code,
        title: response.data.course.title,
        description: response.data.course.description,
        semester: response.data.course.semester,
        section: response.data.course.section,
        slug: response.data.course.slug,
        academicYear: response.data.course.academicYear,
        status: response.data.course.status,
      });

      // Fetch attendance for the selected date after getting students
      if (selectedDate) {
        await fetchAttendance(selectedDate);
      }
    } catch (error) {
      console.error("Error fetching students:", error);
      setStudentList([]);
      toast.error("Failed to fetch students");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAttendance = async (date: Date) => {
    if (!courseSlug) return;

    try {
      setIsDateLoading(true);
      const dateStr = format(date, "yyyy-MM-dd");
      console.log(
        "Fetching attendance for date:",
        dateStr,
        "Original date:",
        date.toISOString()
      );

      const attendanceResponse = await axiosInstance.get<{
        attendance: AttendanceRecord[];
      }>(`/courses/${courseSlug}/attendance`, {
        params: {
          date: dateStr,
          limit: 1000, // Increase limit to get all records
        },
      });

      console.log("Attendance response:", attendanceResponse.data);
      console.log("not Found:", attendanceResponse.data);

      const attendanceData = attendanceResponse.data.attendance;
      const attendanceMap = new Map<string, AttendanceRecord>(
        attendanceData.map((record) => [record.studentId, record])
      );

      // Update the entire student list with attendance records
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
                    date: dateStr,
                    reason: record.reason,
                  },
                ]
              : [],
          };
        })
      );

      // Clear any unsaved changes when fetching new attendance
      setUnsavedChanges({});
    } catch (error) {
      console.error("Error fetching attendance:", error);
      if (axios.isAxiosError(error)) {
        console.error("Error details:", {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        toast.error(
          error.response?.data?.error || "Failed to fetch attendance records"
        );
      } else {
        toast.error("Failed to fetch attendance records");
      }
    } finally {
      setIsDateLoading(false);
    }
  };

  const fetchAttendanceStats = async () => {
    if (!courseSlug) return;

    try {
      const response = await axiosInstance.get(
        `/courses/${courseSlug}/attendance/stats`
      );
      setAttendanceStats(response.data);
    } catch (error) {
      console.error("Error fetching attendance stats:", error);
    }
  };

  const fetchAttendanceDates = async () => {
    if (!courseSlug) return;

    try {
      // Get all attendance dates for this course
      const response = await axiosInstance.get(
        `/courses/${courseSlug}/attendance/dates`
      );

      console.log("Attendance dates API response:", response.data);

      // Check if the response has the expected structure
      if (!response.data || !Array.isArray(response.data.dates)) {
        console.error("Invalid response structure:", response.data);
        toast.error(
          "Failed to fetch attendance dates: Invalid response format"
        );
        return;
      }

      // Convert dates and sort them
      const uniqueDates = response.data.dates
        .map((dateStr: string) => {
          const date = new Date(dateStr);
          return isNaN(date.getTime()) ? null : date;
        })
        .filter((date: Date | null): date is Date => date !== null)
        .sort((a: Date, b: Date) => a.getTime() - b.getTime());

      console.log("Unique attendance dates:", uniqueDates);

      setAttendanceDates(uniqueDates);
    } catch (error) {
      console.error("Error fetching attendance dates:", error);
      if (axios.isAxiosError(error)) {
        toast.error(
          error.response?.data?.error || "Failed to fetch attendance dates"
        );
      } else {
        toast.error("Failed to fetch attendance dates");
      }
    }
  };

  useEffect(() => {
    if (courseSlug) {
      fetchStudents();
      fetchAttendanceStats();
      fetchAttendanceDates();
    }
  }, [courseSlug]);

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

          // Recreate timers based on elapsed time
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
              // Already past timeout; set grace if within grace window
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

  // Get attendance records for the selected date
  const getAttendanceForDate = (student: Student, date: Date | undefined) => {
    if (!date) return null;
    const dateStr = format(date, "yyyy-MM-dd");
    const record = student.attendanceRecords.find((record) => {
      const recordDate = record.date.split("T")[0];
      return recordDate === dateStr;
    });
    return record;
  };

  // Get attendance status for the selected date
  const getStatusForDate = (
    student: Student,
    selectedDate: string
  ): AttendanceStatusWithNotSet => {
    const record = student.attendanceRecords.find(
      (record) => record.date === selectedDate
    );
    return record ? record.status : "NOT_SET";
  };

  // Filter students based on all filters
  const filteredStudents = useMemo(() => {
    return studentList
      .filter((student) =>
        student.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .filter((student) => {
        if (filters.status.length === 0) return true;
        return filters.status.includes(student.status);
      })
      .sort((a, b) => {
        if (!sortDate) return 0;
        const aAttendance = getAttendanceForDate(a, selectedDate);
        const bAttendance = getAttendanceForDate(b, selectedDate);
        if (sortDate === "newest") {
          return (bAttendance?.date || "").localeCompare(
            aAttendance?.date || ""
          );
        }
        return (aAttendance?.date || "").localeCompare(bAttendance?.date || "");
      });
  }, [studentList, searchQuery, selectedDate, filters.status]);

  const totalPages = useMemo(() => {
    const filtered = studentList
      .filter((student) =>
        student.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .filter((student) => {
        if (filters.status.length === 0) return true;
        return filters.status.includes(student.status);
      });
    return Math.ceil(filtered.length / itemsPerPage);
  }, [studentList, searchQuery, filters.status, itemsPerPage]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const updateStatus = async (index: number, newStatus: AttendanceStatus) => {
    const actualIndex = (currentPage - 1) * itemsPerPage + index;
    const student = filteredStudents[actualIndex];
    if (!student) return;

    // Check if this student is in cooldown
    if (cooldownMap[student.id]) {
      return;
    }

    // Set cooldown for this student
    setCooldownMap((prev) => ({ ...prev, [student.id]: true }));
    setIsUpdating(true); // Set updating state immediately

    // Add one day to the selected date
    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Store the latest update
    latestUpdateRef.current = {
      studentId: student.id,
      status: newStatus,
    };

    // Add to pending updates
    setPendingUpdates((prev) => ({
      ...prev,
      [student.id]: {
        studentId: student.id,
        status: newStatus,
      },
    }));

    // Clear any existing toast timeout
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }

    // Show loading toast immediately
    toast.loading("Updating attendance... (feel free to add more students)", {
      id: "attendance-update",
      style: {
        background: "#fff",
        color: "#124A69",
        border: "1px solid #e5e7eb",
        boxShadow:
          "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
        borderRadius: "0.5rem",
        padding: "1rem",
      },
    });

    // Set a new timeout for the toast
    const timeout = setTimeout(async () => {
      try {
        // Get the latest pending updates including the current one
        const updates = Object.values(pendingUpdates);

        // Ensure the latest update is included
        if (latestUpdateRef.current) {
          const latestUpdate = latestUpdateRef.current;
          if (
            !updates.some(
              (update) => update.studentId === latestUpdate.studentId
            )
          ) {
            updates.push(latestUpdate);
          }
        }

        if (updates.length === 0) {
          setIsUpdating(false);
          return;
        }

        const promise = axiosInstance.post(
          `/courses/${courseSlug}/attendance`,
          {
            date: nextDay.toISOString(),
            attendance: updates,
          }
        );

        // Update local state immediately for better UX
        setStudentList((prev) =>
          prev.map((s) => {
            const update = updates.find((u) => u.studentId === s.id);
            if (update) {
              return { ...s, status: update.status };
            }
            return s;
          })
        );

        await promise;

        // Update attendance records
        const records = updates.map((update) => ({
          id: crypto.randomUUID(),
          studentId: update.studentId,
          courseId: courseSlug!,
          status: update.status,
          date: format(selectedDate, "yyyy-MM-dd"),
          reason: null,
        }));

        setStudentList((prev) =>
          prev.map((s) => {
            const record = records.find((r) => r.studentId === s.id);
            if (record) {
              return {
                ...s,
                status: record.status,
                attendanceRecords: [record],
              };
            }
            return s;
          })
        );

        // Clear pending updates and latest update ref after successful update
        setPendingUpdates({});
        latestUpdateRef.current = null;

        // Update the loading toast to success
        toast.success(
          `Updated ${updates.length} student${updates.length > 1 ? "s" : ""}`,
          {
            id: "attendance-update",
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
      } catch (error) {
        console.error("Error saving attendance:", error);
        // Revert local state on error
        setStudentList((prev) =>
          prev.map((s) => {
            const update = Object.values(pendingUpdates).find(
              (u) => u.studentId === s.id
            );
            if (update) {
              return { ...s, status: "NOT_SET" };
            }
            return s;
          })
        );

        // Update the loading toast to error
        toast.error("Failed to update attendance", {
          id: "attendance-update",
          style: {
            background: "#fff",
            color: "#dc2626",
            border: "1px solid #e5e7eb",
            boxShadow:
              "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
            borderRadius: "0.5rem",
            padding: "1rem",
          },
        });
      } finally {
        // Clear all cooldowns and updating state after API call is complete
        setCooldownMap({});
        setIsUpdating(false);
      }
    }, 3000); // Wait 3 seconds before sending the request

    setToastTimeout(timeout);
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (toastTimeout) {
        clearTimeout(toastTimeout);
      }
    };
  }, [toastTimeout]);

  const currentStudents = useMemo(() => {
    const filtered = studentList
      .filter((student) =>
        student.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .filter((student) => {
        if (filters.status.length === 0) return true;
        return filters.status.includes(student.status);
      })
      .sort((a, b) => {
        if (!sortDate) return 0;
        const aAttendance = getAttendanceForDate(a, selectedDate);
        const bAttendance = getAttendanceForDate(b, selectedDate);
        if (sortDate === "newest") {
          return (bAttendance?.date || "").localeCompare(
            aAttendance?.date || ""
          );
        }
        return (aAttendance?.date || "").localeCompare(bAttendance?.date || "");
      });

    return filtered.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [
    studentList,
    searchQuery,
    filters.status,
    sortDate,
    selectedDate,
    currentPage,
    itemsPerPage,
  ]);

  const handleImageUpload = async (index: number, file: File) => {
    try {
      const student = currentStudents[index];
      if (!student) return;

      const formData = new FormData();
      formData.append("image", file);

      const response = await axiosInstance.post(
        `/courses/${courseSlug}/students/${student.id}/image`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      // Update the student's image in the list
      setStudentList((prev) =>
        prev.map((s) =>
          s.id === student.id ? { ...s, image: response.data.imageUrl } : s
        )
      );

      toast.success("Profile picture updated successfully");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
    }
  };

  const handleSaveImageChanges = async (index: number) => {
    if (!tempImage || tempImage.index !== index) return;

    try {
      setIsSaving(true);
      const formData = new FormData();
      // Convert base64 to blob
      const base64Response = await axiosInstance.get(tempImage.dataUrl, {
        responseType: "arraybuffer",
      });
      const blob = new Blob([base64Response.data]);

      // Get file extension from data URL
      const ext = tempImage.dataUrl.split(";")[0].split("/")[1];
      const fileName = `image.${ext}`;

      // Create file from blob with proper name and type
      const file = new File([blob], fileName, { type: `image/${ext}` });
      formData.append("image", file);

      const uploadResponse = await axiosInstance.post("/upload", formData);
      const { imageUrl } = uploadResponse.data;

      // Update the student's image in the database
      const student = studentList[index];
      const updateResponse = await axiosInstance.put(
        `/students/${student.id}/image`,
        { imageUrl }
      );
      const updatedStudent = updateResponse.data;

      // Update student list with new image URL
      setStudentList((prev) =>
        prev.map((student, i) =>
          i === index ? { ...student, image: imageUrl } : student
        )
      );

      // Clear temp image
      setTempImage(null);

      // Show success message
      setShowSuccessMessage((prev) => ({ ...prev, [index]: true }));
      setTimeout(() => {
        setShowSuccessMessage((prev) => ({ ...prev, [index]: false }));
      }, 3000);
    } catch (error) {
      console.error("Error saving image:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save image",
        {
          duration: 3000,
          style: {
            background: "#fff",
            color: "#dc2626",
            border: "1px solid #e5e7eb",
            boxShadow:
              "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
            borderRadius: "0.5rem",
            padding: "1rem",
          },
        }
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    if (!selectedDate) {
      toast.error("Please select a date before exporting");
      return;
    }

    if (filteredStudents.some((student) => student.status === "NOT_SET")) {
      toast.error(
        "Please set attendance status for all students before exporting"
      );
      return;
    }

    const formattedDate = format(selectedDate, "MMMM d, yyyy");

    // Create header rows
    const header = [
      ["ATTENDANCE RECORD"],
      [""],
      ["Date:", formattedDate],
      ["Course:", courseInfo?.code || ""],
      ["Section:", courseInfo?.section || ""],
      [""],
      // Column headers
      ["Student Name", "Attendance Status"],
    ];

    // Create student data rows using filtered students
    const studentRows = filteredStudents.map((student) => [
      student.name,
      student.status === "NOT_SET" ? "No Status" : student.status,
    ]);

    // Combine header and data
    const ws = XLSX.utils.aoa_to_sheet([...header, ...studentRows]);

    // Style configurations
    const headerStyle = {
      font: { bold: true, size: 14 },
      alignment: { horizontal: "center" },
    };

    // Configure column widths
    ws["!cols"] = [
      { wch: 40 }, // Student Name
      { wch: 20 }, // Attendance Status
    ];

    // Merge cells for title
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, // Merge first row across all columns
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");

    // Generate filename with course and date
    const filename = `attendance_${courseInfo?.code || "course"}_${format(
      selectedDate,
      "yyyy-MM-dd"
    )}.xlsx`;

    XLSX.writeFile(wb, filename);
    toast.success("Attendance data exported successfully");
    setShowExportPreview(false);
  };

  const handleImportExcel = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as ExcelRow[];

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
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Error importing Excel file:", error);
      toast.error("Failed to import Excel file");
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
      toast.error("Please select a date before clearing attendance", {
        style: {
          background: "#fff",
          color: "#124A69",
          border: "1px solid #e5e7eb",
          boxShadow:
            "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          borderRadius: "0.5rem",
          padding: "1rem",
        },
      });
      return;
    }

    setIsClearing(true);
    // Set cooldown for all students
    const allStudentCooldowns = studentList.reduce((acc, student) => {
      acc[student.id] = true;
      return acc;
    }, {} as { [key: string]: boolean });
    setCooldownMap(allStudentCooldowns);

    const dateStr = format(selectedDate, "yyyy-MM-dd");

    // Get all attendance records for the selected date
    const recordsToDelete = studentList
      .filter((student) => student.status !== "NOT_SET")
      .map((student) => {
        const record = student.attendanceRecords.find(
          (r) => r.date === dateStr
        );
        return record?.id;
      })
      .filter((id): id is string => id !== undefined);

    if (recordsToDelete.length === 0) {
      toast.error("No attendance records to clear", {
        style: {
          background: "#fff",
          color: "#124A69",
          border: "1px solid #e5e7eb",
          boxShadow:
            "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          borderRadius: "0.5rem",
          padding: "1rem",
        },
      });
      setIsClearing(false);
      setCooldownMap({});
      return;
    }

    const promise = axiosInstance.post(
      `/courses/${courseSlug}/attendance/clear`,
      {
        date: dateStr,
        recordsToDelete,
      }
    );

    toast.promise(
      promise,
      {
        loading: "Clearing attendance...",
        success: "Attendance cleared successfully",
        error: "Failed to clear attendance",
      },
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
      // Update local state immediately for all students
      setStudentList((prev) =>
        prev.map((student) => ({
          ...student,
          status: "NOT_SET",
          attendanceRecords: student.attendanceRecords.filter(
            (record) => record.date !== dateStr
          ),
        }))
      );

      await promise;
      setShowClearConfirm(false);

      // Remove this date from attendanceDates so a new session can be started
      setAttendanceDates((prev) => {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        return prev.filter((d) => format(d, "yyyy-MM-dd") !== dateStr);
      });

      // End any active session state and reset scanning
      setAttendanceStartTime(null);
      setShowTimeoutModal(false);
      setIsInGracePeriod(false);
      setPendingAttendanceUpdates({});

      // Reset to first page after clearing
      setCurrentPage(1);

      // Immediately allow starting a new session
      setShowTimeSetupModal(true);
    } catch (error) {
      console.error("Error clearing attendance:", error);
      // Revert local state on error
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
      // Clear all cooldowns
      setCooldownMap({});
    }
  };

  // Add useEffect to fetch attendance when date changes
  useEffect(() => {
    if (courseSlug && selectedDate) {
      fetchAttendance(selectedDate);
      fetchAttendanceDates();
    }
  }, [selectedDate, courseSlug]);

  // Add useEffect to reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters.status, sortDate]);

  // Add cleanup effect at the component level
  useEffect(() => {
    // Clean up any existing pointer-events style
    document.body.style.removeProperty("pointer-events");

    return () => {
      document.body.style.removeProperty("pointer-events");
    };
  }, []);

  // Add cleanup effect that runs on mount and unmount
  useEffect(() => {
    return () => {
      // Remove all styles that Radix UI might add
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

  // Real-time timer effect for attendance session
  useEffect(() => {
    if (!attendanceStartTime || !showTimeoutModal) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const timeDiff = now - attendanceStartTime.getTime();
      const minutesRemaining =
        attendanceTimeout - Math.floor(timeDiff / (1000 * 60));

      // Force re-render for timer display
      setStudentList((prev) => [...prev]);

      // Check if timeout has passed
      if (minutesRemaining <= 0 && timeoutTimer) {
        handleAttendanceTimeout();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [attendanceStartTime, showTimeoutModal, attendanceTimeout, timeoutTimer]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (gracePeriodTimer) clearTimeout(gracePeriodTimer);
      if (graceTimeoutTimer) clearTimeout(graceTimeoutTimer);
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      if (batchSaveTimeoutRef.current)
        clearTimeout(batchSaveTimeoutRef.current);
    };
  }, [timeoutTimer, gracePeriodTimer, graceTimeoutTimer]);

  // Global grace countdown ticker
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

  // Keyboard shortcuts for RFID input
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + R to open RFID panel
      if ((e.ctrlKey || e.metaKey) && e.key === "r") {
        e.preventDefault();
        if (attendanceStartTime) {
          setShowTimeoutModal(true);
        }
      }

      // Ctrl/Cmd + S to save all changes
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

  const handleRemoveImage = async (index: number, name: string) => {
    const student = studentList[index];
    if (!student?.image) return;

    try {
      // Delete the image file from public/uploads
      await axiosInstance.delete("/upload", {
        data: { imageUrl: student.image },
      });

      // Update the database
      await axiosInstance.put(`/students/${student.id}/image`, {
        imageUrl: null,
      });

      // Update local state
      setStudentList((prev) =>
        prev.map((student, idx) =>
          idx === index ? { ...student, image: undefined } : student
        )
      );

      // Clear temp image if it exists for this student
      if (tempImage?.index === index) {
        setTempImage(null);
      }
      toast.success("Profile picture removed successfully");
    } catch (error) {
      console.error("Error removing image:", error);
      toast.error("Failed to remove profile picture");
      throw error; // Re-throw to let StudentCard handle the error state
    }
  };

  const handleApplyFilters = () => {
    setCurrentPage(1);
    setIsFilterSheetOpen(false);
  };

  const startAttendance = async () => {
    if (!selectedDate || !courseSlug) {
      toast.error("Please select a date before starting attendance", {
        style: {
          background: "#fff",
          color: "#124A69",
          border: "1px solid #e5e7eb",
          boxShadow:
            "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          borderRadius: "0.5rem",
          padding: "1rem",
        },
      });
      return;
    }

    // Show time setup modal first
    setShowTimeSetupModal(true);
  };

  const confirmAttendanceStart = async () => {
    try {
      const dateStr = format(selectedDate!, "yyyy-MM-dd");

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

      // Set grace period timer
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
      toast.error("Failed to start attendance");
    }
  };

  const handleAttendanceTimeout = async () => {
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

    // After grace period, all late arrivals will be marked as LATE
    toast.success("Grace period ended. Late arrivals will be marked as LATE");
    setIsInGracePeriod(false);

    // Clear grace period timer
    if (gracePeriodTimer) {
      clearTimeout(gracePeriodTimer);
      setGracePeriodTimer(null);
    }
  };

  const processRfidAttendance = async (rfid: string) => {
    if (!attendanceStartTime || !selectedDate) {
      toast.error("Attendance session not started");
      return;
    }

    if (isProcessingRfid) {
      return; // Prevent duplicate processing
    }

    setIsProcessingRfid(true);

    try {
      const norm = (v: string | undefined) =>
        (v || "").replace(/\s+/g, "").toUpperCase();
      const incoming = norm(rfid);
      let student = studentList.find((s) => norm(s.rfid) === incoming);

      if (!student) {
        try {
          const res = await axiosInstance.post("/students/rfid", {
            rfidUid: rfid,
          });
          const resolved = res.data?.student;
          if (resolved?.id) {
            const matchById = studentList.find((s) => s.id === resolved.id);
            if (matchById) {
              if (!matchById.rfid || norm(matchById.rfid) !== incoming) {
                setStudentList((prev) =>
                  prev.map((s) => (s.id === matchById.id ? { ...s, rfid } : s))
                );
              }
              student = matchById;
            }
          }
        } catch {}
      }

      if (!student) {
        toast.error("Student not found in this course for this RFID", {
          duration: 2000,
        });
        return;
      }

      // Check if student already has attendance marked
      if (student.status !== "NOT_SET") {
        toast.error(`${student.name} already marked as ${student.status}`, {
          duration: 2000,
        });
        return;
      }

      // Determine status based ONLY on grace period
      const status: AttendanceStatus = isInGracePeriod ? "PRESENT" : "LATE";
      const now = new Date();

      // Update local state immediately
      setStudentList((prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, status } : s))
      );

      // Save local time-in
      const timeInIso = now.toISOString();
      setLocalTimeInMap((prev) => ({ ...prev, [student.id]: timeInIso }));

      // Add to pending updates
      setPendingAttendanceUpdates((prev) => ({
        ...prev,
        [student.id]: {
          status,
          timestamp: now,
          rfid,
        },
      }));

      // Show success toast ONCE
      const statusText = status === "PRESENT" ? "Present" : "Late";
      toast.success(`${student.name} marked as ${statusText}`, {
        duration: 2000,
        id: `rfid-${student.id}`, // Unique ID prevents duplicate toasts
        style: {
          background: status === "LATE" ? "#fef3c7" : "#f0fdf4",
          color: status === "LATE" ? "#92400e" : "#166534",
          border: status === "LATE" ? "1px solid #f59e0b" : "1px solid #22c55e",
        },
      });

      // Clear RFID input
      setRfidInput("");
      setIsScanning(false);

      // Debounce batch save - ONLY ONE TIMER
      if (batchSaveTimeoutRef.current) {
        clearTimeout(batchSaveTimeoutRef.current);
      }

      batchSaveTimeoutRef.current = setTimeout(() => {
        const updates = pendingUpdatesRef.current;
        if (Object.keys(updates).length > 0) {
          batchUpdateAttendance();
        }
      }, 2000); // Save after 2 seconds of inactivity
    } catch (error) {
      console.error("RFID processing error:", error);
      toast.error("Failed to process RFID", { duration: 2000 });
    } finally {
      setIsProcessingRfid(false);
    }
  };

  // Handle RFID input from keyboard-based reader
  const handleRfidInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    if (value.length === 1 && !isScanning) {
      setRfidInput(value);
      setIsScanning(true);
      return;
    }

    if (isScanning) {
      setRfidInput(value);

      // Process when we have complete RFID (10 characters)
      if (value.length >= 10) {
        await processRfidAttendance(value);
        setIsScanning(false);

        // Clear input immediately
        if (rfidInputRef.current) {
          rfidInputRef.current.value = "";
        }
        setRfidInput("");
      } else {
        // Reset if no more input after 500ms (faster than 1s)
        scanTimeoutRef.current = setTimeout(() => {
          setIsScanning(false);
          setRfidInput("");
          if (rfidInputRef.current) {
            rfidInputRef.current.value = "";
          }
        }, 500); // Reduced from 1000ms
      }
    }
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
    if (Object.keys(sourceUpdates).length === 0) return;

    try {
      const dateStr = format(selectedDate!, "yyyy-MM-dd");

      // Send batch update to API (no await - fire and forget for smoother UX)
      const updatePromise = axiosInstance.post(
        `/courses/${courseSlug}/attendance/batch`,
        {
          date: dateStr,
          updates: Object.entries(sourceUpdates).map(([studentId, update]) => ({
            studentId,
            status: update.status,
            timestamp: update.timestamp,
          })),
        }
      );

      // Clear pending updates immediately for smoother UX
      setPendingAttendanceUpdates({});

      // Update attendance dates optimistically
      const dateOnly = new Date(format(selectedDate!, "yyyy-MM-dd"));
      setAttendanceDates((prev) => {
        const exists = prev.some(
          (d) => format(d, "yyyy-MM-dd") === format(dateOnly, "yyyy-MM-dd")
        );
        return exists ? prev : [...prev, dateOnly];
      });

      await updatePromise;

      toast.success(
        `Saved ${Object.keys(sourceUpdates).length} attendance record(s)`,
        {
          duration: 2000,
        }
      );
    } catch (error) {
      console.error("Error batch updating attendance:", error);
      toast.error("Failed to batch update attendance");
      await fetchAttendance(selectedDate!);
    }
  };

  const endAttendanceSession = async () => {
    // Mark all NOT_SET students as ABSENT before ending
    const notSetStudents = studentList.filter((s) => s.status === "NOT_SET");
    if (notSetStudents.length > 0) {
      const now = new Date();
      // Update UI immediately
      setStudentList((prev) =>
        prev.map((s) =>
          s.status === "NOT_SET" ? { ...s, status: "ABSENT" } : s
        )
      );
      // Queue batch updates
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

    // Clear all timers
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

    // Reset session state
    setAttendanceStartTime(null);
    setShowTimeoutModal(false);
    setIsInGracePeriod(false);

    // Force ABSENT for any remaining NOT_SET students at end
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
      toast.error("Please select a date before marking attendance", {
        style: {
          background: "#fff",
          color: "#124A69",
          border: "1px solid #e5e7eb",
          boxShadow:
            "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          borderRadius: "0.5rem",
          padding: "1rem",
        },
      });
      return;
    }

    setIsMarkingAll(true);
    // Set cooldown for all students
    const allStudentCooldowns = studentList.reduce((acc, student) => {
      acc[student.id] = true;
      return acc;
    }, {} as { [key: string]: boolean });
    setCooldownMap(allStudentCooldowns);

    const dateStr = format(selectedDate, "yyyy-MM-dd");

    try {
      // Create attendance records for all students
      const attendanceRecords = studentList.map((student) => ({
        studentId: student.id,
        status: "PRESENT" as AttendanceStatus,
      }));

      const promise = axiosInstance.post(`/courses/${courseSlug}/attendance`, {
        date: dateStr,
        attendance: attendanceRecords,
      });

      toast.promise(
        promise,
        {
          loading: "Marking all students as present...",
          success: "All students marked as present",
          error: "Failed to mark students as present",
        },
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

      // Update local state immediately for better UX
      setStudentList((prev) =>
        prev.map((student) => ({
          ...student,
          status: "PRESENT",
          attendanceRecords: [
            {
              id: crypto.randomUUID(),
              studentId: student.id,
              courseId: courseSlug,
              status: "PRESENT",
              date: dateStr,
              reason: null,
            },
          ],
        }))
      );

      await promise;
      setShowMarkAllConfirm(false);
    } catch (error) {
      console.error("Error marking all as present:", error);
      // Revert local state on error
      setStudentList((prev) =>
        prev.map((student) => ({
          ...student,
          status: "NOT_SET",
          attendanceRecords: [],
        }))
      );
    } finally {
      setIsMarkingAll(false);
      // Clear all cooldowns
      setCooldownMap({});
    }
  };

  const markAllLateAsPresent = async () => {
    if (!selectedDate || !courseSlug) {
      toast.error("Please select a date before marking attendance", {
        style: {
          background: "#fff",
          color: "#124A69",
          border: "1px solid #e5e7eb",
          boxShadow:
            "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          borderRadius: "0.5rem",
          padding: "1rem",
        },
      });
      return;
    }

    const lateStudents = studentList.filter((s) => s.status === "LATE");
    if (lateStudents.length === 0) {
      toast.error("No late students to mark as present", {
        style: {
          background: "#fff",
          color: "#124A69",
          border: "1px solid #e5e7eb",
          boxShadow:
            "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          borderRadius: "0.5rem",
          padding: "1rem",
        },
      });
      return;
    }

    setIsMarkingAll(true);

    const dateStr = format(selectedDate, "yyyy-MM-dd");

    try {
      const attendanceRecords = lateStudents.map((student) => ({
        studentId: student.id,
        status: "PRESENT" as AttendanceStatus,
      }));

      const promise = axiosInstance.post(`/courses/${courseSlug}/attendance`, {
        date: dateStr,
        attendance: attendanceRecords,
      });

      toast.promise(
        promise,
        {
          loading: "Marking late students as present...",
          success: "Late students marked as present",
          error: "Failed to mark late students as present",
        },
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

      // Update local state immediately for better UX
      setStudentList((prev) =>
        prev.map((student) =>
          student.status === "LATE"
            ? {
                ...student,
                status: "PRESENT",
                attendanceRecords: [
                  {
                    id: crypto.randomUUID(),
                    studentId: student.id,
                    courseId: courseSlug!,
                    status: "PRESENT",
                    date: dateStr,
                    reason: null,
                  },
                ],
              }
            : student
        )
      );

      await promise;
    } catch (error) {
      console.error("Error marking late as present:", error);
      // Revert local state on error
      setStudentList((prev) =>
        prev.map((student) =>
          student.status === "PRESENT" &&
          lateStudents.find((ls) => ls.id === student.id)
            ? { ...student, status: "LATE" }
            : student
        )
      );
    } finally {
      setIsMarkingAll(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen">
        <div className="flex items-center gap-4 p-4 border-b bg-white ">
          <Link href="/main/attendance">
            <Button variant="ghost" size="icon" className="hover:bg-gray-100">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-[#124A69] font-bold text-xl">Loading...</h1>
              <p className="text-gray-500 text-sm">Please wait</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (studentList.length === 0) {
    return (
      <div className="flex flex-col h-screen">
        <div className="flex items-center gap-4 p-4 border-b bg-white">
          <Link href="/main/attendance">
            <Button variant="ghost" size="icon" className="hover:bg-gray-100">
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
      <Toaster
        toastOptions={{
          className: "",
          style: {
            background: "#fff",
            color: "#124A69",
            border: "1px solid #e5e7eb",
            boxShadow:
              "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
            borderRadius: "0.5rem",
            padding: "1rem",
          },
          success: {
            style: {
              background: "#fff",
              color: "#124A69",
              border: "1px solid #e5e7eb",
            },
            iconTheme: {
              primary: "#124A69",
              secondary: "#fff",
            },
          },
          error: {
            style: {
              background: "#fff",
              color: "#dc2626",
              border: "1px solid #e5e7eb",
            },
            iconTheme: {
              primary: "#dc2626",
              secondary: "#fff",
            },
          },
          loading: {
            style: {
              background: "#fff",
              color: "#124A69",
              border: "1px solid #e7eb",
            },
          },
        }}
      />
      <div className="flex items-center gap-4 p-4 border-b bg-white">
        <Link href="/main/attendance">
          <Button variant="ghost" size="icon" className="hover:bg-gray-100">
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
        <div className="flex items-center gap-3 ml-6 flex-grow">
          <div className="flex items-center gap-3">
            <div className="relative flex-grow max-w-[300px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search a name"
                className="w-full pl-9 pr-8 bg-white border-gray-200 rounded-full h-10"
                value={searchQuery}
                onChange={handleSearch}
                disabled={!hasAttendanceForSelectedDate}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={!hasAttendanceForSelectedDate}
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
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="rounded-full h-10 pl-3 pr-2 flex items-center gap-2 w-[180px] justify-between relative"
                  disabled={
                    isDateLoading || isUpdating || isClearing || isMarkingAll
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
                    <CalendarIcon className="h-4 w-4 flex-shrink-0" />
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
                      if (date) {
                        setSelectedDate(date);
                        setOpen(false);
                      }
                    }}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const jan2025 = new Date(2025, 0, 1);
                      return date < jan2025 || date > today;
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
                  isUpdating || isDateLoading || isClearing || isMarkingAll
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
                  !hasAttendanceForSelectedDate
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
                  !hasAttendanceForSelectedDate
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
                  !hasAttendanceForSelectedDate
                }
                className="text-[#EF4444] focus:text-[#EF4444] focus:bg-[#EF4444]/10"
              >
                {isSaving ? "Clearing..." : "Clear Attendance"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex items-center gap-3 ml-auto">
            {attendanceStartTime && (
              <Button
                className="rounded-full bg-[#124A69] hover:bg-[#0a2f42] text-white"
                onClick={() => setShowTimeoutModal(true)}
              >
                Ongoing Attendance • Grace:{" "}
                {graceCountdown || `${graceMinutes}:00`}
              </Button>
            )}
            <Button
              variant="outline"
              className="rounded-full relative flex items-center gap-2 px-3"
              onClick={() => setIsFilterSheetOpen(true)}
              disabled={
                isUpdating ||
                isDateLoading ||
                isClearing ||
                isMarkingAll ||
                !hasAttendanceForSelectedDate
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
              onOpenChange={setIsFilterSheetOpen}
              filters={filters}
              onFiltersChange={setFilters}
              onApplyFilters={handleApplyFilters}
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
                !hasAttendanceForSelectedDate
              }
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 bg-white">
        {!hasAttendanceForSelectedDate &&
        selectedDate &&
        !attendanceStartTime ? (
          // Show "Start Attendance" button when no attendance exists for the selected date
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
              >
                Start Attendance
              </Button>
            </div>
          </div>
        ) : (
          // Show students grid when attendance session is active or records exist
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {isDateLoading ? (
              // Loading skeleton for student cards
              Array.from({ length: 10 }).map((_, index) => (
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
              currentStudents.map((student, index) => (
                <div key={student.id} className="relative">
                  <StudentCard
                    student={{
                      name: student.name,
                      status: student.status,
                      image: student.image,
                    }}
                    index={index}
                    tempImage={tempImage}
                    onImageUpload={handleImageUpload}
                    onSaveChanges={handleSaveImageChanges}
                    onRemoveImage={handleRemoveImage}
                    onStatusChange={(index, status: AttendanceStatus) =>
                      updateStatus(index, status)
                    }
                    isSaving={isSaving}
                    isInCooldown={cooldownMap[student.id] || false}
                  />
                </div>
              ))
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
                >
                  Cancel
                </Button>
                <Button
                  className="bg-[#124A69] hover:bg-[#0D3A54] text-white"
                  onClick={handleExport}
                  disabled={
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

      {hasAttendanceForSelectedDate && (
        <AlertDialog
          open={showClearConfirm}
          onOpenChange={(open) => {
            setShowClearConfirm(open);
            if (!open) {
              document.body.style.removeProperty("pointer-events");
            }
          }}
        >
          <AlertDialogContent className="sm:max-w-[425px]">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-[#124A69] text-xl font-bold">
                Clear Attendance
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-500">
                Are you sure you want to clear all attendance records for{" "}
                {selectedDate
                  ? format(selectedDate, "MMMM d, yyyy")
                  : "this date"}
                ? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-2">
              <AlertDialogCancel
                onClick={() => {
                  setShowClearConfirm(false);
                  document.body.style.removeProperty("pointer-events");
                }}
                className="border-gray-200"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  clearAllAttendance();
                  document.body.style.removeProperty("pointer-events");
                }}
                className="bg-[#124A69] hover:bg-[#0a2f42] text-white"
                disabled={isClearing}
              >
                {isClearing ? "Clearing..." : "Clear Attendance"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {hasAttendanceForSelectedDate && (
        <div className="flex justify-end mt-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (previousAttendance) {
                // Undo action
                if (!previousAttendance) return;

                // Create a new object to ensure state update triggers re-render
                const restoredAttendance = { ...previousAttendance };

                // Update states in sequence to ensure proper re-render
                setUnsavedChanges({}); // Clear current changes first
                setTimeout(() => {
                  setUnsavedChanges(restoredAttendance);
                  setPreviousAttendance(null);
                  toast.success("Attendance restored", {
                    duration: 3000,
                    style: {
                      background: "#fff",
                      color: "#124A69",
                      border: "1px solid #e5e7eb",
                    },
                  });
                }, 0);
              } else {
                // Show reset confirmation modal
                setShowResetConfirmation(true);
              }
            }}
            className={
              previousAttendance
                ? "h-9 px-4 bg-[#124A69] text-white hover:bg-[#0d3a56] border-none"
                : "h-9 px-4 border-gray-200 text-gray-600 hover:bg-gray-50"
            }
            disabled={
              isLoading ||
              (!previousAttendance && Object.keys(unsavedChanges).length === 0)
            }
          >
            {previousAttendance ? "Undo Reset" : "Reset Attendance"}
          </Button>
        </div>
      )}

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
                    style: {
                      background: "#fff",
                      color: "#124A69",
                      border: "1px solid #e5e7eb",
                    },
                  });
                }}
                className="bg-[#124A69] hover:bg-[#0d3a56] text-white"
              >
                Reset Attendance
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Floating RFID Input Button */}
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
        <DialogContent className="max-w-[500px] p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#124A69]">
              Set Attendance Grace Period
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Set the grace period for this attendance session.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Time Input Fields */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Grace Period (minutes)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={graceMinutes}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (isNaN(v) || v <= 0) {
                      setGraceMinutes(1);
                      toast.error("Grace period must be at least 1 minute");
                    } else {
                      setGraceMinutes(v);
                    }
                  }}
                  className="w-full"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Late arrivals within this window are marked LATE
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={confirmAttendanceStart}
                disabled={!graceMinutes || graceMinutes <= 0}
                className="flex-1 bg-[#124A69] hover:bg-[#0D3A54] text-white"
              >
                Start Attendance Session
              </Button>
              <Button
                onClick={() => setShowTimeSetupModal(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Timeout Modal */}
      <Dialog
        open={showTimeoutModal}
        onOpenChange={(open) => {
          setShowTimeoutModal(open);
          if (open) {
            setIsScanning(true);
            setRfidInput("");
            setRfidPreviewStudent({
              name: "",
              image: undefined,
              studentId: "",
            });
            setTimeout(() => {
              if (rfidInputRef.current) {
                rfidInputRef.current.focus();
              }
            }, 0);
          } else {
            setIsScanning(false);
            setRfidPreviewStudent(null);
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
            {/* Left Column: Controls */}
            <div className="flex-1 max-w-[760px] space-y-6">
              {/* Timer Display */}

              {/* RFID Input */}
              <div className="space-y-3 ">
                {/* Hidden RFID input for reader */}
                <input
                  ref={rfidInputRef}
                  type="text"
                  value={rfidInput}
                  onChange={handleRfidInput}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && rfidInputRef.current) {
                      const value = rfidInputRef.current.value.trim();
                      if (value) {
                        processRfidAttendance(value);
                        rfidInputRef.current.value = "";
                        setRfidInput("");
                      }
                    }
                  }}
                  className="absolute -left-[9999px]"
                  placeholder="RFID input"
                />

                <div className="flex justify-center">
                  <div className="flex gap-3">
                    <Button
                      disabled
                      size="lg"
                      className="min-w-[200px] h-16 text-lg bg-[#124A69] hover:bg-[#0a2f42] text-white"
                    >
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                        Please Scan Student RFID
                      </div>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Scanned Students List (cards) */}
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
                >
                  Back
                </Button>
                <Button
                  className="flex-1 h-11 bg-[#124A69] hover:bg-[#0a2f42] text-white"
                  onClick={handleAttendanceTimeout}
                >
                  Time Out
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
