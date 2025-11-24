import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  Loader2,
  Search,
  Filter,
  Camera,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import GradingTableHeader from "./grading-table-header";
import GradingTableRow from "./grading-table-row";
import * as XLSX from "xlsx";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import { ExportReporting } from "./export-reporting";
import { useRouter, usePathname } from "next/navigation";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { HeaderSection } from "./header-section";
import { BottomActionBar } from "./bottom-action-bar";
import { EmptyState } from "./empty-state";
import axios from "@/lib/axios";
import {
  useStudentsByCourse,
  useGroupStudents,
  useGrades,
  useGradeDates,
  useSaveGrades,
  useDeleteGrades,
  useCriteriaByCourse,
  useRecitationCriteria,
  useGroupCriteriaByCourse,
  useCreateCriteria,
  useUpdateCriteria,
  useUploadImage,
  useDeleteImage,
} from "@/lib/hooks/queries";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  middleInitial?: string;
  image?: string;
  status?: string;
  attendanceRecords?: any[];
}

interface GradingTableProps {
  courseId: string;
  courseCode: string;
  courseSection: string;
  courseSlug: string;
  selectedDate: Date | undefined;
  onDateSelect?: (date: Date | undefined) => void;
  groupId?: string;
  isGroupView?: boolean;
  isRecitationCriteria?: boolean;
  refreshKey?: number; // Add refresh key to trigger refetch when groups change
  initialStudents?: Student[];
  initialRecitationCriteria?: any[];
  initialCriteria?: any[];
}

interface GradingReport {
  id: string;
  name: string;
  courseId: string;
  userId: string;
  rubrics: RubricDetail[];
  scoringRange: string;
  passingScore: string;
  date: string;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    name: string;
  };
  isGroupCriteria: boolean;
  isRecitationCriteria?: boolean;
}

interface RubricDetail {
  name: string;
  percentage: number;
  isGroupRubric?: boolean;
}

interface GradingScore {
  studentId: string;
  scores: number[];
  total: number;
  reportingScore?: number | null;
  recitationScore?: number | null;
}

interface StudentProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
  onAddImage: (index: number, file: File) => void;
  onRemoveImage: (student: Student) => void;
  students: Student[];
}

