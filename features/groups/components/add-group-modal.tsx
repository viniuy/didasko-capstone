"use client";
import React, { useState, useMemo } from "react";
import { Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { AttendanceStatus } from "@prisma/client";

interface AddGroupModalProps {
  courseCode: string;
  excludedStudentIds?: string[];
  nextGroupNumber?: number;
  onGroupAdded?: () => void;
  isValidationNeeded?: boolean;
  totalStudents?: number;
  students: Student[];
  groupMeta: GroupMeta;
}

interface Student {
  id: string;
  name: string;
  status: AttendanceStatus | "NOT_SET";
}

interface GroupMeta {
  names: string[];
  numbers: number[];
  usedNames: string[];
  usedNumbers: number[];
}

export function AddGroupModal({
  courseCode,
  excludedStudentIds = [],
  onGroupAdded,
  isValidationNeeded = false,
  totalStudents = 0,
  students = [],
  groupMeta = { names: [], numbers: [], usedNames: [], usedNumbers: [] },
}: AddGroupModalProps) {
  const [open, setOpen] = useState(false);
  const [groupNumber, setGroupNumber] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedLeader, setSelectedLeader] = useState<string>("");
  const [studentSearch, setStudentSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [studentSelectionError, setStudentSelectionError] = useState("");
  const [groupNumberError, setGroupNumberError] = useState("");
  const [groupNameError, setGroupNameError] = useState("");

  // --- Helpers ---
  const calculateGroupSizes = (total: number) => {
    if (total <= 0) return { maxGroups: 0 };
    if (total <= 2) return { maxGroups: 1 };
    return { maxGroups: Math.floor(total / 2) };
  };

  const statusColor = (status: AttendanceStatus | "NOT_SET") =>
    ({
      PRESENT: "bg-green-100 text-green-700 border-green-300",
      LATE: "bg-yellow-100 text-yellow-700 border-yellow-300",
      ABSENT: "bg-red-100 text-red-700 border-red-300",
      EXCUSED: "bg-blue-100 text-blue-700 border-blue-300",
      NOT_SET: "bg-gray-100 text-gray-500 border-gray-300",
    }[status] || "bg-gray-100 text-gray-500 border-gray-300");

  const getStatusDisplay = (status: AttendanceStatus | "NOT_SET") =>
    ({
      PRESENT: "Present",
      LATE: "Late",
      ABSENT: "Absent",
      EXCUSED: "Excused",
      NOT_SET: "No Attendance",
    }[status] || "No Attendance");

  // --- Filtering ---
  const availableStudents = useMemo(
    () => students.filter((s) => !excludedStudentIds.includes(s.id)),
    [students, excludedStudentIds]
  );

  const filteredStudents = useMemo(() => {
    const q = studentSearch.toLowerCase();
    return availableStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.status.toLowerCase().includes(q)
    );
  }, [studentSearch, availableStudents]);

  // --- Validation ---
  const validateInputs = () => {
    const groupNum = parseInt(groupNumber);
    const { maxGroups } = calculateGroupSizes(totalStudents);

    // Group number validation
    if (!groupNumber || isNaN(groupNum) || groupNum < 1 || groupNum > maxGroups) {
      setGroupNumberError(`Must be between 1 and ${maxGroups}`);
      return false;
    }

    // Check if group number already exists (convert to number for comparison)
    if (groupMeta.usedNumbers.some(num => Number(num) === groupNum)) {
      setGroupNumberError("This group number already exists");
      return false;
    }

    setGroupNumberError("");

    // Group name validation
    if (groupName && groupMeta.usedNames.includes(groupName.trim())) {
      setGroupNameError("This group name already exists");
      return false;
    }

    setGroupNameError("");

    // Student validation
    if (selectedStudents.length < 2) {
      setStudentSelectionError("At least 2 students required");
      return false;
    }

    const remaining = availableStudents.length - selectedStudents.length;
    if (remaining === 1) {
      setStudentSelectionError("Cannot leave only 1 student");
      return false;
    }

    setStudentSelectionError("");
    return true;
  };

  // --- Handle Form Submit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInputs()) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/courses/${courseCode}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupNumber,
          groupName,
          studentIds: selectedStudents,
          leaderId: selectedLeader,
        }),
      });

      if (!response.ok) throw new Error("Failed to create group");

      toast.success("Group created successfully!");
      setOpen(false);
      
      // Reset form
      setGroupNumber("");
      setGroupName("");
      setSelectedStudents([]);
      setSelectedLeader("");
      setStudentSearch("");
      
      onGroupAdded?.();
    } catch (error) {
      console.error(error);
      toast.error("Error creating group");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="relative flex flex-col items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          style={{ width: "8.75rem", height: "8.75rem" }}
          disabled={isValidationNeeded}
        >
          {isValidationNeeded ? (
            <Loader2 className="h-20 w-20 text-gray-400 animate-spin" />
          ) : (
            <div className="relative flex items-center justify-center">
              <Users
                className="h-20 w-20 text-gray-400 opacity-70"
                strokeWidth={1.5}
              />
              <Plus
                className="h-10 w-10 text-white absolute"
                strokeWidth={2.5}
              />
            </div>
          )}
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#124A69]">
            Add Groups
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Group number + name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Group Number */}
              <div>
                <label className="text-sm font-semibold">Group Number *</label>
                <Input
                  value={groupNumber}
                  onChange={(e) => setGroupNumber(e.target.value)}
                  placeholder="1"
                  required
                />
                {groupNumberError && (
                  <p className="text-xs text-red-500">{groupNumberError}</p>
                )}
                {totalStudents > 0 && (
                  <p className="text-xs text-gray-500">
                    Max: {calculateGroupSizes(totalStudents).maxGroups}
                  </p>
                )}
              </div>

              {/* Group Name */}
              <div>
                <label className="text-sm font-semibold">Group Name</label>
                <Input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Optional"
                />
                {groupNameError && (
                  <p className="text-xs text-red-500">{groupNameError}</p>
                )}
              </div>
            </div>

            {/* Leader Selection */}
            <div>
              <label className="text-sm font-semibold">Group Leader</label>
              <Select
                value={selectedLeader}
                onValueChange={setSelectedLeader}
                disabled={selectedStudents.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      selectedStudents.length
                        ? "Select a leader"
                        : "Select students first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredStudents
                    .filter((s) => selectedStudents.includes(s.id))
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Students */}
            <div>
              <label className="text-sm font-semibold">Add Students *</label>
              <Input
                placeholder="Search students..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="mb-2"
              />
              <div className="border rounded max-h-40 overflow-y-auto bg-white">
                {filteredStudents.length ? (
                  filteredStudents.map((student) => (
                    <label
                      key={student.id}
                      className="flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer"
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
                        className="mr-2"
                      />
                      <span>{student.name}</span>
                      <span
                        className={`ml-3 px-2 py-0.5 rounded text-xs border ${statusColor(
                          student.status
                        )}`}
                      >
                        {getStatusDisplay(student.status)}
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="px-3 py-2 text-gray-400 text-sm">
                    No students found.
                  </p>
                )}
              </div>
              {studentSelectionError && (
                <p className="text-xs text-red-500 mt-1">
                  {studentSelectionError}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-between gap-4 mt-6">
            <Button
              type="button"
              variant="outline"
              className="w-1/2"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="w-1/2 bg-[#124A69] text-white"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add group"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}