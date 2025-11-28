"use client";

import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";
import { editCourse } from "@/lib/actions/courses";
import { CourseStatus } from "@prisma/client";
import type { UserRole } from "@/lib/permission";

interface Course {
  id: string;
  code: string;
  title: string;
  room: string;
  semester: string;
  academicYear: string;
  classNumber: number;
  section: string;
  status: CourseStatus;
  facultyId: string | null;
  schedules: {
    id: string;
    day: string;
    fromTime: string;
    toTime: string;
  }[];
}

interface Faculty {
  id: string;
  name: string;
  email: string;
  department: string;
}

interface CourseSheetProps {
  mode: "add" | "edit";
  course?: Course;
  onSuccess?: (courseData?: any) => void;
  onClose?: () => void;
  faculties: Faculty[];
  userId: string;
  userRole: UserRole;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
}

export function CourseSheet({
  mode,
  course,
  onSuccess,
  onClose,
  faculties,
  userId,
  userRole,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  disabled = false,
}: CourseSheetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;

  const [isLoading, setIsLoading] = useState(false);

  // Function to get the current academic year based on the date
  const getCurrentAcademicYear = (): string => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12 (January = 1, December = 12)
    const currentYear = now.getFullYear();

    // January - June: (Current year - 1) - Current year (e.g., Jan 2025 = 2024-2025)
    // July - December: Current year - (Current year + 1) (e.g., Nov 2025 = 2025-2026)
    if (currentMonth >= 1 && currentMonth <= 6) {
      // January - June
      return `${currentYear - 1}-${currentYear}`;
    } else {
      // July - December
      return `${currentYear}-${currentYear + 1}`;
    }
  };

  const [formData, setFormData] = useState({
    code: course?.code || "",
    title: course?.title || "",
    room: course?.room || "",
    semester: course?.semester || "1st Semester",
    academicYear:
      course?.academicYear || (mode === "add" ? getCurrentAcademicYear() : ""),
    classNumber: course?.classNumber?.toString() || "1",
    section: course?.section || "",
    status: course?.status || CourseStatus.ACTIVE,
  });

  // Update form data when course changes
  useEffect(() => {
    if (course) {
      setFormData({
        code: course.code,
        title: course.title,
        room: course.room,
        semester: course.semester,
        academicYear: course.academicYear,
        classNumber: course.classNumber.toString(),
        section: course.section,
        status: course.status,
      });
    }
  }, [course]);

  // Update academic year when sheet opens in "add" mode
  useEffect(() => {
    if (open && mode === "add" && !course) {
      setFormData((prev) => ({
        ...prev,
        academicYear: getCurrentAcademicYear(),
      }));
    }
  }, [open, mode, course]);

  // Function to remove emojis from text
  const removeEmojis = (text: string): string => {
    // Remove emojis using regex pattern
    // This pattern matches most emoji ranges in Unicode
    return text.replace(
      /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{200D}]|[\u{FE00}-\u{FE0F}]|[\u{20D0}-\u{20FF}]/gu,
      ""
    );
  };

  const handleChange = (field: string, value: string) => {
    // Remove emojis from the value before setting it
    const cleanedValue = removeEmojis(value);
    setFormData((prev) => ({ ...prev, [field]: cleanedValue }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code.trim()) {
      toast.error("Course code is required");
      return;
    }

    // Validate course code: no spaces or special characters allowed
    if (!/^[A-Z0-9]+$/.test(formData.code.trim())) {
      toast.error(
        "Course code can only contain letters and numbers. No spaces or special characters allowed."
      );
      return;
    }
    if (!formData.title.trim()) {
      toast.error("Course title is required");
      return;
    }
    if (!formData.section.trim()) {
      toast.error("Section is required");
      return;
    }
    // Clean room input - remove "Room:" prefix if present
    const cleanedRoom = formData.room
      .trim()
      .replace(/^room:\s*/i, "")
      .trim();
    if (!cleanedRoom) {
      toast.error("Room is required");
      return;
    }
    if (!formData.academicYear.trim()) {
      toast.error("Academic year is required");
      return;
    }

    // Validate academic year format
    if (!/^\d{4}-\d{4}$/.test(formData.academicYear.trim())) {
      toast.error(
        "Academic year must be in format YYYY-YYYY (e.g., 2024-2025)"
      );
      return;
    }

    // Validate academic year values: first year must be less than second year, and difference must be exactly 1
    const [firstYear, secondYear] = formData.academicYear
      .trim()
      .split("-")
      .map(Number);
    if (firstYear >= secondYear) {
      toast.error("First year must be less than second year (e.g., 2024-2025)");
      return;
    }
    if (secondYear - firstYear !== 1) {
      toast.error(
        "Academic year must have exactly 1 year difference (e.g., 2024-2025)"
      );
      return;
    }

    const classNumber = parseInt(formData.classNumber);
    if (isNaN(classNumber) || classNumber < 1) {
      toast.error("Class number must be a positive number");
      return;
    }

    if (classNumber > 9999999999999) {
      toast.error("Class number cannot exceed 9999999999999");
      return;
    }

    setIsLoading(true);

    try {
      // Clean room input - remove "Room:" prefix if present
      const cleanedRoom = formData.room
        .trim()
        .replace(/^room:\s*/i, "")
        .trim()
        .toUpperCase();

      const courseData = {
        code: formData.code.trim().toUpperCase(),
        title: formData.title.trim(),
        room: cleanedRoom,
        semester: formData.semester,
        academicYear: formData.academicYear.trim(),
        classNumber,
        section: formData.section.trim().toUpperCase(),
        status: formData.status,
        facultyId: userId,
      };

      if (mode === "add") {
        // For add mode: Don't create yet, just pass data to schedule dialog
        toast("Please add schedules to complete course creation");
        setOpen(false);
        if (onSuccess) {
          onSuccess(courseData);
        }

        // Reset form
        setFormData({
          code: "",
          title: "",
          room: "",
          semester: "1st Semester",
          academicYear: getCurrentAcademicYear(),
          classNumber: "1",
          section: "",
          status: CourseStatus.ACTIVE,
        });
      } else if (course) {
        // For edit mode: Update existing course
        const result = await editCourse(course.id, courseData);

        if (result?.success) {
          toast.success("Course updated successfully");
          if (onSuccess) onSuccess();
          setOpen(false);
          if (onClose) onClose();
        } else {
          toast.error(result?.error || "Failed to update course");
        }
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("An error occurred while saving the course");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen && onClose) {
      onClose();
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {mode === "add" && (
        <SheetTrigger asChild>
          <Button
            disabled={disabled}
            className="gap-1 xl:gap-2 text-xs xl:text-sm px-2 xl:px-3 py-2 min-h-[44px] sm:min-h-0 bg-[#124A69] hover:bg-[#0D3A54] text-white disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              disabled
                ? "Maximum 15 active courses reached. Please archive some courses first."
                : "Add new course"
            }
          >
            <Plus className="h-3 w-3 sm:h-4 sm:w-4 xl:mr-2" />
            <span className="hidden xl:inline">Add Course</span>
          </Button>
        </SheetTrigger>
      )}
      <SheetContent className="p-4 overflow-y-auto w-full sm:max-w-[540px]">
        <SheetHeader>
          <SheetTitle>
            {mode === "add" ? "Add New Course" : "Edit Course"}
          </SheetTitle>
          <SheetDescription>
            {mode === "add"
              ? "Fill in the course details. You'll add schedules in the next step."
              : "Update the course information"}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label htmlFor="title">
              Course Title <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => {
                  const value = removeEmojis(e.target.value);
                  handleChange("title", value);
                }}
                placeholder="e.g., IT Capstone"
                maxLength={70}
                required
                className="pr-12"
              />
              <span className="absolute bottom-2 right-3 text-xs text-gray-500">
                {formData.title.length}/70
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">
              Course Abbreviation <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => {
                  // Remove emojis, spaces and special characters, only allow alphanumeric
                  const value = removeEmojis(e.target.value)
                    .replace(/[^A-Za-z0-9]/g, "")
                    .toUpperCase();
                  handleChange("code", value);
                }}
                placeholder="e.g., ITCAPSTONE"
                maxLength={15}
                required
                className="pr-12"
              />
              <span className="absolute bottom-2 right-3 text-xs text-gray-500">
                {formData.code.length}/15
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="section">
                Section <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="section"
                  value={formData.section}
                  onChange={(e) => {
                    const value = removeEmojis(e.target.value).toUpperCase();
                    handleChange("section", value);
                  }}
                  placeholder="e.g., BSIT-711"
                  maxLength={10}
                  required
                  className="pr-12"
                />
                <span className="absolute bottom-2 right-3 text-xs text-gray-500">
                  {formData.section.length}/10
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="room">
                Room <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="room"
                  value={formData.room}
                  onChange={(e) => {
                    let value = removeEmojis(e.target.value);
                    // Remove "Room:" or "room:" prefix (case-insensitive) with optional colon and space
                    value = value.replace(/^room:\s*/i, "").trim();
                    handleChange("room", value.toUpperCase());
                  }}
                  placeholder="e.g., 402"
                  maxLength={15}
                  required
                  className="pr-12"
                />
                <span className="absolute bottom-2 right-3 text-xs text-gray-500">
                  {formData.room.length}/15
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="semester">
                Semester <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.semester}
                onValueChange={(value) => handleChange("semester", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1st Semester">1st Semester</SelectItem>
                  <SelectItem value="2nd Semester">2nd Semester</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="academicYear">
                Academic Year <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="academicYear"
                  value={formData.academicYear}
                  onChange={(e) => {
                    const value = removeEmojis(e.target.value);
                    // Only allow format: 0000-0000
                    const academicYearPattern = /^(\d{0,4})(-?)(\d{0,4})$/;
                    if (academicYearPattern.test(value) || value === "") {
                      handleChange("academicYear", value);
                    }
                  }}
                  placeholder="e.g., 2024-2025"
                  maxLength={9}
                  required
                  className="pr-12"
                />
                <span className="absolute bottom-2 right-3 text-xs text-gray-500">
                  {formData.academicYear.length}/9
                </span>
              </div>
              {formData.academicYear &&
                !/^\d{4}-\d{4}$/.test(formData.academicYear) && (
                  <p className="text-xs text-red-500">
                    Format must be YYYY-YYYY (e.g., 2024-2025)
                  </p>
                )}
              {formData.academicYear &&
                /^\d{4}-\d{4}$/.test(formData.academicYear) &&
                (() => {
                  const [firstYear, secondYear] = formData.academicYear
                    .split("-")
                    .map(Number);
                  if (firstYear >= secondYear) {
                    return (
                      <p className="text-xs text-red-500">
                        First year must be less than second year
                      </p>
                    );
                  }
                  if (secondYear - firstYear !== 1) {
                    return (
                      <p className="text-xs text-red-500">
                        Academic year must have exactly 1 year difference
                      </p>
                    );
                  }
                  return null;
                })()}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="classNumber">
                Class Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="classNumber"
                type="number"
                min="1"
                max="9999999999999"
                value={formData.classNumber}
                onChange={(e) => {
                  const value = e.target.value;
                  // Only allow positive integers
                  if (
                    value === "" ||
                    (/^\d+$/.test(value) && parseInt(value) <= 9999999999999)
                  ) {
                    handleChange("classNumber", value);
                  }
                }}
                onKeyDown={(e) => {
                  // Prevent non-numeric keys except backspace, delete, tab, escape, enter
                  if (
                    !/[0-9]/.test(e.key) &&
                    ![
                      "Backspace",
                      "Delete",
                      "Tab",
                      "Escape",
                      "Enter",
                      "ArrowLeft",
                      "ArrowRight",
                    ].includes(e.key)
                  ) {
                    e.preventDefault();
                  }
                }}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  handleChange("status", value as CourseStatus)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-[#124A69] hover:bg-[#0D3A54] text-white"
            >
              {isLoading
                ? "Processing..."
                : mode === "add"
                ? "Next: Add Schedules"
                : "Update Course"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
