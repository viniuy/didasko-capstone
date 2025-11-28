import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Search, AlertCircle, Loader2, Users } from "lucide-react";
import { Student } from "../types/types";
import { getInitials } from "../utils/initials";
import { useStudents } from "@/lib/hooks/queries";

interface AddStudentSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  enrolledStudentIds: string[];
  onSelectStudent: (student: Student) => Promise<void>;
}

export const AddStudentSheet = ({
  isOpen,
  onOpenChange,
  enrolledStudentIds,
  onSelectStudent,
}: AddStudentSheetProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search optimization constants
  const MIN_SEARCH_LENGTH = 2; // Require at least 2 characters
  const SEARCH_DEBOUNCE_MS = 800; // Debounce time

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      // Only update debounced query if minimum length met or clearing search
      if (
        searchQuery.trim().length >= MIN_SEARCH_LENGTH ||
        searchQuery.trim().length === 0
      ) {
        setDebouncedSearchQuery(searchQuery.trim());
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // React Query hook with search
  // Only fetch when there's a debounced search query (to avoid loading all students)
  const { data: studentsData, isLoading: isSearching } = useStudents({
    filters: debouncedSearchQuery
      ? {
          search: debouncedSearchQuery,
          limit: 50,
        }
      : undefined,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Filter students with RFID and not already enrolled
  const searchResults = useMemo(() => {
    if (!studentsData?.students) return [];

    const students = Array.isArray(studentsData.students)
      ? studentsData.students
      : studentsData.students || [];

    return students
      .map((s: any) => ({
        id: s.id,
        lastName: s.lastName,
        firstName: s.firstName,
        middleInitial: s.middleInitial || "",
        studentId: s.studentId,
        image: s.image,
        rfid_id: s.rfid_id,
      }))
      .filter((s: Student) => s.rfid_id && !enrolledStudentIds.includes(s.id));
  }, [studentsData, enrolledStudentIds]);

  // Reset search when sheet closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setDebouncedSearchQuery("");
    }
  }, [isOpen]);

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
              placeholder="Search by name, Student ID, or RFID ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
              disabled={isSubmitting}
            />
            {isSearching && (
              <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-gray-400" />
            )}
          </div>

          <div className="border rounded-lg max-h-[500px] overflow-y-auto">
            {isSearching ? (
              <div className="flex flex-col items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#124A69] mb-2" />
                <p className="text-sm text-gray-500">Searching students...</p>
              </div>
            ) : debouncedSearchQuery === "" ? (
              <div className="p-8 text-center text-gray-500">
                <Search className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p className="font-medium">Start searching</p>
                <p className="text-sm mt-1">
                  Enter at least {MIN_SEARCH_LENGTH} characters to search for
                  students
                </p>
                {searchQuery.trim().length > 0 &&
                  searchQuery.trim().length < MIN_SEARCH_LENGTH && (
                    <p className="text-xs text-gray-400 mt-2">
                      Type {MIN_SEARCH_LENGTH - searchQuery.trim().length} more
                      character
                      {MIN_SEARCH_LENGTH - searchQuery.trim().length > 1
                        ? "s"
                        : ""}{" "}
                      to search
                    </p>
                  )}
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((student: Student) => (
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
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-medium text-gray-900 truncate"
                        title={`${student.lastName}, ${student.firstName} ${
                          student.middleInitial
                            ? `${student.middleInitial}.`
                            : ""
                        }`}
                      >
                        {student.lastName}, {student.firstName}{" "}
                        {student.middleInitial
                          ? `${student.middleInitial}.`
                          : ""}
                      </p>
                      <p
                        className="text-sm text-gray-500 truncate"
                        title={`${student.studentId} • RFID: ${student.rfid_id}`}
                      >
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
                  Try adjusting your search or make sure the student has RFID
                  registration
                </p>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
