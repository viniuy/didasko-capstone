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
  AlertCircle,
  Trash2,
  AlertTriangle,
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

interface Student {
  id: string;
  lastName: string;
  firstName: string;
  middleInitial?: string;
  studentId: string;
  image?: string;
  rfid_id?: number;
  attendanceRate?: number;
  totalPresent?: number;
  totalAbsent?: number;
  totalLate?: number;
  totalExcused?: number;
  averageGrade?: number;
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

  const filteredStudents = existingStudents.filter(
    (s) =>
      !enrolledStudentIds.includes(s.id) &&
      `${s.lastName} ${s.firstName} ${s.studentId}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
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

  const hasStudentsWithRecords = students.some(
    (s) => selectedStudents.includes(s.id) && (s.hasAttendance || s.hasGrades)
  );

  const filteredStudents = students.filter((student) =>
    `${student.lastName} ${student.firstName} ${student.studentId}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleToggleAll = () => {
    if (selectedStudents.length === filteredStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(filteredStudents.map((s) => s.id));
    }
  };

  const handleRemove = () => {
    if (selectedStudents.length === 0) {
      toast.error("Please select at least one student to remove");
      return;
    }

    if (hasStudentsWithRecords) {
      setShowConfirmation(true);
    } else {
      confirmRemoval();
    }
  };

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

      setSelectedStudents([]);
      setConfirmationInput("");
      setShowConfirmation(false);
      onOpenChange(false);
      onRemoveSuccess();
    } catch (error: any) {
      console.error("Error removing students:", error);
      const errorMessage =
        error?.response?.data?.error || "Failed to remove students";
      toast.error(errorMessage);
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
                  delete their records for this course. This action cannot be
                  undone.
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
                  className="text-blue-600 hover:text-blue-800"
                >
                  Clear
                </Button>
              </div>
            )}

            <div className="border rounded-lg">
              {isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#124A69]" />
                </div>
              ) : (
                <>
                  <div className="p-3 border-b bg-gray-50 flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={
                        filteredStudents.length > 0 &&
                        selectedStudents.length === filteredStudents.length
                      }
                      onChange={handleToggleAll}
                      className="w-4 h-4 text-[#124A69] border-gray-300 rounded focus:ring-[#124A69]"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Select All
                    </span>
                  </div>

                  <div className="max-h-[400px] overflow-y-auto">
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map((student) => (
                        <div
                          key={student.id}
                          className="flex items-center gap-3 p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedStudents.includes(student.id)}
                            onChange={() => handleToggleStudent(student.id)}
                            className="w-4 h-4 text-[#124A69] border-gray-300 rounded focus:ring-[#124A69]"
                          />
                          <Avatar className="h-10 w-10">
                            <AvatarImage
                              src={student.image}
                              alt={student.firstName}
                            />
                            <AvatarFallback className="bg-[#124A69] text-white text-sm">
                              {getInitials(student.firstName, student.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {student.lastName}, {student.firstName}{" "}
                              {student.middleInitial
                                ? `${student.middleInitial}.`
                                : ""}
                            </p>
                            <p className="text-sm text-gray-500">
                              {student.studentId}
                            </p>
                            {(student.hasAttendance || student.hasGrades) && (
                              <div className="flex gap-2 mt-1">
                                {student.hasAttendance && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs bg-orange-100 text-orange-700"
                                  >
                                    Has Attendance
                                  </Badge>
                                )}
                                {student.hasGrades && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs bg-purple-100 text-purple-700"
                                  >
                                    Has Grades
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-gray-500">
                        <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                        <p className="font-medium">No students found</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={resetSheet}>
                Cancel
              </Button>
              <Button
                onClick={handleRemove}
                disabled={selectedStudents.length === 0 || isRemoving}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isRemoving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  `Remove ${selectedStudents.length} Student${
                    selectedStudents.length !== 1 ? "s" : ""
                  }`
                )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-red-600">
              Confirm Student Removal
            </DialogTitle>
            <DialogDescription>
              This action will permanently delete all attendance and grade
              records for the selected students.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800 font-medium mb-2">
                You are about to remove:
              </p>
              <ul className="text-sm text-red-700 space-y-1">
                {students
                  .filter((s) => selectedStudents.includes(s.id))
                  .map((student) => (
                    <li key={student.id}>
                      • {student.lastName}, {student.firstName} (
                      {student.studentId})
                      {(student.hasAttendance || student.hasGrades) && (
                        <span className="text-red-600 font-semibold">
                          {" "}
                          - Has Records
                        </span>
                      )}
                    </li>
                  ))}
              </ul>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type <span className="font-bold text-red-600">"Remove"</span> to
                confirm
              </label>
              <Input
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder="Remove"
                className="border-red-300 focus:border-red-500 focus:ring-red-500"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowConfirmation(false);
                  setConfirmationInput("");
                }}
                disabled={isRemoving}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmRemoval}
                disabled={confirmationInput !== "Remove" || isRemoving}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isRemoving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Confirm Removal"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const RemoveAllStudentsDialog = ({
  isOpen,
  onOpenChange,
  students,
  isLoading,
  courseSlug,
  courseInfo,
  onRemoveSuccess,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  students: StudentWithRecords[];
  isLoading: boolean;
  courseSlug: string;
  courseInfo: CourseInfo;
  onRemoveSuccess: () => void;
}) => {
  const [confirmationInput, setConfirmationInput] = useState("");
  const [isRemoving, setIsRemoving] = useState(false);

  const hasAnyRecords = students.some((s) => s.hasAttendance || s.hasGrades);
  const studentsWithRecords = students.filter(
    (s) => s.hasAttendance || s.hasGrades
  );

  const handleRemoveAll = async () => {
    if (confirmationInput !== "REMOVE ALL STUDENTS") {
      toast.error('Please type "REMOVE ALL STUDENTS" to confirm');
      return;
    }

    try {
      setIsRemoving(true);
      await axiosInstance.delete(`/courses/${courseSlug}/students/all`);

      toast.success(`Successfully removed all students from the course`);

      setConfirmationInput("");
      onOpenChange(false);
      onRemoveSuccess();
    } catch (error: any) {
      console.error("Error removing all students:", error);
      const errorMessage =
        error?.response?.data?.error || "Failed to remove all students";
      toast.error(errorMessage);
    } finally {
      setIsRemoving(false);
    }
  };

  const resetDialog = () => {
    setConfirmationInput("");
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={resetDialog}>
      <DialogContent className="w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-red-100 rounded-full">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <DialogTitle className="text-red-600 text-xl">
              Remove All Students
            </DialogTitle>
          </div>
          <DialogDescription className="text-base">
            This will permanently remove all students from this course
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#124A69]" />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="bg-red-100 border-2 border-red-300 rounded-lg p-4">
              <div className="flex gap-3 mb-3">
                <AlertCircle className="w-6 h-6 text-red-700 shrink-0" />
                <div>
                  <p className="font-bold text-red-900 text-base mb-1">
                    CRITICAL WARNING
                  </p>
                  <p className="text-sm text-red-800">
                    This action is IRREVERSIBLE and will DELETE ALL DATA for
                    this course including:
                  </p>
                </div>
              </div>
              <ul className="text-sm text-red-800 space-y-1 ml-9">
                <li>• All student enrollments ({students.length} students)</li>
                <li>• All attendance records</li>
                <li>• All grade records</li>
                <li>• All related course data</li>
              </ul>
            </div>

            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
              <p className="font-semibold text-amber-900 mb-2">
                Course Information:
              </p>
              <div className="text-sm text-amber-800 space-y-1">
                <p>
                  <span className="font-medium">Course:</span> {courseInfo.code}{" "}
                  - {courseInfo.title}
                </p>
                <p>
                  <span className="font-medium">Section:</span>{" "}
                  {courseInfo.section}
                </p>
                <p>
                  <span className="font-medium">Total Students:</span>{" "}
                  {students.length}
                </p>
                {hasAnyRecords && (
                  <p className="text-red-700 font-semibold mt-2">
                    ⚠️ {studentsWithRecords.length} student
                    {studentsWithRecords.length !== 1 ? "s" : ""} with existing
                    records will lose ALL data
                  </p>
                )}
              </div>
            </div>

            {hasAnyRecords && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-40 overflow-y-auto">
                <p className="text-sm font-semibold text-red-800 mb-2">
                  Students with records that will be deleted:
                </p>
                <ul className="text-sm text-red-700 space-y-1">
                  {studentsWithRecords.map((student) => (
                    <li key={student.id}>
                      • {student.lastName}, {student.firstName} (
                      {student.studentId})
                      {student.hasAttendance && student.hasGrades
                        ? " - Attendance & Grades"
                        : student.hasAttendance
                        ? " - Attendance"
                        : " - Grades"}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-900">
                To confirm this action, type:{" "}
                <span className="text-red-600 font-mono bg-red-50 px-2 py-1 rounded">
                  REMOVE ALL STUDENTS
                </span>
              </label>
              <Input
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder="REMOVE ALL STUDENTS"
                className="border-red-300 focus:border-red-500 focus:ring-red-500 font-mono"
              />
              {confirmationInput &&
                confirmationInput !== "REMOVE ALL STUDENTS" && (
                  <p className="text-sm text-red-600">
                    Text must match exactly (case sensitive)
                  </p>
                )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={resetDialog}
                disabled={isRemoving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRemoveAll}
                disabled={
                  confirmationInput !== "REMOVE ALL STUDENTS" || isRemoving
                }
                className="bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                {isRemoving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove All Students
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
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

  const [showAddSheet, setShowAddSheet] = useState(false);
  const [existingStudents, setExistingStudents] = useState<Student[]>([]);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);

  const [showRemoveSheet, setShowRemoveSheet] = useState(false);
  const [studentsWithRecords, setStudentsWithRecords] = useState<
    StudentWithRecords[]
  >([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);

  const [showRemoveAllDialog, setShowRemoveAllDialog] = useState(false);

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

      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      console.error("Error fetching course data:", error);
      toast.error("Failed to load course data");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExistingStudents = async () => {
    try {
      setIsLoadingExisting(true);
      const response = await axiosInstance.get("/students");
      const studentsWithRfid = (response.data.students || []).filter(
        (s: Student) => s.rfid_id !== null && s.rfid_id !== undefined
      );
      setExistingStudents(studentsWithRfid);
    } catch (error: any) {
      console.error("Error fetching students:", error);
      const errorMessage =
        error?.response?.data?.error || "Failed to load students";
      toast.error(errorMessage);
    } finally {
      setIsLoadingExisting(false);
    }
  };

  const fetchStudentsWithRecords = async () => {
    try {
      setIsLoadingRecords(true);
      const response = await axiosInstance.get(
        `/courses/${courseSlug}/students/records`
      );
      const studentsData = response.data.students || [];

      const studentsWithRecordStatus: StudentWithRecords[] = tableData.map(
        (student) => {
          const recordInfo = studentsData.find((s: any) => s.id === student.id);
          return {
            ...student,
            hasAttendance: recordInfo?.hasAttendance || false,
            hasGrades: recordInfo?.hasGrades || false,
          };
        }
      );

      setStudentsWithRecords(studentsWithRecordStatus);
    } catch (error) {
      console.error("Error fetching student records:", error);
      toast.error("Failed to load student records");
    } finally {
      setIsLoadingRecords(false);
    }
  };

  const handleOpenAddSheet = async () => {
    setShowAddSheet(true);
    await fetchExistingStudents();
  };

  const handleOpenRemoveSheet = async () => {
    setShowRemoveSheet(true);
    await fetchStudentsWithRecords();
  };

  const handleOpenRemoveAllDialog = async () => {
    setShowRemoveAllDialog(true);
    await fetchStudentsWithRecords();
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

  const handleSelectExistingStudent = async (student: Student) => {
    try {
      const response = await axiosInstance.post(
        `/courses/${courseSlug}/students`,
        [
          {
            "Student ID": student.studentId,
            "First Name": student.firstName,
            "Last Name": student.lastName,
            "Middle Initial": student.middleInitial || "",
          },
        ]
      );

      await fetchCourseData();

      return response.data;
    } catch (error: any) {
      console.error("Error adding existing student:", error);

      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.details ||
        error?.message ||
        "Failed to add student to course";

      throw new Error(errorMessage);
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
        ["1. Student ID must match existing students with RFID"],
        ["2. Only students with registered RFID can be added"],
        ["3. Last Name and First Name are required"],
        ["4. Middle Initial is optional (single letter)"],
        ["5. Do not include empty rows"],
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

      setTableData((prev) => {
        const newStudents = detailedFeedback
          .filter((f: { status: string }) => f.status === "imported")
          .map((f: any) => {
            const importedStudent = previewData.find(
              (s) => s["Student ID"] === f.studentId
            );
            return {
              id: f.id || "TEMP-" + f.studentId,
              studentId: f.studentId,
              firstName: importedStudent?.["First Name"] || "",
              lastName: importedStudent?.["Last Name"] || "",
              middleInitial: importedStudent?.["Middle Initial"] || "",
              attendanceRate: 0,
              totalPresent: 0,
              totalAbsent: 0,
              totalLate: 0,
              totalExcused: 0,
              averageGrade: 0,
            };
          });

        return [...prev, ...newStudents];
      });
      await fetchCourseData();
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
          />
          <StatsCard
            icon={TrendingUp}
            title="Average Grade"
            value={stats.averageGrade.toFixed(1)}
            subtitle={`${stats.passingRate.toFixed(1)}% passing rate`}
          />
          <StatsCard
            icon={UserX}
            title="Total Absences"
            value={stats.totalAbsents}
            subtitle={`${stats.totalLate} late, ${stats.totalExcused} excused`}
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
                variant="outline"
                onClick={() => setShowImportDialog(true)}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Import
              </Button>
              <Button
                onClick={handleOpenAddSheet}
                className="bg-[#124A69] hover:bg-[#0D3A54] text-white gap-2"
              >
                <Users className="w-4 h-4" />
                Add Student
              </Button>
              <Button
                variant="outline"
                onClick={handleOpenRemoveSheet}
                className="gap-2 border-red-500 text-red-600 hover:bg-red-50"
              >
                <UserX className="w-4 h-4" />
                Remove Student
              </Button>
              <Button
                variant="outline"
                onClick={handleOpenRemoveAllDialog}
                className="gap-2 border-red-600 text-red-700 hover:bg-red-100"
              >
                <Trash2 className="w-4 h-4" />
                Remove All
              </Button>
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
                Upload a file to batch import students with RFID registration
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Important</p>
                  <p>
                    Only students with registered RFID cards can be imported.
                    Students without RFID will be skipped.
                  </p>
                </div>
              </div>

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

        <AddStudentSheet
          isOpen={showAddSheet}
          onOpenChange={setShowAddSheet}
          existingStudents={existingStudents}
          isLoading={isLoadingExisting}
          enrolledStudentIds={tableData.map((s) => s.id)}
          onSelectStudent={async (student) => {
            try {
              await handleSelectExistingStudent(student);
              setShowAddSheet(false);
              toast.success("Student added to course successfully!");
            } catch (error: any) {
              toast.error(error.message || "Failed to add student to course");
            }
          }}
        />

        <RemoveStudentSheet
          isOpen={showRemoveSheet}
          onOpenChange={setShowRemoveSheet}
          students={studentsWithRecords}
          isLoading={isLoadingRecords}
          courseSlug={courseSlug}
          onRemoveSuccess={fetchCourseData}
        />

        <RemoveAllStudentsDialog
          isOpen={showRemoveAllDialog}
          onOpenChange={setShowRemoveAllDialog}
          students={studentsWithRecords}
          isLoading={isLoadingRecords}
          courseSlug={courseSlug}
          courseInfo={courseInfo}
          onRemoveSuccess={fetchCourseData}
        />
      </div>
    </div>
  );
}
