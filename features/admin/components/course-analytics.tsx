"use client";

import React, {
  useState,
  useMemo,
  useRef,
  useCallback,
  useEffect,
} from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
import {
  Search,
  Download,
  Upload,
  ChevronDown,
  ArrowUpDown,
  Users,
  UserCheck,
  UserX,
  Clock,
  TrendingUp,
  FileSpreadsheet,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import * as XLSX from "xlsx";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  ColumnFiltersState,
  VisibilityState,
  getFilteredRowModel,
  getPaginationRowModel,
} from "@tanstack/react-table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Types
interface Student {
  id: string;
  lastName: string;
  firstName: string;
  middleInitial?: string;
  studentId: string;
  image?: string;
  attendanceRate?: number;
  totalPresent?: number;
  totalAbsent?: number;
  totalLate?: number;
  totalExcused?: number;
  averageGrade?: number;
  latestGrade?: number;
}

interface CourseStats {
  totalStudents: number;
  attendanceRate: number;
  averageGrade: number;
  totalAbsents: number;
  totalLate: number;
  totalExcused: number;
  passingRate: number;
}

interface ImportStatus {
  imported: number;
  skipped: number;
  errors: Array<{ studentId: string; message: string }>;
  total: number;
  detailedFeedback: Array<{
    row: number;
    studentId: string;
    status: string;
    message: string;
  }>;
}

// Mock data for demonstration
const mockCourseData = {
  code: "CS101",
  title: "Introduction to Programming",
  section: "A",
  room: "A101",
  semester: "1st Semester",
  academicYear: "2024-2025",
};

const mockStats: CourseStats = {
  totalStudents: 45,
  attendanceRate: 87.5,
  averageGrade: 85.3,
  totalAbsents: 23,
  totalLate: 15,
  totalExcused: 8,
  passingRate: 91.1,
};

const mockStudents: Student[] = Array.from({ length: 45 }, (_, i) => ({
  id: `student-${i + 1}`,
  studentId: `2024-${String(i + 1).padStart(4, "0")}`,
  lastName: ["Dela Cruz", "Santos", "Reyes", "Garcia", "Martinez"][i % 5],
  firstName: ["Juan", "Maria", "Jose", "Anna", "Pedro"][i % 5],
  middleInitial: ["A", "B", "C", "D", "E"][i % 5],
  attendanceRate: 75 + Math.random() * 25,
  totalPresent: Math.floor(30 + Math.random() * 10),
  totalAbsent: Math.floor(Math.random() * 5),
  totalLate: Math.floor(Math.random() * 8),
  totalExcused: Math.floor(Math.random() * 3),
  averageGrade: 75 + Math.random() * 25,
  latestGrade: 75 + Math.random() * 25,
}));

const mockExistingStudents: Student[] = Array.from({ length: 20 }, (_, i) => ({
  id: `existing-${i + 1}`,
  studentId: `2024-${String(i + 100).padStart(4, "0")}`,
  lastName: ["Bautista", "Fernandez", "Lopez", "Ramos", "Torres"][i % 5],
  firstName: ["Carlos", "Sofia", "Miguel", "Isabella", "Luis"][i % 5],
  middleInitial: ["F", "G", "H", "I", "J"][i % 5],
}));

const MAX_PREVIEW_ROWS = 100;
const EXPECTED_HEADERS = [
  "Student ID",
  "Last Name",
  "First Name",
  "Middle Initial",
];

