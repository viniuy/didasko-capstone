"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/svdialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TimePicker } from "@/components/ui/time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Plus, Trash2, AlertCircle, ChevronLeft } from "lucide-react";
import toast from "react-hot-toast";
import {
  useCreateCourse,
  useImportCoursesWithSchedulesArray,
  useAssignSchedules,
} from "@/lib/hooks/queries";
import { useSession } from "next-auth/react";
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
  id?: string;
  slug?: string;
  code: string;
  title: string;
  section: string;
  room: string;
  semester: string;
  academicYear: string;
  classNumber: string | number;
  status: string;
  facultyId?: string;
  schedules?: Schedule[];
}

interface ScheduleAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: ImportedCourse[];
  onComplete: (importResults?: any) => void;
  mode: "create" | "edit" | "import";
  maxActiveCourses?: number;
  currentActiveCount?: number;
}

interface Schedule {
  day: string;
  fromTime: string;
  toTime: string;
}

// Helper function to expand short day names to full names
const expandDayName = (shortDay: string): string => {
  const dayMap: Record<string, string> = {
    Mon: "Monday",
    Tue: "Tuesday",
    Wed: "Wednesday",
    Thu: "Thursday",
    Fri: "Friday",
    Sat: "Saturday",
    Sun: "Sunday",
  };
  return dayMap[shortDay] || shortDay;
};

