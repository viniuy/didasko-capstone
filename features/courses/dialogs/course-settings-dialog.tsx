import React, { useState, useMemo } from "react";
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
import { Search, Archive, ArchiveRestore, Settings2 } from "lucide-react";
import toast from "react-hot-toast";
import { useArchivedCourses } from "@/lib/hooks/queries/useCourses";

const MAX_ACTIVE_COURSES = 15;

interface Course {
  id: string;
  code: string;
  title: string;
  section: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  semester: string;
  academicYear: string;
  facultyId: string | null; // ADD THIS
}

interface CourseSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: Course[];
  onArchiveCourses: (courseIds: string[]) => Promise<void>;
  onUnarchiveCourses: (courseIds: string[]) => Promise<void>;
  userId: string; // ADD THIS
  userRole: string; // ADD THIS
}

export function CourseSettingsDialog({
  open,
  onOpenChange,
  courses,
  onArchiveCourses,
  onUnarchiveCourses,
  userId,
  userRole,
}: CourseSettingsDialogProps) {
  const [selectedActive, setSelectedActive] = useState<Set<string>>(new Set());
  const [selectedArchived, setSelectedArchived] = useState<Set<string>>(
    new Set()
  );
  const [searchActive, setSearchActive] = useState("");
  const [searchArchived, setSearchArchived] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Fetch archived courses independently (only when dialog is open)
  const { data: archivedCoursesData = [], isLoading: isLoadingArchived } =
    useArchivedCourses(
      open
        ? {
            facultyId: userId,
            search: searchArchived || undefined,
          }
        : undefined
    );

  // Calculate current active courses count for this faculty
  const currentActiveCount = useMemo(() => {
    return courses.filter(
      (c) =>
        c.facultyId === userId &&
        (c.status === "ACTIVE" || c.status === "INACTIVE")
    ).length;
  }, [courses, userId]);

  // Calculate remaining slots that can be activated
  const remainingSlots = MAX_ACTIVE_COURSES - currentActiveCount;
  const canActivateMore = remainingSlots > 0;

  // Filter active courses - only show user's own courses
  const activeCourses = useMemo(() => {
    return courses.filter(
      (c) =>
        c.facultyId === userId && // ONLY USER'S COURSES
        (c.status === "ACTIVE" || c.status === "INACTIVE") &&
        (c.code.toLowerCase().includes(searchActive.toLowerCase()) ||
          c.title.toLowerCase().includes(searchActive.toLowerCase()) ||
          c.section.toLowerCase().includes(searchActive.toLowerCase()))
    );
  }, [courses, searchActive, userId]);

  // Use fetched archived courses
  const archivedCourses = useMemo(() => {
    return archivedCoursesData.filter(
      (c) =>
        c.facultyId === userId && // ONLY USER'S COURSES
        (c.code.toLowerCase().includes(searchArchived.toLowerCase()) ||
          c.title.toLowerCase().includes(searchArchived.toLowerCase()) ||
          c.section.toLowerCase().includes(searchArchived.toLowerCase()))
    );
  }, [archivedCoursesData, searchArchived, userId]);

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
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-[#124A69]">
              <Settings2 className="h-5 w-5" />
              Course Settings
            </DialogTitle>
            <DialogDescription>
              Manage your active and archived courses. Archived courses are
              hidden from the main course list.
            </DialogDescription>
          </DialogHeader>

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
                    disabled={activeCourses.length === 0}
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
                {activeCourses.length === 0 ? (
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
                        className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
                      >
                        <Checkbox
                          checked={selectedActive.has(course.id)}
                          onCheckedChange={() =>
                            toggleActiveSelection(course.id)
                          }
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
                  disabled={selectedActive.size === 0 || isProcessing}
                  className="gap-2 bg-[#124A69] hover:bg-[#0d3a56]"
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
                    disabled={archivedCourses.length === 0 || !canActivateMore}
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
                      // Disable if: limit reached and not selected, OR selecting would exceed limit
                      const isDisabled =
                        (!canActivateMore && !isSelected) ||
                        (!isSelected &&
                          selectedArchived.size >= remainingSlots);
                      return (
                        <div
                          key={course.id}
                          className={`flex items-center gap-3 p-4 transition-colors ${
                            isDisabled
                              ? "opacity-50 cursor-not-allowed"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() =>
                              toggleArchivedSelection(course.id)
                            }
                            disabled={isDisabled}
                            className="data-[state=checked]:bg-[#124A69] data-[state=checked]:border-[#124A69]"
                          />
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
                    selectedArchived.size > remainingSlots
                  }
                  variant="outline"
                  className="gap-2"
                >
                  <ArchiveRestore className="h-4 w-4" />
                  Unarchive{" "}
                  {selectedArchived.size > 0 && `(${selectedArchived.size})`}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
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
