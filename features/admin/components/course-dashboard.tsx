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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import toast from "react-hot-toast";
import {
  Search,
  Download,
  Upload,
  ArrowLeft,
  Users,
  UserCheck,
  TrendingUp,
  UserX,
  ArrowUpDown,
  Loader2,
  FileSpreadsheet,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/svdialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import * as XLSX from "xlsx";
import axiosInstance from "@/lib/axios";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";

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

interface CourseInfo {
  id: string;
  code: string;
  title: string;
  section: string;
  room: string;
  semester: string;
  academicYear: string;
  slug: string;
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

interface CourseDashboardProps {
  courseSlug: string;
  backUrl?: string;
}

const MAX_PREVIEW_ROWS = 100;
const EXPECTED_HEADERS = [
  "Student ID",
  "Last Name",
  "First Name",
  "Middle Initial",
];

const getInitials = (firstName: string, lastName: string) => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

// Loading Spinner Component
function LoadingSpinner() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm min-h-[840px] max-h-[840px]">
      <div className="flex flex-col items-center gap-4 mt-40">
        <h2 className="text-3xl font-bold text-[#124A69] animate-pulse">
          Loading Course Data...
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
  <Card className="border-2 border-[#124A69]/30 hover:border-[#124A69] hover:shadow-lg transition-all duration-200">
    <CardContent className="p-6">
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
    </CardContent>
  </Card>
);

const AddStudentSheet = ({
  onAddNew,
  onSelectExisting,
  courseSlug,
}: {
  onAddNew: (student: any) => void;
  onSelectExisting: (student: Student) => void;
  courseSlug: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("existing");
  const [searchExisting, setSearchExisting] = useState("");
  const [existingStudents, setExistingStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newStudent, setNewStudent] = useState({
    studentId: "",
    lastName: "",
    firstName: "",
    middleInitial: "",
  });

  useEffect(() => {
    if (isOpen && activeTab === "existing") {
      fetchExistingStudents();
    }
  }, [isOpen, activeTab]);

  const fetchExistingStudents = async () => {
    try {
      setIsLoading(true);
      const response = await axiosInstance.get("/students");
      setExistingStudents(response.data.students || []);
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("Failed to load students");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredExisting = existingStudents.filter((s) =>
    `${s.lastName} ${s.firstName} ${s.studentId}`
      .toLowerCase()
      .includes(searchExisting.toLowerCase())
  );

  const handleAddNew = async () => {
    if (
      !newStudent.studentId ||
      !newStudent.lastName ||
      !newStudent.firstName
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      await onAddNew(newStudent);
      setNewStudent({
        studentId: "",
        lastName: "",
        firstName: "",
        middleInitial: "",
      });
      setIsOpen(false);
    } catch (error) {
      console.error("Error adding student:", error);
    }
  };

  const handleSelectExisting = async (student: Student) => {
    try {
      await onSelectExisting(student);
      setIsOpen(false);
    } catch (error) {
      console.error("Error adding existing student:", error);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button className="bg-[#124A69] hover:bg-[#0D3A54] text-white gap-2">
          <Users className="w-4 h-4" />
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
              {isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#124A69]" />
                </div>
              ) : filteredExisting.length > 0 ? (
                filteredExisting.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium">
                        {student.lastName}, {student.firstName}{" "}
                        {student.middleInitial
                          ? `${student.middleInitial}.`
                          : ""}
                      </p>
                      <p className="text-sm text-gray-500">
                        {student.studentId}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleSelectExisting(student)}
                      className="bg-[#124A69] hover:bg-[#0D3A54]"
                    >
                      Add
                    </Button>
                  </div>
                ))
              ) : (
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

export function CourseDashboard({
  courseSlug,
  backUrl = "/main/course",
}: CourseDashboardProps) {
  const router = useRouter();
  const [courseInfo, setCourseInfo] = useState<CourseInfo | null>(null);
  const [tableData, setTableData] = useState<Student[]>([]);
  const [stats, setStats] = useState<CourseStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isValidFile, setIsValidFile] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [showImportStatus, setShowImportStatus] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    status: string;
    error?: string;
    hasError?: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      // Small delay for better UX
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      console.error("Error fetching course data:", error);
      toast.error("Failed to load course data");
    } finally {
      setIsLoading(false);
    }
  };

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
        cell: ({ row }) => {
          const student = row.original;
          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={student.image} alt={student.firstName} />
                <AvatarFallback className="bg-[#124A69] text-white">
                  {getInitials(student.firstName, student.lastName)}
                </AvatarFallback>
              </Avatar>
              <span>
                {student.lastName}, {student.firstName}{" "}
                {student.middleInitial ? `${student.middleInitial}.` : ""}
              </span>
            </div>
          );
        },
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
              className={
                rate >= 90 ? "bg-green-500 text-white hover:bg-green-600" : ""
              }
            >
              {rate.toFixed(1)}%
            </Badge>
          );
        },
      },
      {
        accessorKey: "totalPresent",
        header: "Present",
        cell: ({ row }) => (
          <span className="text-green-600 font-medium">
            {row.original.totalPresent || 0}
          </span>
        ),
      },
      {
        accessorKey: "totalAbsent",
        header: "Absent",
        cell: ({ row }) => (
          <span className="text-red-600 font-medium">
            {row.original.totalAbsent || 0}
          </span>
        ),
      },
      {
        accessorKey: "totalLate",
        header: "Late",
        cell: ({ row }) => (
          <span className="text-orange-600 font-medium">
            {row.original.totalLate || 0}
          </span>
        ),
      },
      {
        accessorKey: "totalExcused",
        header: "Excused",
        cell: ({ row }) => (
          <span className="text-blue-600 font-medium">
            {row.original.totalExcused || 0}
          </span>
        ),
      },
      {
        accessorKey: "averageGrade",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Average Grade
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const grade = row.original.averageGrade || 0;
          return (
            <span
              className={`font-semibold ${
                grade >= 75 ? "text-green-600" : "text-red-600"
              }`}
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
    data: tableData,
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

  const handleAddNewStudent = async (student: any) => {
    try {
      await axiosInstance.post("/students", { ...student, courseSlug });
      toast.success("Student added successfully");
      await fetchCourseData();
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.error || "Failed to add student";
      toast.error(errorMessage);
      throw error;
    }
  };

  const handleSelectExistingStudent = async (student: Student) => {
    try {
      await axiosInstance.post(`/courses/${courseSlug}/students`, {
        studentId: student.id,
      });
      toast.success("Student added successfully");
      await fetchCourseData();
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.error || "Failed to add student";
      toast.error(errorMessage);
      throw error;
    }
  };

  const handleExport = () => {
    if (!courseInfo) return;
    try {
      const header = [
        ["STUDENT DATA"],
        [""],
        ["Course:", `${courseInfo.code} - ${courseInfo.title}`],
        ["Section:", courseInfo.section],
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
      const filename = `${courseInfo.code}_students_${
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
          if (!data) {
            reject(new Error("No data found in file"));
            return;
          }

          let rawData: string[][];

          if (file.name.toLowerCase().endsWith(".csv")) {
            const csvData = data.toString();
            rawData = csvData
              .split("\n")
              .map((line) =>
                line
                  .split(",")
                  .map((cell) => cell.trim().replace(/^["\']|["\']$/g, ""))
              );
          } else {
            const workbook = XLSX.read(data, { type: "binary" });
            if (!workbook.SheetNames.length) {
              reject(new Error("No sheets found in the file"));
              return;
            }
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const csvString = XLSX.utils.sheet_to_csv(worksheet, {
              blankrows: false,
              forceQuotes: true,
            });
            rawData = csvString
              .split("\n")
              .map((line) =>
                line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""))
              );
          }

          let headerRowIndex = -1;
          for (let i = 0; i < rawData.length; i++) {
            const row = rawData[i];
            if (!Array.isArray(row) || row.length < EXPECTED_HEADERS.length)
              continue;

            const isHeaderRow = EXPECTED_HEADERS.every((header, index) => {
              const cellValue =
                typeof row[index] === "string" || typeof row[index] === "number"
                  ? String(row[index]).trim().toLowerCase()
                  : "";
              return cellValue === header.toLowerCase();
            });

            if (isHeaderRow) {
              headerRowIndex = i;
              break;
            }
          }

          if (headerRowIndex === -1) {
            reject(new Error("Invalid template format"));
            return;
          }

          const dataRows = rawData
            .slice(headerRowIndex + 1)
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

      reader.onerror = () => reject(new Error("Error reading file"));

      if (file.name.toLowerCase().endsWith(".csv")) {
        reader.readAsText(file);
      } else {
        reader.readAsBinaryString(file);
      }
    });
  }, []);

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

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!validateFile(file)) {
        setSelectedFile(null);
        setPreviewData([]);
        setIsValidFile(false);
        return;
      }

      try {
        setSelectedFile(file);
        const data = await readFile(file);
        if (data.length > 0) {
          setPreviewData(data.slice(0, MAX_PREVIEW_ROWS));
          setIsValidFile(true);
          toast.success("File loaded successfully");
        } else {
          setIsValidFile(false);
          setPreviewData([]);
          toast.error(
            "Could not find header row. Please make sure the file is using the template format."
          );
        }
      } catch (error) {
        toast.error("Failed to read file");
        setIsValidFile(false);
        setSelectedFile(null);
        setPreviewData([]);
      }
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !isValidFile || previewData.length === 0) {
      toast.error("Please select a valid file");
      return;
    }

    try {
      setShowImportStatus(true);
      setImportProgress({
        current: 0,
        total: previewData.length,
        status: "Importing students...",
      });

      const response = await axiosInstance.post(
        `/courses/${courseSlug}/students/import`,
        previewData
      );

      const { imported, skipped, errors, total, detailedFeedback } =
        response.data;

      setImportStatus({
        imported: imported || 0,
        skipped: skipped || 0,
        errors: errors || [],
        total: total || previewData.length,
        detailedFeedback: detailedFeedback || [],
      });

      if (errors && errors.length > 0) {
        toast.error(`Import finished with ${errors.length} errors.`);
      } else if (skipped && skipped > 0) {
        toast(`Import finished. ${skipped} students skipped.`, { icon: "⚠️" });
      } else if (imported && imported > 0) {
        toast.success(`Successfully imported ${imported} students.`);
      }

      setImportProgress(null);
      setShowImportDialog(false);

      setTimeout(async () => {
        await fetchCourseData();
      }, 500);
    } catch (error: any) {
      const errorResponse = error?.response?.data;
      const errorMessage = errorResponse?.error || "Failed to import students";

      setImportProgress({
        current: 0,
        total: previewData.length,
        status: "Import failed",
        error: errorMessage,
        hasError: true,
      });

      toast.error(errorMessage);

      setImportStatus({
        imported: errorResponse?.imported || 0,
        skipped: errorResponse?.skipped || 0,
        errors: errorResponse?.errors || [
          { studentId: "N/A", message: errorMessage },
        ],
        total: errorResponse?.total || previewData.length,
        detailedFeedback: errorResponse?.detailedFeedback || [],
      });
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

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

        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-[400px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search students by name or ID..."
                value={
                  (table.getColumn("lastName")?.getFilterValue() as string) ??
                  ""
                }
                onChange={(event) =>
                  table
                    .getColumn("lastName")
                    ?.setFilterValue(event.target.value)
                }
                className="pl-9"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleExport}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowImportDialog(true)}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Import
              </Button>
              <AddStudentSheet
                onAddNew={handleAddNewStudent}
                onSelectExisting={handleSelectExistingStudent}
                courseSlug={courseSlug}
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
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>

        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent
            className={`p-4 sm:p-6 ${
              previewData.length > 0 ? "w-[75vw]" : "w-[25vw]"
            }`}
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
                  className="gap-2 bg-white hover:bg-gray-50"
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
                      className={
                        isValidFile
                          ? "bg-[#124A69] text-white hover:bg-[#0D3A54]"
                          : ""
                      }
                    >
                      {isValidFile ? "Valid" : "Invalid"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewData([]);
                        setIsValidFile(false);
                        if (fileInputRef.current)
                          fileInputRef.current.value = "";
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
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
                      {previewData.length === 1 ? "row" : "rows"} from import
                      file
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
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {row["Student ID"]}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {row["Last Name"]}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {row["First Name"]}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
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
                  disabled={!!importProgress}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={handleImportTemplate}
                  className="bg-white hover:bg-gray-50"
                  disabled={!!importProgress}
                >
                  Download Template
                </Button>
                <Button
                  className="bg-[#124A69] hover:bg-[#0D3A54] text-white"
                  onClick={handleImport}
                  disabled={!selectedFile || !isValidFile || !!importProgress}
                >
                  Import Students
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showImportStatus} onOpenChange={setShowImportStatus}>
          <DialogContent className="w-[40vw] p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-[#124A69]">
                Import Status
              </DialogTitle>
              <DialogDescription>
                {importProgress
                  ? "Import in progress..."
                  : "Summary of the import process"}
              </DialogDescription>
            </DialogHeader>

            {importProgress ? (
              <div className="mt-6 space-y-6">
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border">
                  {importProgress.hasError ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-red-500"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                  ) : (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#124A69]" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">
                      {importProgress.status}
                    </p>
                    {importProgress.error && (
                      <p className="mt-2 text-sm text-red-600">
                        {importProgress.error}
                      </p>
                    )}
                    {importProgress.total > 0 && !importProgress.hasError && (
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-[#124A69] h-2.5 rounded-full transition-all duration-300"
                          style={{
                            width: `${
                              (importProgress.current / importProgress.total) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
                {importProgress.hasError && (
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowImportStatus(false);
                        setImportProgress(null);
                      }}
                    >
                      Close
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              importStatus && (
                <div className="mt-6 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <h3 className="text-sm font-medium text-green-800">
                        Successfully Imported
                      </h3>
                      <p className="text-2xl font-semibold text-green-600">
                        {
                          importStatus.detailedFeedback.filter(
                            (f) => f.status === "imported"
                          ).length
                        }
                      </p>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                      <h3 className="text-sm font-medium text-amber-800">
                        Skipped
                      </h3>
                      <p className="text-2xl font-semibold text-amber-600">
                        {
                          importStatus.detailedFeedback.filter(
                            (f) => f.status === "skipped"
                          ).length
                        }
                      </p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <h3 className="text-sm font-medium text-red-800">
                        Errors
                      </h3>
                      <p className="text-2xl font-semibold text-red-600">
                        {
                          importStatus.detailedFeedback.filter(
                            (f) => f.status === "error"
                          ).length
                        }
                      </p>
                    </div>
                  </div>

                  {importStatus.detailedFeedback?.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 p-4 border-b">
                        <h3 className="font-medium text-gray-700">
                          Detailed Import Feedback
                        </h3>
                        <p className="text-sm text-gray-500">
                          Status of each row processed during import.
                        </p>
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
                                  <td className="px-4 py-2 text-sm text-gray-900">
                                    {feedback.row}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-900">
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
                                      {feedback.status.charAt(0).toUpperCase() +
                                        feedback.status.slice(1)}
                                    </Badge>
                                  </td>
                                  <td
                                    className={`px-4 py-2 text-sm ${
                                      feedback.status === "error"
                                        ? "text-red-600"
                                        : "text-gray-900"
                                    }`}
                                  >
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
                      onClick={() => {
                        setShowImportStatus(false);
                        setShowImportDialog(false);
                        setSelectedFile(null);
                        setPreviewData([]);
                        setIsValidFile(false);
                        setImportProgress(null);
                      }}
                    >
                      Close
                    </Button>
                    <Button
                      className="bg-[#124A69] hover:bg-[#0D3A54] text-white"
                      onClick={() => {
                        setShowImportStatus(false);
                        setShowImportDialog(true);
                      }}
                    >
                      Import More Students
                    </Button>
                  </div>
                </div>
              )
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
