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
import {
  useCourseAnalytics,
  useImportStudentsToCourse,
} from "@/lib/hooks/queries";
import { StudentImportDialog } from "../dialogs/import-students-dialog";
import { AddStudentSheet } from "../sheets/add-student-sheet";
import { RemoveStudentSheet } from "../sheets/remove-student-sheet";
import { TermGradesTab } from "./term-grades";
import { ExportDialog } from "../dialogs/new-export-dialog";
import {
  LoadingSpinner,
  StudentAvatar,
  AttendanceVisualizer,
  AttendanceLegend,
} from "./ui-components";
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
  const [courseInfo, setCourseInfo] = useState<CourseInfo | null>(null);
  const [tableData, setTableData] = useState<StudentWithGrades[]>([]);
  const [stats, setStats] = useState<CourseStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
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
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    });
  const importStudentsMutation = useImportStudentsToCourse();

  // Update local state when React Query data changes
  useEffect(() => {
    if (analyticsData) {
      const { course, stats, students } = analyticsData;
      setCourseInfo(course);
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
  }, [analyticsData, courseSlug]);

  useEffect(() => {
    setIsLoading(isLoadingAnalytics);
  }, [isLoadingAnalytics]);

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
    // Use router.push with a slight delay to show loading state
    setTimeout(() => {
      router.push(backUrl);
    }, 50);
  };

  // Show loading spinner when redirecting or when initial data is loading
  if (isLoading || isRedirecting) {
    return (
      <LoadingSpinner
        mainMessage={
          isRedirecting ? "Loading Courses..." : "Loading Course Details"
        }
        secondaryMessage={
          isRedirecting
            ? "Please wait while we redirect you back to the courses page..."
            : "Please sit tight while we are getting things ready for you..."
        }
      />
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
            <div>
              <h1 className="text-2xl font-bold text-[#124A69]">
                {courseInfo.code} - {courseInfo.title}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
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
                onClick={() => {
                  setShowAddSheet(true);
                }}
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
            </div>
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs
          defaultValue="overview"
          className="w-full flex flex-col flex-1 min-h-0"
        >
          <TabsList className="grid w-full grid-cols-5 flex-shrink-0">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="prelims">Prelims</TabsTrigger>
            <TabsTrigger value="midterm">Midterm</TabsTrigger>
            <TabsTrigger value="prefinals">Pre-Finals</TabsTrigger>
            <TabsTrigger value="finals">Finals</TabsTrigger>
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
                      Start by adding students to this course
                    </p>
                    <div className="flex items-center gap-3 justify-center flex-wrap">
                      <Button
                        onClick={() => {
                          setShowAddSheet(true);
                        }}
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
              students={tableData}
              termKey="prelims"
              globalSearchQuery={globalSearchQuery}
            />
          </TabsContent>

          <TabsContent
            value="midterm"
            className="flex flex-col flex-1 min-h-0 space-y-4 mt-4 pb-4"
          >
            <TermGradesTab
              students={tableData}
              termKey="midterm"
              globalSearchQuery={globalSearchQuery}
            />
          </TabsContent>

          <TabsContent
            value="prefinals"
            className="flex flex-col flex-1 min-h-0 space-y-4 mt-4 pb-4"
          >
            <TermGradesTab
              students={tableData}
              termKey="preFinals"
              globalSearchQuery={globalSearchQuery}
            />
          </TabsContent>

          <TabsContent
            value="finals"
            className="flex flex-col flex-1 min-h-0 space-y-4 mt-4 pb-4"
          >
            <TermGradesTab
              students={tableData}
              termKey="finals"
              globalSearchQuery={globalSearchQuery}
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
      </div>
    </div>
  );
}
