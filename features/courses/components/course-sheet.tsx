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
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { createCourse, editCourse } from "@/lib/actions/courses";
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
  onSuccess?: () => void;
  onClose?: () => void;
  faculties: Faculty[];
  userId: string;
  userRole: UserRole;
}

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function CourseSheet({
  mode,
  course,
  onSuccess,
  onClose,
  faculties,
  userId,
  userRole,
}: CourseSheetProps) {
  const [open, setOpen] = useState(mode === "edit");
  const [schedules, setSchedules] = useState<
    { day: string; fromTime: string; toTime: string }[]
  >(course?.schedules || []);
  const [scheduleErrors, setScheduleErrors] = useState<string[]>([]);
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

  useEffect(() => {
    if (mode === "edit") {
      setOpen(true);
    }
  }, [mode]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Validate time range
  const validateTimeRange = (
    fromTime: string,
    toTime: string
  ): string | null => {
    if (!fromTime || !toTime) return "Both start and end times are required";

    const [fromHour, fromMin] = fromTime.split(":").map(Number);
    const [toHour, toMin] = toTime.split(":").map(Number);

    const fromMinutes = fromHour * 60 + fromMin;
    const toMinutes = toHour * 60 + toMin;

    if (fromMinutes >= toMinutes) {
      return "End time must be after start time";
    }

    // Check for reasonable class duration (at least 30 minutes, max 8 hours)
    const duration = toMinutes - fromMinutes;
    if (duration < 30) {
      return "Class must be at least 30 minutes long";
    }
    if (duration > 480) {
      return "Class cannot exceed 8 hours";
    }

    return null;
  };

  // Validate all schedules
  const validateSchedules = () => {
    const errors: string[] = [];

    if (schedules.length === 0) {
      toast.error("Please add at least one schedule");
      return false;
    }

    for (let i = 0; i < schedules.length; i++) {
      const schedule = schedules[i];

      if (!schedule.day) {
        errors[i] = "Please select a day";
        continue;
      }

      const timeError = validateTimeRange(schedule.fromTime, schedule.toTime);
      if (timeError) {
        errors[i] = timeError;
      }
    }

    setScheduleErrors(errors);

    if (errors.length > 0) {
      toast.error("Please fix schedule errors before submitting");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
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

    // Validate schedules
    if (!validateSchedules()) {
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
        schedules: schedules.map((s) => ({
          day: s.day.slice(0, 3), // Store as "Mon", "Tue", etc.
          fromTime: s.fromTime,
          toTime: s.toTime,
        })),
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
            semester: "1st Semester",
            academicYear: "",
            classNumber: "1",
            section: "",
            status: CourseStatus.ACTIVE,
          });
          setSchedules([]);
          setScheduleErrors([]);
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

    // Clear error for this schedule when user makes changes
    if (scheduleErrors[index]) {
      setScheduleErrors((prev) => {
        const newErrors = [...prev];
        newErrors[index] = "";
        return newErrors;
      });
    }
  };

  const removeSchedule = (index: number) => {
    setSchedules((prev) => prev.filter((_, i) => i !== index));
    setScheduleErrors((prev) => prev.filter((_, i) => i !== index));
  };

  const addSchedule = () => {
    setSchedules([...schedules, { day: "", fromTime: "", toTime: "" }]);
    setScheduleErrors([...scheduleErrors, ""]);
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
              ? "Fill in the details to create a new course."
              : "Update the course information"}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          {/* Course Code and Title */}
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

          {/* Section and Room */}
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

          {/* Semester and Academic Year */}
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

          {/* Class Number and Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="classNumber">
                Class Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="classNumber"
                type="number"
                min="1"
                max="99"
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

          {/* Schedule Section */}
          <div className="space-y-3">
            <Label>
              Schedule <span className="text-red-500">*</span>
            </Label>

            <div className="space-y-2">
              {schedules.map((sched, index) => (
                <div key={index} className="space-y-2">
                  <div className="grid grid-cols-[1.2fr_1fr_1fr_auto] gap-2 items-start">
                    {/* Day */}
                    <Select
                      value={sched.day}
                      onValueChange={(value) =>
                        updateSchedule(index, "day", value)
                      }
                    >
                      <SelectTrigger
                        className={
                          scheduleErrors[index] && !sched.day
                            ? "border-red-500"
                            : ""
                        }
                      >
                        <SelectValue placeholder="Day" />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS.map((day) => (
                          <SelectItem key={day} value={day}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Start Time */}
                    <TimePicker
                      value={sched.fromTime}
                      onChange={(val) => updateSchedule(index, "fromTime", val)}
                    />

                    {/* End Time */}
                    <TimePicker
                      value={sched.toTime}
                      onChange={(val) => updateSchedule(index, "toTime", val)}
                    />

                    {/* Remove Button */}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => removeSchedule(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Error message for this schedule */}
                  {scheduleErrors[index] && (
                    <p className="text-xs text-red-500 ml-1">
                      {scheduleErrors[index]}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={addSchedule}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Schedule
            </Button>
          </div>

          {/* Action Buttons */}
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