// Stats Card Component
const StatsCard = ({
  icon: Icon,
  title,
  value,
  subtitle,
  color = "bg-[#124A69]",
}: {
  icon: any;
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}) => (
  <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      <div className={`${color} p-3 rounded-lg`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </div>
);

// Add Student Sheet Component
const AddStudentSheet = ({
  onAddNew,
  onSelectExisting,
  existingStudents,
}: {
  onAddNew: (student: any) => void;
  onSelectExisting: (student: Student) => void;
  existingStudents: Student[];
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("existing");
  const [searchExisting, setSearchExisting] = useState("");
  const [newStudent, setNewStudent] = useState({
    studentId: "",
    lastName: "",
    firstName: "",
    middleInitial: "",
  });

  const filteredExisting = existingStudents.filter((s) =>
    `${s.lastName} ${s.firstName} ${s.studentId}`
      .toLowerCase()
      .includes(searchExisting.toLowerCase())
  );

  const handleAddNew = () => {
    if (
      !newStudent.studentId ||
      !newStudent.lastName ||
      !newStudent.firstName
    ) {
      toast.error("Please fill in all required fields");
      return;
    }
    onAddNew(newStudent);
    setNewStudent({
      studentId: "",
      lastName: "",
      firstName: "",
      middleInitial: "",
    });
    setIsOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button className="bg-[#124A69] hover:bg-[#0D3A54] text-white">
          <Users className="w-4 h-4 mr-2" />
          Add Student
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add Student to Course</SheetTitle>
          <SheetDescription>
            Add a new student or select from existing students
          </SheetDescription>
        </SheetHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Existing Students</TabsTrigger>
            <TabsTrigger value="new">New Student</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search students..."
                value={searchExisting}
                onChange={(e) => setSearchExisting(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="border rounded-lg max-h-[500px] overflow-y-auto">
              {filteredExisting.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium">
                      {student.lastName}, {student.firstName}{" "}
                      {student.middleInitial ? `${student.middleInitial}.` : ""}
                    </p>
                    <p className="text-sm text-gray-500">{student.studentId}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      onSelectExisting(student);
                      setIsOpen(false);
                    }}
                    className="bg-[#124A69] hover:bg-[#0D3A54]"
                  >
                    Add
                  </Button>
                </div>
              ))}
              {filteredExisting.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  No students found
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="new" className="space-y-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Student ID <span className="text-red-500">*</span>
                </label>
                <Input
                  value={newStudent.studentId}
                  onChange={(e) =>
                    setNewStudent({ ...newStudent, studentId: e.target.value })
                  }
                  placeholder="2024-0001"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={newStudent.lastName}
                  onChange={(e) =>
                    setNewStudent({ ...newStudent, lastName: e.target.value })
                  }
                  placeholder="Dela Cruz"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  First Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={newStudent.firstName}
                  onChange={(e) =>
                    setNewStudent({ ...newStudent, firstName: e.target.value })
                  }
                  placeholder="Juan"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Middle Initial
                </label>
                <Input
                  value={newStudent.middleInitial}
                  onChange={(e) =>
                    setNewStudent({
                      ...newStudent,
                      middleInitial: e.target.value,
                    })
                  }
                  placeholder="A"
                  maxLength={1}
                />
              </div>
              <Button
                onClick={handleAddNew}
                className="w-full bg-[#124A69] hover:bg-[#0D3A54]"
              >
                Add Student
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

// Main Component
export default function CourseDashboard() {
  const [tableData, setTableData] = useState<Student[]>(mockStudents);
  const [stats, setStats] = useState<CourseStats>(mockStats);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [attendanceFilter, setAttendanceFilter] = useState<string>("all");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isValidFile, setIsValidFile] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [showImportStatus, setShowImportStatus] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter data based on attendance and grade filters
  const filteredData = useMemo(() => {
    let filtered = [...tableData];

    if (attendanceFilter !== "all") {
      filtered = filtered.sort((a, b) => {
        if (attendanceFilter === "most-present") {
          return (b.totalPresent || 0) - (a.totalPresent || 0);
        } else if (attendanceFilter === "most-absent") {
          return (b.totalAbsent || 0) - (a.totalAbsent || 0);
        } else if (attendanceFilter === "most-late") {
          return (b.totalLate || 0) - (a.totalLate || 0);
        } else if (attendanceFilter === "most-excused") {
          return (b.totalExcused || 0) - (a.totalExcused || 0);
        }
        return 0;
      });
    }

    if (gradeFilter !== "all") {
      filtered = filtered.sort((a, b) => {
        if (gradeFilter === "highest") {
          return (b.averageGrade || 0) - (a.averageGrade || 0);
        } else if (gradeFilter === "lowest") {
          return (a.averageGrade || 0) - (b.averageGrade || 0);
        }
        return 0;
      });
    }

    return filtered;
  }, [tableData, attendanceFilter, gradeFilter]);

  const columns = useMemo<ColumnDef<Student>[]>(
    () => [
      {
        accessorKey: "studentId",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Student ID
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
      },
      {
        accessorKey: "lastName",
        header: "Name",
        cell: ({ row }) =>
          `${row.original.lastName}, ${row.original.firstName} ${
            row.original.middleInitial ? `${row.original.middleInitial}.` : ""
          }`,
      },
      {
        accessorKey: "attendanceRate",
        header: "Attendance Rate",
        cell: ({ row }) => {
          const rate = row.original.attendanceRate || 0;
          return (
            <Badge
              variant={
                rate >= 90
                  ? "default"
                  : rate >= 75
                  ? "secondary"
                  : "destructive"
              }
              className={rate >= 90 ? "bg-green-500 text-white" : ""}
            >
              {rate.toFixed(1)}%
            </Badge>
          );
        },
      },
      {
        accessorKey: "totalPresent",
        header: "Present",
        cell: ({ row }) => row.original.totalPresent || 0,
      },
      {
        accessorKey: "totalAbsent",
        header: "Absent",
        cell: ({ row }) => row.original.totalAbsent || 0,
      },
      {
        accessorKey: "totalLate",
        header: "Late",
        cell: ({ row }) => row.original.totalLate || 0,
      },
      {
        accessorKey: "totalExcused",
        header: "Excused",
        cell: ({ row }) => row.original.totalExcused || 0,
      },
      {
        accessorKey: "averageGrade",
        header: "Average Grade",
        cell: ({ row }) => {
          const grade = row.original.averageGrade || 0;
          return (
            <span
              className={
                grade >= 75
                  ? "text-green-600 font-medium"
                  : "text-red-600 font-medium"
              }
            >
              {grade.toFixed(1)}
            </span>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
  });

  const handleExport = () => {
    try {
      const header = [
        ["STUDENT DATA"],
        [""],
        ["Course:", `${mockCourseData.code} - ${mockCourseData.title}`],
        ["Section:", mockCourseData.section],
        ["Date:", new Date().toLocaleDateString()],
        [""],
        [
          "Student ID",
          "Last Name",
          "First Name",
          "Middle Initial",
          "Attendance Rate",
          "Present",
          "Absent",
          "Late",
          "Excused",
          "Average Grade",
        ],
      ];

      const rows = tableData.map((student) => [
        student.studentId,
        student.lastName,
        student.firstName,
        student.middleInitial || "",
        `${(student.attendanceRate || 0).toFixed(1)}%`,
        student.totalPresent || 0,
        student.totalAbsent || 0,
        student.totalLate || 0,
        student.totalExcused || 0,
        (student.averageGrade || 0).toFixed(1),
      ]);

      const ws = XLSX.utils.aoa_to_sheet([...header, ...rows]);
      ws["!cols"] = Array(10).fill({ wch: 15 });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Students");
      const filename = `${mockCourseData.code}_students_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.success("Student data exported successfully");
    } catch (error) {
      toast.error("Failed to export data");
    }
  };

  const handleImportTemplate = () => {
    try {
      const header = [
        ["STUDENT IMPORT TEMPLATE"],
        [""],
        ["Date:", new Date().toLocaleDateString()],
        [""],
        ["IMPORTANT NOTES:"],
        ["1. Student ID must be unique"],
        ["2. Last Name and First Name are required"],
        ["3. Middle Initial is optional (single letter)"],
        ["4. Do not include empty rows"],
        [""],
        EXPECTED_HEADERS,
      ];

      const exampleRow = ["2024-0001", "Dela Cruz", "Juan", "A"];

      const ws = XLSX.utils.aoa_to_sheet([...header, exampleRow]);
      ws["!cols"] = [{ wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      const filename = `student_import_template_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.success("Template downloaded successfully");
    } catch (error) {
      toast.error("Failed to generate template");
    }
  };

  const readFile = useCallback((file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          const headerIndex = jsonData.findIndex((row: any) =>
            EXPECTED_HEADERS.every(
              (h, i) => row[i]?.toString().toLowerCase() === h.toLowerCase()
            )
          );

          if (headerIndex === -1) {
            reject(new Error("Invalid template format"));
            return;
          }

          const dataRows = jsonData
            .slice(headerIndex + 1)
            .filter((row: any) => row.some((cell: any) => cell));
          resolve(
            dataRows.map((row: any) => ({
              "Student ID": row[0],
              "Last Name": row[1],
              "First Name": row[2],
              "Middle Initial": row[3] || "",
            }))
          );
        } catch (error) {
          reject(new Error("Error parsing file"));
        }
      };
      reader.readAsBinaryString(file);
    });
  }, []);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const data = await readFile(file);
        setPreviewData(data.slice(0, MAX_PREVIEW_ROWS));
        setSelectedFile(file);
        setIsValidFile(true);
        toast.success("File loaded successfully");
      } catch (error) {
        toast.error("Failed to read file");
        setIsValidFile(false);
      }
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !isValidFile) {
      toast.error("Please select a valid file");
      return;
    }

    // Simulate import
    const imported = previewData.length;
    setImportStatus({
      imported,
      skipped: 0,
      errors: [],
      total: imported,
      detailedFeedback: previewData.map((row, i) => ({
        row: i + 1,
        studentId: row["Student ID"],
        status: "imported",
        message: "Successfully imported",
      })),
    });

    setShowImportStatus(true);
    setShowImportDialog(false);
    toast.success(`Successfully imported ${imported} students`);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {mockCourseData.code} - {mockCourseData.title}
          </h1>
          <p className="text-sm text-gray-600">
            Section {mockCourseData.section} • {mockCourseData.room} •{" "}
            {mockCourseData.semester} • {mockCourseData.academicYear}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <ArrowUpDown className="w-4 h-4" />
                Sort & Filter
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Sort by Attendance</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => setAttendanceFilter("most-present")}
              >
                Most Present
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setAttendanceFilter("most-absent")}
              >
                Most Absent
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setAttendanceFilter("most-late")}
              >
                Most Late
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setAttendanceFilter("most-excused")}
              >
                Most Excused
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Sort by Grade</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setGradeFilter("highest")}>
                Highest Grade
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGradeFilter("lowest")}>
                Lowest Grade
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setAttendanceFilter("all");
                  setGradeFilter("all");
                }}
              >
                Clear Filters
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" />
            Export to PDF
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          icon={Users}
          title="Total Students"
          value={stats.totalStudents}
          subtitle="Enrolled in course"
        />
        <StatsCard
          icon={UserCheck}
          title="Attendance Rate"
          value={`${stats.attendanceRate.toFixed(1)}%`}
          subtitle="Average attendance"
          color="bg-green-500"
        />
        <StatsCard
          icon={TrendingUp}
          title="Average Grade"
          value={stats.averageGrade.toFixed(1)}
          subtitle={`${stats.passingRate.toFixed(1)}% passing rate`}
          color="bg-blue-500"
        />
        <StatsCard
          icon={UserX}
          title="Total Absences"
          value={stats.totalAbsents}
          subtitle={`${stats.totalLate} late, ${stats.totalExcused} excused`}
          color="bg-red-500"
        />
      </div>

      {/* Student Table */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-[300px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search students..."
              value={
                (table.getColumn("lastName")?.getFilterValue() as string) ?? ""
              }
              onChange={(event) =>
                table.getColumn("lastName")?.setFilterValue(event.target.value)
              }
              className="pl-8"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowImportDialog(true)}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              Import Students
            </Button>
            <AddStudentSheet
              onAddNew={(student) => {
                toast.success("Student added successfully");
                // Add logic here
              }}
              onSelectExisting={(student) => {
                toast.success("Student added successfully");
                // Add logic here
              }}
              existingStudents={mockExistingStudents}
            />
          </div>
        </div>

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
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => table.previousPage()}
                  className={
                    !table.getCanPreviousPage()
                      ? "pointer-events-none opacity-50"
                      : ""
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
                        ? "bg-[#124A69] text-white hover:bg-[#0d3a56]"
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
                      : ""
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent
          className={`p-6 ${previewData.length > 0 ? "w-[75vw]" : "w-[30vw]"}`}
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#124A69]">
              Import Students
            </DialogTitle>
            <DialogDescription>
              Upload a file following the template format to batch import
              students
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-6">
            <div className="flex items-center gap-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Choose File
              </Button>
              {selectedFile && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {selectedFile.name}
                  </span>
                  <Badge
                    variant={isValidFile ? "default" : "destructive"}
                    className={isValidFile ? "bg-[#124A69] text-white" : ""}
                  >
                    {isValidFile ? "Valid" : "Invalid"}
                  </Badge>
                </div>
              )}
            </div>

            {previewData.length > 0 ? (
              <div className="border rounded-lg">
                <div className="bg-gray-50 p-4 border-b">
                  <h3 className="font-medium text-gray-700">
                    Preview Import Data
                  </h3>
                  <p className="text-sm text-gray-500">
                    Showing {previewData.length}{" "}
                    {previewData.length === 1 ? "row" : "rows"}
                  </p>
                </div>
                <div className="max-h-[350px] overflow-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        {EXPECTED_HEADERS.map((header) => (
                          <th
                            key={header}
                            className="px-4 py-2 text-left text-sm font-medium text-gray-500"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, index) => (
                        <tr key={index} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm">
                            {row["Student ID"]}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {row["Last Name"]}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {row["First Name"]}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {row["Middle Initial"]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center p-6 border rounded-lg bg-gray-50">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-500">
                  No preview available. Select a file to import.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowImportDialog(false);
                  setSelectedFile(null);
                  setPreviewData([]);
                  setIsValidFile(false);
                }}
              >
                Cancel
              </Button>
              <Button variant="outline" onClick={handleImportTemplate}>
                Download Template
              </Button>
              <Button
                className="bg-[#124A69] hover:bg-[#0D3A54] text-white"
                onClick={handleImport}
                disabled={!selectedFile || !isValidFile}
              >
                Import Students
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Status Dialog */}
      <Dialog open={showImportStatus} onOpenChange={setShowImportStatus}>
        <DialogContent className="w-[40vw] p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#124A69]">
              Import Status
            </DialogTitle>
            <DialogDescription>Summary of the import process</DialogDescription>
          </DialogHeader>

          {importStatus && (
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h3 className="text-sm font-medium text-green-800">
                    Imported
                  </h3>
                  <p className="text-2xl font-semibold text-green-600">
                    {importStatus.imported}
                  </p>
                </div>
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                  <h3 className="text-sm font-medium text-amber-800">
                    Skipped
                  </h3>
                  <p className="text-2xl font-semibold text-amber-600">
                    {importStatus.skipped}
                  </p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <h3 className="text-sm font-medium text-red-800">Errors</h3>
                  <p className="text-2xl font-semibold text-red-600">
                    {importStatus.errors.length}
                  </p>
                </div>
              </div>

              {importStatus.detailedFeedback.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 p-4 border-b">
                    <h3 className="font-medium text-gray-700">
                      Detailed Feedback
                    </h3>
                  </div>
                  <div className="max-h-[300px] overflow-auto">
                    <table className="w-full border-collapse">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">
                            Row
                          </th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">
                            Student ID
                          </th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">
                            Status
                          </th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">
                            Message
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {importStatus.detailedFeedback.map(
                          (feedback, index) => (
                            <tr
                              key={index}
                              className="border-t hover:bg-gray-50"
                            >
                              <td className="px-4 py-2 text-sm">
                                {feedback.row}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                {feedback.studentId}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                <Badge
                                  variant={
                                    feedback.status === "imported"
                                      ? "default"
                                      : feedback.status === "skipped"
                                      ? "secondary"
                                      : "destructive"
                                  }
                                  className={
                                    feedback.status === "imported"
                                      ? "bg-green-500 text-white"
                                      : ""
                                  }
                                >
                                  {feedback.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-2 text-sm">
                                {feedback.message}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={() => setShowImportStatus(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
