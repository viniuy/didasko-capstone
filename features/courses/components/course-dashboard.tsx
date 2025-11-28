"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import toast from "react-hot-toast";
import {
  Search,
  Download,
  Upload,
  ArrowLeft,
  Users,
  UserX,
  FileSpreadsheet,
} from "lucide-react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  ColumnFiltersState,
  getFilteredRowModel,
} from "@tanstack/react-table";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  useCourseAnalytics,
  useImportStudentsToCourse,
} from "@/lib/hooks/queries";
import { useIsFetching } from "@tanstack/react-query";
import { queryKeys } from "@/lib/hooks/queries/queryKeys";
import { StudentImportDialog } from "../dialogs/import-students-dialog";
import { AddStudentSheet } from "../sheets/add-student-sheet";
import { RemoveStudentSheet } from "../sheets/remove-student-sheet";
import { TermGradesTab } from "./term-grades";
import { ExportDialog } from "../dialogs/new-export-dialog";
import {
  StudentAvatar,
  AttendanceVisualizer,
  AttendanceLegend,
} from "./ui-components";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Student,
  StudentWithGrades,
  StudentWithRecords,
  CourseStats,
  CourseInfo,
} from "../types/types";

interface CourseDashboardProps {
  courseSlug: string;
  backUrl?: string;
  initialAnalyticsData?: any;
}

