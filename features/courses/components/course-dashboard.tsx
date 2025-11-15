"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import toast from "react-hot-toast";
import {
  Search,
  Download,
  Upload,
  ArrowLeft,
  Users,
  UserX,
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
  getPaginationRowModel,
} from "@tanstack/react-table";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import axiosInstance from "@/lib/axios";
import { useRouter } from "next/navigation";
import { StudentImportDialog } from "../dialogs/import-students-dialog";
import { AddStudentSheet } from "../sheets/add-student-sheet";
import { RemoveStudentSheet } from "../sheets/remove-student-sheet";
import { TermGradesTab } from "./term-grades";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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
}

export function CourseDashboard({
  courseSlug,
  backUrl = "/main/course",
}: CourseDashboardProps) {
  const router = useRouter();
  const [courseInfo, setCourseInfo] = useState<CourseInfo | null>(null);
  const [tableData, setTableData] = useState<StudentWithGrades[]>([]);
  const [stats, setStats] = useState<CourseStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showRemoveSheet, setShowRemoveSheet] = useState(false);
  const [existingStudents, setExistingStudents] = useState<Student[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [studentsWithRecords, setStudentsWithRecords] = useState<
    StudentWithRecords[]
  >([]);

  useEffect(() => {
    if (courseSlug) {
      fetchCourseData();
    }
  }, [courseSlug]);

  const fetchCourseData = async () => {
    try {
      setIsLoading(true);
      const response = await axiosInstance.get(
        `/courses/${courseSlug}/course-analytics`
      );
      const { course, stats, students } = response.data;
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
    } catch (error) {
      toast.error("Failed to load course data");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExistingStudents = async () => {
    try {
      const response = await axiosInstance.get("/students");
      setExistingStudents(
        (response.data.students || []).filter((s: Student) => s.rfid_id)
      );
    } catch (error) {
      toast.error("Failed to load students");
    }
  };

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

  const table = useReactTable({
    data: tableData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
  });

  const handleSelectExistingStudent = async (student: Student) => {
    try {
      // Use the same format as your existing POST endpoint
      await axiosInstance.post(`/courses/${courseSlug}/students`, [
        {
          "Student ID": student.studentId,
          "First Name": student.firstName,
          "Last Name": student.lastName,
          "Middle Initial": student.middleInitial || "",
        },
      ]);
      await fetchCourseData();
      toast.success("Student added successfully!");
      setShowAddSheet(false);
    } catch (error: any) {
      throw new Error(error?.response?.data?.error || "Failed to add student");
    }
  };

  const handleExport = async () => {
    if (!courseInfo) return;
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Students");

      // Title row
      worksheet.mergeCells("A1:D1");
      const titleRow = worksheet.getCell("A1");
      titleRow.value = `${courseInfo.code} - ${courseInfo.title}`;
      titleRow.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
      titleRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF124A69" },
      };
      titleRow.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(1).height = 30;

      // Info row
      worksheet.mergeCells("A2:D2");
      const infoRow = worksheet.getCell("A2");
      infoRow.value = `Section ${courseInfo.section} • ${courseInfo.room} • ${courseInfo.semester} ${courseInfo.academicYear}`;
      infoRow.font = { italic: true, size: 11 };
      infoRow.alignment = { vertical: "middle", horizontal: "center" };

      // Date row
      worksheet.mergeCells("A3:D3");
      const dateRow = worksheet.getCell("A3");
      dateRow.value = `Export Date: ${new Date().toLocaleDateString()}`;
      dateRow.font = { italic: true, size: 10, color: { argb: "FF666666" } };
      dateRow.alignment = { vertical: "middle", horizontal: "center" };

      worksheet.addRow([]);

      // Header row
      const headerRow = worksheet.addRow([
        "Student ID",
        "Last Name",
        "First Name",
        "Middle Initial",
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

      // Data rows
      tableData.forEach((student, index) => {
        const row = worksheet.addRow([
          student.studentId,
          student.lastName,
          student.firstName,
          student.middleInitial || "",
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

        if ((index + 1) % 2 === 0) {
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
        { width: 20 },
        { width: 20 },
        { width: 15 },
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const filename = `${courseInfo.code}_students_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      saveAs(blob, filename);

      toast.success(`Successfully exported ${tableData.length} students`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Export failed");
    }
  };

  if (isLoading) return <LoadingSpinner />;

  if (!courseInfo || !stats) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm min-h-[840px]">
        <div className="flex flex-col items-center justify-center h-96">
          <p className="text-gray-500 text-lg mb-4">Course not found</p>
          <Button onClick={() => router.push(backUrl)} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Courses
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm min-h-[840px]">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push(backUrl)}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[#124A69]">
                {courseInfo.code} - {courseInfo.title}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Section {courseInfo.section} • {courseInfo.room} •{" "}
                {courseInfo.semester} • {courseInfo.academicYear}
              </p>
            </div>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="prelims">Prelims</TabsTrigger>
            <TabsTrigger value="midterm">Midterm</TabsTrigger>
            <TabsTrigger value="prefinals">Pre-Finals</TabsTrigger>
            <TabsTrigger value="finals">Finals</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:w-[400px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search students..."
                  value={
                    (table.getColumn("lastName")?.getFilterValue() as string) ??
                    ""
                  }
                  onChange={(e) =>
                    table.getColumn("lastName")?.setFilterValue(e.target.value)
                  }
                  className="pl-9"
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={handleExport}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export
                </Button>
                <Button
                  onClick={() => setShowImportDialog(true)}
                  variant="outline"
                  className="gap-2 border-[#124A69] text-[#124A69] hover:bg-[#124A69] hover:text-white"
                >
                  <Upload className="w-4 h-4" />
                  Import Students
                </Button>
                <Button
                  onClick={() => {
                    setShowAddSheet(true);
                    fetchExistingStudents();
                  }}
                  className="bg-[#124A69] hover:bg-[#0D3A54] text-white gap-2"
                >
                  <Users className="w-4 h-4" />
                  Add Student
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowRemoveSheet(true)}
                  className="gap-2 border-red-500 text-red-600 hover:bg-red-50"
                >
                  <UserX className="w-4 h-4" />
                  Remove
                </Button>
              </div>
            </div>

            <AttendanceLegend />

            <div className="rounded-md border">
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

            <div className="flex items-center justify-end">
              <Pagination className="justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => table.previousPage()}
                      className={
                        !table.getCanPreviousPage()
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                  {Array.from({ length: table.getPageCount() }, (_, i) => (
                    <PaginationItem key={i}>
                      <PaginationLink
                        onClick={() => table.setPageIndex(i)}
                        isActive={table.getState().pagination.pageIndex === i}
                        className={
                          table.getState().pagination.pageIndex === i
                            ? "bg-[#124A69] text-white"
                            : ""
                        }
                      >
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => table.nextPage()}
                      className={
                        !table.getCanNextPage()
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </TabsContent>

          {/* Term Grade Tabs */}
          <TabsContent value="prelims">
            <TermGradesTab students={tableData} termKey="prelims" />
          </TabsContent>

          <TabsContent value="midterm">
            <TermGradesTab students={tableData} termKey="midterm" />
          </TabsContent>

          <TabsContent value="prefinals">
            <TermGradesTab students={tableData} termKey="preFinals" />
          </TabsContent>

          <TabsContent value="finals">
            <TermGradesTab students={tableData} termKey="finals" />
          </TabsContent>
        </Tabs>

        {/* Modals */}
        <AddStudentSheet
          isOpen={showAddSheet}
          onOpenChange={setShowAddSheet}
          existingStudents={existingStudents}
          isLoading={false}
          enrolledStudentIds={tableData.map((s) => s.id)}
          onSelectStudent={handleSelectExistingStudent}
        />

        <RemoveStudentSheet
          isOpen={showRemoveSheet}
          onOpenChange={setShowRemoveSheet}
          students={studentsWithRecords}
          isLoading={false}
          courseSlug={courseSlug}
          onRemoveSuccess={fetchCourseData}
        />

        <StudentImportDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          courseSlug={courseSlug}
          onImportComplete={fetchCourseData}
        />
      </div>
    </div>
  );
}