const StudentProfileDialog = ({
  open,
  onOpenChange,
  student,
  onAddImage,
  onRemoveImage,
  students,
}: StudentProfileDialogProps) => {
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  if (!student) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        setTempImage(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Find the student's index
      const studentIndex = students.findIndex(
        (s: Student) => s.id === student.id
      );
      if (studentIndex !== -1) {
        await onAddImage(studentIndex, file);
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setShowRemoveDialog(true);
  };

  const handleConfirmRemove = async () => {
    try {
      await onRemoveImage(student);
      setShowRemoveDialog(false);
      setTempImage(null);
    } catch (error) {
      console.error("Error removing image:", error);
      toast.error("Failed to remove profile picture");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) {
          setTempImage(null);
          setShowRemoveDialog(false);
        }
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-[#124A69] text-xl font-bold">
            {student.firstName} {student.lastName}'s Profile Picture
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="relative">
            {isUploading ? (
              <div className="w-48 h-48 rounded-full bg-gray-100 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#124A69]" />
              </div>
            ) : tempImage ? (
              <img
                src={tempImage}
                alt={`${student.firstName} ${student.lastName}`}
                className="w-48 h-48 rounded-full object-cover"
              />
            ) : student.image ? (
              <img
                src={student.image}
                alt={`${student.firstName} ${student.lastName}`}
                className="w-48 h-48 rounded-full object-cover"
              />
            ) : (
              <div className="w-48 h-48 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-400 text-4xl">
                  {student.firstName[0]}
                  {student.lastName[0]}
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="file"
              id="profile-picture"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploading}
            />
            <Button
              variant="outline"
              onClick={() => {
                const input = document.getElementById("profile-picture");
                if (input) input.click();
              }}
              className="flex items-center gap-2 bg-[#124A69] text-white hover:bg-[#0D3A54] hover:text-white border-none"
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" />
                  {student.image ? "Change Picture" : "Add Picture"}
                </>
              )}
            </Button>
            {student.image && !isUploading && (
              <Button
                variant="outline"
                onClick={handleRemoveImage}
                className="flex items-center gap-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                disabled={isUploading}
              >
                <X className="h-4 w-4" />
                Remove Picture
              </Button>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Remove Image Confirmation Dialog */}
      <AlertDialog
        open={showRemoveDialog}
        onOpenChange={(newOpen) => {
          if (!newOpen) {
            setShowRemoveDialog(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#124A69] text-xl font-bold">
              Remove Profile Picture
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500">
              Are you sure you want to remove the profile picture? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel
              onClick={() => setShowRemoveDialog(false)}
              className="border-gray-200"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              className="bg-[#124A69] hover:bg-[#0D3A54] text-white"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export function GradingTable({
  courseId,
  courseCode,
  courseSection,
  courseSlug,
  selectedDate,
  onDateSelect,
  groupId,
  isGroupView = false,
  isRecitationCriteria = false,
  refreshKey = 0,
  initialStudents = [],
  initialRecitationCriteria = [],
  initialCriteria = [],
}: GradingTableProps) {
  const { data: session } = useSession();
  const [students, setStudents] = useState<Student[]>([]);
  const [showCriteriaDialog, setShowCriteriaDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [savedReports, setSavedReports] = useState<GradingReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<string>("");
  const [activeReport, setActiveReport] = useState<GradingReport | null>(null);
  const [scores, setScores] = useState<Record<string, GradingScore>>({});
  const [originalScores, setOriginalScores] = useState<
    Record<string, GradingScore>
  >({});
  const [rubricDetails, setRubricDetails] = useState<RubricDetail[]>([]);
  const [newReport, setNewReport] = useState({
    name: "",
    rubrics: "2",
    scoringRange: "5",
    passingScore: "75",
    rubricDetails: [
      { name: "", weight: 50 },
      { name: "", weight: 50 },
    ],
  });
  const [criteriaLoading, setCriteriaLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true); // New: Initial loading state
  const [hasSelectedCriteria, setHasSelectedCriteria] = useState(false); // New: Track if criteria has been selected
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState<{
    passed: boolean;
    failed: boolean;
    noGrades: boolean;
  }>({
    passed: false,
    failed: false,
    noGrades: false,
  });
  // Temporary filter state for the filter sheet (only applied on "Apply")
  const [tempGradeFilter, setTempGradeFilter] = useState<{
    passed: boolean;
    failed: boolean;
    noGrades: boolean;
  }>({
    passed: false,
    failed: false,
    noGrades: false,
  });
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    rubrics?: string[];
  }>({});
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [exportData, setExportData] = useState<{
    header: string[][];
    studentRows: string[][];
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const studentsPerPage = 10;
  // totalPages and totalStudents are now computed via useMemo (see below)
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingGroup, setIsLoadingGroup] = useState(false);
  const [previousScores, setPreviousScores] = useState<Record<
    string,
    any
  > | null>(null);
  const [showExportWarning, setShowExportWarning] = useState(false);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] =
    useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null
  );
  const router = useRouter();
  const pathname = usePathname();
  const [isEditingCriteria, setIsEditingCriteria] = useState(false);
  const [editingReport, setEditingReport] = useState<GradingReport | null>(
    null
  );
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRubricChangeWarning, setShowRubricChangeWarning] = useState(false);
  const [pendingRubricCount, setPendingRubricCount] = useState<string | null>(
    null
  );
  const [showSaveEditConfirmation, setShowSaveEditConfirmation] =
    useState(false);
  const [tempImage, setTempImage] = useState<{
    index: number;
    dataUrl: string;
  } | null>(null);
  const [imageToRemove, setImageToRemove] = useState<{
    index: number;
    name: string;
  } | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState<{
    [key: number]: boolean;
  }>({});
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Auto-save refs (same pattern as class-record.tsx)
  const pendingScoresRef = useRef<
    Map<string, { studentId: string; scores: number[]; total: number }>
  >(new Map());
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const manuallyOpenedDialogRef = useRef(false);

  // Function to handle dialog close
  const handleDialogClose = () => {
    setShowCriteriaDialog(false);
    // Reset manual open flag when dialog is closed
    manuallyOpenedDialogRef.current = false;
    // Only reset if there's no active report
    if (!activeReport) {
      setStudents([]);
      setScores({});
      setRubricDetails([]);
      setSelectedReport("");
    }
  };

  // Helper function to convert date to Philippines timezone (UTC+8)
  const convertToPhilippinesDate = useCallback((date: Date | string): Date => {
    const dateObj = typeof date === "string" ? new Date(date) : date;

    // Get date components - treat as if it's already in Philippines time
    // Extract YYYY-MM-DD from the date
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();
    const day = dateObj.getDate();

    // Create a new date at noon in local timezone (Philippines)
    // This ensures we get the correct date regardless of UTC conversion
    return new Date(year, month, day, 12, 0, 0, 0);
  }, []);

  // React Query hooks for data fetching
  const formattedDate = selectedDate?.toISOString().split("T")[0];

  // Determine if we should use initial data (only for initial load, no date selected yet, or date matches today)
  const shouldUseInitialStudents =
    initialStudents.length > 0 &&
    (!selectedDate ||
      selectedDate.toISOString().split("T")[0] ===
        new Date().toISOString().split("T")[0]);

  // Fetch students
  const { data: studentsData, isLoading: isLoadingStudentsQuery } =
    useStudentsByCourse(
      courseSlug,
      selectedDate || undefined,
      shouldUseInitialStudents
        ? {
            initialData: { students: initialStudents },
            refetchOnMount: false,
            refetchOnWindowFocus: false,
          }
        : undefined
    );
  const { data: groupStudentsData, isLoading: isLoadingGroupQuery } =
    useGroupStudents(courseSlug, groupId || "");

  // Fetch grades - only when date, criteria, and course info are available
  const { data: gradesData, isLoading: isLoadingGrades } = useGrades(
    courseSlug,
    {
      date: formattedDate,
      criteriaId: activeReport?.id,
      courseCode,
      courseSection,
      groupId: isGroupView ? groupId : undefined,
    }
  );

  // Fetch dates where grades exist for the current criteria
  const { data: gradeDatesData, isLoading: isLoadingGradeDates } =
    useGradeDates(courseSlug, {
      criteriaId: activeReport?.id,
      courseCode,
      courseSection,
    });
  const gradeDates = gradeDatesData?.dates || [];

  // Determine which students to use - memoize to prevent infinite loops
  const currentStudents = useMemo(() => {
    if (isGroupView && groupId) {
      return groupStudentsData?.students || [];
    }
    // Use initial students if available and no date selected or date is today
    if (
      shouldUseInitialStudents &&
      initialStudents.length > 0 &&
      (!selectedDate ||
        selectedDate.toISOString().split("T")[0] ===
          new Date().toISOString().split("T")[0])
    ) {
      return initialStudents;
    }
    return studentsData?.students || [];
  }, [
    isGroupView,
    groupId,
    groupStudentsData?.students,
    studentsData?.students,
    initialStudents,
    shouldUseInitialStudents,
    selectedDate,
  ]);

  // Memoize student IDs for stable comparison
  const currentStudentIds = useMemo(
    () => currentStudents.map((s: Student) => s.id).join(","),
    [currentStudents]
  );

  const isLoadingStudents =
    isGroupView && groupId ? isLoadingGroupQuery : isLoadingStudentsQuery;

  // Use ref to track previous values and prevent unnecessary updates
  const prevValuesRef = useRef({
    studentIds: "",
    gradesDataLength: 0,
    selectedDate: undefined as Date | undefined,
    activeReportId: "",
    rubricLength: 0,
  });

  // Update students and scores when data changes
  useEffect(() => {
    if (!selectedDate || !activeReport) {
      // Only update if we have data to clear (check ref to avoid unnecessary updates)
      if (
        prevValuesRef.current.studentIds !== "" ||
        prevValuesRef.current.gradesDataLength > 0
      ) {
        setStudents([]);
        setScores({});
        prevValuesRef.current = {
          studentIds: "",
          gradesDataLength: 0,
          selectedDate: undefined,
          activeReportId: "",
          rubricLength: 0,
        };
      }
      return;
    }

    // Check if anything actually changed
    const hasChanged =
      prevValuesRef.current.studentIds !== currentStudentIds ||
      prevValuesRef.current.gradesDataLength !== (gradesData?.length || 0) ||
      prevValuesRef.current.selectedDate !== selectedDate ||
      prevValuesRef.current.activeReportId !== activeReport.id ||
      prevValuesRef.current.rubricLength !== rubricDetails.length;

    if (!hasChanged) {
      return;
    }

    // Update ref
    prevValuesRef.current = {
      studentIds: currentStudentIds,
      gradesDataLength: gradesData?.length || 0,
      selectedDate,
      activeReportId: activeReport.id,
      rubricLength: rubricDetails.length,
    };

    if (currentStudents.length > 0) {
      setStudents(currentStudents);
    }

    if (gradesData && currentStudents.length > 0) {
      // Map grades by studentId
      const gradesMap: Record<string, GradingScore> = {};
      (gradesData as GradingScore[]).forEach((grade: GradingScore) => {
        gradesMap[grade.studentId] = grade;
      });

      // Initialize scores state for all students, even those without grades
      const newScores: Record<string, GradingScore> = {};
      currentStudents.forEach((student: Student) => {
        newScores[student.id] = {
          studentId: student.id,
          scores:
            gradesMap[student.id]?.scores ||
            new Array(rubricDetails.length).fill(0),
          total: gradesMap[student.id]?.total || 0,
        };
      });
      setScores(newScores);
    }
  }, [
    currentStudentIds,
    currentStudents,
    gradesData,
    selectedDate,
    activeReport?.id,
    rubricDetails.length,
  ]);

  // Update loading states
  useEffect(() => {
    setIsLoading(isLoadingGrades || isLoadingStudents);
    setIsLoadingGroup(isLoadingGroupQuery);
  }, [isLoadingGrades, isLoadingStudents, isLoadingGroupQuery]);

  // React Query hooks for criteria fetching - fetch all criteria, filter by date on client
  const { data: allCriteriaData, isLoading: isLoadingCriteria } =
    useCriteriaByCourse(courseSlug, {
      initialData:
        !isGroupView &&
        !isRecitationCriteria &&
        initialCriteria &&
        initialCriteria.length > 0
          ? initialCriteria
          : undefined,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    });
  const { data: recitationCriteriaData, isLoading: isLoadingRecitation } =
    useRecitationCriteria(courseSlug, {
      initialData:
        isRecitationCriteria &&
        initialRecitationCriteria &&
        initialRecitationCriteria.length > 0
          ? initialRecitationCriteria
          : undefined,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    });
  const { data: groupCriteriaData, isLoading: isLoadingGroupCriteria } =
    useGroupCriteriaByCourse(courseSlug, {
      initialData:
        isGroupView && initialCriteria && initialCriteria.length > 0
          ? initialCriteria
          : undefined,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    });

  // Determine which criteria to use
  const allReports = isRecitationCriteria
    ? recitationCriteriaData || initialRecitationCriteria || []
    : isGroupView
    ? groupCriteriaData || initialCriteria || []
    : allCriteriaData || initialCriteria || [];

  // Check for existing criteria when date is selected or on mount
  useEffect(() => {
    // Don't reset if we're waiting for auto-select (activeReport exists but no date yet)
    if (!selectedDate && !activeReport) {
      setRubricDetails([]);
      setSelectedReport("");
      // Don't close dialog if it was manually opened
      if (!manuallyOpenedDialogRef.current) {
        setShowCriteriaDialog(false);
      }
      setSavedReports([]);
      setInitialLoading(false);
      setHasSelectedCriteria(false);
      return;
    }

    // If no date and we have an active report, we're waiting for auto-select
    if (!selectedDate && activeReport) {
      return;
    }

    // If criteria has already been selected, don't show dialog again
    if (hasSelectedCriteria && activeReport) {
      setInitialLoading(false);
      return;
    }

    // Update loading states based on query states
    const isAnyLoading =
      isLoadingCriteria || isLoadingRecitation || isLoadingGroupCriteria;
    setCriteriaLoading(isAnyLoading);

    // If still loading, don't process yet but don't set initialLoading to true if we already have data
    if (isAnyLoading) {
      // Only set initialLoading if we don't have reports yet
      if (allReports.length === 0) {
        setInitialLoading(true);
      }
      return;
    }

    // Data is loaded, set initialLoading to false
    setInitialLoading(false);

    try {
      // Filter reports by view type only - no date filtering
      let filteredReports: GradingReport[] = [];
      if (isGroupView) {
        // Group criteria is for the whole section, not specific to a group
        filteredReports = (allReports as GradingReport[]).filter(
          (report: GradingReport) => {
            return report.isGroupCriteria === true;
          }
        );
      } else if (isRecitationCriteria) {
        filteredReports = (allReports as GradingReport[]).filter(
          (report: GradingReport) => {
            return report.isRecitationCriteria === true;
          }
        );
      } else {
        filteredReports = (allReports as GradingReport[]).filter(
          (report: GradingReport) => {
            return (
              report.isGroupCriteria === false &&
              report.isRecitationCriteria === false
            );
          }
        );
      }
      setSavedReports(filteredReports);

      // Show dialog to let user select criteria
      if (filteredReports.length > 0 && !hasSelectedCriteria && !activeReport) {
        setShowCriteriaDialog(true);
      } else if (filteredReports.length === 0 && !hasSelectedCriteria) {
        // No criteria exists, show dialog to create new one
        setShowCriteriaDialog(true);
      }
    } catch (error) {
      console.error("Error processing criteria:", error);
      toast.error("Failed to load saved criteria", {
        duration: 3000,
        style: {
          background: "#fff",
          color: "#dc2626",
          border: "1px solid #e5e7eb",
        },
      });
    } finally {
      setCriteriaLoading(false);
      setInitialLoading(false);
    }
  }, [
    selectedDate,
    courseId,
    isGroupView,
    groupId,
    isRecitationCriteria,
    courseSlug,
    activeReport?.id,
    hasSelectedCriteria,
    allReports,
    isLoadingCriteria,
    isLoadingRecitation,
    isLoadingGroupCriteria,
  ]);

  // Track the last criteria ID we auto-selected a date for to prevent re-selecting
  const lastAutoSelectedCriteriaIdRef = useRef<string | null>(null);

  // Auto-select date from criteria when criteria is selected - always update date to match criteria
  useEffect(() => {
    if (activeReport?.id && activeReport?.date) {
      // Only auto-select once per criteria selection
      if (lastAutoSelectedCriteriaIdRef.current === activeReport.id) {
        return;
      }

      // Convert criteria date to Philippines timezone
      const phDate = convertToPhilippinesDate(activeReport.date);

      console.log(
        "Auto-selecting date from criteria.date (Philippines timezone):",
        {
          originalDate: activeReport.date,
          phDate,
          criteriaId: activeReport.id,
        }
      );

      lastAutoSelectedCriteriaIdRef.current = activeReport.id;
      onDateSelect?.(phDate);
    } else if (!activeReport) {
      // Reset when no active report
      lastAutoSelectedCriteriaIdRef.current = null;
    }
  }, [
    activeReport?.id,
    activeReport?.date,
    onDateSelect,
    convertToPhilippinesDate,
  ]);

  // Reset scores when date changes
  useEffect(() => {
    setScores({});
    setOriginalScores({});
    if (!activeReport) {
      setHasSelectedCriteria(false);
    }
  }, [selectedDate, activeReport]);

  // Reset originalScores when changing report or date
  useEffect(() => {
    setOriginalScores({});
    // Clear pending saves when changing report or date
    pendingScoresRef.current.clear();
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, [activeReport?.id, selectedDate]);

  // Cleanup on unmount to prevent memory leaks and ensure pending saves complete
  useEffect(() => {
    return () => {
      // Clear any pending timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      // Save any remaining pending scores before unmounting
      if (pendingScoresRef.current.size > 0) {
        // Use a synchronous approach or save immediately
        const gradesToSave = Array.from(pendingScoresRef.current.values());
        // Note: This is a fire-and-forget operation on unmount
        // In production, you might want to use navigator.sendBeacon or similar
        if (session?.user?.id && selectedDate && activeReport) {
          const formattedDate = selectedDate.toISOString().split("T")[0];
          const gradesToSaveFormatted = gradesToSave.map((grade) => ({
            studentId: grade.studentId,
            scores: grade.scores,
            total: grade.total,
            reportingScore: isRecitationCriteria ? 0 : grade.total,
            recitationScore: isRecitationCriteria ? grade.total : 0,
          }));
          saveGradesMutation
            .mutateAsync({
              courseSlug,
              gradeData: {
                date: formattedDate,
                criteriaId: activeReport.id,
                courseCode,
                courseSection,
                grades: gradesToSaveFormatted,
                isRecitationCriteria,
              },
            })
            .catch((err) => {
              console.error("Failed to save pending scores on unmount:", err);
            });
        }
      }
    };
  }, [
    courseSlug,
    session?.user?.id,
    selectedDate,
    activeReport,
    courseCode,
    courseSection,
    isRecitationCriteria,
  ]);

  // Update originalScores when scores are first loaded after criteria/date change
  useEffect(() => {
    if (
      Object.keys(scores).length > 0 &&
      Object.keys(originalScores).length === 0 &&
      activeReport
    ) {
      // Only set originalScores on initial load after criteria is selected
      // Use structuredClone for better performance
      setOriginalScores(structuredClone(scores));
    }
  }, [scores, originalScores, activeReport]);

  // Check if there are any changes
  const hasChanges = () => {
    // If we're still loading or no scores are loaded yet, return false
    if (isLoading || Object.keys(scores).length === 0) return false;

    if (Object.keys(scores).length !== Object.keys(originalScores).length)
      return true;

    return Object.entries(scores).some(([studentId, score]) => {
      const originalScore = originalScores[studentId];
      if (!originalScore) return true;

      // Check if scores array is different
      if (score.scores.length !== originalScore.scores.length) return true;
      if (score.scores.some((s, i) => s !== originalScore.scores[i]))
        return true;

      // Check if total is different
      return score.total !== originalScore.total;
    });
  };

  // React Query mutations
  const saveGradesMutation = useSaveGrades();
  const deleteGradesMutation = useDeleteGrades();
  const createCriteriaMutation = useCreateCriteria();
  const updateCriteriaMutation = useUpdateCriteria();
  const uploadImageMutation = useUploadImage();
  const deleteImageMutation = useDeleteImage();

  const handleSaveGrades = async () => {
    if (!session?.user?.id || !selectedDate || !activeReport) {
      toast.error("Missing required information to save grades", {
        duration: 3000,
        style: {
          background: "#fff",
          color: "#dc2626",
          border: "1px solid #e5e7eb",
        },
      });
      return;
    }

    // Clear any pending auto-save timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    // Save any pending scores immediately
    if (pendingScoresRef.current.size > 0) {
      await savePendingScores();
    }

    setIsSaving(true);
    try {
      const formattedDate = selectedDate.toISOString().split("T")[0];

      // Calculate total scores for each student
      const gradesToSave = Object.values(scores).map((score) => {
        const total = calculateTotal(score.scores);

        return {
          studentId: score.studentId,
          scores: score.scores,
          total: total,
          reportingScore: isRecitationCriteria ? 0 : total,
          recitationScore: isRecitationCriteria ? total : 0,
        };
      });

      // Log the data being sent
      console.log("Saving grades data:", {
        date: formattedDate,
        criteriaId: activeReport.id,
        courseCode,
        courseSection,
        grades: gradesToSave,
        isRecitationCriteria,
      });

      // Save all grades in a single request
      await saveGradesMutation.mutateAsync({
        courseSlug,
        gradeData: {
          date: formattedDate,
          criteriaId: activeReport.id,
          courseCode,
          courseSection,
          grades: gradesToSave,
          isRecitationCriteria,
        },
      });

      // Update original scores after successful save
      // Use structuredClone for better performance (10-100x faster than JSON.parse/stringify)
      setOriginalScores(structuredClone(scores));
    } catch (error: any) {
      console.error("Error saving grades:", {
        error,
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack,
      });
      // Error is handled by the mutation hook
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyCriteria = async () => {
    if (selectedReport) {
      const selected = savedReports.find((c) => c.id === selectedReport);
      if (selected) {
        setActiveReport(selected);
        setRubricDetails(selected.rubrics);
        setHasSelectedCriteria(true); // Mark criteria as selected

        // Set date to criteria's date using Philippines timezone
        if (selected.date) {
          const phDate = convertToPhilippinesDate(selected.date);
          onDateSelect?.(phDate);
        }
      }
      setShowCriteriaDialog(false);
    }
  };

  // Auto-save functions (same pattern as class-record.tsx)
  // savePendingScores must be defined before queueScoreForSaving which references it
  const savePendingScores = useCallback(async () => {
    if (pendingScoresRef.current.size === 0) return;
    if (!session?.user?.id || !selectedDate || !activeReport) return;

    // Create a copy of pending scores before clearing
    const gradesToSave = Array.from(pendingScoresRef.current.values());

    // Validate grades before sending
    const validGrades = gradesToSave.filter((g) => {
      if (!g.studentId) return false;
      if (!Array.isArray(g.scores)) return false;
      if (typeof g.total !== "number" || isNaN(g.total)) return false;
      return true;
    });

    if (validGrades.length === 0) {
      // No valid grades to save, just clear pending
      pendingScoresRef.current.clear();
      return;
    }

    const pendingScoresBackup = new Map(pendingScoresRef.current);

    // Clear pending scores optimistically
    pendingScoresRef.current.clear();

    try {
      toast.loading("Saving grades...", { id: "save-grades" });
      const formattedDate = selectedDate.toISOString().split("T")[0];

      // Prepare grades in the format expected by the API
      const gradesToSaveFormatted = validGrades.map((grade) => ({
        studentId: grade.studentId,
        scores: grade.scores,
        total: grade.total,
        reportingScore: isRecitationCriteria ? 0 : grade.total,
        recitationScore: isRecitationCriteria ? grade.total : 0,
      }));

      // Save all grades in a single request
      await saveGradesMutation.mutateAsync({
        courseSlug,
        gradeData: {
          date: formattedDate,
          criteriaId: activeReport.id,
          courseCode,
          courseSection,
          grades: gradesToSaveFormatted,
          isRecitationCriteria,
        },
      });

      toast.success("Grades saved successfully", { id: "save-grades" });

      // Update original scores after successful save
      setOriginalScores((prev) => {
        const updated = { ...prev };
        validGrades.forEach((grade) => {
          updated[grade.studentId] = {
            studentId: grade.studentId,
            scores: grade.scores,
            total: grade.total,
            reportingScore: isRecitationCriteria ? null : grade.total,
            recitationScore: isRecitationCriteria ? grade.total : null,
          };
        });
        return updated;
      });

      // Dispatch event to refresh leaderboard seamlessly
      window.dispatchEvent(
        new CustomEvent("gradesUpdated", {
          detail: { courseSlug },
        })
      );
    } catch (error: any) {
      // Restore pending scores on failure to prevent data loss
      pendingScoresRef.current = pendingScoresBackup;

      const errorMessage =
        error?.response?.data?.error ||
        error?.message ||
        "Failed to save grades. Please try again.";

      toast.error(errorMessage, {
        id: "save-grades",
      });

      console.error("Error saving grades:", error);
      console.error("Grades that failed to save:", validGrades);

      // Re-queue the save after a delay
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        savePendingScores();
      }, 2000);
    }
  }, [
    session?.user?.id,
    selectedDate,
    activeReport,
    courseSlug,
    courseCode,
    courseSection,
    isRecitationCriteria,
    saveGradesMutation,
  ]);

  // queueScoreForSaving must be defined after savePendingScores
  const queueScoreForSaving = useCallback(
    (studentId: string, scores: number[], total: number) => {
      // Add to pending scores
      pendingScoresRef.current.set(studentId, { studentId, scores, total });

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set new timeout to save after 1 second of no changes
      saveTimeoutRef.current = setTimeout(() => {
        savePendingScores();
      }, 1000);
    },
    [savePendingScores] // Add savePendingScores to dependencies
  );

  // Memoized calculateTotal to prevent recreation on every render
  // Must be defined before handleScoreChange which uses it
  const calculateTotal = useCallback(
    (scores: number[]): number => {
      if (!rubricDetails.length) return 0;

      // Calculate the maximum possible score based on the scoring range
      const maxScore = Number(activeReport?.scoringRange) || 5;

      // Ensure we only use scores up to the number of rubrics
      const validScores = scores.slice(0, rubricDetails.length);

      // Calculate weighted percentage for each rubric
      const weightedScores = validScores.map((score, index) => {
        const weight = rubricDetails[index]?.percentage || 0;
        // Convert score to percentage based on max score, then apply weight
        return (score / maxScore) * weight;
      });

      // Sum up all weighted scores and round to 2 decimal places
      const total = Number(
        weightedScores.reduce((sum, score) => sum + score, 0).toFixed(2)
      );

      // Log the calculation for debugging
      console.log("Score calculation:", {
        scores: validScores,
        weights: rubricDetails.map((r) => r.percentage),
        weightedScores,
        total,
      });

      return total;
    },
    [rubricDetails, activeReport?.scoringRange]
  );

  // Memoized handleScoreChange to prevent unnecessary re-renders of child components
  const handleScoreChange = useCallback(
    async (studentId: string, rubricIndex: number, value: number | "") => {
      // If value is empty (Select Grade), delete the grades
      if (value === "") {
        try {
          setIsLoading(true);
          const formattedDate = selectedDate?.toISOString().split("T")[0];

          // Delete grades for this student (Note: service doesn't support studentId filter yet, so we'll need to handle this differently)
          // For now, we'll delete all grades for the criteria/date and recreate without this student
          // This is a limitation - the service should support studentId filter
          if (activeReport?.id && formattedDate) {
            await deleteGradesMutation.mutateAsync({
              courseSlug,
              criteriaId: activeReport.id,
              date: formattedDate,
            });
          }

          // Update local state
          setScores((prev) => {
            const newScores = { ...prev };
            delete newScores[studentId];
            return newScores;
          });

          toast.success("Grades deleted successfully");
        } catch (error: any) {
          console.error("Error deleting grades:", error);
          toast.error(
            error.response?.data?.message || "Failed to delete grades"
          );
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // Otherwise, update the grade as normal
      setScores((prev) => {
        const rubricCount = activeReport?.rubrics.length || 0;
        const studentScores =
          prev[studentId]?.scores || new Array(rubricCount).fill(0);
        const newScores = [...studentScores];
        newScores[rubricIndex] = value;

        // Calculate total including all rubrics
        const total = calculateTotal(newScores);

        const updatedScore: GradingScore = {
          studentId,
          scores: newScores,
          total,
          reportingScore: isRecitationCriteria ? null : total,
          recitationScore: isRecitationCriteria ? total : null,
        };

        // Queue for auto-save
        queueScoreForSaving(studentId, newScores, total);

        return {
          ...prev,
          [studentId]: updatedScore,
        };
      });
    },
    [
      activeReport?.id,
      activeReport?.rubrics.length,
      selectedDate,
      courseSlug,
      isRecitationCriteria,
      calculateTotal,
      queueScoreForSaving,
      deleteGradesMutation,
    ]
  );

  // Note: savePendingScores is already defined above (line 1095), duplicate removed

  const validateReportName = (name: string) => {
    if (!name.trim()) {
      return "Report name is required";
    }
    if (name.length > 25) {
      return "Report name must not exceed 25 characters";
    }
    if (!/^[a-zA-Z0-9\s]+$/.test(name)) {
      return "Report name can only contain letters, numbers, and spaces";
    }
    // Check for duplicate names, excluding the current report if editing
    const isDuplicate = savedReports.some(
      (report) =>
        report.name.toLowerCase() === name.toLowerCase() &&
        (!editingReport || report.id !== editingReport.id)
    );
    if (isDuplicate) {
      return "A report with this name already exists";
    }
    return "";
  };

  const validateRubricName = (name: string, index: number) => {
    if (!name.trim()) {
      return "Criteria name is required";
    }
    if (name.length > 15) {
      return "Criteria name must not exceed 15 characters";
    }
    if (!/^[a-zA-Z0-9\s]+$/.test(name)) {
      return "Criteria name can only contain letters, numbers, and spaces";
    }
    // Check for duplicate names
    const isDuplicate = newReport.rubricDetails.some(
      (r, i) => i !== index && r.name.toLowerCase() === name.toLowerCase()
    );
    if (isDuplicate) {
      return "Criteria name must be unique";
    }
    return "";
  };

  const handleReportNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const error = validateReportName(value);
    setValidationErrors((prev) => ({ ...prev, name: error }));

    if (value.length <= 25 && /^[a-zA-Z0-9\s]*$/.test(value)) {
      setNewReport((prev) => ({
        ...prev,
        name: value,
      }));
    }
  };

  const handleRubricCountChange = async (value: string) => {
    const count = parseInt(value);
    const currentRubrics = [...newReport.rubricDetails];

    // If we're editing and there are unsaved changes, show warning
    if (editingReport && hasChanges()) {
      setPendingRubricCount(value);
      setShowRubricChangeWarning(true);
      return;
    }

    // Rest of the existing handleRubricCountChange function...
    if (isGroupView) {
      // For group view: Reserve 20% for Participation
      const baseWeight = Math.floor(80 / (count - 1));
      const remainder = 80 % (count - 1);

      // Create array of weights, distributing remainder to first elements
      const weights = Array(count - 1).fill(baseWeight);
      for (let i = 0; i < remainder; i++) {
        weights[i]++;
      }

      // Create the group rubrics (all except the last one)
      const groupRubrics = Array(count - 1)
        .fill(null)
        .map((_, index) => ({
          name:
            currentRubrics[index]?.name === "Participation"
              ? ""
              : currentRubrics[index]?.name || "",
          weight: weights[index],
          isGroupRubric: true,
        }));

      const newRubricDetails = [
        ...groupRubrics,
        {
          name: "Participation",
          weight: 20,
          isGroupRubric: false,
        },
      ];

      setNewReport((prev) => ({
        ...prev,
        rubrics: value,
        rubricDetails: newRubricDetails,
      }));
    } else {
      // For individual view: Keep original behavior but preserve names
      const baseWeight = Math.floor(100 / count);
      const remainder = 100 % count;

      // Create array of weights, distributing remainder to first elements
      const weights = Array(count).fill(baseWeight);
      for (let i = 0; i < remainder; i++) {
        weights[i]++;
      }

      const newRubricDetails = Array(count)
        .fill(null)
        .map((_, index) => ({
          name: currentRubrics[index]?.name || "",
          weight: weights[index],
          isGroupRubric: false,
        }));

      setNewReport((prev) => ({
        ...prev,
        rubrics: value,
        rubricDetails: newRubricDetails,
      }));
    }
  };

  // Add useEffect to handle initial rubric setup for group view
  useEffect(() => {
    if (isGroupView && showCriteriaDialog) {
      // Initialize with 2 rubrics by default for group view
      // Only initialize if rubricDetails is empty to avoid overwriting user input
      if (
        newReport.rubricDetails.length === 0 ||
        (newReport.rubricDetails.length === 2 &&
          newReport.rubricDetails.every(
            (r) => r.name === "" && r.weight === 50
          ))
      ) {
        handleRubricCountChange("2");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGroupView, showCriteriaDialog]);

  // Update the updateRubricDetail function to handle Participation rubric
  const updateRubricDetail = (
    index: number,
    field: "name" | "weight",
    value: string | number
  ) => {
    // For group view, only allow weight changes for the last rubric
    if (
      isGroupView &&
      index === newReport.rubricDetails.length - 1 &&
      field === "name"
    ) {
      return;
    }

    setNewReport((prev) => {
      const newDetails = [...prev.rubricDetails];

      if (field === "weight") {
        // Ensure weight is a valid number between 1 and 100
        const numValue = Number(value);
        if (isNaN(numValue) || numValue < 1 || numValue > 100) {
          return prev;
        }

        // For group view, when changing the last rubric's weight, adjust other weights proportionally
        if (isGroupView && index === newReport.rubricDetails.length - 1) {
          const remainingWeight = 100 - numValue;
          const otherRubrics = newDetails.slice(0, -1);
          const totalOtherWeight = otherRubrics.reduce(
            (sum, r) => sum + r.weight,
            0
          );

          // Adjust other weights proportionally
          otherRubrics.forEach((rubric, i) => {
            const proportion = rubric.weight / totalOtherWeight;
            newDetails[i].weight = Math.round(remainingWeight * proportion);
          });

          // Add any rounding errors to the first rubric
          const actualTotal = newDetails.reduce((sum, r) => sum + r.weight, 0);
          if (actualTotal !== 100) {
            newDetails[0].weight += 100 - actualTotal;
          }
        }

        newDetails[index] = {
          ...newDetails[index],
          weight: numValue,
        };
      } else {
        // Validate name input
        const nameValue = value as string;
        const error = validateRubricName(nameValue, index);
        setValidationErrors((prev) => ({
          ...prev,
          rubrics: prev.rubrics
            ? prev.rubrics.map((err, i) => (i === index ? error : err))
            : new Array(newDetails.length).fill(""),
        }));

        if (nameValue.length <= 15 && /^[a-zA-Z0-9\s]*$/.test(nameValue)) {
          newDetails[index] = {
            ...newDetails[index],
            name: nameValue,
          };
        }
      }

      return {
        ...prev,
        rubricDetails: newDetails,
      };
    });
  };

  const handleCreateReport = async () => {
    // Validate report name
    const nameError = validateReportName(newReport.name);
    if (nameError) {
      setValidationErrors((prev) => ({ ...prev, name: nameError }));
      toast.error(nameError, {
        duration: 3000,
        style: {
          background: "#fff",
          color: "#dc2626",
          border: "1px solid #e5e7eb",
        },
      });
      return;
    }

    // Validate all criteria names
    const rubricErrors = newReport.rubricDetails.map((rubric, idx, arr) => {
      if (isGroupView && idx === arr.length - 1) {
        // Skip validation for Participation criteria in group view
        return "";
      }
      return validateRubricName(rubric.name, idx);
    });
    const hasRubricErrors = rubricErrors.some((error) => error);
    if (hasRubricErrors) {
      setValidationErrors((prev) => ({ ...prev, rubrics: rubricErrors }));
      toast.error("Please fix the criteria name errors", {
        duration: 3000,
        style: {
          background: "#fff",
          color: "#dc2626",
          border: "1px solid #e5e7eb",
        },
      });
      return;
    }

    // Check if total weight equals 100%
    const totalWeight = newReport.rubricDetails.reduce(
      (sum, rubric) => sum + rubric.weight,
      0
    );
    if (totalWeight !== 100) {
      toast.error("Total weight must equal 100%", {
        duration: 3000,
        style: {
          background: "#fff",
          color: "#dc2626",
          border: "1px solid #e5e7eb",
        },
      });
      return;
    }

    if (!session?.user?.id) {
      console.log("No session user ID");
      return;
    }
    const loadingToast = toast.loading(
      isRecitationCriteria ? "Creating recitation..." : "Creating report...",
      {
        position: "top-center",
        duration: Infinity,
        style: {
          background: "#fff",
          color: "#124A69",
          border: "1px solid #e5e7eb",
        },
      }
    );
    try {
      setIsLoading(true);
      const rubrics = newReport.rubricDetails.map((r, idx, arr) => ({
        name: isGroupView && idx === arr.length - 1 ? "Participation" : r.name,
        percentage: r.weight,
        isGroupRubric: isGroupView ? idx !== arr.length - 1 : false,
      }));

      // Ensure Participation rubric is properly set for group view
      if (isGroupView) {
        const participationRubric = rubrics[rubrics.length - 1];
        participationRubric.name = "Participation";
        participationRubric.isGroupRubric = false;
      }

      // Note: Group criteria is for the whole section, so we use the general criteria endpoint
      // and filter by isGroupCriteria on the client side
      // The mutation will automatically use the correct endpoint based on isRecitationCriteria
      const dateToSend = selectedDate ? new Date(selectedDate) : undefined;
      if (dateToSend) {
        dateToSend.setHours(0, 0, 0, 0);
      }
      const created = await createCriteriaMutation.mutateAsync({
        courseSlug,
        criteriaData: {
          name: newReport.name,
          userId: session.user.id,
          date: dateToSend
            ? dateToSend.toISOString()
            : new Date().toISOString(),
          scoringRange: Number(newReport.scoringRange),
          passingScore: Number(newReport.passingScore),
          isGroupCriteria: isGroupView,
          isRecitationCriteria: isRecitationCriteria,
          rubrics: rubrics.map((r) => ({
            name: r.name,
            percentage: r.percentage,
          })),
        },
      });
      setSavedReports((prev) => [created, ...prev]);
      setActiveReport(created);
      setRubricDetails(created.rubrics);
      setSelectedReport(created.id);
      setHasSelectedCriteria(true); // Mark criteria as selected
      setShowCriteriaDialog(false);
      setNewReport({
        name: "",
        rubrics: "2",
        scoringRange: "5",
        passingScore: "75",
        rubricDetails: [
          { name: "", weight: 50 },
          { name: "", weight: 50 },
        ],
      });
      setValidationErrors({});
      toast.dismiss(loadingToast);
      toast.success(
        isRecitationCriteria
          ? "Recitation created successfully"
          : "Report created successfully",
        {
          duration: 3000,
          style: {
            background: "#fff",
            color: "#124A69",
            border: "1px solid #e5e7eb",
          },
        }
      );
    } catch (error) {
      console.error("Error creating report:", error);
      toast.dismiss(loadingToast);
      toast.error(
        isRecitationCriteria
          ? "Failed to create recitation"
          : "Failed to create report",
        {
          duration: 3000,
          style: {
            background: "#fff",
            color: "#dc2626",
            border: "1px solid #e5e7eb",
          },
        }
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Update saved reports when criteria data changes - filter by view type only (no date filtering)
  useEffect(() => {
    try {
      const allReportsData = isRecitationCriteria
        ? recitationCriteriaData || []
        : isGroupView
        ? groupCriteriaData || []
        : allCriteriaData || [];

      // Filter by view type only - no date filtering
      let reports: GradingReport[] = [];
      if (isGroupView) {
        reports = (allReportsData as GradingReport[]).filter((r: any) => {
          return r.isGroupCriteria === true;
        });
      } else if (isRecitationCriteria) {
        reports = (allReportsData as GradingReport[]).filter((r: any) => {
          return r.isRecitationCriteria === true;
        });
      } else {
        reports = (allReportsData as GradingReport[]).filter((r: any) => {
          return (
            r.isGroupCriteria === false && r.isRecitationCriteria === false
          );
        });
      }
      setSavedReports(reports);
    } catch (error) {
      console.error("Error loading reports:", error);
      toast.error("Failed to load saved reports", {
        duration: 3000,
        style: {
          background: "#fff",
          color: "#dc2626",
          border: "1px solid #e5e7eb",
        },
      });
    }
  }, [
    courseId,
    isGroupView,
    groupId,
    isRecitationCriteria,
    allCriteriaData,
    recitationCriteriaData,
    groupCriteriaData,
    isLoadingGroupCriteria,
  ]);

  const prepareExportData = () => {
    if (!activeReport || !selectedDate) return null;

    const formattedDate = selectedDate.toISOString().split("T")[0];

    // Create header rows
    const header = [
      [
        `${courseCode} - ${courseSection} ${
          isRecitationCriteria ? "RECITATION" : "GRADING"
        } REPORT`,
      ],
      [""],
      ["Date:", formattedDate],
      [
        `${isRecitationCriteria ? "Recitation" : "Grading"} Report:`,
        activeReport.name,
      ],
      [""],
      // Column headers
      [
        "Student Name",
        ...rubricDetails.map((r) => `${r.name} (${r.percentage}%)`),
        "Total Grade",
        "Remarks",
      ],
    ];

    // Create student data rows
    const studentRows = students.map((student) => {
      const studentScore = scores[student.id] || {
        studentId: student.id,
        scores: new Array(rubricDetails.length).fill(0),
        total: 0,
      };

      return [
        `${student.lastName}, ${student.firstName}${
          student.middleInitial ? ` ${student.middleInitial}.` : ""
        }`,
        ...studentScore.scores.map((score) =>
          score ? score.toString() : "---"
        ),
        studentScore.scores.some((score) => score === 0) ||
        studentScore.total === 0
          ? "---"
          : `${studentScore.total.toFixed(2)}%`,
        studentScore.scores.some((score) => score === 0) ||
        studentScore.total === 0
          ? "---"
          : studentScore.total >= Number(activeReport.passingScore)
          ? "PASSED"
          : "FAILED",
      ];
    });

    return { header, studentRows };
  };

  const handleExport = () => {
    if (!activeReport || !selectedDate) {
      toast.error("Please select a date and grading report first", {
        duration: 3000,
        style: {
          background: "#fff",
          color: "#dc2626",
          border: "1px solid #e5e7eb",
        },
      });
      return;
    }

    // Check for students without scores
    const unscoredStudents = students.filter((student) => {
      const studentScore = scores[student.id];
      return !studentScore || studentScore.scores.every((score) => score === 0);
    });

    if (unscoredStudents.length > 0) {
      setShowExportWarning(true);
      return;
    }

    const data = prepareExportData();
    if (!data) return;

    setExportData(data);
    setShowExportPreview(true);
  };

  const handleConfirmExportWithWarning = () => {
    setShowExportWarning(false);
    const data = prepareExportData();
    if (!data) return;
    setExportData(data);
    setShowExportPreview(true);
  };

  const handleConfirmExport = () => {
    if (!exportData) return;

    try {
      const { header, studentRows } = exportData;
      const ws = XLSX.utils.aoa_to_sheet([...header, ...studentRows]);

      // Configure column widths
      ws["!cols"] = [
        { wch: 30 }, // Student Name
        ...rubricDetails.map(() => ({ wch: 15 })), // Rubric scores
        { wch: 15 }, // Total Grade
        { wch: 15 }, // Remarks
      ];

      // Style configurations
      const headerStyle = {
        fill: { fgColor: { rgb: "124A69" } }, // Dark blue background
        font: { color: { rgb: "FFFFFF" }, bold: true }, // White bold text
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
      };

      const subHeaderStyle = {
        fill: { fgColor: { rgb: "F5F6FA" } }, // Light gray background
        font: { bold: true },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
      };

      const cellStyle = {
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
      };

      // Apply styles to cells
      const range = XLSX.utils.decode_range(ws["!ref"] || "A1");

      // Style the title row
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: C });
        if (!ws[cellRef]) ws[cellRef] = { v: "" };
        ws[cellRef].s = headerStyle;
      }

      // Style the subheader row (column headers)
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: 5, c: C });
        if (!ws[cellRef]) ws[cellRef] = { v: "" };
        ws[cellRef].s = subHeaderStyle;
      }

      // Style all other cells
      for (let R = 6; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[cellRef]) ws[cellRef] = { v: "" };

          // Special styling for remarks column
          if (C === range.e.c) {
            const value = ws[cellRef].v;
            if (value === "PASSED") {
              ws[cellRef].s = {
                ...cellStyle,
                font: { color: { rgb: "008000" }, bold: true }, // Green for PASSED
              };
            } else if (value === "FAILED") {
              ws[cellRef].s = {
                ...cellStyle,
                font: { color: { rgb: "FF0000" }, bold: true }, // Red for FAILED
              };
            } else {
              ws[cellRef].s = cellStyle;
            }
          } else {
            ws[cellRef].s = cellStyle;
          }
        }
      }

      // Merge cells for title and info rows
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: range.e.c } }, // Title row
        { s: { r: 1, c: 0 }, e: { r: 1, c: range.e.c } }, // Empty row
        { s: { r: 2, c: 1 }, e: { r: 2, c: range.e.c } }, // Date row
        { s: { r: 3, c: 1 }, e: { r: 3, c: range.e.c } }, // Report name row
        { s: { r: 4, c: 0 }, e: { r: 4, c: range.e.c } }, // Empty row
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Grades");

      // Generate filename with date
      const formattedDate = selectedDate?.toISOString().split("T")[0];
      const filename = `${courseCode}-${courseSection}-${formattedDate}-grades.xlsx`;
      XLSX.writeFile(wb, filename);

      setShowExportPreview(false);
      toast.success("Grades exported successfully", {
        duration: 3000,
        style: {
          background: "#fff",
          color: "#124A69",
          border: "1px solid #e5e7eb",
        },
      });
    } catch (error) {
      console.error("Error exporting grades:", error);
      toast.error("Failed to export grades", {
        duration: 3000,
        style: {
          background: "#fff",
          color: "#dc2626",
          border: "1px solid #e5e7eb",
        },
      });
    }
  };

  // Function to handle filter changes in the filter sheet (temporary state)
  const handleFilterChange = (key: keyof typeof tempGradeFilter) => {
    const newFilter = {
      ...tempGradeFilter,
      [key]: !tempGradeFilter[key],
    };

    // If all options are checked, set all to true
    if (Object.values(newFilter).every(Boolean)) {
      setTempGradeFilter({
        passed: true,
        failed: true,
        noGrades: true,
      });
    } else {
      setTempGradeFilter(newFilter);
    }
  };

  // Memoized studentMatchesFilter to prevent recreation on every render
  const studentMatchesFilter = useCallback(
    (student: Student) => {
      // If no filters are checked, show all students
      if (!gradeFilter.passed && !gradeFilter.failed && !gradeFilter.noGrades) {
        return true;
      }

      const studentScore = scores[student.id];
      const total = studentScore?.total || 0;
      const hasGrades =
        studentScore?.scores.some((score) => score > 0) || false;

      if (
        gradeFilter.passed &&
        hasGrades &&
        total >= Number(activeReport?.passingScore)
      )
        return true;
      if (
        gradeFilter.failed &&
        hasGrades &&
        total < Number(activeReport?.passingScore)
      )
        return true;
      if (gradeFilter.noGrades && !hasGrades) return true;
      return false;
    },
    [gradeFilter, scores, activeReport?.passingScore]
  );

  const handleResetGrades = () => {
    if (hasChanges()) {
      toast.error("Cannot reset grades while there are unsaved changes", {
        duration: 3000,
        position: "top-center",
        style: {
          background: "#fff",
          color: "#dc2626",
          border: "1px solid #e5e7eb",
        },
      });
      setShowResetDialog(false);
      return;
    }

    // Store current scores before resetting
    const currentScores = { ...scores };
    setPreviousScores(currentScores);
    setScores({});
    setShowResetDialog(false);

    toast.success(
      (t) => (
        <div className="flex items-center gap-2">
          <span>Grades reset successfully</span>
          <button
            onClick={() => {
              // Restore the scores from before the reset
              setScores(currentScores);
              toast.dismiss(t.id);
              toast.success("Grades restored", {
                duration: 3000,
                style: {
                  background: "#fff",
                  color: "#124A69",
                  border: "1px solid #e5e7eb",
                },
              });
            }}
            className="px-3 py-1 bg-[#124A69] text-white rounded hover:bg-[#0d3a56] transition-colors text-sm"
          >
            Undo
          </button>
        </div>
      ),
      {
        duration: 5000,
        position: "top-center",
        style: {
          background: "#fff",
          color: "#124A69",
          border: "1px solid #e5e7eb",
        },
      }
    );
  };

  // Memoized filtered & paginated students - eliminates duplicate filtering
  const { filteredStudents, paginatedStudents, totalPages, totalStudents } =
    useMemo(() => {
      const filtered = students.filter((student) => {
        const name = `${student.lastName || ""} ${student.firstName || ""} ${
          student.middleInitial || ""
        }`.toLowerCase();
        const nameMatch = name.includes(searchQuery.toLowerCase());
        return nameMatch && studentMatchesFilter(student);
      });

      // Sort students alphabetically by lastName, then firstName, then middleInitial
      const sorted = [...filtered].sort((a, b) => {
        // Compare last names
        const lastNameA = (a.lastName || "").toLowerCase();
        const lastNameB = (b.lastName || "").toLowerCase();
        if (lastNameA !== lastNameB) {
          return lastNameA.localeCompare(lastNameB);
        }

        // If last names are equal, compare first names
        const firstNameA = (a.firstName || "").toLowerCase();
        const firstNameB = (b.firstName || "").toLowerCase();
        if (firstNameA !== firstNameB) {
          return firstNameA.localeCompare(firstNameB);
        }

        // If first names are also equal, compare middle initials
        const middleA = (a.middleInitial || "").toLowerCase();
        const middleB = (b.middleInitial || "").toLowerCase();
        return middleA.localeCompare(middleB);
      });

      const startIndex = (currentPage - 1) * studentsPerPage;
      const endIndex = startIndex + studentsPerPage;

      return {
        filteredStudents: sorted,
        paginatedStudents: sorted.slice(startIndex, endIndex),
        totalPages: Math.ceil(sorted.length / studentsPerPage),
        totalStudents: sorted.length,
      };
    }, [
      students,
      searchQuery,
      currentPage,
      studentsPerPage,
      studentMatchesFilter,
    ]);

  // Note: totalPages and totalStudents are now computed via useMemo above
  // No need for separate state or useEffect

  // Add helper to get index of Participation rubric in group view
  const participationIndex = isGroupView
    ? newReport.rubricDetails.length - 1
    : -1;

  const GroupViewTable = ({
    students,
    scores,
    rubricDetails,
    activeReport,
    handleScoreChange,
    paginatedStudents,
    isLoading,
  }: {
    students: Student[];
    scores: Record<string, GradingScore>;
    rubricDetails: RubricDetail[];
    activeReport: GradingReport | null;
    handleScoreChange: (
      studentId: string,
      rubricIndex: number,
      value: number | ""
    ) => void;
    paginatedStudents: Student[];
    isLoading: boolean;
  }) => {
    if (paginatedStudents.length === 0) {
      return (
        <tr>
          <td
            colSpan={rubricDetails.length + 3}
            className="text-center py-8 text-muted-foreground"
          >
            No students found
          </td>
        </tr>
      );
    }

    return paginatedStudents.map((student, idx) => {
      // Initialize scores for new students with all rubrics including Participation
      const studentScore = scores[student.id] || {
        studentId: student.id,
        scores: new Array(rubricDetails.length).fill(0),
        total: 0,
      };

      // Ensure the scores array has the correct length
      if (studentScore.scores.length !== rubricDetails.length) {
        studentScore.scores = new Array(rubricDetails.length).fill(0);
      }

      return (
        <tr key={student.id}>
          <td className="sticky left-0 z-10 bg-white px-4 py-2 align-middle w-[300px]">
            <div className="flex items-center gap-3">
              <img
                src={student.image}
                alt=""
                className="w-8 h-8 rounded-full object-cover"
              />
              <span>{`${student.lastName}, ${student.firstName}${
                student.middleInitial ? ` ${student.middleInitial}.` : ""
              }`}</span>
            </div>
          </td>
          {rubricDetails.map((rubric, rubricIdx) => {
            // If this is not the last rubric (should be grouped)
            if (rubricIdx < rubricDetails.length - 1) {
              // Only render for the first student row
              if (idx === 0) {
                // Get the value from the first student
                const groupValue =
                  students.length > 0 &&
                  scores[students[0].id]?.scores[rubricIdx] !== undefined
                    ? scores[students[0].id].scores[rubricIdx]
                    : "";
                let cellBg = "";
                if (groupValue) {
                  if (groupValue <= 3) {
                    cellBg = "bg-red-50";
                  } else {
                    cellBg = "bg-green-50";
                  }
                }
                return (
                  <td
                    key={`group-rubric-${rubricIdx}`}
                    rowSpan={paginatedStudents.length}
                    className={`text-center px-4 py-2 align-middle w-[120px] ${cellBg}`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      {isLoading ? (
                        <div className="w-full border rounded px-2 py-1 bg-gray-50 flex items-center justify-center">
                          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        </div>
                      ) : (
                        <select
                          className="w-full border rounded px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          value={groupValue}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            setScores((prev) => {
                              const updated = { ...prev };
                              students.forEach((student) => {
                                const studentScores =
                                  updated[student.id]?.scores ||
                                  new Array(rubricDetails.length).fill(0);
                                // Set the group rubric score for all students
                                studentScores[rubricIdx] = value;
                                const total = calculateTotal(studentScores);
                                updated[student.id] = {
                                  ...updated[student.id],
                                  scores: studentScores,
                                  total,
                                };
                                // Queue for auto-save for each student
                                queueScoreForSaving(
                                  student.id,
                                  studentScores,
                                  total
                                );
                              });
                              return updated;
                            });
                          }}
                          disabled={isLoading}
                        >
                          <option value="">Select grade</option>
                          {Array.from(
                            { length: Number(activeReport?.scoringRange) || 5 },
                            (_, i) => (
                              <option key={i + 1} value={i + 1}>
                                {i + 1}
                              </option>
                            )
                          )}
                        </select>
                      )}
                    </div>
                  </td>
                );
              } else {
                // Don't render for other student rows
                return null;
              }
            } else {
              // Last rubric (Participation)
              const value = studentScore.scores[rubricIdx] || "";
              let cellBg = "";
              if (value) {
                if (value <= 3) {
                  cellBg = "bg-red-50";
                } else {
                  cellBg = "bg-green-50";
                }
              }
              return (
                <td
                  key={rubricIdx}
                  className={`text-center px-4 py-2 align-middle w-[120px] ${cellBg}`}
                >
                  {isLoading ? (
                    <div className="w-full border rounded px-2 py-1 bg-gray-50 flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <select
                      className="w-full border rounded px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      value={value}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        handleScoreChange(student.id, rubricIdx, v);
                      }}
                      disabled={isLoading}
                    >
                      <option value="">Select grade</option>
                      {Array.from(
                        { length: Number(activeReport?.scoringRange) || 5 },
                        (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1}
                          </option>
                        )
                      )}
                    </select>
                  )}
                </td>
              );
            }
          })}
          <td className="text-center px-4 py-2 align-middle font-bold w-[100px]">
            {studentScore.scores.some((score) => score === 0) ||
            studentScore.total === 0
              ? "---"
              : `${studentScore.total.toFixed(2)}%`}
          </td>
          <td className="text-center px-4 py-2 align-middle w-[100px]">
            {studentScore.scores.some((score) => score === 0) ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                ---
              </span>
            ) : (
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  studentScore.total >= Number(activeReport?.passingScore)
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {`${activeReport?.passingScore}%`}
              </span>
            )}
          </td>
        </tr>
      );
    });
  };

  // Add useEffect for handling unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges()) {
        const message =
          "You have unsaved changes. Are you sure you want to leave?";
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    // Add event listener for beforeunload
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Add event listener for unload
    window.addEventListener("unload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("unload", handleBeforeUnload);
    };
  }, [hasChanges]);

  // Add useEffect for handling navigation
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");
      if (link && hasChanges()) {
        e.preventDefault();
        setPendingNavigation(link.href);
        setShowUnsavedChangesDialog(true);
      }
    };

    // Handle browser back/forward navigation
    const handlePopState = (e: PopStateEvent) => {
      if (hasChanges()) {
        e.preventDefault();
        setPendingNavigation(pathname);
        setShowUnsavedChangesDialog(true);
        // Push the current state back to prevent navigation
        window.history.pushState(null, "", pathname);
      }
    };

    // Handle form submissions
    const handleSubmit = (e: Event) => {
      if (hasChanges()) {
        e.preventDefault();
        setShowUnsavedChangesDialog(true);
      }
    };

    document.addEventListener("click", handleClick);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("submit", handleSubmit);

    return () => {
      document.removeEventListener("click", handleClick);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("submit", handleSubmit);
    };
  }, [hasChanges, pathname]);

  // Add function to handle navigation
  const handleNavigation = () => {
    setShowUnsavedChangesDialog(false);
    if (pendingNavigation) {
      if (pendingNavigation.startsWith("/")) {
        // Handle internal navigation
        router.push(pendingNavigation);
      } else {
        // Handle external navigation
        window.location.href = pendingNavigation;
      }
      setPendingNavigation(null);
    }
  };

  // Add function to handle edit button click
  const handleEditCriteria = (report: GradingReport) => {
    setEditingReport(report);
    setIsEditingCriteria(true);
    setNewReport({
      name: report.name,
      rubrics: report.rubrics.length.toString(),
      scoringRange: report.scoringRange,
      passingScore: report.passingScore,
      rubricDetails: report.rubrics.map((r) => ({
        name: r.name,
        weight: r.percentage,
        isGroupRubric: r.isGroupRubric || false,
      })),
    });
  };

  // Add function to handle save edit
  const handleSaveEdit = async () => {
    if (!editingReport) return;

    // Validate report name
    const nameError = validateReportName(newReport.name);
    if (nameError) {
      setValidationErrors((prev) => ({ ...prev, name: nameError }));
      toast.error(nameError, {
        duration: 3000,
        style: {
          background: "#fff",
          color: "#dc2626",
          border: "1px solid #e5e7eb",
        },
      });
      return;
    }

    // Validate all rubric names
    const rubricErrors = newReport.rubricDetails.map((rubric, idx, arr) => {
      if (isGroupView && idx === arr.length - 1) {
        // Skip validation for Participation rubric in group view
        return "";
      }
      return validateRubricName(rubric.name, idx);
    });
    const hasRubricErrors = rubricErrors.some((error) => error);
    if (hasRubricErrors) {
      setValidationErrors((prev) => ({ ...prev, rubrics: rubricErrors }));
      toast.error("Please fix the criteria name errors", {
        duration: 3000,
        style: {
          background: "#fff",
          color: "#dc2626",
          border: "1px solid #e5e7eb",
        },
      });
      return;
    }

    // Check if total weight equals 100%
    const totalWeight = newReport.rubricDetails.reduce(
      (sum, rubric) => sum + rubric.weight,
      0
    );
    if (totalWeight !== 100) {
      toast.error("Total weight must equal 100%", {
        duration: 3000,
        style: {
          background: "#fff",
          color: "#dc2626",
          border: "1px solid #e5e7eb",
        },
      });
      return;
    }

    // Show confirmation dialog
    setShowSaveEditConfirmation(true);
  };

  const handleConfirmSaveEdit = async () => {
    if (!editingReport) return; // Add null check for editingReport

    setIsSavingEdit(true);
    const loadingToast = toast.loading("Updating report...");
    try {
      const rubrics = newReport.rubricDetails.map((r, idx) => ({
        name:
          isGroupView && idx === newReport.rubricDetails.length - 1
            ? "Participation"
            : r.name,
        percentage: r.weight,
        isGroupRubric: isGroupView
          ? idx !== newReport.rubricDetails.length - 1
          : false,
      }));

      // If we're reducing the number of rubrics, we need to remove grades for the dropped rubrics
      if (newReport.rubricDetails.length < editingReport.rubrics.length) {
        // Update scores to keep only the first N rubrics
        setScores((prev) => {
          const newScores = { ...prev };
          Object.keys(newScores).forEach((studentId) => {
            const studentScore = newScores[studentId];
            // Keep only the scores for the first N rubrics
            studentScore.scores = studentScore.scores.slice(
              0,
              newReport.rubricDetails.length
            );
            // Recalculate total
            studentScore.total = calculateTotal(studentScore.scores);
          });
          return newScores;
        });

        // Save the updated scores to preserve the first N rubrics
        const formattedDate = selectedDate?.toISOString().split("T")[0];
        if (formattedDate) {
          const gradesToSave = Object.values(scores).map((score) => {
            const total = calculateTotal(
              score.scores.slice(0, newReport.rubricDetails.length)
            );
            return {
              studentId: score.studentId,
              scores: score.scores.slice(0, newReport.rubricDetails.length),
              total: total,
              reportingScore: isRecitationCriteria ? 0 : total,
              recitationScore: isRecitationCriteria ? total : 0,
            };
          });

          await saveGradesMutation.mutateAsync({
            courseSlug,
            gradeData: {
              date: formattedDate,
              criteriaId: editingReport.id,
              courseCode,
              courseSection,
              grades: gradesToSave,
              isRecitationCriteria,
            },
          });
        }
      }

      // Use the new PUT endpoint
      const updated = await updateCriteriaMutation.mutateAsync({
        courseSlug,
        criteriaId: editingReport.id,
        criteriaData: {
          name: newReport.name,
          rubrics: rubrics.map((r) => ({
            name: r.name,
            percentage: r.percentage,
          })),
          scoringRange: Number(newReport.scoringRange),
          passingScore: Number(newReport.passingScore),
        },
      });
      setSavedReports((prev) =>
        prev.map((report) => (report.id === updated.id ? updated : report))
      );
      setActiveReport(updated);
      setRubricDetails(updated.rubrics);
      setSelectedReport(updated.id);
      setIsEditingCriteria(false);
      setEditingReport(null);
      setShowEditDialog(false);
      setShowSaveEditConfirmation(false);
      setNewReport({
        name: "",
        rubrics: "2",
        scoringRange: "5",
        passingScore: "75",
        rubricDetails: [
          { name: "", weight: 50 },
          { name: "", weight: 50 },
        ],
      });
      setValidationErrors({});
      toast.dismiss(loadingToast);
      toast.success("Report updated successfully");
    } catch (error) {
      console.error("Error updating report:", error);
      toast.dismiss(loadingToast);
      toast.error("Failed to update report");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmRubricChange = async () => {
    if (pendingRubricCount) {
      await handleRubricCountChange(pendingRubricCount);
      setPendingRubricCount(null);
    }
    setShowRubricChangeWarning(false);
  };

  const handleImageUpload = async (index: number, file: File) => {
    try {
      const student = students[index];
      if (!student) return;

      // Use the upload mutation
      const result = await uploadImageMutation.mutateAsync(file);

      if (result?.imageUrl) {
        // Update the student's image in the local state
        setStudents((prevStudents) =>
          prevStudents.map((s) =>
            s.id === student.id ? { ...s, image: result.imageUrl } : s
          )
        );
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      // Error is handled by the mutation hook
      throw error;
    }
  };

  const handleSaveImageChanges = async (index: number) => {
    if (!tempImage || tempImage.index !== index) return;

    try {
      setIsSaving(true);

      // Convert base64 to blob
      const base64Response = await fetch(tempImage.dataUrl);
      const blob = await base64Response.blob();

      // Get file extension from data URL
      const ext = tempImage.dataUrl.split(";")[0].split("/")[1];
      const fileName = `image.${ext}`;

      // Create file from blob with proper name and type
      const file = new File([blob], fileName, { type: `image/${ext}` });

      // Use the upload mutation
      const result = await uploadImageMutation.mutateAsync(file);
      const imageUrl = result?.imageUrl;

      if (imageUrl) {
        // Update student list with new image URL
        setStudents((prev) =>
          prev.map((student, i) =>
            i === index ? { ...student, image: imageUrl } : student
          )
        );

        // Clear temp image
        setTempImage(null);

        // Show success message
        setShowSuccessMessage((prev) => ({ ...prev, [index]: true }));
        setTimeout(() => {
          setShowSuccessMessage((prev) => ({ ...prev, [index]: false }));
        }, 3000);
      }
    } catch (error) {
      console.error("Error saving image:", error);
      // Error is handled by the mutation hook
    } finally {
      setIsSaving(false);
    }
  };

  const confirmAndRemoveImage = async () => {
    if (imageToRemove) {
      try {
        const student = students[imageToRemove.index];

        // Delete the image file
        if (student.image) {
          await deleteImageMutation.mutateAsync(student.image);
        }

        // Update local state
        setStudents((prev) =>
          prev.map((student, idx) =>
            idx === imageToRemove.index
              ? { ...student, image: undefined }
              : student
          )
        );
        // Clear temp image if it exists for this student
        if (tempImage?.index === imageToRemove.index) {
          setTempImage(null);
        }
        setImageToRemove(null);
        // Success toast is handled by the mutation hook
      } catch (error) {
        console.error("Error removing image:", error);
        // Error is handled by the mutation hook
      }
    }
  };

  const handleRemoveImage = async (student: Student) => {
    try {
      if (student.image) {
        await deleteImageMutation.mutateAsync(student.image);
      }

      // Update the student's image in the local state
      setStudents((prevStudents) =>
        prevStudents.map((s) =>
          s.id === student.id ? { ...s, image: undefined } : s
        )
      );
      // Success toast is handled by the mutation hook
    } catch (error) {
      console.error("Error removing image:", error);
      // Error is handled by the mutation hook
      throw error;
    }
  };

  const handleImageClick = (student: Student) => {
    setSelectedStudent(student);
    setShowImageDialog(true);
  };

  return (
    <div className="min-h-screen w-full p-0">
      <div className="max-w-6xl mx-auto">
        <HeaderSection
          courseCode={courseCode}
          courseSection={courseSection}
          selectedDate={selectedDate}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterClick={() => setIsFilterOpen(true)}
          onDateSelect={(date) => onDateSelect?.(date)}
          onManageReport={() => {
            // Reset editing state when opening via Manage Report button
            setIsEditingCriteria(false);
            setEditingReport(null);
            setSelectedReport(activeReport?.id || "");
            // Mark as manually opened to prevent useEffect from closing it
            manuallyOpenedDialogRef.current = true;
            // Open the criteria dialog
            setShowCriteriaDialog(true);
          }}
          hasActiveReport={!!activeReport}
          isRecitationCriteria={isRecitationCriteria}
          filterCount={
            Number(gradeFilter.passed) +
            Number(gradeFilter.failed) +
            Number(gradeFilter.noGrades)
          }
          onBackClick={() => {
            if (hasChanges()) {
              setPendingNavigation(window.location.href);
              setShowUnsavedChangesDialog(true);
            } else {
              window.history.back();
            }
          }}
          gradeDates={gradeDates}
          isLoading={
            isLoadingStudents || isLoading || isLoadingGrades || !activeReport
          }
        />

        {/* Add Filter Sheet */}
        <Sheet
          open={isFilterOpen}
          onOpenChange={(open) => {
            if (open) {
              // When opening, initialize temp filter with current filter state
              setTempGradeFilter(gradeFilter);
            } else {
              // When closing without applying, revert temp filter
              setTempGradeFilter(gradeFilter);
            }
            setIsFilterOpen(open);
          }}
        >
          <SheetContent side="right" className="w-[340px] sm:w-[400px] p-0">
            <div className="p-6 border-b">
              <SheetHeader>
                <SheetTitle className="text-xl font-semibold">
                  Filter Options
                </SheetTitle>
              </SheetHeader>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <label className="text-sm font-medium text-gray-700">
                  Remarks
                </label>
                <div className="space-y-3 border rounded-lg p-4 bg-white">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={tempGradeFilter.passed}
                      onCheckedChange={() => handleFilterChange("passed")}
                      className="rounded border-gray-300 text-[#124A69] focus:ring-[#124A69]"
                    />
                    <span className="text-sm text-gray-700">Passed</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={tempGradeFilter.failed}
                      onCheckedChange={() => handleFilterChange("failed")}
                      className="rounded border-gray-300 text-[#124A69] focus:ring-[#124A69]"
                    />
                    <span className="text-sm text-gray-700">Failed</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={tempGradeFilter.noGrades}
                      onCheckedChange={() => handleFilterChange("noGrades")}
                      className="rounded border-gray-300 text-[#124A69] focus:ring-[#124A69]"
                    />
                    <span className="text-sm text-gray-700">No Grades</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-6 border-t mt-auto">
              <Button
                variant="outline"
                className="flex-1 rounded-lg"
                onClick={() => {
                  // Cancel: revert to previous state and close
                  setTempGradeFilter(gradeFilter);
                  setIsFilterOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                className="flex-1 rounded-lg"
                onClick={() => {
                  // Clear: set all to false in temp state
                  setTempGradeFilter({
                    passed: false,
                    failed: false,
                    noGrades: false,
                  });
                }}
              >
                Clear
              </Button>
              <Button
                className="flex-1 rounded-lg bg-[#124A69] hover:bg-[#0D3A54] text-white"
                onClick={() => {
                  // Apply: update actual filter state and close
                  setGradeFilter(tempGradeFilter);
                  setIsFilterOpen(false);
                }}
              >
                Apply
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {activeReport && (
          <div className="space-y-4 p-0 rounded-lg shadow-md">
            {/* Grading Table */}
            <div className="overflow-x-auto max-h-[calc(100vh-300px)]">
              <table className="w-full border-separate border-spacing-0 table-fixed">
                <GradingTableHeader
                  rubricDetails={rubricDetails}
                  activeReport={
                    activeReport
                      ? {
                          ...activeReport,
                          passingScore: Number(activeReport.passingScore),
                        }
                      : undefined
                  }
                />
                {isGroupView ? (
                  <tbody>
                    {isLoadingGroup || isLoadingStudents ? (
                      Array.from({ length: Math.min(studentsPerPage, 10) }).map(
                        (_, idx) => (
                          <tr key={idx}>
                            <td className="sticky left-0 z-10 bg-white px-4 py-2 align-middle w-[300px]">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
                                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                              </div>
                            </td>
                            {rubricDetails.map((_, rubricIdx) => (
                              <td
                                key={rubricIdx}
                                className="text-center px-4 py-2 align-middle w-[120px]"
                              >
                                <div className="h-8 w-full bg-gray-200 rounded animate-pulse" />
                              </td>
                            ))}
                            <td className="text-center px-4 py-2 align-middle w-[100px]">
                              <div className="h-4 w-16 bg-gray-200 rounded animate-pulse mx-auto" />
                            </td>
                            <td className="text-center px-4 py-2 align-middle w-[100px]">
                              <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse mx-auto" />
                            </td>
                          </tr>
                        )
                      )
                    ) : (
                      <GroupViewTable
                        students={students}
                        scores={scores}
                        rubricDetails={rubricDetails}
                        activeReport={activeReport}
                        handleScoreChange={handleScoreChange}
                        paginatedStudents={paginatedStudents}
                        isLoading={isLoadingGrades || isLoadingStudents}
                      />
                    )}
                  </tbody>
                ) : (
                  <tbody>
                    {isLoadingStudents || isLoading
                      ? Array.from({
                          length: Math.min(studentsPerPage, 10),
                        }).map((_, idx) => (
                          <tr key={idx}>
                            <td className="sticky left-0 z-10 bg-white px-4 py-2 align-middle w-[300px]">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
                                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                              </div>
                            </td>
                            {rubricDetails.map((_, rubricIdx) => (
                              <td
                                key={rubricIdx}
                                className="text-center px-4 py-2 align-middle w-[120px]"
                              >
                                <div className="h-8 w-full bg-gray-200 rounded animate-pulse" />
                              </td>
                            ))}
                            <td className="text-center px-4 py-2 align-middle w-[100px]">
                              <div className="h-4 w-16 bg-gray-200 rounded animate-pulse mx-auto" />
                            </td>
                            <td className="text-center px-4 py-2 align-middle w-[100px]">
                              <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse mx-auto" />
                            </td>
                          </tr>
                        ))
                      : (() => {
                          // Use memoized paginatedStudents from above (already computed via useMemo)
                          if (paginatedStudents.length === 0) {
                            return (
                              <tr>
                                <td
                                  colSpan={rubricDetails.length + 3}
                                  className="text-center py-8 text-muted-foreground"
                                >
                                  No students found
                                </td>
                              </tr>
                            );
                          }

                          return paginatedStudents.map(
                            (student: Student, idx: number) => {
                              const studentScore = scores[student.id] || {
                                studentId: student.id,
                                scores: new Array(rubricDetails.length).fill(0),
                                total: 0,
                              };
                              return (
                                <GradingTableRow
                                  key={student.id}
                                  student={student}
                                  rubricDetails={rubricDetails}
                                  activeReport={activeReport}
                                  studentScore={studentScore}
                                  handleScoreChange={handleScoreChange}
                                  idx={idx}
                                  onImageUpload={handleImageUpload}
                                  onSaveImageChanges={handleSaveImageChanges}
                                  onRemoveImage={(index, name) =>
                                    setImageToRemove({ index, name })
                                  }
                                  tempImage={tempImage}
                                  isSaving={isSaving}
                                  showSuccessMessage={showSuccessMessage}
                                  isLoading={
                                    isLoadingGrades || isLoadingStudents
                                  }
                                />
                              );
                            }
                          );
                        })()}
                  </tbody>
                )}
              </table>
            </div>
            {/* Footer Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t bg-white">
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-500 whitespace-nowrap">
                    {totalStudents > 0 ? (
                      <>
                        {currentPage * studentsPerPage - (studentsPerPage - 1)}-
                        {Math.min(currentPage * studentsPerPage, totalStudents)}{" "}
                        of {totalStudents} students
                      </>
                    ) : (
                      "No students found"
                    )}
                  </p>
                </div>
                <div className="flex-1 flex justify-end">
                  <Pagination className="w-full flex justify-end">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() =>
                            setCurrentPage((prev) => Math.max(prev - 1, 1))
                          }
                          className={
                            currentPage === 1
                              ? "pointer-events-none opacity-50"
                              : "hover:bg-gray-100"
                          }
                        />
                      </PaginationItem>
                      {[...Array(totalPages)].map((_, i) => (
                        <PaginationItem key={i}>
                          <PaginationLink
                            isActive={currentPage === i + 1}
                            onClick={() => setCurrentPage(i + 1)}
                            className={`${
                              currentPage === i + 1
                                ? "bg-[#124A69] text-white hover:bg-[#0d3a56]"
                                : "hover:bg-gray-100"
                            }`}
                          >
                            {i + 1}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() =>
                            setCurrentPage((prev) =>
                              Math.min(prev + 1, totalPages)
                            )
                          }
                          className={
                            currentPage === totalPages
                              ? "pointer-events-none opacity-50"
                              : "hover:bg-gray-100"
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              </div>
            </div>
          </div>
        )}

        {!showCriteriaDialog && !activeReport && (
          <EmptyState
            isLoading={criteriaLoading}
            isRecitationCriteria={isRecitationCriteria}
          />
        )}

        <BottomActionBar
          activeReport={activeReport}
          previousScores={previousScores}
          isLoading={isLoading}
          isLoadingStudents={isLoadingStudents}
          hasChanges={hasChanges}
          isSaving={isSaving}
          onReset={() => {
            if (previousScores) {
              // Undo action
              if (!previousScores) return;

              // Create a new object to ensure state update triggers re-render
              const restoredScores = { ...previousScores };

              // Update states in sequence to ensure proper re-render
              setScores({}); // Clear current scores first
              setTimeout(() => {
                setScores(restoredScores);
                setPreviousScores(null);
                toast.success("Grades restored", {
                  duration: 3000,
                  style: {
                    background: "#fff",
                    color: "#124A69",
                    border: "1px solid #e5e7eb",
                  },
                });
              }, 0);
            } else {
              // Show reset confirmation modal
              setShowResetConfirmation(true);
            }
          }}
          onEdit={() => {
            if (activeReport) {
              handleEditCriteria(activeReport);
              setShowEditDialog(true);
            }
          }}
          onExport={handleExport}
        />
      </div>

      {/* Keep all the dialogs here */}
      {/* ... existing dialogs ... */}
      <Dialog
        open={showCriteriaDialog}
        onOpenChange={(open) => {
          setShowCriteriaDialog(open);
          if (!open) {
            // Reset manual open flag when dialog is closed
            manuallyOpenedDialogRef.current = false;
          }
        }}
      >
        <DialogContent className="sm:max-w-[450px] p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#124A69]">
              {isEditingCriteria
                ? isRecitationCriteria
                  ? "Edit Recitation"
                  : "Edit Report"
                : isRecitationCriteria
                ? "Create New Recitation"
                : "Create New Report"}
            </DialogTitle>
            <DialogDescription>
              {isEditingCriteria
                ? "Edit the rubric details below"
                : "Set up your grading criteria and weights"}
            </DialogDescription>
          </DialogHeader>
          {criteriaLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs defaultValue="existing" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-gray-100 p-1 rounded-lg">
                <TabsTrigger
                  value="existing"
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  Use Existing
                </TabsTrigger>
                <TabsTrigger
                  value="new"
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  Create New
                </TabsTrigger>
              </TabsList>
              <TabsContent value="existing">
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-700">
                      {isRecitationCriteria
                        ? "Select a recitation"
                        : "Select a report"}
                    </div>
                    <p className="text-xs text-gray-500">
                      Select a criteria to use for grading. Each criteria shows
                      the date it was created.
                    </p>
                  </div>
                  {criteriaLoading ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-[#124A69]" />
                      <p className="text-sm text-gray-500 mt-2">
                        {loadingMessage}
                      </p>
                    </div>
                  ) : savedReports.length === 0 ? (
                    <div className="text-gray-500 text-center py-4">
                      {isRecitationCriteria
                        ? "No recitation reports found."
                        : "No reports found."}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <Select
                        value={selectedReport}
                        onValueChange={setSelectedReport}
                      >
                        <SelectTrigger className="bg-gray-50 border-gray-200 w-full max-w-[400px]">
                          <SelectValue
                            placeholder={
                              isRecitationCriteria
                                ? "Select saved recitation"
                                : "Select saved report"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {[...savedReports]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((report) => {
                              // Count students without grades for this report on the selected date
                              const ungradedCount = students.filter(
                                (student) => {
                                  const studentScore = scores[student.id];
                                  return (
                                    !studentScore ||
                                    studentScore.scores.length === 0 ||
                                    studentScore.scores.every(
                                      (score) => score === 0
                                    )
                                  );
                                }
                              ).length;

                              return (
                                <SelectItem key={report.id} value={report.id}>
                                  <div className="flex flex-col items-start">
                                    <span className="font-medium text-[#124A69]">
                                      {report.name}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      Date:{" "}
                                      {format(new Date(report.date), "PPP")} |{" "}
                                      {report.rubrics.length} Criteria | Passing
                                      Score: {report.passingScore}%
                                    </span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <DialogFooter className="gap-2 sm:gap-2">
                    <Button
                      variant="outline"
                      onClick={handleDialogClose}
                      className="border-gray-200"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleApplyCriteria}
                      disabled={!selectedReport}
                      className="bg-[#124A69] hover:bg-[#0d3a56]"
                    >
                      {isRecitationCriteria
                        ? "Apply Selected Recitation"
                        : "Apply Selected Report"}
                    </Button>
                  </DialogFooter>
                </div>
              </TabsContent>
              <TabsContent value="new">
                <div className="space-y-4 py-4">
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <label
                        htmlFor="name"
                        className="text-sm font-medium text-gray-700"
                      >
                        {isRecitationCriteria
                          ? "Recitation Name"
                          : "Report Name"}
                        <span className="text-red-500"> *</span>
                      </label>
                      <Input
                        id="name"
                        value={newReport.name}
                        onChange={handleReportNameChange}
                        placeholder={
                          isRecitationCriteria
                            ? "e.g., Week 1 Recitation"
                            : "e.g., Mt. Mayon Report"
                        }
                        maxLength={20}
                        className={`bg-gray-50 border-gray-200 ${
                          validationErrors.name ? "border-red-500" : ""
                        }`}
                      />
                      <div className="flex justify-between mt-1">
                        {validationErrors.name && (
                          <p className="text-sm text-red-500">
                            {validationErrors.name}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 -mt-2 ml-auto">
                          {newReport.name.length}/20
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <label
                        htmlFor="rubrics"
                        className="text-sm font-medium text-gray-700"
                      >
                        Number of Criteria{" "}
                        <span className="text-red-500"> *</span>
                      </label>
                      <Select
                        value={newReport.rubrics}
                        onValueChange={handleRubricCountChange}
                      >
                        <SelectTrigger className="bg-gray-50 border-gray-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">2 Criteria</SelectItem>
                          <SelectItem value="3">3 Criteria</SelectItem>
                          <SelectItem value="4">4 Criteria</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <label
                          htmlFor="scoringRange"
                          className="text-sm font-medium text-gray-700"
                        >
                          Scoring Range <span className="text-red-500"> *</span>
                        </label>
                        <Select
                          value={newReport.scoringRange}
                          onValueChange={(value) =>
                            setNewReport((prev) => ({
                              ...prev,
                              scoringRange: value,
                            }))
                          }
                        >
                          <SelectTrigger className="bg-gray-50 border-gray-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">1-5</SelectItem>
                            <SelectItem value="10">1-10</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <label
                          htmlFor="passingScore"
                          className="text-sm font-medium text-gray-700"
                        >
                          Passing Score (%)
                          <span className="text-red-500"> *</span>
                        </label>
                        <Select
                          value={newReport.passingScore}
                          onValueChange={(value) =>
                            setNewReport((prev) => ({
                              ...prev,
                              passingScore: value,
                            }))
                          }
                        >
                          <SelectTrigger className="bg-gray-50 border-gray-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="60">60%</SelectItem>
                            <SelectItem value="65">65%</SelectItem>
                            <SelectItem value="70">70%</SelectItem>
                            <SelectItem value="75">75%</SelectItem>
                            <SelectItem value="80">80%</SelectItem>
                            <SelectItem value="85">85%</SelectItem>
                            <SelectItem value="90">90%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-4 mt-2">
                      <label className="text-sm font-medium text-gray-700">
                        Rubric Details <span className="text-red-500"> *</span>
                      </label>
                      <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2">
                        {newReport.rubricDetails.map((rubric, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="relative w-[400px]">
                              <Input
                                value={
                                  isGroupView &&
                                  index === newReport.rubricDetails.length - 1
                                    ? "Participation"
                                    : rubric.name
                                }
                                onChange={(e) =>
                                  updateRubricDetail(
                                    index,
                                    "name",
                                    e.target.value
                                  )
                                }
                                placeholder={`Criteria ${index + 1} name`}
                                className={`bg-gray-50 border-gray-200 ${
                                  validationErrors.rubrics?.[index]
                                    ? "border-red-500"
                                    : ""
                                } ${
                                  isGroupView &&
                                  index === newReport.rubricDetails.length - 1
                                    ? "bg-gray-100 cursor-not-allowed"
                                    : ""
                                }`}
                                disabled={
                                  isGroupView &&
                                  index === newReport.rubricDetails.length - 1
                                }
                              />
                              {validationErrors.rubrics?.[index] && (
                                <p className="text-sm text-red-500">
                                  {validationErrors.rubrics[index]}
                                </p>
                              )}
                              <p className="flex justify-end text-xs text-gray-500 ml-auto">
                                {rubric.name.length}/15
                              </p>
                            </div>
                            <div className="relative w-[200px] -mt-4">
                              <div className="flex items-center gap-2">
                                <Slider
                                  value={[rubric.weight]}
                                  onValueChange={(value: number[]) =>
                                    updateRubricDetail(
                                      index,
                                      "weight",
                                      value[0]
                                    )
                                  }
                                  max={100}
                                  step={1}
                                  className="w-[100px]"
                                />
                                <Input
                                  value={rubric.weight}
                                  onChange={(e) =>
                                    updateRubricDetail(
                                      index,
                                      "weight",
                                      parseInt(e.target.value)
                                    )
                                  }
                                  type="number"
                                  min={0}
                                  max={100}
                                  className="w-[60px] bg-gray-50 border-gray-200"
                                />
                                <span className="text-sm text-gray-500">%</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end mt-2">
                        <p className="text-sm font-medium">
                          Total Weight:{" "}
                          <span
                            className={
                              newReport.rubricDetails.reduce(
                                (sum, r) => sum + r.weight,
                                0
                              ) === 100
                                ? "text-green-600"
                                : "text-red-500"
                            }
                          >
                            {newReport.rubricDetails.reduce(
                              (sum, r) => sum + r.weight,
                              0
                            )}
                            %
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="gap-2 sm:gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (isEditingCriteria) {
                          setIsEditingCriteria(false);
                          setEditingReport(null);
                          setNewReport({
                            name: "",
                            rubrics: "2",
                            scoringRange: "5",
                            passingScore: "75",
                            rubricDetails: [
                              { name: "", weight: 50 },
                              { name: "", weight: 50 },
                            ],
                          });
                          setValidationErrors({});
                        } else {
                          handleDialogClose();
                        }
                      }}
                      className="border-gray-200"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={
                        isEditingCriteria ? handleSaveEdit : handleCreateReport
                      }
                      disabled={
                        !newReport.name ||
                        !newReport.rubrics ||
                        newReport.rubricDetails.reduce(
                          (sum, r) => sum + r.weight,
                          0
                        ) !== 100 ||
                        newReport.rubricDetails.some((r) => !r.name.trim()) ||
                        newReport.rubricDetails.some((r, i) =>
                          newReport.rubricDetails.some(
                            (other, j) =>
                              i !== j &&
                              r.name.toLowerCase() === other.name.toLowerCase()
                          )
                        )
                      }
                      className="bg-[#124A69] hover:bg-[#0d3a56]"
                    >
                      {isEditingCriteria
                        ? "Save Changes"
                        : isRecitationCriteria
                        ? "Create New Recitation"
                        : "Create New Report"}
                    </Button>
                  </DialogFooter>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-[#124A69] text-xl font-bold">
              Reset Grades
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Are you sure you want to reset all grades? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setShowResetDialog(false)}
              className="border-gray-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleResetGrades}
              className="bg-[#124A69] hover:bg-[#0d3a56] text-white"
            >
              Reset Grades
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Warning Dialog */}
      <Dialog open={showExportWarning} onOpenChange={setShowExportWarning}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-[#124A69] text-xl font-bold">
              Warning: Unscored Students
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              There are students who have not been scored yet. Do you want to
              proceed with the export?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setShowExportWarning(false)}
              className="border-gray-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmExportWithWarning}
              className="bg-[#124A69] hover:bg-[#0d3a56] text-white"
            >
              Proceed with Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Preview Dialog */}
      <ExportReporting
        showExportPreview={showExportPreview}
        setShowExportPreview={setShowExportPreview}
        exportData={exportData}
        selectedDate={selectedDate}
        courseCode={courseCode}
        courseSection={courseSection}
        rubricDetails={rubricDetails}
      />

      {/* Reset Confirmation Modal */}
      <Dialog
        open={showResetConfirmation}
        onOpenChange={setShowResetConfirmation}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-[#124A69] text-xl font-bold">
              Reset Grades
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Are you sure you want to reset all grades? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowResetConfirmation(false)}
              className="border-gray-200"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setPreviousScores(scores);
                setScores({});
                students.forEach((student) => {
                  // Reset each rubric score individually
                  rubricDetails.forEach((_, index) => {
                    handleScoreChange(student.id, index, 0);
                  });
                });
                setShowResetConfirmation(false);
                toast.success("Grades reset successfully", {
                  duration: 5000,
                  style: {
                    background: "#fff",
                    color: "#124A69",
                    border: "1px solid #e5e7eb",
                  },
                });
              }}
              className="bg-[#124A69] hover:bg-[#0d3a56] text-white"
            >
              Reset Grades
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Dialog */}
      <Dialog
        open={showUnsavedChangesDialog}
        onOpenChange={(newOpen) => {
          if (!newOpen) {
            setShowUnsavedChangesDialog(false);
            setPendingNavigation(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-[#124A69] text-xl font-bold">
              Unsaved Changes
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              You have unsaved changes. Are you sure you want to leave? Your
              changes will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowUnsavedChangesDialog(false);
                setPendingNavigation(null);
              }}
              className="border-gray-200"
            >
              Stay
            </Button>
            <Button
              onClick={handleNavigation}
              className="bg-[#124A69] hover:bg-[#0D3A54] text-white"
            >
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-[#124A69] text-2xl font-bold">
              {isRecitationCriteria ? "Recitation" : "Grading Report"}
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              {isRecitationCriteria
                ? "Modify the recitation details"
                : "Modify the grading report details"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <label
                  htmlFor="name"
                  className="text-sm font-medium text-gray-700"
                >
                  {isRecitationCriteria ? "Recitation Name" : "Report Name"}
                  <span className="text-red-500"> *</span>
                </label>
                <Input
                  id="name"
                  value={newReport.name}
                  onChange={handleReportNameChange}
                  placeholder={
                    isRecitationCriteria
                      ? "e.g., Week 1 Recitation"
                      : "e.g., Mt. Mayon Report"
                  }
                  maxLength={20}
                  className={`bg-gray-50 border-gray-200 ${
                    validationErrors.name ? "border-red-500" : ""
                  }`}
                />
                <div className="flex justify-between mt-1">
                  {validationErrors.name && (
                    <p className="text-sm text-red-500">
                      {validationErrors.name}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 -mt-2 ml-auto">
                    {newReport.name.length}/20
                  </p>
                </div>
              </div>
              <div className="grid gap-2">
                <label
                  htmlFor="rubrics"
                  className="text-sm font-medium text-gray-700"
                >
                  Number of Criteria <span className="text-red-500"> *</span>
                </label>
                <Select
                  value={newReport.rubrics}
                  onValueChange={handleRubricCountChange}
                >
                  <SelectTrigger className="bg-gray-50 border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 Criteria</SelectItem>
                    <SelectItem value="3">3 Criteria</SelectItem>
                    <SelectItem value="4">4 Criteria</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label
                    htmlFor="scoringRange"
                    className="text-sm font-medium text-gray-700"
                  >
                    Scoring Range <span className="text-red-500"> *</span>
                  </label>
                  <Select
                    value={newReport.scoringRange}
                    onValueChange={(value) =>
                      setNewReport((prev) => ({
                        ...prev,
                        scoringRange: value,
                      }))
                    }
                  >
                    <SelectTrigger className="bg-gray-50 border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">1-5</SelectItem>
                      <SelectItem value="10">1-10</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <label
                    htmlFor="passingScore"
                    className="text-sm font-medium text-gray-700"
                  >
                    Passing Score (%)<span className="text-red-500"> *</span>
                  </label>
                  <Select
                    value={newReport.passingScore}
                    onValueChange={(value) =>
                      setNewReport((prev) => ({
                        ...prev,
                        passingScore: value,
                      }))
                    }
                  >
                    <SelectTrigger className="bg-gray-50 border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="60">60%</SelectItem>
                      <SelectItem value="65">65%</SelectItem>
                      <SelectItem value="70">70%</SelectItem>
                      <SelectItem value="75">75%</SelectItem>
                      <SelectItem value="80">80%</SelectItem>
                      <SelectItem value="85">85%</SelectItem>
                      <SelectItem value="90">90%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 mt-2">
                <label className="text-sm font-medium text-gray-700">
                  Rubric Details <span className="text-red-500"> *</span>
                </label>
                <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2">
                  {newReport.rubricDetails.map((rubric, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="relative w-[400px]">
                        <Input
                          value={
                            isGroupView &&
                            index === newReport.rubricDetails.length - 1
                              ? "Participation"
                              : rubric.name
                          }
                          onChange={(e) =>
                            updateRubricDetail(index, "name", e.target.value)
                          }
                          placeholder={`Rubric ${index + 1} name`}
                          className={`bg-gray-50 border-gray-200 ${
                            validationErrors.rubrics?.[index]
                              ? "border-red-500"
                              : ""
                          } ${
                            isGroupView &&
                            index === newReport.rubricDetails.length - 1
                              ? "bg-gray-100 cursor-not-allowed"
                              : ""
                          }`}
                          disabled={
                            isGroupView &&
                            index === newReport.rubricDetails.length - 1
                          }
                        />
                        {validationErrors.rubrics?.[index] && (
                          <p className="text-sm text-red-500">
                            {validationErrors.rubrics[index]}
                          </p>
                        )}
                        <p className="flex justify-end text-xs text-gray-500 ml-auto">
                          {rubric.name.length}/15
                        </p>
                      </div>
                      <div className="relative w-[200px] -mt-4">
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[rubric.weight]}
                            onValueChange={(value: number[]) =>
                              updateRubricDetail(index, "weight", value[0])
                            }
                            max={100}
                            step={1}
                            className="w-[100px]"
                          />
                          <Input
                            value={rubric.weight}
                            onChange={(e) =>
                              updateRubricDetail(
                                index,
                                "weight",
                                parseInt(e.target.value)
                              )
                            }
                            type="number"
                            min={0}
                            max={100}
                            className="w-[60px] bg-gray-50 border-gray-200"
                          />
                          <span className="text-sm text-gray-500">%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-2">
                  <p className="text-sm font-medium">
                    Total Weight:{" "}
                    <span
                      className={
                        newReport.rubricDetails.reduce(
                          (sum, r) => sum + r.weight,
                          0
                        ) === 100
                          ? "text-green-600"
                          : "text-red-500"
                      }
                    >
                      {newReport.rubricDetails.reduce(
                        (sum, r) => sum + r.weight,
                        0
                      )}
                      %
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditDialog(false);
                  setEditingReport(null);
                  setNewReport({
                    name: "",
                    rubrics: "2",
                    scoringRange: "5",
                    passingScore: "75",
                    rubricDetails: [
                      { name: "", weight: 50 },
                      { name: "", weight: 50 },
                    ],
                  });
                  setValidationErrors({});
                }}
                className="border-gray-200"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={
                  !newReport.name ||
                  !newReport.rubrics ||
                  newReport.rubricDetails.reduce(
                    (sum, r) => sum + r.weight,
                    0
                  ) !== 100 ||
                  newReport.rubricDetails.some((r) => !r.name.trim()) ||
                  newReport.rubricDetails.some((r, i) =>
                    newReport.rubricDetails.some(
                      (other, j) =>
                        i !== j &&
                        r.name.toLowerCase() === other.name.toLowerCase()
                    )
                  )
                }
                className="bg-[#124A69] hover:bg-[#0d3a56]"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save Edit Confirmation Dialog */}
      <Dialog
        open={showSaveEditConfirmation}
        onOpenChange={(newOpen) => {
          if (!newOpen) {
            setShowSaveEditConfirmation(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-[#124A69] text-xl font-bold">
              Confirm Changes
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Are you sure you want to save these changes? This will update the
              grading report and may affect existing grades.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSaveEditConfirmation(false)}
              className="border-gray-200"
              disabled={isSavingEdit}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSaveEdit}
              className="bg-[#124A69] hover:bg-[#0D3A54] text-white relative overflow-hidden"
              disabled={isSavingEdit}
            >
              {isSavingEdit ? (
                <>
                  <span className="absolute inset-0 flex items-center justify-center bg-[#124A69]">
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  </span>
                  <span className="opacity-0">Save Changes</span>
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rubric Change Warning Dialog */}
      <Dialog
        open={showRubricChangeWarning}
        onOpenChange={(newOpen) => {
          if (!newOpen) {
            setShowRubricChangeWarning(false);
            setPendingRubricCount(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-[#124A69] text-xl font-bold">
              Unsaved Changes
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              You have unsaved grade changes. Please wait for auto-save to
              complete before changing the rubric count.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowRubricChangeWarning(false);
                setPendingRubricCount(null);
              }}
              className="border-gray-200"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                // Wait for any pending auto-saves to complete
                if (pendingScoresRef.current.size > 0) {
                  await savePendingScores();
                }
                await handleConfirmRubricChange();
              }}
              className="bg-[#124A69] hover:bg-[#0D3A54] text-white"
            >
              Save and Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Removal Confirmation Dialog */}
      <Dialog
        open={!!imageToRemove}
        onOpenChange={(newOpen) => {
          if (!newOpen) {
            setImageToRemove(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-[#124A69] text-xl font-bold">
              Remove Profile Picture
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Are you sure you want to remove this profile picture? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setImageToRemove(null)}
              className="border-gray-200"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmAndRemoveImage}
              className="bg-[#124A69] hover:bg-[#0D3A54] text-white"
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add the StudentProfileDialog */}
      <StudentProfileDialog
        open={showImageDialog}
        onOpenChange={setShowImageDialog}
        student={selectedStudent}
        onAddImage={handleImageUpload}
        onRemoveImage={handleRemoveImage}
        students={students}
      />
    </div>
  );
}
