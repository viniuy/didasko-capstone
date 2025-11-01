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
import { TimePicker } from "@/components/ui/time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";

import { Plus } from "lucide-react";
import toast from "react-hot-toast";
import { createCourse, editCourse } from "@/lib/actions/courses";
import { CourseStatus } from "@prisma/client";

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
  onSuccess?: () => void;
  onClose?: () => void;
  faculties: Faculty[];
}

export function CourseSheet({
  mode,
  course,
  onSuccess,
  onClose,
  faculties,
}: CourseSheetProps) {
  const [open, setOpen] = useState(mode === "edit");
  const [schedules, setSchedules] = useState<
    { day: string; fromTime: string; toTime: string }[]
  >(course?.schedules || []);

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    code: course?.code || "",
    title: course?.title || "",
    room: course?.room || "",
    semester: course?.semester || "",
    academicYear: course?.academicYear || "",
    classNumber: course?.classNumber?.toString() || "",
    section: course?.section || "",
    status: course?.status || CourseStatus.ACTIVE,
    facultyId: course?.facultyId || "",
  });

  useEffect(() => {
    if (mode === "edit") {
      setOpen(true);
    }
  }, [mode]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (schedules.length === 0) {
      toast.error("Please add at least one schedule");
      setIsLoading(false);
      return;
    }

    // Validate each schedule
    for (const s of schedules) {
      if (!s.day || !s.fromTime || !s.toTime) {
        toast.error("All schedule fields are required");
        setIsLoading(false);
        return;
      }
    }

    try {
      // Validate required fields
      if (
        !formData.code ||
        !formData.title ||
        !formData.room ||
        !formData.semester ||
        !formData.academicYear ||
        !formData.classNumber ||
        !formData.section
      ) {
        toast.error("Please fill in all required fields");
        setIsLoading(false);
        return;
      }

      const classNumber = parseInt(formData.classNumber);
      if (isNaN(classNumber) || classNumber < 1) {
        toast.error("Class number must be a positive number");
        setIsLoading(false);
        return;
      }

      const courseData = {
        code: formData.code.trim(),
        title: formData.title.trim(),
        room: formData.room.trim(),
        semester: formData.semester.trim(),
        academicYear: formData.academicYear.trim(),
        classNumber,
        section: formData.section.trim(),
        status: formData.status,
        facultyId: formData.facultyId || null,
        schedules,
      };

      let result;
      if (mode === "add") {
        result = await createCourse(courseData);
      } else if (course) {
        result = await editCourse(course.id, courseData);
      }

      if (result?.success) {
        toast.success(
          mode === "add"
            ? "Course created successfully"
            : "Course updated successfully"
        );
        setOpen(false);
        if (onSuccess) onSuccess();
        if (onClose) onClose();

        // Reset form if adding
        if (mode === "add") {
          setFormData({
            code: "",
            title: "",
            room: "",
            semester: "",
            academicYear: "",
            classNumber: "",
            section: "",
            status: CourseStatus.ACTIVE,
            facultyId: "",
          });
          setSchedules([]);
        }
      } else {
        toast.error(result?.error || "Failed to save course");
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

  const updateSchedule = (index: number, field: string, value: string) => {
    setSchedules((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const removeSchedule = (index: number) => {
    setSchedules((prev) => prev.filter((_, i) => i !== index));
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
      <SheetContent className="p-4 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {mode === "add" ? "Add New Course" : "Edit Course"}
          </SheetTitle>
          <SheetDescription>
            {mode === "add"
              ? "Fill in the details to create a new course"
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
              onChange={(e) => handleChange("code", e.target.value)}
              placeholder="e.g., CS101"
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
                onChange={(e) => handleChange("section", e.target.value)}
                placeholder="e.g., A"
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
                onChange={(e) => handleChange("room", e.target.value)}
                placeholder="e.g., A101"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="semester">
                Semester <span className="text-red-500">*</span>
              </Label>
              <Input
                id="semester"
                value={formData.semester}
                onChange={(e) => handleChange("semester", e.target.value)}
                placeholder="e.g., 1st Semester"
                required
              />
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
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="classNumber">
              Class Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="classNumber"
              type="number"
              min="1"
              value={formData.classNumber}
              onChange={(e) => handleChange("classNumber", e.target.value)}
              placeholder="e.g., 1"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="facultyId">Assigned Faculty</Label>
            <Select
              value={formData.facultyId || "none"}
              onValueChange={(value) =>
                handleChange("facultyId", value === "none" ? "" : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a faculty member">
                  {formData.facultyId && formData.facultyId !== "none"
                    ? faculties.find((f) => f.id === formData.facultyId)
                        ?.name || "Select a faculty member"
                    : "No faculty assigned"}
                </SelectValue>
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">
                    No faculty assigned
                  </span>
                </SelectItem>

                {faculties.length === 0 ? (
                  <SelectItem value="no-faculty" disabled>
                    <span className="text-muted-foreground">
                      No faculty members found
                    </span>
                  </SelectItem>
                ) : (
                  faculties.map((faculty) => (
                    <SelectItem key={faculty.id} value={faculty.id}>
                      {faculty.name} ({faculty.department})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
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

          <div className="space-y-2">
            <Label>
              Schedule <span className="text-red-500">*</span>
            </Label>

            {schedules.map((sched, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center border p-2 rounded-md"
              >
                {/* Day */}
                <Select
                  value={sched.day}
                  onValueChange={(value) => updateSchedule(index, "day", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Day" />
                  </SelectTrigger>
                  <SelectContent>
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <TimePicker
                  value={sched.fromTime}
                  onChange={(val) => updateSchedule(index, "fromTime", val)}
                />

                <TimePicker
                  value={sched.toTime}
                  onChange={(val) => updateSchedule(index, "toTime", val)}
                />
                {/* Remove */}
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="text-white"
                  onClick={() => removeSchedule(index)}
                >
                  ✕
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                setSchedules([
                  ...schedules,
                  { day: "", fromTime: "", toTime: "" },
                ])
              }
            >
              + Add Schedule
            </Button>
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-[#124A69] hover:bg-[#0D3A54] text-white"
            >
              {isLoading
                ? "Saving..."
                : mode === "add"
                ? "Create Course"
                : "Update Course"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