export function CourseDashboard({
  courseSlug,
  backUrl = "/main/course",
  initialAnalyticsData,
}: CourseDashboardProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const userId = session?.user?.id;
  const isAcademicHead = userRole === "ACADEMIC_HEAD";
  const [courseInfo, setCourseInfo] = useState<CourseInfo | null>(null);
  const [tableData, setTableData] = useState<StudentWithGrades[]>([]);
  const [stats, setStats] = useState<CourseStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "lastName", desc: false },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showRemoveSheet, setShowRemoveSheet] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [studentsWithRecords, setStudentsWithRecords] = useState<
    StudentWithRecords[]
  >([]);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    studentId: true,
    firstName: true,
    lastName: true,
    middleInitial: true,
    attendance: false,
    prelims: false,
    midterm: false,
    preFinals: false,
    finals: false,
  });
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [isTermLoading, setIsTermLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [termAverageGrade, setTermAverageGrade] = useState<{
    averageGrade: number;
    passingRate: number;
    hasGrades: boolean;
    isLoading: boolean;
  }>({
    averageGrade: 0,
    passingRate: 0,
    hasGrades: false,
    isLoading: false,
  });

  // Check if any term grades query is fetching
  const isFetchingTermGrades = useIsFetching({
    predicate: (query) => {
      const key = query.queryKey;
      return (
        Array.isArray(key) &&
        key[0] === "grading" &&
        key[1] === "termGrades" &&
        key[2] === courseSlug
      );
    },
  });

  // Check screen width for button text visibility
  useEffect(() => {
    const checkWidth = () => {
      setIsSmallScreen(window.innerWidth < 1495);
    };

    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  // React Query hooks with initialData
  const { data: analyticsData, isLoading: isLoadingAnalytics } =
    useCourseAnalytics(courseSlug, {
      initialData: initialAnalyticsData,
      refetchOnMount: true, // Enable refetch on mount to get fresh term grades
      refetchOnWindowFocus: false, // Keep false to avoid excessive refetches
    });
  const importStudentsMutation = useImportStudentsToCourse();

  // Check if course is archived
  const isArchived = useMemo(() => {
    return courseInfo?.status === "ARCHIVED";
  }, [courseInfo?.status]);

  // Check if this is the Academic Head's own course
  const isOwnCourse = useMemo(() => {
    if (!courseInfo || !userId) return false;
    return courseInfo.facultyId === userId;
  }, [courseInfo, userId]);

  // Check if Academic Head is viewing someone else's course (view-only)
  const isViewOnly = useMemo(() => {
    return isAcademicHead && !isOwnCourse;
  }, [isAcademicHead, isOwnCourse]);

  // Update local state when React Query data changes
  useEffect(() => {
    if (analyticsData && userId) {
      const { course, stats, students } = analyticsData;

      // Get facultyId from course (either directly or from faculty relation)
      const courseFacultyId =
        (course as any).facultyId || (course as any).faculty?.id;

      // Authorization check: redirect if user is not course owner and not Academic Head
      if (courseFacultyId) {
        const isCourseOwner = courseFacultyId === userId;
        const hasAccess = isCourseOwner || isAcademicHead;

        if (!hasAccess) {
          setIsUnauthorized(true);
          toast.error("You don't have access to this course");
          setTimeout(() => {
            router.push(backUrl);
          }, 1500);
          return;
        }
      }

      // Set courseInfo with facultyId
      setCourseInfo({
        ...course,
        facultyId: courseFacultyId,
      });
      setStats(stats);
      setTableData(students);

      // Transform students for removal sheet
      setStudentsWithRecords(
        students.map((s: StudentWithGrades) => ({
          ...s,
          hasAttendance: (s.attendanceRecords?.length || 0) > 0,
          hasGrades: Object.values(s.termGrades || {}).some(
            (term) => term !== null
          ),
        }))
      );

      // Dispatch custom event to refresh sidebar components
      window.dispatchEvent(
        new CustomEvent("courseStudentsUpdated", {
          detail: { courseSlug },
        })
      );
    }
  }, [analyticsData, courseSlug, userId, isAcademicHead, router, backUrl]);

  useEffect(() => {
    setIsLoading(isLoadingAnalytics);
  }, [isLoadingAnalytics]);

  // Helper function to convert percentage to numeric grade
  const getNumericGrade = (totalPercent: number): number => {
    if (totalPercent >= 97.5) return 1.0;
    if (totalPercent >= 94.5) return 1.25;
    if (totalPercent >= 91.5) return 1.5;
    if (totalPercent >= 86.5) return 1.75;
    if (totalPercent >= 81.5) return 2.0;
    if (totalPercent >= 76.0) return 2.25;
    if (totalPercent >= 70.5) return 2.5;
    if (totalPercent >= 65.0) return 2.75;
    if (totalPercent >= 59.5) return 3.0;
    return 5.0;
  };

  // Helper function to calculate grade from assessment scores
  const calculateGradeFromScores = (
    termGrade: any,
    ptWeight: number,
    quizWeight: number,
    examWeight: number
  ): { totalPercentage: number | null; numericGrade: number | null } => {
    if (!termGrade) return { totalPercentage: null, numericGrade: null };

    // Calculate PT average percentage
    const ptPercentages: number[] = [];
    termGrade.ptScores?.forEach((pt: any) => {
      if (pt.score !== null && pt.score !== undefined && pt.maxScore > 0) {
        const percentage = (pt.score / pt.maxScore) * 100;
        ptPercentages.push(percentage);
      }
    });
    const ptAvg =
      ptPercentages.length > 0
        ? ptPercentages.reduce((a, b) => a + b, 0) / ptPercentages.length
        : 0;

    // Calculate Quiz average percentage
    const quizPercentages: number[] = [];
    termGrade.quizScores?.forEach((quiz: any) => {
      if (
        quiz.score !== null &&
        quiz.score !== undefined &&
        quiz.maxScore > 0
      ) {
        const percentage = (quiz.score / quiz.maxScore) * 100;
        quizPercentages.push(percentage);
      }
    });
    const quizAvg =
      quizPercentages.length > 0
        ? quizPercentages.reduce((a, b) => a + b, 0) / quizPercentages.length
        : 0;

    // Calculate Exam percentage
    let examPercentage: number | null = null;
    if (termGrade.examScore) {
      const exam = termGrade.examScore;
      if (
        exam.score !== null &&
        exam.score !== undefined &&
        exam.maxScore > 0
      ) {
        examPercentage = (exam.score / exam.maxScore) * 100;
      }
    }

    // If no exam score, can't compute term grade
    if (examPercentage === null) {
      return { totalPercentage: null, numericGrade: null };
    }

    // Calculate weighted total
    const ptWeighted = (ptAvg / 100) * ptWeight;
    const quizWeighted = (quizAvg / 100) * quizWeight;
    const examWeighted = (examPercentage / 100) * examWeight;
    const totalPercentage = ptWeighted + quizWeighted + examWeighted;

    // Calculate numeric grade
    const numericGrade = getNumericGrade(totalPercentage);

    return { totalPercentage, numericGrade };
  };

  // Reset termAverageGrade when switching to overview tab
  useEffect(() => {
    if (activeTab === "overview") {
      setTermAverageGrade({
        averageGrade: stats?.averageGrade || 0,
        passingRate: stats?.passingRate || 0,
        hasGrades: true,
        isLoading: false,
      });
    }
  }, [activeTab, stats]);

  // Dispatch tab change with computed average
  useEffect(() => {
    if (courseInfo && !isLoading) {
      // Use termAverageGrade from TermGradesTab if on a term tab, otherwise use overview stats
      const averageGradeData =
        activeTab === "overview"
          ? {
              averageGrade: stats?.averageGrade || 0,
              passingRate: stats?.passingRate || 0,
              hasGrades: true,
              isLoading: false,
            }
          : termAverageGrade;

      // Dispatch tab state with computed average
      window.dispatchEvent(
        new CustomEvent("courseTabChanged", {
          detail: {
            courseSlug,
            activeTab,
            termAverageGrade: averageGradeData,
          },
        })
      );
    }
  }, [courseInfo, courseSlug, isLoading, activeTab, termAverageGrade, stats]);

  const columns = useMemo<ColumnDef<StudentWithGrades>[]>(
    () => [
      {
        accessorKey: "studentId",
        header: "Student ID",
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.studentId}</span>
        ),
      },
      {
        accessorKey: "lastName",
        header: "Name",
        cell: ({ row }) => <StudentAvatar student={row.original} />,
        sortingFn: (rowA, rowB) => {
          const lastNameA = rowA.original.lastName.toLowerCase();
          const lastNameB = rowB.original.lastName.toLowerCase();
          const lastNameCompare = lastNameA.localeCompare(
            lastNameB,
            undefined,
            {
              sensitivity: "base",
            }
          );
          if (lastNameCompare !== 0) return lastNameCompare;
          // If last names are the same, sort by first name
          const firstNameA = rowA.original.firstName.toLowerCase();
          const firstNameB = rowB.original.firstName.toLowerCase();
          return firstNameA.localeCompare(firstNameB, undefined, {
            sensitivity: "base",
          });
        },
      },
      {
        id: "attendance",
        header: "Attendance",
        cell: ({ row }) => (
          <AttendanceVisualizer records={row.original.attendanceRecords} />
        ),
      },
    ],
    []
  );

  // Filter table data based on global search query
  const filteredTableData = useMemo(() => {
    if (!globalSearchQuery.trim()) {
      return tableData;
    }

    const searchValue = globalSearchQuery.toLowerCase();
    return tableData.filter((student) => {
      const studentId = (student.studentId || "").toLowerCase();
      const firstName = (student.firstName || "").toLowerCase();
      const lastName = (student.lastName || "").toLowerCase();
      const middleInitial = (student.middleInitial || "").toLowerCase();

      return (
        studentId.includes(searchValue) ||
        firstName.includes(searchValue) ||
        lastName.includes(searchValue) ||
        middleInitial.includes(searchValue) ||
        `${firstName} ${lastName}`.includes(searchValue) ||
        `${lastName}, ${firstName}`.includes(searchValue)
      );
    });
  }, [tableData, globalSearchQuery]);

  const table = useReactTable({
    data: filteredTableData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
  });

  const handleSelectExistingStudent = async (student: Student) => {
    // Prevent view-only users from adding students
    if (isViewOnly) {
      toast.error(
        "You don't have permission to manage students for this course"
      );
      return;
    }

    try {
      // Format: "Last Name, First Name M."
      const fullName = `${student.lastName}, ${student.firstName}${
        student.middleInitial ? ` ${student.middleInitial}.` : ""
      }`;

      await importStudentsMutation.mutateAsync({
        courseSlug,
        students: [
          {
            "Student Number": student.studentId,
            "Full Name": fullName,
          },
        ],
      });
      // Data will be refetched automatically by React Query (analytics query is invalidated)
      // Dispatch custom event to refresh sidebar components
      window.dispatchEvent(
        new CustomEvent("courseStudentsUpdated", {
          detail: { courseSlug },
        })
      );
      setShowAddSheet(false);
    } catch (error: any) {
      throw new Error(error?.response?.data?.error || "Failed to add student");
    }
  };

  const handleBackNavigation = () => {
    setIsRedirecting(true);
    router.push(backUrl);
  };

  // Show unauthorized message
  if (isUnauthorized) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm min-h-[840px] transition-opacity duration-200">
        <div className="flex flex-col items-center justify-center h-96">
          <p className="text-gray-500 text-lg mb-4">
            You don't have access to this course
          </p>
          <Button onClick={handleBackNavigation} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Courses
          </Button>
        </div>
      </div>
    );
  }

  // Show loading skeleton when redirecting or when initial data is loading
  if (isLoading || isRedirecting) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm h-screen flex flex-col overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col flex-1 min-h-0 space-y-6 pb-6">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-md" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96" />
              </div>
            </div>
          </div>

          {/* Search and Action Buttons Skeleton */}
          <div className="flex gap-2 flex-wrap justify-between">
            <Skeleton className="h-10 w-full sm:w-[400px]" />
            <div className="flex gap-2 flex-wrap">
              <Skeleton className="h-10 w-20 sm:w-24" />
              <Skeleton className="h-10 w-32 sm:w-40" />
              <Skeleton className="h-10 w-28 sm:w-36" />
              <Skeleton className="h-10 w-32 sm:w-40" />
            </div>
          </div>

          {/* Tabs Skeleton */}
          <div className="w-full">
            <div className="grid w-full grid-cols-5 gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>

            {/* Table Skeleton */}
            <div className="rounded-md border overflow-hidden">
              <div className="p-4 space-y-3">
                {/* Table Header Skeleton */}
                <div className="flex gap-4 pb-2 border-b">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-28" />
                </div>
                {/* Table Rows Skeleton */}
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div
                    key={i}
                    className="flex gap-4 py-3 border-b last:border-0"
                  >
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!courseInfo || !stats) {
    return (
      <div
        className={`bg-white p-6 rounded-lg shadow-sm min-h-[840px] transition-opacity duration-200 ${
          isRedirecting ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="flex flex-col items-center justify-center h-96">
          <p className="text-gray-500 text-lg mb-4">Course not found</p>
          <Button onClick={handleBackNavigation} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Courses
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white p-6 rounded-lg shadow-sm h-screen flex flex-col overflow-y-auto overflow-x-hidden transition-opacity duration-200 ${
        isRedirecting ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col flex-1 min-h-0 space-y-6 pb-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={handleBackNavigation}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1
                className="text-2xl font-bold text-[#124A69] truncate"
                title={`${courseInfo.code} - ${courseInfo.title}`}
              >
                {courseInfo.code} - {courseInfo.title}
              </h1>
              <p
                className="text-sm text-gray-600 mt-1 truncate"
                title={`Section: ${courseInfo.section} • Room: ${courseInfo.room} • ${courseInfo.semester} • ${courseInfo.academicYear}`}
              >
                Section: {courseInfo.section} • Room: {courseInfo.room} •{" "}
                {courseInfo.semester} • {courseInfo.academicYear}
              </p>
            </div>
          </div>
        </div>

        {/* Search and Action Buttons - Above tabs */}
        {tableData.length > 0 && (
          <div className="flex gap-2 flex-wrap justify-between">
            <div className="relative w-full sm:w-[400px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search students..."
                value={globalSearchQuery}
                onChange={(e) => {
                  setGlobalSearchQuery(e.target.value);
                }}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() => setShowExportDialog(true)}
                className={isSmallScreen ? "" : "gap-2"}
                size={isSmallScreen ? "icon" : "default"}
              >
                <Download className="w-4 h-4" />
                {!isSmallScreen && <span>Export</span>}
              </Button>
              {!isArchived && !isViewOnly && (
                <>
                  <Button
                    onClick={() => setShowImportDialog(true)}
                    variant="outline"
                    className={`${
                      isSmallScreen ? "" : "gap-2"
                    } border-[#124A69] text-[#124A69] hover:bg-[#124A69] hover:text-white`}
                    size={isSmallScreen ? "icon" : "default"}
                  >
                    <Upload className="w-4 h-4" />
                    {!isSmallScreen && <span>Import Students</span>}
                  </Button>
                  <Button
                    onClick={() => setShowAddSheet(true)}
                    className={`${
                      isSmallScreen ? "" : "gap-2"
                    } bg-[#124A69] hover:bg-[#0D3A54] text-white`}
                    size={isSmallScreen ? "icon" : "default"}
                  >
                    <Users className="w-4 h-4" />
                    {!isSmallScreen && <span>Add Student</span>}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowRemoveSheet(true)}
                    className={`${
                      isSmallScreen ? "" : "gap-2"
                    } border-red-500 text-red-600 hover:bg-red-50`}
                    size={isSmallScreen ? "icon" : "default"}
                  >
                    <UserX className="w-4 h-4" />
                    {!isSmallScreen && <span>Remove Student</span>}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs
          defaultValue="overview"
          className="w-full flex flex-col flex-1 min-h-0"
          onValueChange={(value) => {
            setActiveTab(value);
            // Event will be dispatched by useEffect that watches activeTab
          }}
        >
          <TabsList className="grid w-full grid-cols-5 flex-shrink-0">
            <TabsTrigger
              value="overview"
              disabled={isTermLoading || isFetchingTermGrades > 0}
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="prelims"
              disabled={isTermLoading || isFetchingTermGrades > 0}
            >
              Prelims
            </TabsTrigger>
            <TabsTrigger
              value="midterm"
              disabled={isTermLoading || isFetchingTermGrades > 0}
            >
              Midterm
            </TabsTrigger>
            <TabsTrigger
              value="prefinals"
              disabled={isTermLoading || isFetchingTermGrades > 0}
            >
              Pre-Finals
            </TabsTrigger>
            <TabsTrigger
              value="finals"
              disabled={isTermLoading || isFetchingTermGrades > 0}
            >
              Finals
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent
            value="overview"
            className="flex flex-col flex-1 min-h-0 space-y-4 mt-4 pb-4"
          >
            {tableData.length > 0 && (
              <div className="flex-shrink-0">
                <AttendanceLegend />
              </div>
            )}

            {tableData.length === 0 ? (
              <>
                <style>{`
                  @keyframes tumbleweedHorizontal {
                    0% {
                      left: -100px;
                    }
                    100% {
                      left: calc(100% + 20px);
                    }
                  }
                  @keyframes tumbleweedBounce {
                    0% {
                      transform: translateY(0px);
                    }
                    25% {
                      transform: translateY(-12px);
                    }
                    50% {
                      transform: translateY(0px);
                    }
                    75% {
                      transform: translateY(-10px);
                    }
                    100% {
                      transform: translateY(0px);
                    }
                  }
                  @keyframes tumbleweedRotate {
                    from {
                      transform: rotate(0deg);
                    }
                    to {
                      transform: rotate(360deg);
                    }
                  }
                  .tumbleweed-container {
                    animation: tumbleweedHorizontal 8s linear infinite,
                               tumbleweedBounce 1.6s ease-in-out infinite;
                  }
                  .tumbleweed-svg {
                    animation: tumbleweedRotate 4s linear infinite;
                  }
                `}</style>
                <div className="flex flex-col items-center justify-center flex-1 min-h-[200px] mb-4 rounded-md border border-dashed border-gray-300 bg-gray-50/50 relative overflow-hidden">
                  <div className="text-center px-4 pb-8 z-10 relative">
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">
                      It seems empty here
                    </h3>
                    <p className="text-gray-500 mb-4">
                      {isArchived
                        ? "This course is archived. Student management is disabled."
                        : isViewOnly
                        ? "You can view course data but cannot manage students for this course."
                        : "Start by adding students to this course"}
                    </p>
                    {!isArchived && !isViewOnly && (
                      <div className="flex items-center gap-3 justify-center flex-wrap">
                        <Button
                          onClick={() => setShowAddSheet(true)}
                          className="bg-[#124A69] hover:bg-[#0D3A54] text-white gap-2"
                        >
                          <Users className="w-4 h-4" />
                          Add Student
                        </Button>
                        <span className="text-gray-500">or</span>
                        <Button
                          onClick={() => setShowImportDialog(true)}
                          variant="outline"
                          className="border-[#124A69] text-[#124A69] hover:bg-[#124A69] hover:text-white gap-2"
                        >
                          <Upload className="w-4 h-4" />
                          Import Students
                        </Button>
                      </div>
                    )}
                  </div>
                  {/* Tumbleweed Animation */}
                  <div className="relative w-full flex items-end">
                    {/* Outer container: horizontal movement + vertical bounce */}
                    <div className="absolute bottom-0 tumbleweed-container">
                      {/* Inner SVG: rotation only */}
                      <img
                        src="/svg/tumbleweed.svg"
                        alt="Tumbleweed"
                        className="w-20 h-20 tumbleweed-svg"
                        style={{ filter: "brightness(0.8)" }}
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div
                className="rounded-md border overflow-auto flex-1 min-h-[200px] mb-4"
                style={{
                  height: "auto",
                  maxHeight: "100%",
                  alignSelf: "stretch",
                }}
              >
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows?.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id}>
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={columns.length}
                          className="h-24 text-center"
                        >
                          No students found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Term Grade Tabs */}
          <TabsContent
            value="prelims"
            className="flex flex-col flex-1 min-h-0 space-y-4 mt-4 pb-4"
          >
            <TermGradesTab
              courseSlug={courseSlug}
              termKey="prelims"
              globalSearchQuery={globalSearchQuery}
              onLoadingChange={setIsTermLoading}
              onAverageGradeChange={(avg) => {
                if (activeTab === "prelims") {
                  setTermAverageGrade(avg);
                }
              }}
            />
          </TabsContent>

          <TabsContent
            value="midterm"
            className="flex flex-col flex-1 min-h-0 space-y-4 mt-4 pb-4"
          >
            <TermGradesTab
              courseSlug={courseSlug}
              termKey="midterm"
              globalSearchQuery={globalSearchQuery}
              onLoadingChange={setIsTermLoading}
              onAverageGradeChange={(avg) => {
                if (activeTab === "midterm") {
                  setTermAverageGrade(avg);
                }
              }}
            />
          </TabsContent>

          <TabsContent
            value="prefinals"
            className="flex flex-col flex-1 min-h-0 space-y-4 mt-4 pb-4"
          >
            <TermGradesTab
              courseSlug={courseSlug}
              termKey="preFinals"
              globalSearchQuery={globalSearchQuery}
              onLoadingChange={setIsTermLoading}
              onAverageGradeChange={(avg) => {
                if (activeTab === "prefinals") {
                  setTermAverageGrade(avg);
                }
              }}
            />
          </TabsContent>

          <TabsContent
            value="finals"
            className="flex flex-col flex-1 min-h-0 space-y-4 mt-4 pb-4"
          >
            <TermGradesTab
              courseSlug={courseSlug}
              termKey="finals"
              globalSearchQuery={globalSearchQuery}
              onLoadingChange={setIsTermLoading}
              onAverageGradeChange={(avg) => {
                if (activeTab === "finals") {
                  setTermAverageGrade(avg);
                }
              }}
            />
          </TabsContent>
        </Tabs>

        <ExportDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          students={tableData}
          courseInfo={courseInfo}
        />

        {/* Modals */}
        {!isViewOnly && (
          <>
            <AddStudentSheet
              isOpen={showAddSheet}
              onOpenChange={setShowAddSheet}
              enrolledStudentIds={tableData.map((s) => s.id)}
              onSelectStudent={handleSelectExistingStudent}
            />

            <RemoveStudentSheet
              isOpen={showRemoveSheet}
              onOpenChange={setShowRemoveSheet}
              students={studentsWithRecords}
              isLoading={false}
              courseSlug={courseSlug}
              onRemoveSuccess={async () => {
                // Data will be refetched automatically by React Query
                // Dispatch custom event to refresh sidebar components
                window.dispatchEvent(
                  new CustomEvent("courseStudentsUpdated", {
                    detail: { courseSlug },
                  })
                );
              }}
            />

            <StudentImportDialog
              open={showImportDialog}
              onOpenChange={setShowImportDialog}
              courseSlug={courseSlug}
              onImportComplete={async () => {
                // Data will be refetched automatically by React Query
                // Dispatch custom event to refresh sidebar components
                window.dispatchEvent(
                  new CustomEvent("courseStudentsUpdated", {
                    detail: { courseSlug },
                  })
                );
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
