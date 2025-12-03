"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { format } from "date-fns";
import { Role } from "@prisma/client";
import { useAuditLogs } from "@/lib/hooks/queries/useAuditLogs";
import { useFaculty } from "@/lib/hooks/queries";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  Search,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  UserCog,
  BookOpen,
  Activity,
  Download,
  Filter,
  Eye,
  Calendar as CalendarIcon,
} from "lucide-react";
import { AuditExportsModal } from "./AuditExportsModal";
import { AuditLogsFilterSheet } from "./AuditLogsFilterSheet";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  module: string;
  before: any;
  after: any;
  reason: string | null;
  metadata: any;
  batchId: string | null;
  status: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
}

interface AuditLogsTableProps {
  initialLogs: AuditLog[];
  userRole: Role;
  isLoading?: boolean;
  initialFaculty?: any[];
}

function LoadingSpinner() {
  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm min-h-[400px] sm:min-h-[600px]">
      <div className="flex flex-col items-center gap-3 sm:gap-4 mt-20 sm:mt-40">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#124A69] animate-pulse text-center px-4">
          Loading Audit Logs...
        </h2>
        <p
          className="text-sm sm:text-base lg:text-lg text-gray-600 animate-pulse text-center px-4"
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

function AuditLogsTableComponent({
  initialLogs,
  userRole,
  isLoading = false,
  initialFaculty = [],
}: AuditLogsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 9;
  const isAcademicHead = userRole === "ACADEMIC_HEAD";
  const [searchAction, setSearchAction] = useState("");
  const [selectedModule, setSelectedModule] = useState("all");

  const [exportsModalOpen, setExportsModalOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [windowHeight, setWindowHeight] = useState(800);
  const [windowWidth, setWindowWidth] = useState(1024);

  // Get today's date range (start and end of today)
  const getTodayDateRange = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);
    return { start: today, end: endOfToday };
  }, []);

  // Initialize filters in state
  const [filters, setFilters] = useState<{
    actions: string[];
    faculty: string[];
    modules: string[];
    startDate: Date | undefined;
    endDate: Date | undefined;
  }>({
    actions: [],
    faculty: [],
    modules: [],
    startDate: getTodayDateRange.start,
    endDate: getTodayDateRange.end,
  });

  // Local state for date range picker (not applied until "Apply" is clicked)
  const [localDateRange, setLocalDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: filters.startDate,
    to: filters.endDate,
  });

  // Sync local date range with filters when filters change externally
  useEffect(() => {
    setLocalDateRange({
      from: filters.startDate,
      to: filters.endDate,
    });
  }, [filters.startDate, filters.endDate]);

  const { data: facultyData, isLoading: isLoadingFaculty } = useFaculty({
    initialData: initialFaculty,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Extract faculty from React Query
  const faculty = useMemo(() => {
    if (!facultyData || !Array.isArray(facultyData)) return [];
    return facultyData.map((user: any) => ({
      id: user.id,
      name: user.name,
      email: user.email,
    }));
  }, [facultyData]);

  // Track window dimensions for dynamic sizing
  useEffect(() => {
    if (typeof window !== "undefined") {
      setWindowHeight(window.innerHeight);
      setWindowWidth(window.innerWidth);
      const handleResize = () => {
        setWindowHeight(window.innerHeight);
        setWindowWidth(window.innerWidth);
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  // Calculate dynamic table height based on viewport
  const tableHeight = useMemo(() => {
    // Reserve space for header, filters, pagination
    const reservedHeight = 300; // Approximate space for other elements
    const availableHeight = windowHeight - reservedHeight;
    // Min height of 400px, max height of 80% of viewport
    return Math.max(400, Math.min(availableHeight, windowHeight * 0.8));
  }, [windowHeight]);

  // Refetch logs when date range changes
  const shouldRefetch = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    // Check if date range is different from today (default)
    if (!filters.startDate || !filters.endDate) return false;

    const startChanged = filters.startDate.getTime() !== today.getTime();
    const endChanged = filters.endDate.getTime() !== endOfToday.getTime();

    return startChanged || endChanged;
  }, [filters.startDate, filters.endDate]);

  // Fetch logs when date range changes
  const { data: fetchedLogsData, isLoading: isLoadingLogs } = useAuditLogs({
    filters: shouldRefetch
      ? {
          startDate: filters.startDate?.toISOString(),
          endDate: filters.endDate?.toISOString(),
        }
      : undefined,
    enabled: shouldRefetch,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Allowed modules for ACADEMIC_HEAD
  const academicHeadAllowedModules = useMemo(
    () => [
      "Course Management",
      "Course",
      "Courses",
      "Class Management",
      "Faculty",
      "Attendance",
      "Enrollment",
    ],
    []
  );

  // Use fetched logs if date range changed, otherwise use initial logs
  const allLogs = useMemo(() => {
    if (shouldRefetch && fetchedLogsData?.logs) {
      return fetchedLogsData.logs;
    }
    return initialLogs;
  }, [shouldRefetch, fetchedLogsData, initialLogs]);

  // Client-side filtering, sorting, and pagination
  const filteredAndSortedLogs = useMemo(() => {
    let result = [...allLogs];

    // For ACADEMIC_HEAD: Filter out logs from modules they're not allowed to see
    // This ensures they never see unauthorized logs, even if they somehow get through
    if (isAcademicHead) {
      result = result.filter((log) =>
        academicHeadAllowedModules.includes(log.module)
      );
    }

    // Filter by actions
    if (filters.actions.length > 0) {
      result = result.filter((log) => filters.actions.includes(log.action));
    }

    // Filter by modules (intersect with allowed modules for ACADEMIC_HEAD)
    if (filters.modules.length > 0) {
      result = result.filter((log) => filters.modules.includes(log.module));
      // For ACADEMIC_HEAD, ensure filtered modules are also in allowed list
      if (isAcademicHead) {
        const allowedFilterModules = filters.modules.filter((m) =>
          academicHeadAllowedModules.includes(m)
        );
        result = result.filter((log) =>
          allowedFilterModules.includes(log.module)
        );
      }
    }

    // Filter by faculty
    if (filters.faculty.length > 0) {
      result = result.filter(
        (log) => log.userId && filters.faculty.includes(log.userId)
      );
    }

    // Sort by createdAt descending (newest first)
    result.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return result;
  }, [
    allLogs,
    isAcademicHead,
    academicHeadAllowedModules,
    filters.actions,
    filters.modules,
    filters.faculty,
  ]);

  // Paginate the filtered results
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredAndSortedLogs.slice(startIndex, endIndex);
  }, [filteredAndSortedLogs, currentPage, pageSize]);

  // Calculate total pages
  const totalPages = Math.ceil(filteredAndSortedLogs.length / pageSize);

  // Use paginated logs for display
  const logs = paginatedLogs;

  // All possible actions based on audit logging requirements
  const allPossibleActions = useMemo(() => {
    const allActions = [
      "BreakGlass Activated",
      "BreakGlass Deactivate",
      "BreakGlass Promote",
      "Course Activated",
      "Course Archived",
      "Course Create",
      "Course Import",
      "Course Export",
      "User Login",
      "User Logout",
      "User Failed Login",
      "Student Register",
      "Student Import",
      "Student RFID Assigned",
      "Student RFID Reassigned",
    ];

    // Filter actions for ACADEMIC_HEAD - only show actions relevant to their allowed modules
    if (isAcademicHead) {
      // ACADEMIC_HEAD can see: Course Management, Class Management, Faculty, Attendance, Enrollment
      // Relevant actions:
      // - Course-related: Course Activated, Course Archived, Course Create, Course Import, Course Export
      // - Student/Enrollment-related: Student Register, Student Import
      // - Exclude: Security actions (BreakGlass), User login actions
      return allActions.filter((action) => {
        const actionLower = action.toLowerCase();
        // Include Course-related actions
        if (actionLower.includes("course")) return true;
        // Include Student enrollment-related actions
        if (
          actionLower.includes("student register") ||
          actionLower.includes("student import")
        )
          return true;
        // Exclude Security/BreakGlass actions
        if (actionLower.includes("breakglass")) return false;
        // Exclude User login/logout actions
        if (
          actionLower.includes("user login") ||
          actionLower.includes("user logout") ||
          actionLower.includes("user failed")
        )
          return false;
        // Exclude RFID actions (not part of enrollment management)
        if (actionLower.includes("rfid")) return false;
        return false;
      });
    }

    return allActions;
  }, [isAcademicHead]);

  // All possible modules - filter for ACADEMIC_HEAD
  const allPossibleModules = useMemo(() => {
    const allModules = ["Security", "Course", "User", "Student"];
    if (isAcademicHead) {
      // ACADEMIC_HEAD can only see these modules
      return allModules.filter((m) =>
        academicHeadAllowedModules.some(
          (allowed) =>
            m.toLowerCase().includes(allowed.toLowerCase()) ||
            allowed.toLowerCase().includes(m.toLowerCase())
        )
      );
    }
    return allModules;
  }, [isAcademicHead, academicHeadAllowedModules]);

  // Get unique modules and actions from logs (for display)
  // Filter modules for ACADEMIC_HEAD
  const uniqueModules = useMemo(() => {
    const modules = Array.from(
      new Set(logs.map((log: AuditLog) => log.module))
    );
    if (isAcademicHead) {
      return modules
        .filter((m) => academicHeadAllowedModules.includes(m))
        .sort();
    }
    return modules.sort();
  }, [logs, isAcademicHead, academicHeadAllowedModules]);

  const uniqueActions = Array.from(
    new Set(logs.map((log: AuditLog) => log.action))
  ).sort();

  // Count active filters (excluding date range - date is not considered a filter)
  const activeFilterCount =
    filters.actions.length + filters.faculty.length + filters.modules.length;

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.actions, filters.faculty, filters.modules]);

  const toggleRow = (logId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedRows(newExpanded);
  };

  // Get current pathname for navigation
  const currentPath = pathname || "/main/logs";

  const handleSearch = () => {
    // Update filters state
    if (searchAction) {
      setFilters((prev) => ({
        ...prev,
        actions: prev.actions.includes(searchAction)
          ? prev.actions
          : [...prev.actions, searchAction],
      }));
    }
    // Reset to page 1 when searching
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleApplyFilters = () => {
    // Filters are already in state, just reset to page 1 and close sheet
    setCurrentPage(1);
    setFilterSheetOpen(false);
  };

  const getActionBadgeVariant = (
    action: string
  ): "default" | "secondary" | "destructive" => {
    const actionUpper = action.toUpperCase();
    if (actionUpper.includes("CREATED")) {
      return "default";
    }
    if (actionUpper.includes("UPDATED")) {
      return "secondary";
    }
    if (
      actionUpper.includes("DELETED") ||
      actionUpper.includes("FAILED") ||
      actionUpper.includes("BREAK_GLASS")
    ) {
      return "destructive";
    }
    return "default";
  };

  const getModuleIcon = (module: string) => {
    const moduleLower = module.toLowerCase();
    if (moduleLower.includes("security")) {
      return <ShieldAlert className="w-4 h-4" />;
    }
    if (moduleLower.includes("user")) {
      return <UserCog className="w-4 h-4" />;
    }
    if (moduleLower.includes("course")) {
      return <BookOpen className="w-4 h-4" />;
    }
    return <Activity className="w-4 h-4" />;
  };

  // Format action name to be more user-friendly
  const formatActionName = (action: string): string => {
    // Replace underscores with spaces and capitalize words
    return action
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .replace(
        /\b(Success|Failed|Created|Updated|Deleted|Activated|Deactivated|Expired)\b/g,
        (match) => match
      );
  };

  // Format action description for better readability
  const getActionDescription = (action: string, module: string): string => {
    const actionUpper = action.toUpperCase();
    if (actionUpper.includes("CREATED")) {
      return `Created in ${module}`;
    }
    if (actionUpper.includes("UPDATED")) {
      return `Updated in ${module}`;
    }
    if (actionUpper.includes("DELETED")) {
      return `Deleted from ${module}`;
    }
    if (actionUpper.includes("SUCCESS")) {
      return `Successfully completed in ${module}`;
    }
    if (actionUpper.includes("FAILED")) {
      return `Failed in ${module}`;
    }
    if (actionUpper.includes("BREAK_GLASS")) {
      return `Security override in ${module}`;
    }
    return `Action in ${module}`;
  };

  // Keep field names as-is for technical display
  const formatFieldName = (key: string): string => {
    return key;
  };

  // Format file size to human-readable format
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  // Format value for technical display
  const formatValue = (value: any, key?: string): string => {
    if (value === null || value === undefined) {
      return "null";
    }
    if (typeof value === "boolean") {
      return value.toString();
    }
    if (typeof value === "number") {
      return value.toString();
    }
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "object") {
      if (Array.isArray(value)) {
        return JSON.stringify(value);
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  // Render technical details in readable format
  const renderOrganizedDetails = (data: any, title: string) => {
    if (!data || typeof data !== "object") {
      return null;
    }

    if (Object.keys(data).length === 0) {
      return null;
    }

    return (
      <div className="space-y-2">
        <div className="text-sm font-semibold text-[#124A69] dark:text-[#4da6d1] uppercase tracking-wide border-b border-gray-200 pb-1">
          {title}
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-lg p-3 overflow-x-auto">
          <pre className="text-xs font-mono text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>
    );
  };

  // Render metadata in readable format
  const renderMetadata = (metadata: any) => {
    if (!metadata || typeof metadata !== "object") {
      return null;
    }

    return (
      <div className="space-y-2">
        <div className="text-sm font-semibold text-[#124A69] dark:text-[#4da6d1] uppercase tracking-wide border-b border-gray-200 pb-1">
          metadata
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-lg p-3 overflow-x-auto">
          <pre className="text-xs font-mono text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
            {JSON.stringify(metadata, null, 2)}
          </pre>
        </div>
      </div>
    );
  };

  // Show loading spinner if loading (initial load or refetching for date range)
  if (isLoading || (shouldRefetch && isLoadingLogs)) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <Card className="p-4 flex-1 sm:p-6 bg-white shadow-sm border border-gray-200">
        {/* Filters and Export */}
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 flex flex-col gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="pb-1 text-xl sm:text-2xl font-bold text-[#124A69]">
                  Audit Logs
                </h2>
                <p className="text-sm text-muted-foreground">
                  {userRole === Role.ADMIN
                    ? "All system activity logs"
                    : "Course and faculty management logs"}
                </p>
              </div>
              <Badge className="bg-green-50 text-green-700 border border-green-200 h-fit whitespace-nowrap text-xs sm:text-sm">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Auto-exported weekly
              </Badge>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full sm:w-auto justify-start text-left font-normal border-[#124A69] text-sm sm:text-base",
                    !filters.startDate &&
                      !filters.endDate &&
                      "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.startDate && filters.endDate ? (
                    <>
                      {format(filters.startDate, "LLL dd, y")} -{" "}
                      {format(filters.endDate, "LLL dd, y")}
                    </>
                  ) : filters.startDate ? (
                    format(filters.startDate, "LLL dd, y")
                  ) : (
                    "Pick a date range"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{
                    from: localDateRange.from,
                    to: localDateRange.to,
                  }}
                  onSelect={(range: { from?: Date; to?: Date } | undefined) => {
                    setLocalDateRange({
                      from: range?.from,
                      to: range?.to,
                    });
                  }}
                  numberOfMonths={2}
                  className="[&_button[data-range-start='true']]:!bg-[#124A69] [&_button[data-range-start='true']]:!text-white [&_button[data-range-end='true']]:!bg-[#124A69] [&_button[data-range-end='true']]:!text-white"
                />
                <div className="flex items-center gap-2 p-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setLocalDateRange({
                        from: filters.startDate,
                        to: filters.endDate,
                      });
                      setCalendarOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-[#124A69] hover:bg-[#0D3A54]"
                    onClick={() => {
                      setFilters({
                        ...filters,
                        startDate: localDateRange.from,
                        endDate: localDateRange.to,
                      });
                      // Don't set hasAppliedFilters for date changes - date is not considered a filter
                      setCurrentPage(1);
                      setCalendarOpen(false);
                    }}
                  >
                    Apply
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              className="relative border-[#124A69] text-[#124A69] hover:bg-[#124A69] hover:text-white w-full sm:w-auto text-sm sm:text-base"
              onClick={() => setFilterSheetOpen(true)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filter
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#124A69] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>

            <Button
              onClick={() => setExportsModalOpen(true)}
              className="border-white text-white bg-[#124A69]  hover:bg-[#0a2f42] w-full sm:w-auto text-sm sm:text-base"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Exports
            </Button>
          </div>
        </div>

        {/* Table */}
        {logs.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <p className="text-gray-600 text-base sm:text-lg">
              No audit logs found.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            <div
              className="rounded-md border border-gray-200 overflow-y-auto overflow-x-auto"
              style={{
                maxHeight: `${tableHeight}px`,
                minHeight: `${Math.min(tableHeight, 400)}px`,
              }}
            >
              <Table>
                <TableHeader className="sticky top-0 bg-gray-50 z-10">
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-[#124A69] font-semibold text-xs sm:text-sm whitespace-nowrap">
                      Timestamp
                    </TableHead>
                    <TableHead className="text-[#124A69] font-semibold text-xs sm:text-sm whitespace-nowrap">
                      User
                    </TableHead>
                    <TableHead className="text-[#124A69] font-semibold text-xs sm:text-sm whitespace-nowrap">
                      Action
                    </TableHead>
                    <TableHead className="text-[#124A69] font-semibold text-xs sm:text-sm whitespace-nowrap">
                      Module
                    </TableHead>
                    {!isAcademicHead && (
                      <TableHead className="text-[#124A69] font-semibold text-xs sm:text-sm whitespace-nowrap">
                        Details
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: AuditLog) => {
                    const isExpanded = expandedRows.has(log.id);
                    return (
                      <React.Fragment key={log.id}>
                        <TableRow>
                          <TableCell className="px-2 sm:px-4 py-2 sm:py-3">
                            <div className="space-y-1">
                              <div className="font-medium text-xs sm:text-sm">
                                {format(
                                  new Date(log.createdAt),
                                  "MMM dd, yyyy"
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {format(new Date(log.createdAt), "HH:mm:ss")}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-2 sm:px-4 py-2 sm:py-3">
                            {log.user ? (
                              <div>
                                <div className="font-medium text-xs sm:text-sm truncate max-w-[150px] sm:max-w-none">
                                  {log.user.name || "Unknown"}
                                </div>
                                <div className="text-xs text-muted-foreground truncate max-w-[150px] sm:max-w-none">
                                  {log.user.email}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs sm:text-sm">
                                System
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="px-2 sm:px-4 py-2 sm:py-3">
                            <div className="space-y-1">
                              <Badge
                                variant="default"
                                className="bg-[#124A69] text-white border-[#124A69] dark:bg-[#4da6d1] dark:text-white dark:border-[#4da6d1] text-xs"
                              >
                                {formatActionName(log.action)}
                              </Badge>
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {getActionDescription(log.action, log.module)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-2 sm:px-4 py-2 sm:py-3">
                            <div className="flex items-center gap-1 sm:gap-2">
                              {getModuleIcon(log.module)}
                              <span className="text-xs sm:text-sm truncate max-w-[100px] sm:max-w-none">
                                {log.module}
                              </span>
                            </div>
                          </TableCell>
                          {!isAcademicHead && (
                            <TableCell className="px-2 sm:px-4 py-2 sm:py-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleRow(log.id)}
                                className="text-[#124A69] hover:bg-[#124A69]/10 text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                    <span className="hidden sm:inline">
                                      Hide
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                    <span className="hidden sm:inline">
                                      Show
                                    </span>
                                  </>
                                )}
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                        {isExpanded && !isAcademicHead && (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="bg-gray-50/50 px-2 sm:px-4"
                            >
                              <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
                                {/* Technical Info Grid */}
                                {(log.status || log.batchId || log.userId) && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {log.status && (
                                      <div className="bg-white border border-gray-200 rounded-lg p-3">
                                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                          Status
                                        </div>
                                        <div className="text-sm font-medium text-gray-900">
                                          {log.status}
                                        </div>
                                      </div>
                                    )}
                                    {log.batchId && (
                                      <div className="bg-white border border-gray-200 rounded-lg p-3">
                                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                          Batch ID
                                        </div>
                                        <div className="text-sm font-mono text-gray-900 break-all">
                                          {log.batchId}
                                        </div>
                                      </div>
                                    )}
                                    {log.userId && (
                                      <div className="bg-white border border-gray-200 rounded-lg p-3">
                                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                          User ID
                                        </div>
                                        <div className="text-sm font-mono text-gray-900 break-all">
                                          {log.userId}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Reason */}
                                {log.reason && (
                                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                                    <div className="text-sm font-semibold text-[#124A69] dark:text-[#4da6d1] uppercase tracking-wide mb-2 border-b border-gray-200 pb-1">
                                      Reason
                                    </div>
                                    <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                                      {log.reason}
                                    </div>
                                  </div>
                                )}

                                {/* Before State */}
                                {renderOrganizedDetails(
                                  log.before,
                                  "Before State"
                                )}

                                {/* After State */}
                                {renderOrganizedDetails(
                                  log.after,
                                  "After State"
                                )}

                                {/* Metadata */}
                                {renderMetadata(log.metadata)}

                                {/* Empty State */}
                                {!log.before &&
                                  !log.after &&
                                  !log.reason &&
                                  !log.metadata &&
                                  !log.status &&
                                  !log.batchId && (
                                    <div className="text-sm text-gray-500 text-center py-6 bg-white border border-gray-200 rounded-lg">
                                      No additional data available
                                    </div>
                                  )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 0 && (
              <div className="flex flex-col sm:flex-row justify-between mt-auto pt-3 sm:pt-4 border-t border-gray-200 gap-3 sm:gap-0">
                <div className="flex justify-start gap-2 sm:gap-4 w-full sm:w-auto">
                  <span className="w-[300px] text-xs sm:text-sm text-gray-600">
                    Showing {(currentPage - 1) * pageSize + 1}-
                    {Math.min(
                      currentPage * pageSize,
                      filteredAndSortedLogs.length
                    )}{" "}
                    of {filteredAndSortedLogs.length} log
                    {filteredAndSortedLogs.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex justify-end">
                  <Pagination className="flex justify-end sm:justify-end w-full sm:w-auto">
                    <PaginationContent className="flex gap-1">
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage > 1) {
                              handlePageChange(currentPage - 1);
                            }
                          }}
                          className={
                            currentPage === 1
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
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
                              onClick={(e) => {
                                e.preventDefault();
                                handlePageChange(item as number);
                              }}
                              isActive={currentPage === item}
                              className={
                                currentPage === item
                                  ? "bg-[#124A69] text-white hover:bg-[#0d3a56] cursor-pointer"
                                  : "cursor-pointer"
                              }
                            >
                              {item}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}

                      <PaginationItem>
                        <PaginationNext
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage < totalPages) {
                              handlePageChange(currentPage + 1);
                            }
                          }}
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
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Audit Exports Modal */}
      <AuditExportsModal
        open={exportsModalOpen}
        onOpenChange={setExportsModalOpen}
      />

      {/* Filter Sheet */}
      <AuditLogsFilterSheet
        isOpen={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        filters={filters}
        onFiltersChange={setFilters}
        onApplyFilters={handleApplyFilters}
        availableActions={allPossibleActions}
        availableModules={allPossibleModules}
        availableFaculty={faculty}
        isLoadingFaculty={isLoadingFaculty}
      />
    </>
  );
}

export default AuditLogsTableComponent;
