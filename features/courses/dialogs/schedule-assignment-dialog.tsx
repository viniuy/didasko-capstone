"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/svdialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Plus, Trash2, CheckCircle, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "@/lib/axios";
import { cn } from "@/lib/utils";

const DAYS = [
  { value: "Monday", label: "Monday", short: "Mon" },
  { value: "Tuesday", label: "Tuesday", short: "Tue" },
  { value: "Wednesday", label: "Wednesday", short: "Wed" },
  { value: "Thursday", label: "Thursday", short: "Thu" },
  { value: "Friday", label: "Friday", short: "Fri" },
  { value: "Saturday", label: "Saturday", short: "Sat" },
];

interface ImportedCourse {
  id: string;
  code: string;
  title: string;
  section: string;
  room: string;
}

interface ScheduleAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: ImportedCourse[];
  onComplete: () => void;
}

interface Schedule {
  day: string;
  fromTime: string;
  toTime: string;
}

export function ScheduleAssignmentDialog({
  open,
  onOpenChange,
  courses,
  onComplete,
}: ScheduleAssignmentDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [allSchedules, setAllSchedules] = useState<Record<string, any[]>>({});
  const [currentSchedules, setCurrentSchedules] = useState<Schedule[]>([
    { day: "", fromTime: "", toTime: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentCourse = courses[currentIndex];
  const progress = ((currentIndex + 1) / courses.length) * 100;

  const addSchedule = () => {
    setCurrentSchedules([
      ...currentSchedules,
      { day: "", fromTime: "", toTime: "" },
    ]);
  };

  const removeSchedule = (index: number) => {
    if (currentSchedules.length > 1) {
      setCurrentSchedules(currentSchedules.filter((_, i) => i !== index));
    }
  };

  const updateSchedule = (index: number, field: string, value: string) => {
    setCurrentSchedules((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const checkTimeOverlap = (
    schedule1: Schedule,
    schedule2: Schedule
  ): boolean => {
    // Different days = no overlap
    if (schedule1.day !== schedule2.day) return false;

    const start1 = timeToMinutes(schedule1.fromTime);
    const end1 = timeToMinutes(schedule1.toTime);
    const start2 = timeToMinutes(schedule2.fromTime);
    const end2 = timeToMinutes(schedule2.toTime);

    // Check if times overlap
    return start1 < end2 && start2 < end1;
  };

  const validateCurrentSchedules = () => {
    // Filter out completely empty schedules
    const filledSchedules = currentSchedules.filter(
      (s) => s.day || s.fromTime || s.toTime
    );

    // At least one schedule must be completely filled
    const completeSchedules = filledSchedules.filter(
      (s) => s.day && s.fromTime && s.toTime
    );

    if (completeSchedules.length === 0) {
      toast.error("Please add at least one complete schedule");
      return false;
    }

    // Check if all filled schedules are complete
    for (let i = 0; i < filledSchedules.length; i++) {
      const schedule = filledSchedules[i];
      const hasAnyField = schedule.day || schedule.fromTime || schedule.toTime;
      const hasAllFields = schedule.day && schedule.fromTime && schedule.toTime;

      if (hasAnyField && !hasAllFields) {
        toast.error(
          `Schedule ${i + 1}: Please complete all fields (day, start time, end time)`
        );
        return false;
      }
    }

    // Validate time ranges
    for (let i = 0; i < completeSchedules.length; i++) {
      const schedule = completeSchedules[i];
      const fromMinutes = timeToMinutes(schedule.fromTime);
      const toMinutes = timeToMinutes(schedule.toTime);

      if (fromMinutes >= toMinutes) {
        toast.error(
          `Schedule ${i + 1}: End time must be after start time`
        );
        return false;
      }

      // Check minimum duration (e.g., 30 minutes)
      if (toMinutes - fromMinutes < 30) {
        toast.error(
          `Schedule ${i + 1}: Class duration must be at least 30 minutes`
        );
        return false;
      }
    }

    // Check for duplicate/overlapping schedules
    for (let i = 0; i < completeSchedules.length; i++) {
      for (let j = i + 1; j < completeSchedules.length; j++) {
        const schedule1 = completeSchedules[i];
        const schedule2 = completeSchedules[j];

        if (checkTimeOverlap(schedule1, schedule2)) {
          const dayLabel = DAYS.find((d) => d.value === schedule1.day)?.label;
          toast.error(
            `Schedules ${i + 1} and ${j + 1} overlap on ${dayLabel}. Please adjust the times.`
          );
          return false;
        }
      }
    }

    return true;
  };

  const handleNext = () => {
    if (!validateCurrentSchedules()) {
      return;
    }

    // Filter out empty schedules
    const validSchedules = currentSchedules.filter(
      (s) => s.day && s.fromTime && s.toTime
    );

    // Save current course schedules
    const updatedSchedules = {
      ...allSchedules,
      [currentCourse.id]: validSchedules.map((s) => ({
        day: DAYS.find((d) => d.value === s.day)?.short || s.day.slice(0, 3),
        fromTime: s.fromTime,
        toTime: s.toTime,
      })),
    };
    setAllSchedules(updatedSchedules);

    if (currentIndex < courses.length - 1) {
      // Move to next course
      setCurrentIndex(currentIndex + 1);
      setCurrentSchedules([{ day: "", fromTime: "", toTime: "" }]);
    } else {
      // All done - submit to backend
      handleComplete(updatedSchedules);
    }
  };

  const handleSkip = () => {
    if (currentIndex < courses.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setCurrentSchedules([{ day: "", fromTime: "", toTime: "" }]);
    } else {
      // Submit whatever we have
      handleComplete(allSchedules);
    }
  };

  const handleComplete = async (schedules: Record<string, any[]>) => {
    setIsSubmitting(true);

    try {
      // Format data for API
      const coursesSchedules = Object.entries(schedules).map(
        ([courseId, scheduleList]) => ({
          courseId,
          schedules: scheduleList,
        })
      );

      const response = await axiosInstance.post("/courses/assign-schedules", {
        coursesSchedules,
      });

      if (response.data.results) {
        const { success, failed } = response.data.results;
        if (failed > 0) {
          toast.error(
            `${success} schedules assigned, ${failed} failed. Check console for details.`
          );
          console.error("Schedule errors:", response.data.results.errors);
        } else {
          toast.success(
            `Successfully assigned schedules to ${success} courses!`
          );
        }
      } else {
        toast.success("Schedules assigned successfully!");
      }

      onComplete();
      onOpenChange(false);

      // Reset state
      setCurrentIndex(0);
      setAllSchedules({});
      setCurrentSchedules([{ day: "", fromTime: "", toTime: "" }]);
    } catch (error: any) {
      console.error("Error assigning schedules:", error);
      toast.error(error?.response?.data?.error || "Failed to assign schedules");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentCourse) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} >
      <DialogContent className="max-h-[90vh] w-[60vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold text-[#124A69]">
              Add Schedules for Imported Courses
            </DialogTitle>
            <Badge className="bg-[#124A69] text-white px-3 py-1">
              {currentIndex + 1} of {courses.length}
            </Badge>
          </div>
          <DialogDescription className="flex items-center gap-2 text-base">
            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
            <span>
              Successfully imported courses! Now let's add schedules for each
              course.
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
          <div
            className="bg-[#124A69] h-2.5 rounded-full transition-all duration-300 ease-in-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Current Course Info */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-[#124A69] rounded-lg p-5 mb-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="bg-[#124A69] rounded-lg p-3">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-gray-900">
                {currentCourse.code} - {currentCourse.section}
              </h3>
              <p className="text-sm text-gray-700 mt-1">
                {currentCourse.title}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="text-xs">
                  Room: {currentCourse.room}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Schedule Form */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold text-gray-900">
              Class Schedules <span className="text-red-500">*</span>
            </Label>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Schedules cannot overlap on the same day</span>
            </div>
          </div>

          <div className="space-y-4">
            {currentSchedules.map((schedule, index) => (
              <div
                key={index}
                className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:border-[#124A69] transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-medium text-gray-700">
                    Schedule {index + 1}
                  </Label>
                  {currentSchedules.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7"
                      onClick={() => removeSchedule(index)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Day Selector */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">
                      Day of the Week
                    </Label>
                    <Select
                      value={schedule.day}
                      onValueChange={(value) =>
                        updateSchedule(index, "day", value)
                      }
                    >
                      <SelectTrigger
                        className={cn(
                          "w-full",
                          schedule.day && "border-[#124A69] bg-blue-50"
                        )}
                      >
                        <SelectValue placeholder="Choose day" />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS.map((day) => (
                          <SelectItem key={day.value} value={day.value}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Start Time */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">
                      Start Time
                    </Label>
                    <Input
                      type="time"
                      value={schedule.fromTime}
                      onChange={(e) =>
                        updateSchedule(index, "fromTime", e.target.value)
                      }
                      className={cn(
                        "w-full",
                        schedule.fromTime && "border-[#124A69] bg-blue-50"
                      )}
                    />
                  </div>

                  {/* End Time */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">
                      End Time
                    </Label>
                    <Input
                      type="time"
                      value={schedule.toTime}
                      onChange={(e) =>
                        updateSchedule(index, "toTime", e.target.value)
                      }
                      className={cn(
                        "w-full",
                        schedule.toTime && "border-[#124A69] bg-blue-50"
                      )}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full border-dashed border-2 hover:border-[#124A69] hover:bg-blue-50"
            onClick={addSchedule}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Another Schedule Slot
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between gap-3 mt-8 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="px-6"
          >
            Skip This Course
          </Button>

          <Button
            className="bg-[#124A69] hover:bg-[#0D3A54] text-white px-8"
            onClick={handleNext}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Saving..."
              : currentIndex < courses.length - 1
              ? "Next Course →"
              : "Finish & Save All"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}