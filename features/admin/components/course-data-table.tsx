"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Download,
  Upload,
  GraduationCap,
  Users,
  CircleUserRound,
  BookOpen,
  Calendar,
} from "lucide-react";
import { CourseSheet } from "./course-sheet";
import { CourseStatus } from "@prisma/client";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import axiosInstance from "@/lib/axios";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/svdialog";
import { useRouter } from "next/navigation";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

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
  "Faculty Email": string;
  [key: string]: string;
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

const ITEMS_PER_PAGE = 8;
const MAX_PREVIEW_ROWS = 100;
const EXPECTED_HEADERS = [
  "Course Code",
  "Course Title",
  "Room",
  "Semester",
  "Academic Year",
  "Class Number",
  "Section",
  "Status",
  "Faculty Email",
];

const formatEnumValue = (value: string) =>
  value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

// Loading Spinner Component
function LoadingSpinner() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm min-h-[840px] max-h-[840px] mt-5">
      <div className="flex flex-col items-center gap-4 mt-40">
        <h2 className="text-3xl font-bold text-[#124A69] animate-pulse">
          Welcome to Didasko!
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

// Course Card Component
const CourseCard = ({ course }: { course: Course }) => {
  const router = useRouter();

  const formatTo12Hour = (time: string) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":").map(Number);
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

  const passingRate = 95;
  const attendanceRate = 85;

  return (
    <div
      onClick={() => router.push(`/main/course/${course.slug}`)}
      className="group relative w-auto h-[270px] bg-white rounded-lg border-2 border-[#124A69]/30 p-3 hover:border-[#124A69] hover:shadow-lg transition-all duration-200 cursor-pointer text-[#124A69]"
    >
      <div className="absolute top-4 right-4">
        <Badge className={`${getStatusColor(course.status)} border`}>
          {formatEnumValue(course.status)}
        </Badge>
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-bold group-hover:text-[#0C3246] transition-colors">
          {course.code} - {course.section}
        </h3>
        <p className="text-xs opacity-80 mt-1">{course.title}</p>
      </div>

      <div className="flex items-center mb-4 opacity-80">
        <Calendar className="w-5 h-5" />
        <span className="text-xs font-medium ml-2 truncate">
          {course.room} |{" "}
          {course.schedules?.length > 0
            ? course.schedules
                .map(
                  (s) =>
                    `${s.day.slice(0, 3)} ${formatTo12Hour(
                      s.fromTime
                    )}–${formatTo12Hour(s.toTime)}`
                )
                .join(", ")
            : "No schedule"}
        </span>
      </div>

      <div className="flex justify-between items-center mb-4 opacity-80 text-gray-700">
        <div className="flex items-center min-w-0">
          <CircleUserRound className="w-5 h-5 flex-shrink-0" />
          <span
            className="text-xs font-medium ml-2 truncate max-w-[150px]"
            title={course.faculty?.name || "No Instructor"}
          >
            {course.faculty?.name || "No Instructor"}
          </span>
        </div>

        <div className="flex items-center flex-shrink-0">
          <Users className="w-5 h-5" />
          <span className="text-xs font-medium ml-2">
            {course._count?.students || 0} Students
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-7">
        <div className="rounded-lg p-3 bg-[#124A69] text-white border border-[#124A69] shadow-sm">
          <div className="flex items-center gap-2 mb-1 text-xs">
            <span>Passing Rate</span>
          </div>
          <p className="text-xl font-bold">{passingRate}%</p>
        </div>
        <div className="rounded-lg p-3 bg-[#124A69] text-white border border-[#124A69] shadow-sm">
          <div className="flex items-center gap-2 mb-1 text-xs">
            <GraduationCap className="w-3 h-3" />
            <span>Attendance</span>
          </div>
          <p className="text-xl font-bold">{attendanceRate}%</p>
        </div>
      </div>

      <div className="absolute inset-0 rounded-lg border-2 border-[#124A69] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  );
};

export function CourseDataTable({
  courses: initialCourses,
  onCourseAdded,
}: CourseDataTableProps) {
  const [tableData, setTableData] = useState<Course[]>(initialCourses);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CourseStatus | "ALL">("ALL");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [showImportStatus, setShowImportStatus] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [previewData, setPreviewData] = useState<CsvRow[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isValidFile, setIsValidFile] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    status: string;
    error?: string;
    hasError?: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Batch load all required data on mount
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setIsInitialLoading(true);

        const [facultyResponse] = await Promise.all([
          axiosInstance.get("/users?role=FACULTY"),
        ]);

        console.log("Faculty data loaded:", facultyResponse.data);

        if (Array.isArray(facultyResponse.data)) {
          setFaculties(facultyResponse.data);
        } else {
          console.error("Unexpected faculty response:", facultyResponse.data);
        }

        // Set initial courses
        if (initialCourses.length > 0) {
          setTableData(initialCourses);
        }

        // Small delay for better UX
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        console.error("Error loading initial data:", error);
        toast.error("Failed to load some data");
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadAllData();
  }, [initialCourses]);

  const refreshTableData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const response = await axiosInstance.get("/courses");
      const data = await response.data;
      if (data.courses) {
        setTableData(data.courses);
      }
    } catch (error) {
      console.error("Error refreshing table data:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Filter courses
  const filteredCourses = tableData.filter((course) => {
    const matchesSearch =
      course.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.section.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || course.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredCourses.length / ITEMS_PER_PAGE);

  const paginatedCourses = filteredCourses.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleExport = useCallback(() => {
    try {
      const header = [
        ["COURSE MANAGEMENT DATA"],
        [""],
        ["Date:", new Date().toLocaleDateString()],
        [""],
        EXPECTED_HEADERS,
      ];

      const courseRows = tableData.map((course: Course) => {
        return [
          course.code,
          course.title,
          course.room,
          course.semester,
          course.academicYear,
          course.classNumber.toString(),
          course.section,
          formatEnumValue(course.status),
          course.faculty?.email || "N/A",
        ];
      });

      const ws = XLSX.utils.aoa_to_sheet([...header, ...courseRows]);
      ws["!cols"] = [
        { wch: 15 },
        { wch: 30 },
        { wch: 10 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 30 },
      ];
      ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Courses");
      const filename = `course_data_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.success("Course data exported successfully");
      setShowExportPreview(false);
    } catch (error) {
      toast.error("Failed to export data");
    }
  }, [tableData]);

  const handleImportTemplate = useCallback(() => {
    try {
      const header = [
        ["COURSE MANAGEMENT TEMPLATE"],
        [""],
        ["Date:", new Date().toLocaleDateString()],
        [""],
        ["IMPORTANT NOTES:"],
        ["1. Course Code must be unique"],
        ["2. Faculty Email must match existing faculty users"],
        ["3. Status must be: Active, Inactive, or Archived"],
        ["4. Do not include empty rows"],
        ["5. All fields are required"],
        [""],
        EXPECTED_HEADERS,
      ];

      const exampleRow = [
        "CS101",
        "Introduction to Programming",
        "A101",
        "1st Semester",
        "2024-2025",
        "1",
        "A",
        "Active",
        "faculty@alabang.sti.edu.ph",
      ];

      const ws = XLSX.utils.aoa_to_sheet([...header, exampleRow]);
      ws["!cols"] = [
        { wch: 15 },
        { wch: 30 },
        { wch: 10 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 30 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      const filename = `course_import_template_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.success("Template downloaded successfully");
    } catch (error) {
      toast.error("Failed to generate template");
    }
  }, []);

  const readFile = useCallback((file: File): Promise<CsvRow[]> => {
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
            resolve([]);
            return;
          }

          const headers = rawData[headerRowIndex].map(
            (h) => h?.toString().trim() || ""
          );
          const dataRowsRaw = rawData
            .slice(headerRowIndex + 1)
            .filter(
              (row) =>
                Array.isArray(row) &&
                row.some(
                  (cell) =>
                    cell !== null &&
                    cell !== undefined &&
                    cell.toString().trim() !== ""
                )
            );

          const formattedData: CsvRow[] = dataRowsRaw.map((row) => {
            const rowData: Record<string, string> = {};
            headers.forEach((header, index) => {
              rowData[header] =
                row[index] !== null && row[index] !== undefined
                  ? String(row[index]).trim()
                  : "";
            });
            return rowData as CsvRow;
          });

          const requiredFields = EXPECTED_HEADERS;

          const validFormattedData = formattedData.filter(
            (row): row is CsvRow =>
              requiredFields.every(
                (field) => row[field] && row[field].toString().trim() !== ""
              )
          );

          if (validFormattedData.length === 0) {
            reject(
              new Error(
                "No valid data rows found in file. Please check that there are rows with all required information below the header."
              )
            );
            return;
          }

          resolve(validFormattedData);
        } catch (error) {
          reject(
            new Error(
              "Error parsing file. Please make sure you are using a valid file and template format."
            )
          );
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
          toast.error(
            "Could not find header row. Please make sure the file is using the template format."
          );
        }
      } catch (error) {
        setIsValidFile(false);
        setPreviewData([]);
        toast.error(
          error instanceof Error && error.message.includes("parsing file")
            ? error.message
            : "Error reading file. Please ensure it is a valid Excel or CSV file."
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
      setShowImportStatus(true);
      setImportProgress({
        current: 0,
        total: previewData.length,
        status: "Importing courses...",
      });

      const response = await axiosInstance.post("/courses/import", previewData);
      const {
        imported,
        skipped,
        errors,
        total: backendTotalProcessed,
        detailedFeedback,
      } = response.data;

      setImportStatus({
        imported: imported || 0,
        skipped: skipped || 0,
        errors: errors || [],
        total: backendTotalProcessed || previewData.length,
        detailedFeedback: detailedFeedback || [],
      });

      if (errors && errors.length > 0) {
        toast.error(`Import finished with ${errors.length} errors.`);
      } else if (skipped && skipped > 0) {
        toast(`Import finished. ${skipped} courses skipped.`, { icon: "⚠️" });
      } else if (imported && imported > 0) {
        toast.success(`Successfully imported ${imported} courses.`);
      } else {
        toast("Import process finished with no courses imported.", {
          icon: "ℹ️",
        });
      }

      setImportProgress(null);
      setTimeout(async () => {
        await refreshTableData();
        if (onCourseAdded) onCourseAdded();
      }, 500);
    } catch (error: any) {
      const errorResponse = error?.response?.data;
      const errorMessage =
        errorResponse?.error ||
        (error instanceof Error ? error.message : "Failed to import courses");
      const importErrors = errorResponse?.errors || [
        { code: "N/A", message: errorMessage },
      ];

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
        errors: importErrors,
        total: errorResponse?.total || previewData.length,
        detailedFeedback: errorResponse?.detailedFeedback || [],
      });
    }
  }, [selectedFile, isValidFile, previewData, refreshTableData, onCourseAdded]);

  // Show loading spinner while initial data is loading
  if (isInitialLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm min-h-[840px] max-h-[840px] mt-5">
      <h1 className="text-2xl sm:text-3xl font-bold text-[#124A69]">
        Course Management Dashboard
      </h1>

      <div className="space-y-6 ">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-[400px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search courses by code, title, or section..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setShowImportPreview(true)}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button variant="outline" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <CourseSheet
              mode="add"
              onSuccess={refreshTableData}
              faculties={faculties}
            />
          </div>
        </div>

        <div className="flex gap-2 border-b">
          <button
            onClick={() => setStatusFilter("ALL")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === "ALL"
                ? "text-[#124A69] border-b-2 border-[#124A69]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            All Courses ({tableData.length})
          </button>

          <button
            onClick={() => setStatusFilter("ACTIVE")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === "ACTIVE"
                ? "text-[#124A69] border-b-2 border-[#124A69]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Active ({tableData.filter((c) => c.status === "ACTIVE").length})
          </button>

          <button
            onClick={() => setStatusFilter("INACTIVE")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === "INACTIVE"
                ? "text-[#124A69] border-b-2 border-[#124A69]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Inactive ({tableData.filter((c) => c.status === "INACTIVE").length})
          </button>

          <button
            onClick={() => setStatusFilter("ARCHIVED")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === "ARCHIVED"
                ? "text-[#124A69] border-b-2 border-[#124A69]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Archived ({tableData.filter((c) => c.status === "ARCHIVED").length})
          </button>
        </div>

        {isRefreshing ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#124A69]" />
          </div>
        ) : filteredCourses.length > 0 ? (
          <div className="space-y-8 ">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6 min-h-[570px] ">
              {paginatedCourses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between w-full mt-6">
                <span className="text-sm text-gray-600 w-[1100%]">
                  {Math.min(
                    (currentPage - 1) * ITEMS_PER_PAGE + 1,
                    filteredCourses.length
                  )}
                  –
                  {Math.min(
                    currentPage * ITEMS_PER_PAGE,
                    filteredCourses.length
                  )}{" "}
                  of {filteredCourses.length} courses
                </span>

                <Pagination>
                  <PaginationContent className="flex gap-1">
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() =>
                          currentPage > 1 && handlePageChange(currentPage - 1)
                        }
                        className={
                          currentPage === 1
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>

                    {Array.from({ length: totalPages })
                      .map((_, i) => i + 1)
                      .filter((page) => {
                        return (
                          page === 1 ||
                          page === totalPages ||
                          Math.abs(page - currentPage) <= 1
                        );
                      })
                      .reduce((acc: (number | string)[], page, index, arr) => {
                        if (index > 0) {
                          const prevPage = arr[index - 1] as number;
                          if ((page as number) - prevPage > 1) acc.push("…");
                        }
                        acc.push(page);
                        return acc;
                      }, [])
                      .map((item, i) => (
                        <PaginationItem key={i}>
                          {item === "…" ? (
                            <span className="px-2 text-gray-500 select-none">
                              …
                            </span>
                          ) : (
                            <PaginationLink
                              onClick={() => handlePageChange(item as number)}
                              isActive={currentPage === item}
                              className={`hidden xs:inline-flex ${
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
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <BookOpen className="w-12 h-12 text-gray-400 mb-3" />
            <p className="text-gray-600 font-medium">No courses found</p>
            <p className="text-sm text-gray-500 mt-1">
              {searchQuery
                ? "Try adjusting your search"
                : "Get started by adding a new course"}
            </p>
          </div>
        )}

        <Dialog open={showExportPreview} onOpenChange={setShowExportPreview}>
          <DialogContent className="w-[90vw] max-w-[800px] p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-[#124A69]">
                Export to Excel
              </DialogTitle>
              <DialogDescription>
                Preview of data to be exported:
              </DialogDescription>
            </DialogHeader>
            <div className="mt-6 max-h-[400px] overflow-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-50">
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
                  {tableData.slice(0, MAX_PREVIEW_ROWS).map((course, index) => {
                    return (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {course.code}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {course.title}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {course.room}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {course.semester}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {course.academicYear}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {course.classNumber}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {course.section}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {formatEnumValue(course.status)}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {course.faculty?.email || "N/A"}
                        </td>
                      </tr>
                    );
                  })}
                  {tableData.length > MAX_PREVIEW_ROWS && (
                    <tr className="border-t">
                      <td
                        colSpan={9}
                        className="px-4 py-2 text-sm text-gray-500 text-center"
                      >
                        And {tableData.length - MAX_PREVIEW_ROWS} more
                        courses...
                      </td>
                    </tr>
                  )}
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
              >
                Export to Excel
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showImportPreview} onOpenChange={setShowImportPreview}>
          <DialogContent
            className={`p-4 sm:p-6 h-auto ${
              previewData.length > 0 ? "w-[75vw]" : "w-[25vw]"
            }`}
          >
            <DialogHeader className="w-full">
              <DialogTitle className="text-xl font-semibold text-[#124A69]">
                Import Courses
              </DialogTitle>
              <DialogDescription>
                Please upload a file following the template format below:
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
                  className="flex items-center gap-2 bg-white hover:bg-gray-50"
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
                  </div>
                )}
              </div>

              {previewData.length > 0 ? (
                <div className="border rounded-lg w-full">
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
                              {row["Course Code"]}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {row["Course Title"]}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {row["Room"]}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {row["Semester"]}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {row["Academic Year"]}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {row["Class Number"]}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {row["Section"]}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {row["Status"]}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {row["Faculty Email"]}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center p-6 border rounded-lg bg-gray-50">
                  <p className="text-gray-500">
                    No preview available. Please select a file to import.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowImportPreview(false);
                    setSelectedFile(null);
                    setPreviewData([]);
                    setIsValidFile(false);
                    setImportProgress(null);
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
                  Import Courses
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
                    <div className="border rounded-lg overflow-hidden max-w-[2100px]">
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
                                Course Code
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
                                    {feedback.code}
                                  </td>
                                  <td className="px-4 py-2 text-sm font-medium">
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
                                    {feedback.message || "-"}
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
                        setShowImportPreview(false);
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
                        setShowImportPreview(true);
                      }}
                    >
                      Import More Courses
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
