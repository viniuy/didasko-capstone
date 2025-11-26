import React, { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Archive,
  ArchiveRestore,
  Settings2,
  History,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useArchivedCourses, useCourses } from "@/lib/hooks/queries/useCourses";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/hooks/queries/queryKeys";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const MAX_ACTIVE_COURSES = 15;

interface Course {
  id: string;
  code: string;
  title: string;
  section: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  semester: string;
  academicYear: string;
  facultyId: string | null;
  slug?: string; // Add slug for navigation
}

interface Faculty {
  id: string;
  name: string;
  email: string;
  department?: string;
}

interface CourseSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: Course[];
  onArchiveCourses: (courseIds: string[]) => Promise<void>;
  onUnarchiveCourses: (courseIds: string[]) => Promise<void>;
  userId: string;
  userRole: string;
  faculties?: Faculty[]; // For academic head to select faculty
}

export function CourseSettingsDialog({
  open,
  onOpenChange,
  courses,
  onArchiveCourses,
  onUnarchiveCourses,
  userId,
  userRole,
  faculties = [],
}: CourseSettingsDialogProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigatingToCourse, setNavigatingToCourse] = useState<string | null>(
    null
  );
  const [selectedActive, setSelectedActive] = useState<Set<string>>(new Set());
  const [selectedArchived, setSelectedArchived] = useState<Set<string>>(
    new Set()
  );
  const [searchActive, setSearchActive] = useState("");
  const [searchArchived, setSearchArchived] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>(userId);

  // Check if user is academic head
  const isAcademicHead = userRole === "ACADEMIC_HEAD";

  // Determine which faculty's courses to view
  // For academic head: use selectedFacultyId, otherwise use userId
  const viewingFacultyId = isAcademicHead ? selectedFacultyId : userId;
  const isViewingOwnCourses = viewingFacultyId === userId;

  // Fetch active courses independently (only when dialog is open)
  const {
    data: activeCoursesData,
    isLoading: isLoadingActive,
    refetch: refetchActive,
  } = useCourses(
    open
      ? {
          facultyId: viewingFacultyId,
          status: undefined, // Get ACTIVE and INACTIVE (excludes ARCHIVED by default)
        }
      : undefined
  );

  // Fetch archived courses independently (only when dialog is open)
  const {
    data: archivedCoursesData = [],
    isLoading: isLoadingArchived,
    refetch: refetchArchived,
  } = useArchivedCourses(
    open
      ? {
          facultyId: viewingFacultyId,
          search: searchArchived || undefined,
        }
      : undefined
  );

  // Use fetched active courses when dialog is open, otherwise fall back to prop
  const activeCoursesFromQuery = activeCoursesData?.courses || [];
  // When dialog is open, prefer fetched data (even if empty) to ensure fresh data
  // When dialog is closed, use the prop to avoid unnecessary queries
  const coursesToUse =
    open && activeCoursesData !== undefined ? activeCoursesFromQuery : courses;

  // Reset faculty selection when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedFacultyId(userId);
      setSelectedActive(new Set());
      setSelectedArchived(new Set());
    }
  }, [open, userId]);

  // Refetch both active and archived courses when dialog opens or faculty selection changes
  useEffect(() => {
    if (open) {
      // Refetch active courses
      refetchActive();
      // Refetch archived courses
      refetchArchived();
    }
  }, [open, viewingFacultyId, refetchActive, refetchArchived]);

  // Calculate current active courses count for the viewing faculty
  const currentActiveCount = useMemo(() => {
    return coursesToUse.filter(
      (c) =>
        c.facultyId === viewingFacultyId &&
        (c.status === "ACTIVE" || c.status === "INACTIVE")
    ).length;
  }, [coursesToUse, viewingFacultyId]);

  // Calculate remaining slots that can be activated
  const remainingSlots = MAX_ACTIVE_COURSES - currentActiveCount;
  const canActivateMore = remainingSlots > 0;

  // Filter active courses - show courses for the viewing faculty with ACTIVE or INACTIVE status
  const activeCourses = useMemo(() => {
    return coursesToUse.filter(
      (c) =>
        c.facultyId === viewingFacultyId && // Courses for the viewing faculty
        c.status !== "ARCHIVED" && // Explicitly exclude ARCHIVED (safety check)
        (c.status === "ACTIVE" || c.status === "INACTIVE") &&
        (c.code.toLowerCase().includes(searchActive.toLowerCase()) ||
          c.title.toLowerCase().includes(searchActive.toLowerCase()) ||
          c.section.toLowerCase().includes(searchActive.toLowerCase()))
    );
  }, [coursesToUse, searchActive, viewingFacultyId]);

  // Use fetched archived courses - explicitly filter to only ARCHIVED status
  const archivedCourses = useMemo(() => {
    return archivedCoursesData.filter(
      (c) =>
        c.facultyId === viewingFacultyId && // Courses for the viewing faculty
        c.status === "ARCHIVED" && // Explicitly only show ARCHIVED (safety check against stale cache)
        (c.code.toLowerCase().includes(searchArchived.toLowerCase()) ||
          c.title.toLowerCase().includes(searchArchived.toLowerCase()) ||
          c.section.toLowerCase().includes(searchArchived.toLowerCase()))
    );
  }, [archivedCoursesData, searchArchived, viewingFacultyId]);

  // Selection toggling
  const toggleActiveSelection = (courseId: string) => {
    const newSelected = new Set(selectedActive);
    newSelected.has(courseId)
      ? newSelected.delete(courseId)
      : newSelected.add(courseId);
    setSelectedActive(newSelected);
  };

  const toggleArchivedSelection = (courseId: string) => {
    // If limit is reached and trying to add a new selection, prevent it
    if (!selectedArchived.has(courseId) && !canActivateMore) {
      toast.error(
        `Maximum limit of ${MAX_ACTIVE_COURSES} active courses reached. Please archive some courses before unarchiving new ones.`
      );
      return;
    }

    const newSelected = new Set(selectedArchived);
    newSelected.has(courseId)
      ? newSelected.delete(courseId)
      : newSelected.add(courseId);

    // Check if the new selection would exceed the limit
    if (newSelected.size > remainingSlots) {
      toast.error(
        `Cannot select ${newSelected.size} course(s). You can only activate ${remainingSlots} more course(s) (maximum ${MAX_ACTIVE_COURSES} active courses allowed).`
      );
      return;
    }

    setSelectedArchived(newSelected);
  };

  // Select/Deselect all
  const selectAllActive = () =>
    setSelectedActive(new Set(activeCourses.map((c) => c.id)));
  const deselectAllActive = () => setSelectedActive(new Set());
  const selectAllArchived = () => {
    if (!canActivateMore) {
      toast.error(
        `Maximum limit of ${MAX_ACTIVE_COURSES} active courses reached. Please archive some courses before unarchiving new ones.`
      );
      return;
    }
    // Only select up to the remaining slots
    const selectableCourses = archivedCourses.slice(0, remainingSlots);
    setSelectedArchived(new Set(selectableCourses.map((c) => c.id)));
  };
  const deselectAllArchived = () => setSelectedArchived(new Set());

  // Handle archive
  const handleArchive = async () => {
    if (selectedActive.size === 0) {
      toast.error("Please select at least one course to archive");
      return;
    }
    setConfirmOpen(true);
  };

  // Handle confirmed archive
  const confirmArchive = async () => {
    setConfirmOpen(false);
    setIsProcessing(true);
    try {
      await onArchiveCourses(Array.from(selectedActive));
      setSelectedActive(new Set());

      // Refetch archived courses to update the list
      queryClient.invalidateQueries({
        queryKey: queryKeys.courses.archived({
          facultyId: userId,
          search: searchArchived || undefined,
        }),
      });
      await refetchArchived();
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle unarchive
  const handleUnarchive = async () => {
    if (selectedArchived.size === 0) {
      toast.error("Please select at least one course to unarchive");
      return;
    }

    // Check if unarchiving would exceed the limit
    if (selectedArchived.size > remainingSlots) {
      toast.error(
        `Cannot unarchive ${selectedArchived.size} course(s). You can only activate ${remainingSlots} more course(s) (maximum ${MAX_ACTIVE_COURSES} active courses allowed).`
      );
      return;
    }

    setIsProcessing(true);
    try {
      await onUnarchiveCourses(Array.from(selectedArchived));
      setSelectedArchived(new Set());

      // Refetch archived courses to update the list
      // Invalidate all archived queries (not just the specific one) to ensure all variations are updated
      queryClient.invalidateQueries({
        queryKey: queryKeys.courses.archived(),
      });

      // Also invalidate the main courses list so active courses update in parent
      queryClient.invalidateQueries({
        queryKey: queryKeys.courses.list(undefined),
      });

      // Also invalidate active courses query
      queryClient.invalidateQueries({
        queryKey: queryKeys.courses.active({ facultyId: userId }),
      });

      // Force refetch the current archived courses query
      await refetchArchived();
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Main Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] min-h-[90vh] overflow-hidden flex flex-col">
          {/* Redirecting Overlay */}
          {isNavigating && navigatingToCourse && (
            <div className="absolute inset-0 z-[100] flex items-center justify-center bg-white/95 backdrop-blur-sm rounded-lg -m-6">
              <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
                <div className="flex gap-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-[#124A69] rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 sm:w-3 sm:h-3 bg-[#124A69] rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  ></div>
                  <div
                    className="w-2 h-2 sm:w-3 sm:h-3 bg-[#124A69] rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  ></div>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#124A69] text-center">
                  Redirecting to course...
                </h2>
                <p className="text-sm sm:text-base text-gray-600 text-center">
                  Please wait while we navigate to the archived course
                </p>
              </div>
            </div>
          )}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl text-[#124A69]">
                <Settings2 className="h-5 w-5" />
                Course Settings
              </DialogTitle>
              <DialogDescription>
                {isViewingOwnCourses
                  ? "Manage your active and archived courses. Archived courses are hidden from the main course list."
                  : "View active and archived courses. You can only view these courses, not modify them."}
              </DialogDescription>
            </DialogHeader>

            {/* Faculty Selector for Academic Head */}
            {isAcademicHead && faculties.length > 0 && (
              <div className="space-y-2 flex-shrink-0 border-b pb-4">
                <Label
                  htmlFor="faculty-selector"
                  className="text-sm font-medium text-[#124A69] flex items-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  Select Faculty
                </Label>
                <Select
                  value={selectedFacultyId}
                  onValueChange={setSelectedFacultyId}
                >
                  <SelectTrigger id="faculty-selector" className="w-full">
                    <SelectValue placeholder="Select faculty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={userId}>
                      My Courses
                      {faculties.find((f) => f.id === userId)?.name &&
                        ` (${faculties.find((f) => f.id === userId)?.name})`}
                    </SelectItem>
                    {faculties
                      .filter((f) => f.id !== userId)
                      .map((faculty) => (
                        <SelectItem key={faculty.id} value={faculty.id}>
                          {faculty.name}
                          {faculty.department && ` (${faculty.department})`}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {!isViewingOwnCourses && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <History className="w-3 h-3" />
                    View-only mode: You can view courses but cannot archive or
                    unarchive them.
                  </p>
                )}
              </div>
            )}

            <Tabs
              defaultValue="active"
              className="flex-1 flex flex-col overflow-hidden"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="active" className="gap-2">
                  Active Courses{" "}
                  <Badge variant="secondary">{activeCourses.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="archived" className="gap-2">
                  Archived Courses{" "}
                  <Badge variant="secondary">{archivedCourses.length}</Badge>
                </TabsTrigger>
              </TabsList>

              {/* Active Courses */}
              <TabsContent
                value="active"
                className="flex-1 flex flex-col overflow-hidden space-y-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search active courses..."
                      value={searchActive}
                      onChange={(e) => setSearchActive(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllActive}
                      disabled={
                        activeCourses.length === 0 || !isViewingOwnCourses
                      }
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={deselectAllActive}
                      disabled={selectedActive.size === 0}
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto border rounded-lg">
                  {isLoadingActive ? (
                    <div className="text-center py-8 text-gray-500">
                      Loading active courses...
                    </div>
                  ) : activeCourses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                      <Archive className="h-12 w-12 mb-2 opacity-50" />
                      <p className="font-medium">No active courses found</p>
                      <p className="text-sm">
                        You don't have any active courses yet
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {activeCourses.map((course) => (
                        <div
                          key={course.id}
                          className={`flex items-center gap-3 p-4 transition-colors ${
                            !isViewingOwnCourses
                              ? "opacity-75"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          <Checkbox
                            checked={selectedActive.has(course.id)}
                            onCheckedChange={() =>
                              toggleActiveSelection(course.id)
                            }
                            disabled={!isViewingOwnCourses}
                            className="data-[state=checked]:bg-[#124A69] data-[state=checked]:border-[#124A69]"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-sm text-[#124A69]">
                                {course.code} - {course.section}
                              </h4>
                            </div>
                            <p className="text-sm text-gray-600 truncate">
                              {course.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {course.semester} • {course.academicYear}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    onClick={handleArchive}
                    disabled={
                      selectedActive.size === 0 ||
                      isProcessing ||
                      !isViewingOwnCourses
                    }
                    className="gap-2 bg-[#124A69] hover:bg-[#0d3a56]"
                    title={
                      !isViewingOwnCourses
                        ? "You can only archive your own courses"
                        : undefined
                    }
                  >
                    <Archive className="h-4 w-4" />
                    Archive{" "}
                    {selectedActive.size > 0 && `(${selectedActive.size})`}
                  </Button>
                </DialogFooter>
              </TabsContent>

              {/* Archived Courses */}
              <TabsContent
                value="archived"
                className="flex-1 flex flex-col overflow-hidden space-y-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search archived courses..."
                      value={searchArchived}
                      onChange={(e) => setSearchArchived(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllArchived}
                      disabled={
                        archivedCourses.length === 0 ||
                        !canActivateMore ||
                        !isViewingOwnCourses
                      }
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={deselectAllArchived}
                      disabled={selectedArchived.size === 0}
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto border rounded-lg">
                  {isLoadingArchived ? (
                    <div className="text-center py-8 text-gray-500">
                      Loading archived courses...
                    </div>
                  ) : archivedCourses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                      <ArchiveRestore className="h-12 w-12 mb-2 opacity-50" />
                      <p className="font-medium">No archived courses</p>
                      <p className="text-sm">
                        Archive courses to keep your list organized
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {archivedCourses.map((course) => {
                        const isSelected = selectedArchived.has(course.id);
                        // Disable checkbox if: viewing another faculty's courses, limit reached and not selected, OR selecting would exceed limit
                        const isCheckboxDisabled =
                          !isViewingOwnCourses ||
                          (!canActivateMore && !isSelected) ||
                          (!isSelected &&
                            selectedArchived.size >= remainingSlots);
                        return (
                          <div
                            key={course.id}
                            className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
                          >
                            <div
                              className={
                                isCheckboxDisabled
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              }
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() =>
                                  toggleArchivedSelection(course.id)
                                }
                                disabled={isCheckboxDisabled}
                                className="data-[state=checked]:bg-[#124A69] data-[state=checked]:border-[#124A69]"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-sm text-gray-600">
                                  {course.code} - {course.section}
                                </h4>
                                <Badge variant="outline" className="text-xs">
                                  ARCHIVED
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-500 truncate">
                                {course.title}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {course.semester} • {course.academicYear}
                              </p>
                            </div>
                            <div className="flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (course.slug) {
                                    setNavigatingToCourse(course.slug);
                                    setIsNavigating(true);
                                    setTimeout(() => {
                                      router.push(
                                        `/main/course/${course.slug}`
                                      );
                                    }, 300);
                                  } else {
                                    toast.error("Course slug not available");
                                  }
                                }}
                                disabled={isNavigating || !course.slug}
                                className="gap-1 text-[#124A69] hover:text-[#0d3a56] hover:bg-[#124A69]/10"
                              >
                                <History className="h-4 w-4" />
                                View
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <DialogFooter className="flex items-center justify-between">
                  <div className="text-sm text-gray-600 ">
                    <span className="font-medium">{currentActiveCount}</span> of{" "}
                    <span className="font-medium">{MAX_ACTIVE_COURSES}</span>{" "}
                    active courses
                  </div>
                  <Button
                    onClick={handleUnarchive}
                    disabled={
                      selectedArchived.size === 0 ||
                      isProcessing ||
                      selectedArchived.size > remainingSlots ||
                      !isViewingOwnCourses
                    }
                    variant="outline"
                    className="gap-2"
                    title={
                      !isViewingOwnCourses
                        ? "You can only unarchive your own courses"
                        : undefined
                    }
                  >
                    <ArchiveRestore className="h-4 w-4" />
                    Unarchive{" "}
                    {selectedArchived.size > 0 && `(${selectedArchived.size})`}
                  </Button>
                </DialogFooter>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#124A69]">
              Confirm Archive
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to archive{" "}
              <strong>{selectedActive.size}</strong> course
              {selectedActive.size > 1 && "s"}? Archived courses will be hidden
              from the main list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmArchive}
              disabled={isProcessing}
              className="gap-2 bg-[#124A69] hover:bg-[#0d3a56]"
            >
              <Archive className="h-4 w-4" />
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
