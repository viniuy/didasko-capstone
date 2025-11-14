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
}: CourseSheetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;

  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    code: course?.code || "",
    title: course?.title || "",
    room: course?.room || "",
    semester: course?.semester || "1st Semester",
    academicYear: course?.academicYear || "",
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

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code.trim()) {
      toast.error("Course code is required");
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
    if (!formData.room.trim()) {
      toast.error("Room is required");
      return;
    }
    if (!formData.academicYear.trim()) {
      toast.error("Academic year is required");
      return;
    }

    const classNumber = parseInt(formData.classNumber);
    if (isNaN(classNumber) || classNumber < 1) {
      toast.error("Class number must be a positive number");
      return;
    }

    setIsLoading(true);

    try {
      const courseData = {
        code: formData.code.trim().toUpperCase(),
        title: formData.title.trim(),
        room: formData.room.trim().toUpperCase(),
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
          academicYear: "",
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
          <Button className="bg-[#124A69] hover:bg-[#0D3A54] text-white">
            <Plus className="h-4 w-4 mr-2" />
            Add Course
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
            <Label htmlFor="code">
              Course Code <span className="text-red-500">*</span>
            </Label>
            <Input
              id="code"
              value={formData.code}
              onChange={(e) =>
                handleChange("code", e.target.value.toUpperCase())
              }
              placeholder="e.g., CS101"
              maxLength={20}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">
              Course Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
              placeholder="e.g., Introduction to Programming"
              maxLength={100}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="section">
                Section <span className="text-red-500">*</span>
              </Label>
              <Input
                id="section"
                value={formData.section}
                onChange={(e) =>
                  handleChange("section", e.target.value.toUpperCase())
                }
                placeholder="e.g., A"
                maxLength={10}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="room">
                Room <span className="text-red-500">*</span>
              </Label>
              <Input
                id="room"
                value={formData.room}
                onChange={(e) =>
                  handleChange("room", e.target.value.toUpperCase())
                }
                placeholder="e.g., A101"
                maxLength={20}
                required
              />
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
                <SelectTrigger>
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
              <Input
                id="academicYear"
                value={formData.academicYear}
                onChange={(e) => handleChange("academicYear", e.target.value)}
                placeholder="e.g., 2024-2025"
                maxLength={20}
                required
              />
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
                max="999999999"
                value={formData.classNumber}
                onChange={(e) => handleChange("classNumber", e.target.value)}
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
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