export function ScheduleAssignmentDialog({
  open,
  onOpenChange,
  courses,
  onComplete,
  mode,
  maxActiveCourses = 15,
  currentActiveCount = 0,
}: ScheduleAssignmentDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [allSchedules, setAllSchedules] = useState<Record<number, Schedule[]>>(
    {}
  );
  const [currentSchedules, setCurrentSchedules] = useState<Schedule[]>([
    { day: "", fromTime: "", toTime: "" },
  ]);
  const [isCanceling, setIsCanceling] = useState(false);

  // React Query mutations
  const { data: session } = useSession();
  const createCourseMutation = useCreateCourse();
  const importCoursesMutation = useImportCoursesWithSchedulesArray();
  const assignSchedulesMutation = useAssignSchedules();

  const currentCourse = courses[currentIndex];
  const progress = ((currentIndex + 1) / courses.length) * 100;

  const isSubmitting =
    createCourseMutation.isPending ||
    importCoursesMutation.isPending ||
    assignSchedulesMutation.isPending;

  // Initialize schedules based on mode
  useEffect(() => {
    if (open && currentCourse && mode === "edit" && currentCourse.schedules) {
      // For edit mode, populate existing schedules
      const existingSchedules = currentCourse.schedules.map((s) => ({
        day: expandDayName(s.day),
        fromTime: s.fromTime,
        toTime: s.toTime,
      }));
      setCurrentSchedules(
        existingSchedules.length > 0
          ? existingSchedules
          : [{ day: "", fromTime: "", toTime: "" }]
      );
    } else if (
      open &&
      currentCourse &&
      mode === "import" &&
      currentCourse.schedules
    ) {
      // For import mode, populate existing schedules if available
      const existingSchedules = currentCourse.schedules.map((s) => ({
        day: expandDayName(s.day),
        fromTime: s.fromTime,
        toTime: s.toTime,
      }));
      setCurrentSchedules(
        existingSchedules.length > 0
          ? existingSchedules
          : [{ day: "", fromTime: "", toTime: "" }]
      );
    } else if (open) {
      // For create mode, start fresh
      setCurrentSchedules([{ day: "", fromTime: "", toTime: "" }]);
    }
  }, [open, currentCourse, mode, currentIndex]);

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
    if (!time) return 0;

    const [t, period] = time.split(" ");
    let [h, m] = t.split(":").map(Number);

    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;

    return h * 60 + m;
  };

  const checkTimeOverlap = (
    schedule1: Schedule,
    schedule2: Schedule
  ): boolean => {
    if (schedule1.day !== schedule2.day) return false;

    const start1 = timeToMinutes(schedule1.fromTime);
    const end1 = timeToMinutes(schedule1.toTime);
    const start2 = timeToMinutes(schedule2.fromTime);
    const end2 = timeToMinutes(schedule2.toTime);

    return start1 < end2 && start2 < end1;
  };

  // Normalize day name for comparison (handles both full and short names)
  const normalizeDayName = (day: string): string => {
    const dayMap: Record<string, string> = {
      Mon: "Monday",
      Tue: "Tuesday",
      Wed: "Wednesday",
      Thu: "Thursday",
      Fri: "Friday",
      Sat: "Saturday",
      Sun: "Sunday",
      Monday: "Monday",
      Tuesday: "Tuesday",
      Wednesday: "Wednesday",
      Thursday: "Thursday",
      Friday: "Friday",
      Saturday: "Saturday",
      Sunday: "Sunday",
    };
    return dayMap[day] || day;
  };

  const validateCurrentSchedules = () => {
    // Use a single toast ID to prevent multiple toasts
    const toastId = "schedule-validation-error";

    const filledSchedules = currentSchedules.filter(
      (s) => s.day || s.fromTime || s.toTime
    );

    const completeSchedules = filledSchedules.filter(
      (s) => s.day && s.fromTime && s.toTime
    );

    if (completeSchedules.length === 0) {
      toast.error("At least one complete schedule is required to proceed", {
        id: toastId,
      });
      return false;
    }

    for (let i = 0; i < filledSchedules.length; i++) {
      const schedule = filledSchedules[i];
      const hasAnyField = schedule.day || schedule.fromTime || schedule.toTime;
      const hasAllFields = schedule.day && schedule.fromTime && schedule.toTime;

      if (hasAnyField && !hasAllFields) {
        toast.error(
          `Schedule ${
            i + 1
          }: Please complete all fields (day, start time, end time)`,
          { id: toastId }
        );
        return false;
      }
    }

    for (let i = 0; i < completeSchedules.length; i++) {
      const schedule = completeSchedules[i];
      const fromMinutes = timeToMinutes(schedule.fromTime);
      const toMinutes = timeToMinutes(schedule.toTime);

      // Validate time range: 7am (420 minutes) to 8pm (1200 minutes)
      const MIN_TIME = 7 * 60; // 7:00 AM
      const MAX_TIME = 20 * 60; // 8:00 PM

      if (fromMinutes < MIN_TIME || fromMinutes > MAX_TIME) {
        toast.error(
          `Schedule ${i + 1}: Start time must be between 7:00 AM and 8:00 PM`,
          { id: toastId }
        );
        return false;
      }

      if (toMinutes < MIN_TIME || toMinutes > MAX_TIME) {
        toast.error(
          `Schedule ${i + 1}: End time must be between 7:00 AM and 8:00 PM`,
          { id: toastId }
        );
        return false;
      }

      if (fromMinutes >= toMinutes) {
        toast.error(`Schedule ${i + 1}: End time must be after start time`, {
          id: toastId,
        });
        return false;
      }

      if (toMinutes - fromMinutes < 30) {
        toast.error(
          `Schedule ${i + 1}: Class duration must be at least 30 minutes`,
          { id: toastId }
        );
        return false;
      }
    }

    for (let i = 0; i < completeSchedules.length; i++) {
      for (let j = i + 1; j < completeSchedules.length; j++) {
        const schedule1 = completeSchedules[i];
        const schedule2 = completeSchedules[j];

        if (checkTimeOverlap(schedule1, schedule2)) {
          const dayLabel = DAYS.find((d) => d.value === schedule1.day)?.label;
          toast.error(
            `Schedules ${i + 1} and ${
              j + 1
            } overlap on ${dayLabel}. Please adjust the times.`,
            { id: toastId }
          );
          return false;
        }
      }
    }

    return true;
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      // Save current schedules before going back
      const validSchedules = currentSchedules.filter(
        (s) => s.day && s.fromTime && s.toTime
      );
      
      const updatedSchedules = {
        ...allSchedules,
        [currentIndex]: validSchedules.map((s) => ({
          day: s.day,
          fromTime: s.fromTime,
          toTime: s.toTime,
        })),
      };
      setAllSchedules(updatedSchedules);
      
      // Go to previous course
      setCurrentIndex(currentIndex - 1);
      // Restore schedules for previous course if they exist
      const previousSchedules = allSchedules[currentIndex - 1];
      setCurrentSchedules(
        previousSchedules && previousSchedules.length > 0
          ? previousSchedules
          : [{ day: "", fromTime: "", toTime: "" }]
      );
    }
  };

  const handleNext = () => {
    if (!validateCurrentSchedules()) {
      return;
    }

    const validSchedules = currentSchedules.filter(
      (s) => s.day && s.fromTime && s.toTime
    );

    const updatedSchedules = {
      ...allSchedules,
      [currentIndex]: validSchedules.map((s) => ({
        day: s.day,
        fromTime: s.fromTime,
        toTime: s.toTime,
      })),
    };
    setAllSchedules(updatedSchedules);

    if (currentIndex < courses.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setCurrentSchedules([{ day: "", fromTime: "", toTime: "" }]);
    } else {
      // Close modal immediately before starting the operation
      onOpenChange(false);

      // Show loading toast based on mode
      let loadingToast;
      if (mode === "edit") {
        loadingToast = toast.loading("Updating schedules...");
      } else if (mode === "import") {
        loadingToast = toast.loading("Creating courses...");
      } else {
        loadingToast = toast.loading("Creating course...");
      }

      // Then handle completion with loading toast
      handleComplete(updatedSchedules, loadingToast);
    }
  };

  const handleCancel = () => {
    let confirmMessage = "";

    if (mode === "create") {
      confirmMessage =
        "Are you sure? The course will NOT be created without schedules.";
    } else if (mode === "edit") {
      confirmMessage = "Are you sure? Schedule changes will not be saved.";
    } else if (mode === "import") {
      confirmMessage =
        "Are you sure? Canceling will discard all imported courses.";
    }

    if (confirm(confirmMessage)) {
      setIsCanceling(true);
      setCurrentIndex(0);
      setAllSchedules({});
      setCurrentSchedules([{ day: "", fromTime: "", toTime: "" }]);

      if (mode === "create") {
        toast.error("Course creation canceled. No course was created.");
      } else if (mode === "import") {
        toast.error("Import canceled. No courses were created.");
      } else {
        toast("Schedule editing canceled");
      }

      // Close dialog without calling onComplete
      onOpenChange(false);
      setIsCanceling(false);
    }
  };

  const handleComplete = async (
    schedules: Record<number, Schedule[]>,
    loadingToast?: string
  ) => {
    try {
      if (mode === "create") {
        // Check if limit is reached before creating
        if (currentActiveCount >= maxActiveCourses) {
          if (loadingToast) toast.dismiss(loadingToast);
          toast.error(
            `Maximum limit of ${maxActiveCourses} active courses reached. Please archive some courses before adding new ones.`
          );
          return;
        }

        // Create mode: Create course WITH schedules in one transaction
        const courseData = currentCourse;
        const schedulesToAdd = schedules[0] || [];

        // Use provided loading toast or create new one
        const toastId = loadingToast || toast.loading("Creating course...");

        try {
          await createCourseMutation.mutateAsync({
            ...courseData,
            schedules: schedulesToAdd.map((s) => ({
              day: s.day.slice(0, 3), // Convert to short form
              fromTime: s.fromTime,
              toTime: s.toTime,
            })),
          } as any);

          // Dismiss loading toast (success toast is handled by the mutation)
          toast.dismiss(toastId);
        } catch (error) {
          // Dismiss loading toast on error (error toast is handled by the mutation)
          toast.dismiss(toastId);
          throw error;
        }
      } else if (mode === "import") {
        // Check if limit is reached before importing
        const coursesToImport = courses.filter(
          (c) => c.status === "ACTIVE" || c.status === "INACTIVE" || !c.status
        );
        const remainingSlots = maxActiveCourses - currentActiveCount;

        if (coursesToImport.length > remainingSlots) {
          if (loadingToast) toast.dismiss(loadingToast);
          toast.error(
            `Cannot import ${coursesToImport.length} course(s). You can only add ${remainingSlots} more active course(s) (maximum ${maxActiveCourses} active courses allowed).`
          );
          return;
        }
        // Import mode: Create courses with schedules
        const coursesWithSchedules = courses.map((course, index) => ({
          code: course.code,
          title: course.title,
          section: course.section,
          room: course.room,
          semester: course.semester,
          academicYear: course.academicYear,
          classNumber: course.classNumber,
          status: course.status,
          facultyId: course.facultyId,
          schedules: (schedules[index] || []).map((s) => ({
            day: s.day.slice(0, 3), // Convert to short form
            fromTime: s.fromTime,
            toTime: s.toTime,
          })),
        }));

        // Use provided loading toast or create new one
        const toastId = loadingToast || toast.loading("Creating courses...");

        try {
          const response = await importCoursesMutation.mutateAsync(
            coursesWithSchedules
          );

          // Dismiss loading toast (success toast is handled by the mutation)
          toast.dismiss(toastId);

          // Close dialog immediately after import
          onOpenChange(false);

          // Process import results
          if (response?.results) {
            const results = response.results;
            // Pass results to onComplete callback
            if (!isCanceling) {
              onComplete(results);
            }
          } else {
            // If no results, still call onComplete
            if (!isCanceling) {
              onComplete(null);
            }
          }
        } catch (error) {
          // Dismiss loading toast on error (error toast is handled by the mutation)
          toast.dismiss(toastId);
          throw error;
        }
      } else if (mode === "edit") {
        // Edit mode: Update schedules for existing course
        const courseSlug = currentCourse.slug;
        if (!courseSlug) {
          if (loadingToast) toast.dismiss(loadingToast);
          throw new Error("Course slug is missing");
        }

        const schedulesToUpdate = schedules[0] || [];

        // Use provided loading toast or create new one
        const toastId = loadingToast || toast.loading("Updating schedules...");

        try {
          await assignSchedulesMutation.mutateAsync({
            courseSlug,
            schedules: schedulesToUpdate.map((s) => ({
              day: s.day.slice(0, 3), // Convert to short form
              fromTime: s.fromTime,
              toTime: s.toTime,
            })),
          });

          // Dismiss loading toast (success toast is handled by the mutation)
          toast.dismiss(toastId);
          // Close dialog for edit mode
          onOpenChange(false);
        } catch (error) {
          // Dismiss loading toast on error (error toast is handled by the mutation)
          toast.dismiss(toastId);
          throw error;
        }
      }

      // Only call onComplete if we're not canceling
      if (!isCanceling) {
        // For create and edit modes, call onComplete without results
        if (mode === "create" || mode === "edit") {
          onComplete();
        }
      }
      setCurrentIndex(0);
      setAllSchedules({});
      setCurrentSchedules([{ day: "", fromTime: "", toTime: "" }]);
    } catch (error: any) {
      // Error is already handled by the mutations
      console.error("Error handling schedules:", error);
    }
  };

  if (!currentCourse) return null;

  const getDialogTitle = () => {
    if (mode === "create") return "Add Schedules to New Course";
    if (mode === "edit") return "Edit Course Schedules";
    return "Add Required Schedules";
  };

  const getDialogDescription = () => {
    if (mode === "create") {
      return "Add at least one schedule to complete course creation.";
    }
    if (mode === "edit") {
      return "Update the course schedules below.";
    }
    return "Each course must have at least one schedule before it can be created.";
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) {
          handleCancel();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] w-[70vh] max-w-[70vh] overflow-y-auto overflow-x-hidden min-w-0">
        <div className="w-full min-w-0 max-w-full">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <DialogTitle className="text-xl font-semibold text-[#124A69] truncate flex-1 min-w-0">
                {getDialogTitle()}
              </DialogTitle>
              {mode === "import" && (
                <Badge className="bg-[#124A69] text-white px-3 py-1 flex-shrink-0">
                  {currentIndex + 1} of {courses.length}
                </Badge>
              )}
            </div>
            <DialogDescription className="flex items-start gap-2 text-base min-w-0">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <span className="min-w-0 break-words">
                <strong>Schedules are required!</strong>{" "}
                {getDialogDescription()}
              </span>
            </DialogDescription>
          </DialogHeader>

          {/* Progress Bar (only for import mode) */}
          {mode === "import" && (
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
              <div
                className="bg-[#124A69] h-2.5 rounded-full transition-all duration-300 ease-in-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Current Course Info */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-[#124A69] rounded-lg p-5 mb-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="bg-[#124A69] rounded-lg p-3">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3
                  className="font-bold text-lg text-gray-900 truncate"
                  title={`${currentCourse.code} - ${currentCourse.section}`}
                >
                  {currentCourse.code} - {currentCourse.section}
                </h3>
                <p
                  className="text-sm text-gray-700 mt-1 truncate"
                  title={currentCourse.title}
                >
                  {currentCourse.title}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge
                    variant="secondary"
                    className="text-xs truncate max-w-full"
                    title={`Room: ${currentCourse.room}`}
                  >
                    Room: {currentCourse.room}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Schedule Form */}
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <Label className="text-base font-semibold text-gray-900 flex-shrink-0">
                Class Schedules <span className="text-red-500">*</span>
              </Label>
              <div className="flex items-center gap-1 text-xs text-gray-500 min-w-0 flex-1 justify-end">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                <span
                  className="truncate"
                  title="Schedules cannot overlap on the same day"
                >
                  Schedules cannot overlap on the same day
                </span>
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
                        disabled={isSubmitting}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0">
                    <div className="space-y-2 min-w-0">
                      <Label className="text-xs font-medium text-gray-600">
                        Day of the Week
                      </Label>
                      <Select
                        value={schedule.day}
                        onValueChange={(value) =>
                          updateSchedule(index, "day", value)
                        }
                        disabled={isSubmitting}
                      >
                        <SelectTrigger
                          className={cn(
                            "w-full min-w-0",
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

                    <div className="space-y-2 min-w-0">
                      <Label className="text-xs font-medium text-gray-600">
                        Start Time
                      </Label>
                      <TimePicker
                        value={schedule.fromTime}
                        onChange={(val) =>
                          updateSchedule(index, "fromTime", val)
                        }
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="space-y-2 min-w-0">
                      <Label className="text-xs font-medium text-gray-600">
                        End Time
                      </Label>
                      <TimePicker
                        value={schedule.toTime}
                        onChange={(val) => updateSchedule(index, "toTime", val)}
                        disabled={isSubmitting}
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
              disabled={isSubmitting}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Schedule Slot
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between gap-3 mt-8 pt-4 border-t min-w-0">
            <div className="flex gap-3">
              {/* Back Button - only show for import mode when not on first course */}
              {mode === "import" && currentIndex > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 flex-shrink-0 min-w-0 truncate"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
            </div>
            <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="px-6 text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0 min-w-0 truncate"
              title={mode === "edit" ? "Cancel" : "Cancel Creation"}
            >
              {mode === "edit" ? "Cancel" : "Cancel Creation"}
            </Button>

            <Button
              className="bg-[#124A69] hover:bg-[#0D3A54] text-white px-8 flex-shrink-0 min-w-0 truncate"
              onClick={handleNext}
              disabled={isSubmitting}
              title={
                isSubmitting
                  ? mode === "edit"
                    ? "Updating..."
                    : "Creating..."
                  : mode === "import" && currentIndex < courses.length - 1
                  ? "Next Course →"
                  : mode === "edit"
                  ? "Update Schedules"
                  : "Create Course"
              }
            >
              {isSubmitting
                ? mode === "edit"
                  ? "Updating..."
                  : "Creating..."
                : mode === "import" && currentIndex < courses.length - 1
                ? "Next Course →"
                : mode === "edit"
                ? "Update Schedules"
                : "Create Course"}
            </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
