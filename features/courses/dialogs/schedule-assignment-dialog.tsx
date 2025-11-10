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
import { Calendar, Plus, Trash2, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "@/lib/axios";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
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

export function ScheduleAssignmentDialog({
  open,
  onOpenChange,
  courses,
  onComplete,
}: ScheduleAssignmentDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [allSchedules, setAllSchedules] = useState<Record<string, any[]>>({});
  const [currentSchedules, setCurrentSchedules] = useState([
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

  const validateCurrentSchedules = () => {
    // At least one schedule must be filled
    const hasValidSchedule = currentSchedules.some(
      (s) => s.day && s.fromTime && s.toTime
    );

    if (!hasValidSchedule) {
      toast.error("Please add at least one complete schedule");
      return false;
    }

    // Check if all filled schedules are complete
    for (const schedule of currentSchedules) {
      const hasAnyField = schedule.day || schedule.fromTime || schedule.toTime;
      const hasAllFields = schedule.day && schedule.fromTime && schedule.toTime;

      if (hasAnyField && !hasAllFields) {
        toast.error("Please complete all fields for each schedule");
        return false;
      }

      // Validate time range
      if (hasAllFields) {
        const [fromHour, fromMin] = schedule.fromTime.split(":").map(Number);
        const [toHour, toMin] = schedule.toTime.split(":").map(Number);
        const fromMinutes = fromHour * 60 + fromMin;
        const toMinutes = toHour * 60 + toMin;

        if (fromMinutes >= toMinutes) {
          toast.error("End time must be after start time");
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
        day: s.day.slice(0, 3), // Store as "Mon", "Tue", etc.
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold text-[#124A69]">
              Add Schedules
            </DialogTitle>
            <Badge className="bg-[#124A69] text-white">
              {currentIndex + 1} of {courses.length}
            </Badge>
          </div>
          <DialogDescription>
            <CheckCircle className="inline h-4 w-4 text-green-600 mr-1" />
            Successfully imported courses! Now let's add schedules for each
            course.
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div
            className="bg-[#124A69] h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Current Course Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-[#124A69] flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-gray-900">
                {currentCourse.code} - {currentCourse.section}
              </h3>
              <p className="text-sm text-gray-600">{currentCourse.title}</p>
              <p className="text-xs text-gray-500 mt-1">
                Room: {currentCourse.room}
              </p>
            </div>
          </div>
        </div>

        {/* Schedule Form */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">
            Schedule <span className="text-red-500">*</span>
          </Label>

          {currentSchedules.map((schedule, index) => (
            <div key={index} className="space-y-2">
              <div className="grid grid-cols-[1.5fr_1fr_1fr_auto] gap-2 items-end">
                {/* Day */}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Day</Label>
                  <Select
                    value={schedule.day}
                    onValueChange={(value) =>
                      updateSchedule(index, "day", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS.map((day) => (
                        <SelectItem key={day} value={day}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Start Time */}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Start</Label>
                  <Input
                    type="time"
                    value={schedule.fromTime}
                    onChange={(e) =>
                      updateSchedule(index, "fromTime", e.target.value)
                    }
                  />
                </div>

                {/* End Time */}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">End</Label>
                  <Input
                    type="time"
                    value={schedule.toTime}
                    onChange={(e) =>
                      updateSchedule(index, "toTime", e.target.value)
                    }
                  />
                </div>

                {/* Remove Button */}
                {currentSchedules.length > 1 && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => removeSchedule(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={addSchedule}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Another Schedule
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between gap-3 mt-6">
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={isSubmitting}
          >
            Skip This Course
          </Button>

          <Button
            className="bg-[#124A69] hover:bg-[#0D3A54] text-white"
            onClick={handleNext}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Saving..."
              : currentIndex < courses.length - 1
              ? "Next Course"
              : "Finish"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
