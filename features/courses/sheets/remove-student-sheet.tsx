import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Search, AlertCircle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "@/lib/axios";
import { StudentWithRecords } from "../types/types";
import { getInitials } from "../utils/initials";

interface RemoveStudentSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  students: StudentWithRecords[];
  isLoading: boolean;
  courseSlug: string;
  onRemoveSuccess: () => void;
}

export const RemoveStudentSheet = ({
  isOpen,
  onOpenChange,
  students,
  isLoading,
  courseSlug,
  onRemoveSuccess,
}: RemoveStudentSheetProps) => {
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
                    {(student.hasAttendance || student.hasGrades) && (
                      <p className="text-xs text-red-600 mt-1">
                        Has {student.hasAttendance && "attendance"}
                        {student.hasAttendance && student.hasGrades && " & "}
                        {student.hasGrades && "grades"}
                      </p>
                    )}
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
