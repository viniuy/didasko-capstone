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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  AlertCircle,
  Trash2,
  AlertTriangle,
  Circle,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
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

// ==================== Types ====================
interface Student {
  id: string;
  lastName: string;
  firstName: string;
  middleInitial?: string;
  studentId: string;
  image?: string;
  rfid_id?: number;
  attendanceRecords?: AttendanceRecord[];
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
}

interface TermGrades {
  prelims?: TermGradeData;
  midterm?: TermGradeData;
  preFinals?: TermGradeData;
  finals?: TermGradeData;
}

interface TermGradeData {
  ptScores: Assessment[];
  quizScores: Assessment[];
  examScore?: Assessment;
  totalPercentage?: number;
  numericGrade?: number;
  remarks?: string;
}

interface Assessment {
  id: string;
  name: string;
  score?: number;
  maxScore: number;
  percentage?: number;
}

interface StudentWithGrades extends Student {
  termGrades: TermGrades;
}

interface StudentWithRecords extends Student {
  hasAttendance: boolean;
  hasGrades: boolean;
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

// ==================== Constants ====================
const MAX_PREVIEW_ROWS = 100;
const EXPECTED_HEADERS = [
  "Student ID",
  "Last Name",
  "First Name",
  "Middle Initial",
];
const TERMS = ["PRELIMS", "MIDTERM", "PRE-FINALS", "FINALS"] as const;

// ==================== Utility Functions ====================
const getInitials = (firstName: string, lastName: string) => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

const getAttendanceIcon = (status: string) => {
  switch (status) {
    case "PRESENT":
      return <CheckCircle2 className="w-3 h-3 text-green-600" />;
    case "LATE":
      return <Clock className="w-3 h-3 text-orange-600" />;
    case "ABSENT":
      return <XCircle className="w-3 h-3 text-red-600" />;
    case "EXCUSED":
      return <Circle className="w-3 h-3 text-blue-600" />;
    default:
      return <Circle className="w-3 h-3 text-gray-300" />;
  }
};

// ==================== Reusable UI Components ====================

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
          {[0, 150, 300].map((delay, i) => (
            <div
              key={i}
              className="w-3 h-3 bg-[#124A69] rounded-full animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
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
    <CardContent className="p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1 truncate">
            {title}
          </p>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs sm:text-sm text-gray-500 mt-1 truncate">
              {subtitle}
            </p>
          )}
        </div>
        <div className={`${color} p-2 sm:p-3 rounded-lg shrink-0`}>
          <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const StudentAvatar = ({ student }: { student: Student }) => (
  <div className="flex items-center gap-3">
    <Avatar className="h-8 w-8">
      <AvatarImage src={student.image} alt={student.firstName} />
      <AvatarFallback className="bg-[#124A69] text-white text-xs">
        {getInitials(student.firstName, student.lastName)}
      </AvatarFallback>
    </Avatar>
    <span className="text-sm">
      {student.lastName}, {student.firstName}{" "}
      {student.middleInitial ? `${student.middleInitial}.` : ""}
    </span>
  </div>
);

const AttendanceVisualizer = ({
  records,
}: {
  records?: AttendanceRecord[];
}) => {
  if (!records || records.length === 0) {
    return <span className="text-gray-400 text-xs">No records</span>;
  }

  return (
    <div className="flex items-center gap-1 flex-wrap max-w-[200px]">
      {records.slice(0, 20).map((record) => (
        <div key={record.id} className="relative group">
          {getAttendanceIcon(record.status)}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
            {new Date(record.date).toLocaleDateString()} - {record.status}
          </div>
        </div>
      ))}
      {records.length > 20 && (
        <span className="text-xs text-gray-500 ml-1">
          +{records.length - 20}
        </span>
      )}
    </div>
  );
};

const AttendanceLegend = () => (
  <div className="flex items-center gap-4 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg border">
    <span className="flex items-center gap-1">
      <CheckCircle2 className="w-3 h-3 text-green-600" /> Present
    </span>
    <span className="flex items-center gap-1">
      <Clock className="w-3 h-3 text-orange-600" /> Late
    </span>
    <span className="flex items-center gap-1">
      <XCircle className="w-3 h-3 text-red-600" /> Absent
    </span>
    <span className="flex items-center gap-1">
      <Circle className="w-3 h-3 text-blue-600" /> Excused
    </span>
  </div>
);

// ==================== Feature Components ====================

const AddStudentSheet = ({
  isOpen,
  onOpenChange,
  existingStudents,
  isLoading,
  enrolledStudentIds,
  onSelectStudent,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  existingStudents: Student[];
  isLoading: boolean;
  enrolledStudentIds: string[];
  onSelectStudent: (student: Student) => Promise<void>;
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredStudents = useMemo(
    () =>
      existingStudents.filter(
        (s) =>
          !enrolledStudentIds.includes(s.id) &&
          `${s.lastName} ${s.firstName} ${s.studentId}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
      ),
    [existingStudents, enrolledStudentIds, searchQuery]
  );

  const handleSelect = async (student: Student) => {
    setIsSubmitting(true);
    try {
      await onSelectStudent(student);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto p-4">
        <SheetHeader>
          <SheetTitle>Add Student to Course</SheetTitle>
          <SheetDescription>
            Select from existing students with RFID registration
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">RFID Required</p>
              <p>
                Only students with registered RFID cards can be added to
                courses.
              </p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="border rounded-lg max-h-[500px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#124A69]" />
              </div>
            ) : filteredStudents.length > 0 ? (
              filteredStudents.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={student.image}
                        alt={student.firstName}
                      />
                      <AvatarFallback className="bg-[#124A69] text-white text-sm">
                        {getInitials(student.firstName, student.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-gray-900">
                        {student.lastName}, {student.firstName}{" "}
                        {student.middleInitial
                          ? `${student.middleInitial}.`
                          : ""}
                      </p>
                      <p className="text-sm text-gray-500">
                        {student.studentId} • RFID: {student.rfid_id}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSelect(student)}
                    disabled={isSubmitting}
                    className="bg-[#124A69] hover:bg-[#0D3A54] text-white"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Add"
                    )}
                  </Button>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p className="font-medium">No students found</p>
                <p className="text-sm mt-1">
                  {searchQuery
                    ? "Try adjusting your search"
                    : "No students with RFID registration available"}
                </p>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const RemoveStudentSheet = ({
  isOpen,
  onOpenChange,
  students,
  isLoading,
  courseSlug,
  onRemoveSuccess,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  students: StudentWithRecords[];
  isLoading: boolean;
  courseSlug: string;
  onRemoveSuccess: () => void;
}) => {
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmationInput, setConfirmationInput] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const hasStudentsWithRecords = useMemo(
    () =>
      students.some(
        (s) =>
          selectedStudents.includes(s.id) && (s.hasAttendance || s.hasGrades)
      ),
    [students, selectedStudents]
  );

  const filteredStudents = useMemo(
    () =>
      students.filter((student) =>
        `${student.lastName} ${student.firstName} ${student.studentId}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      ),
    [students, searchQuery]
  );

  const confirmRemoval = async () => {
    if (hasStudentsWithRecords && confirmationInput !== "Remove") {
      toast.error('Please type "Remove" to confirm');
      return;
    }

    try {
      setIsRemoving(true);
      await axiosInstance.delete(`/courses/${courseSlug}/students`, {
        data: { studentIds: selectedStudents },
      });

      toast.success(
        `Successfully removed ${selectedStudents.length} student${
          selectedStudents.length > 1 ? "s" : ""
        }`
      );
      resetSheet();
      onRemoveSuccess();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to remove students");
    } finally {
      setIsRemoving(false);
    }
  };

  const resetSheet = () => {
    setSelectedStudents([]);
    setSearchQuery("");
    setConfirmationInput("");
    setShowConfirmation(false);
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={isOpen && !showConfirmation} onOpenChange={resetSheet}>
        <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto p-4">
          <SheetHeader>
            <SheetTitle className="text-red-600">
              Remove Students from Course
            </SheetTitle>
            <SheetDescription>
              Select students to remove from this course
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">
                <p className="font-medium mb-1">Warning</p>
                <p>
                  Removing students with attendance or grades will permanently
                  delete their records.
                </p>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>

            {selectedStudents.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm font-medium text-blue-800">
                  {selectedStudents.length} student
                  {selectedStudents.length > 1 ? "s" : ""} selected
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedStudents([])}
                  className="text-blue-600"
                >
                  Clear
                </Button>
              </div>
            )}

            {/* Student list with checkboxes */}
            <div className="border rounded-lg max-h-[400px] overflow-y-auto">
              {filteredStudents.map((student) => (
                <label
                  key={student.id}
                  className="flex items-center gap-3 p-4 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedStudents.includes(student.id)}
                    onChange={() =>
                      setSelectedStudents((prev) =>
                        prev.includes(student.id)
                          ? prev.filter((id) => id !== student.id)
                          : [...prev, student.id]
                      )
                    }
                    className="w-4 h-4 text-[#124A69] border-gray-300 rounded"
                  />
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={student.image} alt={student.firstName} />
                    <AvatarFallback className="bg-[#124A69] text-white text-sm">
                      {getInitials(student.firstName, student.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {student.lastName}, {student.firstName}
                    </p>
                    <p className="text-sm text-gray-500">{student.studentId}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={resetSheet}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  hasStudentsWithRecords
                    ? setShowConfirmation(true)
                    : confirmRemoval()
                }
                disabled={selectedStudents.length === 0}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Remove {selectedStudents.length} Student
                {selectedStudents.length !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Confirm Removal</DialogTitle>
            <DialogDescription>
              Type "Remove" to confirm deletion of all records
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmationInput}
            onChange={(e) => setConfirmationInput(e.target.value)}
            placeholder="Remove"
            className="border-red-300"
          />
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowConfirmation(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmRemoval}
              disabled={confirmationInput !== "Remove" || isRemoving}
              className="bg-red-600"
            >
              {isRemoving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Confirm"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const TermGradesTab = ({
  students,
  termKey,
}: {
  students: StudentWithGrades[];
  termKey: "prelims" | "midterm" | "preFinals" | "finals";
}) => {
  const termName =
    termKey === "preFinals" ? "PRE-FINALS" : termKey.toUpperCase();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 10;

  // Check if any student has data for this term
  const hasData = students.some((s) => s.termGrades[termKey]);

  if (!hasData) {
    return (
      <div className="text-center py-12 text-gray-500">
        <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p>No grades available for {termName}</p>
      </div>
    );
  }

  // Filter students based on search
  const filteredStudents = students.filter((student) =>
    `${student.lastName} ${student.firstName} ${student.studentId}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  // Paginate filtered students
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const paginatedStudents = filteredStudents.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  // Get all unique assessment names for table headers
  const sampleTerm = students.find((s) => s.termGrades[termKey])?.termGrades[
    termKey
  ];
  const ptColumns = sampleTerm?.ptScores?.map((pt) => pt.name) || [];
  const quizColumns = sampleTerm?.quizScores?.map((q) => q.name) || [];
  const hasExam = sampleTerm?.examScore !== undefined;

  const handleExport = () => {
    try {
      const ws_data = [
        [`${termName} Grades Export`],
        [""],
        ["Date:", new Date().toLocaleDateString()],
        [""],
        [
          "Student ID",
          "Last Name",
          "First Name",
          ...ptColumns,
          ...quizColumns,
          hasExam ? "Exam" : "",
          "Final %",
          "Grade",
          "Remarks",
        ].filter(Boolean),
        ...filteredStudents
          .map((student) => {
            const termData = student.termGrades[termKey];
            if (!termData) return [];

            return [
              student.studentId,
              student.lastName,
              student.firstName,
              ...ptColumns.map((pt) => {
                const score = termData.ptScores?.find((p) => p.name === pt);
                return score?.score !== undefined
                  ? `${score.score}/${score.maxScore}`
                  : "—";
              }),
              ...quizColumns.map((q) => {
                const score = termData.quizScores?.find(
                  (quiz) => quiz.name === q
                );
                return score?.score !== undefined
                  ? `${score.score}/${score.maxScore}`
                  : "—";
              }),
              ...(hasExam
                ? [
                    termData.examScore?.score !== undefined
                      ? `${termData.examScore.score}/${termData.examScore.maxScore}`
                      : "—",
                  ]
                : []),
              termData.totalPercentage?.toFixed(2) || "—",
              termData.numericGrade?.toFixed(2) || "—",
              termData.remarks || "—",
            ];
          })
          .filter((row) => row.length > 0),
      ];

      const ws = XLSX.utils.aoa_to_sheet(ws_data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, termName);
      XLSX.writeFile(
        wb,
        `${termName}_grades_${new Date().toISOString().split("T")[0]}.xlsx`
      );
      toast.success("Exported successfully");
    } catch (error) {
      toast.error("Export failed");
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-[400px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(0); // Reset to first page on search
            }}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" />
            Export {termName}
          </Button>
        </div>
      </div>

      {/* Grades Table */}
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px] sticky left-0 bg-white z-10 border-r">
                  Student
                </TableHead>
                {ptColumns.map((pt, idx) => (
                  <TableHead
                    key={`pt-${idx}`}
                    className="text-center min-w-[100px]"
                  >
                    {pt}
                  </TableHead>
                ))}
                {quizColumns.map((quiz, idx) => (
                  <TableHead
                    key={`quiz-${idx}`}
                    className="text-center min-w-[100px]"
                  >
                    {quiz}
                  </TableHead>
                ))}
                {hasExam && (
                  <TableHead className="text-center min-w-[100px]">
                    Exam
                  </TableHead>
                )}
                <TableHead className="text-center min-w-[100px]">
                  Final %
                </TableHead>
                <TableHead className="text-center min-w-[100px]">
                  Grade
                </TableHead>
                <TableHead className="text-center min-w-[100px]">
                  Remarks
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedStudents.length > 0 ? (
                paginatedStudents.map((student) => {
                  const termData = student.termGrades[termKey];
                  if (!termData) return null;

                  return (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium sticky left-0 bg-white z-10 border-r">
                        <StudentAvatar student={student} />
                      </TableCell>

                      {/* PT Scores */}
                      {ptColumns.map((ptName, idx) => {
                        const pt = termData.ptScores?.find(
                          (p) => p.name === ptName
                        );
                        return (
                          <TableCell key={`pt-${idx}`} className="text-center">
                            {pt?.score !== undefined ? (
                              <div className="flex flex-col items-center">
                                <span className="font-semibold">
                                  {pt.score}
                                </span>
                                <span className="text-xs text-gray-500">
                                  / {pt.maxScore}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                        );
                      })}

                      {/* Quiz Scores */}
                      {quizColumns.map((quizName, idx) => {
                        const quiz = termData.quizScores?.find(
                          (q) => q.name === quizName
                        );
                        return (
                          <TableCell
                            key={`quiz-${idx}`}
                            className="text-center"
                          >
                            {quiz?.score !== undefined ? (
                              <div className="flex flex-col items-center">
                                <span className="font-semibold">
                                  {quiz.score}
                                </span>
                                <span className="text-xs text-gray-500">
                                  / {quiz.maxScore}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                        );
                      })}

                      {/* Exam Score */}
                      {hasExam && (
                        <TableCell className="text-center">
                          {termData.examScore?.score !== undefined ? (
                            <div className="flex flex-col items-center">
                              <span className="font-semibold">
                                {termData.examScore.score}
                              </span>
                              <span className="text-xs text-gray-500">
                                / {termData.examScore.maxScore}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                      )}

                      {/* Final Percentage */}
                      <TableCell className="text-center">
                        <span className="font-bold text-[#124A69]">
                          {termData.totalPercentage?.toFixed(2) || "—"}%
                        </span>
                      </TableCell>

                      {/* Numeric Grade */}
                      <TableCell className="text-center">
                        <span className="font-bold text-[#124A69]">
                          {termData.numericGrade?.toFixed(2) || "—"}
                        </span>
                      </TableCell>

                      {/* Remarks */}
                      <TableCell className="text-center">
                        {termData.remarks && (
                          <Badge
                            className={
                              termData.remarks === "PASSED"
                                ? "bg-green-500 hover:bg-green-600 text-white"
                                : "bg-red-500 hover:bg-red-600 text-white"
                            }
                          >
                            {termData.remarks}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={
                      ptColumns.length +
                      quizColumns.length +
                      (hasExam ? 1 : 0) +
                      4
                    }
                    className="text-center py-8 text-gray-500"
                  >
                    No students found matching your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing {currentPage * itemsPerPage + 1} to{" "}
            {Math.min(
              (currentPage + 1) * itemsPerPage,
              filteredStudents.length
            )}{" "}
            of {filteredStudents.length} students
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  className={
                    currentPage === 0
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = i;
                if (totalPages > 5) {
                  if (currentPage > 2) {
                    pageNum = currentPage - 2 + i;
                  }
                  if (pageNum >= totalPages) {
                    pageNum = totalPages - 5 + i;
                  }
                }
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      onClick={() => setCurrentPage(pageNum)}
                      isActive={currentPage === pageNum}
                      className={
                        currentPage === pageNum
                          ? "bg-[#124A69] text-white hover:bg-[#0d3a56]"
                          : "cursor-pointer"
                      }
                    >
                      {pageNum + 1}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              <PaginationItem>
                <PaginationNext
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages - 1, currentPage + 1))
                  }
                  className={
                    currentPage >= totalPages - 1
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
  );
};

// ==================== Main Dashboard Component ====================

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
  const [studentsWithRecords, setStudentsWithRecords] = useState<
    StudentWithRecords[]
  >([]);
  const [selectedTerm, setSelectedTerm] = useState<string>("PRELIMS");

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

  const handleExport = () => {
    if (!courseInfo) return;
    try {
      const ws_data = [
        ["Course Dashboard Export"],
        [""],
        ["Course:", `${courseInfo.code} - ${courseInfo.title}`],
        ["Section:", courseInfo.section],
        ["Date:", new Date().toLocaleDateString()],
        [""],
        ["Student ID", "Last Name", "First Name", "Middle Initial"],
        ...tableData.map((s) => [
          s.studentId,
          s.lastName,
          s.firstName,
          s.middleInitial || "",
        ]),
      ];

      const ws = XLSX.utils.aoa_to_sheet(ws_data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Students");
      XLSX.writeFile(
        wb,
        `${courseInfo.code}_students_${
          new Date().toISOString().split("T")[0]
        }.xlsx`
      );
      toast.success("Exported successfully");
    } catch (error) {
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
                  onClick={() => {
                    setShowRemoveSheet(true);
                  }}
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
      </div>
    </div>
  );
}
