"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { gradingService } from "@/lib/services/client";
import React from "react";
import { saveAs } from "file-saver";
import {
  Search,
  Loader2,
  Settings,
  Download,
  ClipboardPaste,
  Lightbulb,
  ArrowRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { SettingsModal } from "./SettingsModal";
// Dynamic imports for heavy libraries (code-split)
import PasteGradesModal from "./paste-grades";
import ExcelJS from "exceljs";
import SplitText from "@/components/ui/SplitText";
import AnimatedContent from "@/components/ui/AnimatedContent";
import CustomTutorial, { TutorialStep } from "@/components/ui/CustomTutorial";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/svdialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const tutorialSteps: TutorialStep[] = [
  {
    target: "[data-tutorial='search-bar']",
    title: "Step 1: Search Students",
    content:
      "Quickly find students by typing their name here. The table will filter automatically as you type!",
    placement: "bottom",
    spotlightPadding: 8,
  },
  {
    target: "[data-tutorial='settings-button']",
    title: "Step 2: Configure Settings",
    content:
      "Click here to set up assessments, weights, and dates for each term. You must configure settings before you can start entering grades. You can customize PT/Lab, Quizzes, and Exams for each term!",
    placement: "bottom",
    spotlightPadding: 8,
  },
  {
    target: "[data-tutorial='paste-grades-button']",
    title: "Step 3: Paste Grades Quickly",
    content:
      "Copy grades from Excel and paste them in bulk! This saves tons of time when entering multiple grades. Simply copy a column of grades from Excel and paste them here. Note: This feature is only available after you've saved your class record settings.",
    placement: "bottom",
    spotlightPadding: 8,
  },
  {
    target: "[data-tutorial='export-button']",
    title: "Step 4: Export to Excel",
    content:
      "Download all grades as an Excel file. You can export either a summary view (final grades only) or a detailed view (all assessment scores). Perfect for backup or sharing with administration! Note: This feature is only available after you've saved your class record settings.",
    placement: "bottom",
    spotlightPadding: 8,
  },
  {
    target: "[data-tutorial='term-tabs']",
    title: "Step 5: Switch Between Terms",
    content:
      "Navigate between Prelims, Midterm, Pre-Finals, Finals, and Summary view. Each term has its own grades! You can only access terms that you've configured and saved in the Settings. The Summary view shows your final computed grades across all terms.",
    placement: "bottom",
    spotlightPadding: 8,
  },
  {
    target: "[data-tutorial='grade-table']",
    title: "Step 6: Enter Grades",
    content:
      "Click on any cell to enter grades. Scores that are below 75% will be highlighted in red. Grades are auto-saved after 1 second of inactivity. You can see validation errors if a score exceeds the max score. The system also supports base scoring (transmutation) for PT/Lab and Quizzes.",
    placement: "top",
    spotlightPadding: 8,
  },
];

const TERMS = ["PRELIM", "MIDTERM", "PREFINALS", "FINALS", "SUMMARY"] as const;
type Term = (typeof TERMS)[number];

interface Assessment {
  id: string;
  name: string;
  type: "PT" | "QUIZ" | "EXAM";
  maxScore: number;
  date: string | null;
  enabled: boolean;
  order: number;
  linkedCriteriaId?: string | null;
  transmutationBase?: number;
}

interface TermConfig {
  id: string;
  term: Term;
  ptWeight: number;
  quizWeight: number;
  examWeight: number;
  assessments: Assessment[];
}

interface StudentScore {
  studentId: string;
  assessmentId: string;
  score: number | null;
  rawScores?: number[];
  criteriaId?: string;
}

interface Student {
  id: string;
  studentId: string;
  lastName: string;
  firstName: string;
  middleInitial: string | null;
  image?: string | null;
}

interface ClassRecordData {
  students: Array<{
    id: string;
    studentId: string;
    firstName: string;
    lastName: string;
    middleInitial: string | null;
    image: string | null;
  }>;
  termConfigs: Record<string, TermConfig> | null;
  assessmentScores: Record<string, any>;
  criteriaLinks: {
    recitations?: Array<{
      id: string;
      name: string;
      date: string | null;
      maxScore: number;
    }>;
    groupReportings?: Array<{
      id: string;
      name: string;
      date: string | null;
      maxScore: number;
    }>;
    individualReportings?: Array<{
      id: string;
      name: string;
      date: string | null;
      maxScore: number;
    }>;
  } | null;
  criteriaMetadata?: Record<
    string,
    {
      scoringRange: number;
      rubrics: Array<{ percentage: number }>;
    }
  >;
}

interface ClassRecordTableProps {
  courseSlug: string;
  courseCode: string;
  courseSection: string;
  courseTitle: string;
  courseNumber: number;
  initialData?: ClassRecordData;
}

const TERM_WEIGHTS = {
  PRELIM: 0.2,
  MIDTERM: 0.2,
  PREFINALS: 0.2,
  FINALS: 0.4,
} as const;

function percent(score: number | null, max: number | null): number | null {
  if (score == null || max == null || max <= 0) return null;
  return Math.max(0, Math.min(100, (score / max) * 100));
}

function transmuteScore(
  rawScore: number | null,
  maxScore: number,
  base: number
): number | null {
  // If base is 0, no transmutation (raw score stays the same)
  if (base === 0 || rawScore === null) return rawScore;

  // New formula: (raw_score / max_score) * (base% of max_score) + (remaining% of max_score)
  // Simplified: raw_score * (base/100) + ((100 - base)/100) * max_score
  const basePercentage = base / 100;
  const remainingPercentage = (100 - base) / 100;
  const transmuted = rawScore * basePercentage + remainingPercentage * maxScore;

  return transmuted;
}

function getNumericGrade(totalPercent: number): string {
  if (totalPercent >= 97.5) return "1.00";
  if (totalPercent >= 94.5) return "1.25";
  if (totalPercent >= 91.5) return "1.50";
  if (totalPercent >= 86.5) return "1.75";
  if (totalPercent >= 81.5) return "2.00";
  if (totalPercent >= 76.0) return "2.25";
  if (totalPercent >= 70.5) return "2.50";
  if (totalPercent >= 65.0) return "2.75";
  if (totalPercent >= 59.5) return "3.00";
  return "5.00";
}

function getScoreStyle(score: number | null, max: number | null): string {
  if (score != null && score > 0 && (max == null || max <= 0))
    return "bg-red-500 text-white";
  if (score != null && max != null && score > max)
    return "bg-red-500 text-white";
  if (score != null && max != null && max > 0) {
    const percentage = (score / max) * 100;
    return percentage < 75 ? "text-red-500" : "";
  }
  return "";
}

export interface CriteriaOption {
  id: string;
  name: string;
  date?: string | null;
  maxScore?: number;
  type: "RECITATION" | "GROUP_REPORTING" | "INDIVIDUAL_REPORTING";
}

export function ClassRecordTable({
  courseSlug,
  courseCode,
  courseSection,
  courseTitle,
  courseNumber,
  initialData,
}: ClassRecordTableProps) {
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [termConfigs, setTermConfigs] = useState<Record<string, TermConfig>>({
    PRELIM: {
      id: "prelims",
      term: "PRELIM",
      ptWeight: 30,
      quizWeight: 20,
      examWeight: 50,
      assessments: [
        {
          id: "pt1",
          name: "PT1",
          type: "PT",
          maxScore: 50,
          date: null,
          enabled: true,
          order: 0,
        },
        {
          id: "q1",
          name: "Q1",
          type: "QUIZ",
          maxScore: 20,
          date: null,
          enabled: true,
          order: 0,
        },
        {
          id: "exam1",
          name: "Exam",
          type: "EXAM",
          maxScore: 100,
          date: null,
          enabled: true,
          order: 0,
        },
      ],
    },
    MIDTERM: {
      id: "midterm",
      term: "MIDTERM",
      ptWeight: 30,
      quizWeight: 20,
      examWeight: 50,
      assessments: [
        {
          id: "pt2",
          name: "PT1",
          type: "PT",
          maxScore: 50,
          date: null,
          enabled: true,
          order: 0,
        },
        {
          id: "q2",
          name: "QUIZ1",
          type: "QUIZ",
          maxScore: 20,
          date: null,
          enabled: true,
          order: 0,
        },
        {
          id: "exam2",
          name: "Exam",
          type: "EXAM",
          maxScore: 100,
          date: null,
          enabled: true,
          order: 0,
        },
      ],
    },
    PREFINALS: {
      id: "prefinals",
      term: "PREFINALS",
      ptWeight: 30,
      quizWeight: 20,
      examWeight: 50,
      assessments: [
        {
          id: "pt3",
          name: "PT1",
          type: "PT",
          maxScore: 50,
          date: null,
          enabled: true,
          order: 0,
        },
        {
          id: "q3",
          name: "QUIZ1",
          type: "QUIZ",
          maxScore: 20,
          date: null,
          enabled: true,
          order: 0,
        },
        {
          id: "exam3",
          name: "Exam",
          type: "EXAM",
          maxScore: 100,
          date: null,
          enabled: true,
          order: 0,
        },
      ],
    },
    FINALS: {
      id: "finals",
      term: "FINALS",
      ptWeight: 30,
      quizWeight: 20,
      examWeight: 50,
      assessments: [
        {
          id: "pt4",
          name: "PT1",
          type: "PT",
          maxScore: 50,
          date: null,
          enabled: true,
          order: 0,
        },
        {
          id: "q4",
          name: "QUIZ1",
          type: "QUIZ",
          maxScore: 20,
          date: null,
          enabled: true,
          order: 0,
        },
        {
          id: "exam4",
          name: "Exam",
          type: "EXAM",
          maxScore: 100,
          date: null,
          enabled: true,
          order: 0,
        },
      ],
    },
  });
  const [availableCriteria, setAvailableCriteria] = useState<CriteriaOption[]>(
    []
  );
  const [scores, setScores] = useState<Map<string, StudentScore>>(new Map());
  const [criteriaMetadata, setCriteriaMetadata] = useState<
    Record<
      string,
      {
        scoringRange: number;
        rubrics: Array<{ percentage: number }>;
      }
    >
  >({});
  const [search, setSearch] = useState("");
  const [activeTerm, setActiveTerm] = useState<Term>("PRELIM");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(7);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null
  );
  const [hasTermConfigs, setHasTermConfigs] = useState(false);
  // Track which score inputs are currently being edited (focused)
  const [editingScores, setEditingScores] = useState<Set<string>>(new Set());
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [summarySelectedTerm, setSummarySelectedTerm] = useState<Term | "ALL">(
    "ALL"
  );

  const pendingScoresRef = useRef<
    Map<
      string,
      { studentId: string; assessmentId: string; score: number | null }
    >
  >(new Map());
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const shownMessagesRef = useRef<Set<string>>(new Set());
  const notifyOnce = (message: string) => {
    if (shownMessagesRef.current.has(message)) return;
    shownMessagesRef.current.add(message);
    toast.error(message, { id: `toast:${message}` });
  };

  // Initialize data from props or fetch on mount
  useEffect(() => {
    const initializeData = (classRecordData: ClassRecordData) => {
      const studentList = classRecordData.students || [];
      setStudents(studentList);
      if (
        classRecordData.termConfigs &&
        Object.keys(classRecordData.termConfigs).length > 0
      ) {
        setTermConfigs(classRecordData.termConfigs);
        setHasTermConfigs(true);
      } else {
        setHasTermConfigs(false);
      }
      // Convert assessment scores object to Map format
      const assessmentScoresMap = new Map<string, StudentScore>();
      const assessmentScoresData = classRecordData.assessmentScores || {};
      Object.entries(assessmentScoresData).forEach(
        ([key, value]: [string, any]) => {
          assessmentScoresMap.set(key, {
            studentId: value.studentId,
            assessmentId: value.assessmentId,
            score: value.score,
            // ✅ Store raw scores and criteriaId for linked criteria
            rawScores: value.rawScores,
            criteriaId: value.criteriaId,
          });
        }
      );
      setScores(assessmentScoresMap);

      // ✅ Cache criteria metadata
      if (classRecordData.criteriaMetadata) {
        setCriteriaMetadata(classRecordData.criteriaMetadata);
      }
      const {
        recitations = [],
        groupReportings = [],
        individualReportings = [],
      } = classRecordData.criteriaLinks || {};
      const recitationList = recitations.map((item: any) => ({
        id: item.id,
        name: item.name,
        date: item.date,
        maxScore: item.maxScore,
        type: "RECITATION" as const,
      }));
      const groupList = groupReportings.map((item: any) => ({
        id: item.id,
        name: item.name,
        date: item.date,
        maxScore: item.maxScore,
        type: "GROUP_REPORTING" as const,
      }));
      const individualList = individualReportings.map((item: any) => ({
        id: item.id,
        name: item.name,
        date: item.date,
        maxScore: item.maxScore,
        type: "INDIVIDUAL_REPORTING" as const,
      }));
      setAvailableCriteria([
        ...recitationList,
        ...groupList,
        ...individualList,
      ]);
    };

    // Use initialData if provided, otherwise fetch
    if (initialData) {
      setLoading(true);
      initializeData(initialData);
      // Small delay for smooth transition
      setTimeout(() => setLoading(false), 300);
    } else {
      // Fallback: fetch data if initialData not provided (for backward compatibility)
      const load = async () => {
        if (!courseSlug) return;
        setLoading(true);
        try {
          const classRecordData = await gradingService.getClassRecordData(
            courseSlug
          );
          if (classRecordData) {
            initializeData(classRecordData);
          }
          await new Promise((resolve) => setTimeout(resolve, 300));
        } catch (err) {
          console.error("Error loading data:", err);
          toast.error("Failed to load class records");
        } finally {
          setLoading(false);
        }
      };
      load();
    }
  }, [courseSlug, initialData]);

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem(
      "didasko-class-record-tutorial"
    );
    // Only show tutorial if term configs are saved and user hasn't seen it
    if (!hasSeenTutorial && !loading && students.length > 0 && hasTermConfigs) {
      setTimeout(() => setShowTutorial(true), 1000);
    }
  }, [loading, students.length, hasTermConfigs]);

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
        gradingService
          .saveAssessmentScoresBulk(courseSlug, gradesToSave)
          .catch((err) => {
            console.error("Failed to save pending scores on unmount:", err);
          });
      }
    };
  }, [courseSlug]);

  const handleTutorialComplete = () => {
    setShowTutorial(false);
    localStorage.setItem("didasko-class-record-tutorial", "completed");
  };

  const handleTutorialSkip = () => {
    setShowTutorial(false);
    localStorage.setItem("didasko-class-record-tutorial", "completed");
  };

  const savePendingScores = async () => {
    if (pendingScoresRef.current.size === 0) return;

    // Create a copy of pending scores before clearing
    const gradesToSave = Array.from(pendingScoresRef.current.values());

    // Validate grades before sending
    const validGrades = gradesToSave.filter((g) => {
      if (g.score === null) return true; // null is valid (delete)
      if (typeof g.score !== "number" || isNaN(g.score)) return false;
      if (g.score < 0) return false;
      if (!g.studentId || !g.assessmentId) return false;
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
      await gradingService.saveAssessmentScoresBulk(courseSlug, validGrades);
      toast.success("Grades saved successfully", { id: "save-grades" });

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
  };

  const queueScoreForSaving = (
    studentId: string,
    assessmentId: string,
    score: number | null
  ) => {
    // Add to pending scores
    const key = `${studentId}:${assessmentId}`;
    pendingScoresRef.current.set(key, { studentId, assessmentId, score });

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout to save after 2 seconds of no changes
    saveTimeoutRef.current = setTimeout(() => {
      savePendingScores();
    }, 1000);
  };

  const saveBulkScoresToAPI = async (
    grades: Array<{
      studentId: string;
      assessmentId: string;
      score: number | null;
    }>
  ) => {
    // Validate grades before sending
    const validGrades = grades.filter((g) => {
      if (g.score === null) return true; // null is valid (delete)
      if (typeof g.score !== "number") return false;
      if (g.score < 0) return false;
      if (!g.studentId || !g.assessmentId) return false;
      return true;
    });

    if (validGrades.length !== grades.length) {
      toast.error("Some grades are invalid and were not saved", {
        id: "bulk-save",
      });
      return;
    }

    try {
      toast.loading("Updating grades...", { id: "bulk-save" });
      await gradingService.saveAssessmentScoresBulk(courseSlug, validGrades);
      toast.success("Grades updated successfully", { id: "bulk-save" });

      // Dispatch event to refresh leaderboard seamlessly
      window.dispatchEvent(
        new CustomEvent("gradesUpdated", {
          detail: { courseSlug },
        })
      );
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.error ||
        error?.message ||
        "Failed to save grades";
      toast.error(errorMessage, { id: "bulk-save" });
      console.error("Error saving bulk grades:", error);
      throw error; // Re-throw to allow caller to handle
    }
  };

  const currentConfig = termConfigs[activeTerm];
  const pts =
    currentConfig?.assessments
      .filter((a) => a.type === "PT" && a.enabled)
      .sort((a, b) => a.order - b.order) || [];
  const quizzes =
    currentConfig?.assessments
      .filter((a) => a.type === "QUIZ" && a.enabled)
      .sort((a, b) => a.order - b.order) || [];
  const exam = currentConfig?.assessments.find(
    (a) => a.type === "EXAM" && a.enabled
  );

  const getScore = (studentId: string, assessmentId: string): number | null => {
    const result = scores.get(`${studentId}:${assessmentId}`);
    return result?.score ?? null;
  };

  const getLinkedCriteriaScore = (
    studentId: string,
    criteriaId: string
  ): number | null => {
    const student = scores.get(`${studentId}:criteria:${criteriaId}`);
    return student?.score ?? null;
  };

  /**
   * Calculate weighted percentage from raw rubric scores
   * Uses the same formula as grading-table.tsx calculateTotal
   */
  const calculateWeightedPercentage = (
    rawScores: number[] | null | undefined,
    rubrics: Array<{ percentage: number }>,
    scoringRange: number
  ): number => {
    if (
      !rawScores ||
      !Array.isArray(rawScores) ||
      !rubrics ||
      rubrics.length === 0
    )
      return 0;

    // Ensure we only use scores up to the number of rubrics
    const validScores = rawScores.slice(0, rubrics.length);

    // Calculate weighted percentage for each rubric
    const weightedScores = validScores.map((score, index) => {
      const weight = rubrics[index]?.percentage || 0;
      // Convert score to percentage based on max score, then apply weight
      return (score / scoringRange) * weight;
    });

    // Sum up all weighted scores and round to 2 decimal places
    const total = Number(
      weightedScores.reduce((sum, score) => sum + score, 0).toFixed(2)
    );

    return total;
  };

  /**
   * Get the true score (not percentage) from linked criteria
   */
  const getTrueScoreFromCriteria = (
    studentId: string,
    criteriaId: string,
    assessmentMaxScore: number
  ): number | null => {
    const gradeData = scores.get(`${studentId}:criteria:${criteriaId}`);
    if (!gradeData) return null;

    // Get raw scores and criteria metadata
    const rawScores = gradeData.rawScores;
    const criteriaMeta = criteriaMetadata?.[criteriaId];

    // Ensure rawScores is an array
    const scoresArray = Array.isArray(rawScores) ? rawScores : null;

    if (!scoresArray || !criteriaMeta) {
      // Fallback: use percentage if raw scores not available
      const percentage = gradeData.score;
      if (percentage === null) return null;
      return Math.round((percentage / 100) * assessmentMaxScore * 100) / 100;
    }

    // Calculate weighted percentage from raw scores
    const weightedPercentage = calculateWeightedPercentage(
      scoresArray,
      criteriaMeta.rubrics,
      criteriaMeta.scoringRange
    );

    // Convert percentage to actual score
    const trueScore = (weightedPercentage / 100) * assessmentMaxScore;
    return Math.round(trueScore * 100) / 100;
  };

  const getEffectiveScore = (
    studentId: string,
    assessment: Assessment
  ): number | null => {
    if (assessment.linkedCriteriaId) {
      // ✅ Use new function to get true score from raw rubric scores
      return getTrueScoreFromCriteria(
        studentId,
        assessment.linkedCriteriaId,
        assessment.maxScore
      );
    }
    return getScore(studentId, assessment.id);
  };

  const setScore = (
    studentId: string,
    assessmentId: string,
    score: number | null
  ) => {
    // Validate score before setting
    if (score !== null) {
      if (typeof score !== "number" || isNaN(score)) {
        console.error("Invalid score value:", score);
        return;
      }
      if (score < 0) {
        console.error("Score cannot be negative:", score);
        return;
      }
    }

    const key = `${studentId}:${assessmentId}`;
    const updated = new Map(scores);
    if (score === null) {
      updated.delete(key);
    } else {
      updated.set(key, { studentId, assessmentId, score });
    }
    setScores(updated);
    queueScoreForSaving(studentId, assessmentId, score);
  };

  const handleNumericKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow keyboard shortcuts (Ctrl, Cmd, Alt combinations)
    if (e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }

    const allowed = [
      "Backspace",
      "Delete",
      "ArrowLeft",
      "ArrowRight",
      "Tab",
      "Home",
      "End",
    ];
    if (/^[0-9]$/.test(e.key)) return;
    if (allowed.includes(e.key)) return;
    e.preventDefault();
  };

  const sanitizeDigits = (value: string) => value.replace(/[^0-9]/g, "");

  // Function to remove emojis from text
  const removeEmojis = (text: string): string => {
    // Remove emojis using regex pattern
    // This pattern matches most emoji ranges in Unicode
    return text.replace(
      /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{200D}]|[\u{FE00}-\u{FE0F}]|[\u{20D0}-\u{20FF}]/gu,
      ""
    );
  };

  const handleScoreChange =
    (studentId: string, assessmentId: string, max: number) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Extract just the raw score (number before parenthesis if present)
      const inputValue = e.target.value;
      const rawValue = inputValue.includes("(")
        ? inputValue.split("(")[0].trim()
        : inputValue;
      const digits = sanitizeDigits(rawValue);
      if (digits === "") {
        setScore(studentId, assessmentId, null);
        return;
      }
      const num = Number(digits);
      // Validate: score must be non-negative and not exceed max
      if (num < 0) {
        notifyOnce(`Score cannot be negative.`);
        setScore(studentId, assessmentId, 0);
        return;
      }
      if (num === 0) {
        setScore(studentId, assessmentId, 0);
        return;
      }
      if (num > max) {
        notifyOnce(`Score cannot exceed max (${max}).`);
        setScore(studentId, assessmentId, max);
      } else {
        setScore(studentId, assessmentId, num);
      }
    };

  const computeTermGrade = (studentId: string, term: Term) => {
    const config = termConfigs[term];
    if (!config) return null;
    const ptAssessments = config.assessments.filter(
      (a) => a.type === "PT" && a.enabled
    );
    const quizAssessments = config.assessments.filter(
      (a) => a.type === "QUIZ" && a.enabled
    );
    const examAssessment = config.assessments.find(
      (a) => a.type === "EXAM" && a.enabled
    );
    // Check if any score exceeds max score
    let hasScoreExceedingMax = false;

    // Apply transmutation to raw scores before calculating percentages (per-assessment)
    let ptPercentages: number[] = [];
    ptAssessments.forEach((pt) => {
      const rawScore = getEffectiveScore(studentId, pt);
      // For linked assessments, if no score exists, treat as 0 for computation
      const scoreForComputation =
        rawScore === null && pt.linkedCriteriaId ? 0 : rawScore;
      // Check if raw score exceeds max score
      if (scoreForComputation !== null && scoreForComputation > pt.maxScore) {
        hasScoreExceedingMax = true;
      }
      // Apply transmutation using assessment's own transmutationBase
      const transmutedScore = transmuteScore(
        scoreForComputation,
        pt.maxScore,
        pt.transmutationBase ?? 0
      );
      if (transmutedScore !== null) {
        const pct = percent(transmutedScore, pt.maxScore);
        if (pct !== null) ptPercentages.push(pct);
      }
    });
    let quizPercentages: number[] = [];
    quizAssessments.forEach((quiz) => {
      const rawScore = getEffectiveScore(studentId, quiz);
      // For linked assessments, if no score exists, treat as 0 for computation
      const scoreForComputation =
        rawScore === null && quiz.linkedCriteriaId ? 0 : rawScore;
      // Check if raw score exceeds max score
      if (scoreForComputation !== null && scoreForComputation > quiz.maxScore) {
        hasScoreExceedingMax = true;
      }
      // Apply transmutation using assessment's own transmutationBase
      const transmutedScore = transmuteScore(
        scoreForComputation,
        quiz.maxScore,
        quiz.transmutationBase ?? 0
      );
      if (transmutedScore !== null) {
        const pct = percent(transmutedScore, quiz.maxScore);
        if (pct !== null) quizPercentages.push(pct);
      }
    });
    let examPercentage: number | null = null;
    if (examAssessment) {
      const rawExamScore = getEffectiveScore(studentId, examAssessment);
      // For linked assessments, if no score exists, treat as 0 for computation
      const scoreForComputation =
        rawExamScore === null && examAssessment.linkedCriteriaId
          ? 0
          : rawExamScore;
      // Check if raw score exceeds max score
      if (
        scoreForComputation !== null &&
        scoreForComputation > examAssessment.maxScore
      ) {
        hasScoreExceedingMax = true;
      }
      // Apply transmutation using assessment's own transmutationBase
      const transmutedExamScore = transmuteScore(
        scoreForComputation,
        examAssessment.maxScore,
        examAssessment.transmutationBase ?? 0
      );
      if (transmutedExamScore !== null) {
        examPercentage = percent(transmutedExamScore, examAssessment.maxScore);
      }
    }
    // CRITICAL FIX: Divide by actual number of scores, not total assessments
    // If a student has scores for 2 out of 3 PT assessments, divide by 2, not 3
    const ptAvg =
      ptPercentages.length > 0
        ? ptPercentages.reduce((a, b) => a + b, 0) / ptPercentages.length
        : null;
    const quizAvg =
      quizPercentages.length > 0
        ? quizPercentages.reduce((a, b) => a + b, 0) / quizPercentages.length
        : null;

    // Calculate weighted scores independently:
    // PT weighted is calculated if ALL PT assessments have scores
    // Quiz weighted is calculated if ALL Quiz assessments have scores
    // Exam weighted is calculated if Exam has a score
    const hasAllPTScores =
      ptAssessments.length === 0 ||
      (ptPercentages.length === ptAssessments.length && ptAvg !== null);
    const hasAllQuizScores =
      quizAssessments.length === 0 ||
      (quizPercentages.length === quizAssessments.length && quizAvg !== null);
    const hasExamScore = !examAssessment || examPercentage !== null;

    const ptWeighted =
      hasAllPTScores && ptAvg !== null ? (ptAvg / 100) * config.ptWeight : null;
    const quizWeighted =
      hasAllQuizScores && quizAvg !== null
        ? (quizAvg / 100) * config.quizWeight
        : null;
    const examWeighted =
      hasExamScore && examPercentage !== null
        ? (examPercentage / 100) * config.examWeight
        : null;

    // Only calculate total if we have all required scores
    // If PT assessments exist, we need ALL PT scores
    // If Quiz assessments exist, we need ALL Quiz scores
    // If Exam assessment exists, we need Exam score
    const hasRequiredPTScores =
      ptAssessments.length === 0 || ptWeighted !== null;
    const hasRequiredQuizScores =
      quizAssessments.length === 0 || quizWeighted !== null;
    const hasRequiredExamScore = !examAssessment || examWeighted !== null;

    // Calculate total only if all required components are present
    const totalPercent =
      hasRequiredPTScores && hasRequiredQuizScores && hasRequiredExamScore
        ? (ptWeighted ?? 0) + (quizWeighted ?? 0) + (examWeighted ?? 0)
        : null;

    return {
      totalPercent: totalPercent !== null ? totalPercent.toFixed(2) : "-",
      numericGrade:
        totalPercent !== null
          ? hasScoreExceedingMax
            ? "(error)"
            : getNumericGrade(totalPercent)
          : "-",
      ptWeighted: ptWeighted !== null ? ptWeighted.toFixed(2) : "-",
      quizWeighted: quizWeighted !== null ? quizWeighted.toFixed(2) : "-",
      examWeighted: examWeighted !== null ? examWeighted.toFixed(2) : "-",
    };
  };

  const computeFinalGrade = (studentId: string) => {
    const prelimGrade = computeTermGrade(studentId, "PRELIM");
    const midtermGrade = computeTermGrade(studentId, "MIDTERM");
    const preFinalsGrade = computeTermGrade(studentId, "PREFINALS");
    const finalsGrade = computeTermGrade(studentId, "FINALS");
    if (!prelimGrade || !midtermGrade || !preFinalsGrade || !finalsGrade)
      return null;

    // Check if any term grade is invalid (has "-" or is NaN)
    const prelimNum = parseFloat(prelimGrade.numericGrade);
    const midtermNum = parseFloat(midtermGrade.numericGrade);
    const preFinalsNum = parseFloat(preFinalsGrade.numericGrade);
    const finalsNum = parseFloat(finalsGrade.numericGrade);

    // If any term grade is invalid (NaN or "-"), return null
    if (
      isNaN(prelimNum) ||
      isNaN(midtermNum) ||
      isNaN(preFinalsNum) ||
      isNaN(finalsNum) ||
      prelimGrade.numericGrade === "-" ||
      midtermGrade.numericGrade === "-" ||
      preFinalsGrade.numericGrade === "-" ||
      finalsGrade.numericGrade === "-"
    ) {
      return null;
    }

    const finalWeighted =
      prelimNum * TERM_WEIGHTS.PRELIM +
      midtermNum * TERM_WEIGHTS.MIDTERM +
      preFinalsNum * TERM_WEIGHTS.PREFINALS +
      finalsNum * TERM_WEIGHTS.FINALS;

    // Double-check the result is valid
    if (isNaN(finalWeighted)) {
      return null;
    }

    return {
      grade: finalWeighted.toFixed(2),
      remarks: finalWeighted <= 3.0 ? "PASSED" : "FAILED",
    };
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = students;

    if (q) {
      result = students.filter((s) =>
        `${s.lastName} ${s.firstName}`.toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => {
      const lastNameCompare = a.lastName.localeCompare(b.lastName);
      if (lastNameCompare !== 0) return lastNameCompare;
      return a.firstName.localeCompare(b.firstName);
    });
  }, [students, search]);

  // Pagination calculations
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedStudents = filtered.slice(startIndex, endIndex);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  // Dispatch custom event when activeTerm changes to sync with leaderboard
  useEffect(() => {
    const event = new CustomEvent("classRecordTermChanged", {
      detail: { courseSlug, activeTerm },
    });
    window.dispatchEvent(event);
  }, [activeTerm, courseSlug]);

  const studentName = (s: Student) =>
    `${s.lastName}, ${s.firstName}${
      s.middleInitial ? ` ${s.middleInitial}.` : ""
    }`;

  const handleClearScores = async (
    assessmentId: string,
    studentIds: string[]
  ) => {
    try {
      // Clear scores from state
      const updated = new Map(scores);
      studentIds.forEach((studentId) => {
        const key = `${studentId}:${assessmentId}`;
        updated.delete(key);
      });
      setScores(updated);

      // Clear scores from backend
      const scoresToDelete = studentIds.map((studentId) => ({
        studentId,
        assessmentId,
        score: null,
      }));

      await gradingService.saveAssessmentScoresBulk(courseSlug, scoresToDelete);
    } catch (error: any) {
      console.error("Failed to clear scores:", error);
      throw error;
    }
  };

  const handleSaveSettings = async (configs: Record<string, TermConfig>) => {
    try {
      const payload = { termConfigs: configs };
      const response = await gradingService.saveTermConfigs(
        courseSlug,
        payload.termConfigs
      );
      // Use the updated term configs from the backend (with real assessment IDs)
      // If the backend returns updated configs, use them; otherwise fall back to the sent configs
      const updatedConfigs = response?.termConfigs || configs;
      setTermConfigs(updatedConfigs);
      setHasTermConfigs(true);

      // Dispatch event to refresh leaderboard
      const event = new CustomEvent("classRecordSettingsSaved", {
        detail: { courseSlug },
      });
      window.dispatchEvent(event);

      // No success toast - only loading toast is shown
    } catch (error: any) {
      console.error("Failed to save settings:", error.response?.data || error);
      throw error; // Re-throw to let SettingsModal handle the error
    }
  };

  const handleExportToExcel = async (
    term: Term | "SUMMARY",
    exportType: "summary" | "details"
  ) => {
    try {
      toast.loading("Preparing export...");

      toast.loading("Generating Excel file...");

      if (exportType === "summary") {
        await exportSummary(term);
      } else {
        await exportDetails(term);
      }

      toast.dismiss();
      toast.success("Excel exported successfully!");
      setShowExportDialog(false);
    } catch (error) {
      toast.dismiss();
      console.error(error);
      toast.error("Failed to export Excel");
    }
  };

  const exportSummary = async (term: Term | "SUMMARY") => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Class Record");

    // -----------------------
    // Top metadata rows
    // -----------------------
    ws.getCell("A1").value = `Subject Name: ${courseTitle}`;
    ws.getCell("A2").value = `Class number: ${courseNumber}`;
    ws.getCell("A3").value = `Class Section: ${courseSection}`;

    // Row 4 - Main Header
    const headerRow = ws.addRow([
      "",
      "",
      "Prelim Grade",
      "Midterm Grade",
      "Prefinals Grade",
      "Finals Grade",
    ]);

    headerRow.height = 25;
    headerRow.eachCell((cell: any, col: number) => {
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };

      let isGradeHeader = col >= 3;

      if (isGradeHeader) {
        ws.getColumn(col).width = 10;
      }

      cell.alignment = {
        vertical: "middle",
        horizontal: isGradeHeader ? "center" : "left",
      };

      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9D9D9" },
      };
    });

    // -----------------------
    // Student Rows Start Row 5
    // -----------------------
    filtered.forEach((student) => {
      // Get term grades and ensure valid values
      const prelimGrade = computeTermGrade(student.id, "PRELIM");
      const midtermGrade = computeTermGrade(student.id, "MIDTERM");
      const prefinalGrade = computeTermGrade(student.id, "PREFINALS");
      const finalsGrade = computeTermGrade(student.id, "FINALS");

      // Sanitize values: only export if valid (not "-", not NaN)
      const prelim =
        prelimGrade?.totalPercent &&
        prelimGrade.totalPercent !== "-" &&
        !isNaN(parseFloat(prelimGrade.totalPercent))
          ? prelimGrade.totalPercent
          : "";
      const midterm =
        midtermGrade?.totalPercent &&
        midtermGrade.totalPercent !== "-" &&
        !isNaN(parseFloat(midtermGrade.totalPercent))
          ? midtermGrade.totalPercent
          : "";
      const prefinal =
        prefinalGrade?.totalPercent &&
        prefinalGrade.totalPercent !== "-" &&
        !isNaN(parseFloat(prefinalGrade.totalPercent))
          ? prefinalGrade.totalPercent
          : "";
      const finals =
        finalsGrade?.totalPercent &&
        finalsGrade.totalPercent !== "-" &&
        !isNaN(parseFloat(finalsGrade.totalPercent))
          ? finalsGrade.totalPercent
          : "";

      const fullName = studentName(student);
      const formattedName = fullName
        .replace(/\s+[A-Z]\.$/, "")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();

      const row = ws.addRow([
        student.studentId ?? "",
        formattedName,
        prelim,
        midterm,
        prefinal,
        finals,
      ]);

      row.eachCell((cell: any, col: number) => {
        cell.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        };

        cell.alignment = {
          vertical: "middle",
          horizontal: col <= 2 ? "left" : "right",
        };
      });
    });

    // -----------------------
    // Column Widths
    // -----------------------
    ws.getColumn(1).width = 16;
    ws.getColumn(2).width = 30;
    ws.getColumn(3).width = 15;
    ws.getColumn(4).width = 15;
    ws.getColumn(5).width = 15;
    ws.getColumn(6).width = 15;

    // Freeze top rows (up to header row)
    ws.views = [{ state: "frozen", ySplit: 4 }];

    // -----------------------
    // Save File
    // -----------------------
    const buffer = await wb.xlsx.writeBuffer();
    const fileName = `${courseCode}_${courseSection}_ClassRecord_Summary.xlsx`;
    saveAs(new Blob([buffer]), fileName);
  };

  const exportDetails = async (term: Term | "SUMMARY") => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Class Record");

    // Get term config for the selected term
    // If term is "SUMMARY", use activeTerm, but if activeTerm is also "SUMMARY",
    // default to the first available term (usually "PRELIM")
    let termToExport: Term;
    if (term === "SUMMARY") {
      termToExport =
        activeTerm === "SUMMARY"
          ? (Object.keys(termConfigs).find((t) => t !== "SUMMARY") as Term) ||
            "PRELIM"
          : (activeTerm as Term);
    } else {
      termToExport = term;
    }

    const config = termConfigs[termToExport];
    if (!config) {
      throw new Error(`No configuration found for ${termToExport}`);
    }

    const pts = config.assessments
      .filter((a) => a.type === "PT" && a.enabled)
      .sort((a, b) => a.order - b.order);
    const quizzes = config.assessments
      .filter((a) => a.type === "QUIZ" && a.enabled)
      .sort((a, b) => a.order - b.order);
    const exam = config.assessments.find((a) => a.type === "EXAM" && a.enabled);

    // Calculate total columns
    const totalColumns =
      2 + // Student ID, Name
      pts.length +
      1 + // PT Weighted
      quizzes.length +
      1 + // Quiz Weighted
      (exam ? 2 : 0) + // Exam + Exam Weighted
      2; // Total Percent, Numeric Grade

    // Add title row
    ws.mergeCells(`A1:${String.fromCharCode(64 + totalColumns)}1`);
    const titleRow = ws.getCell("A1");
    titleRow.value = "CLASS RECORD DATA";
    titleRow.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    titleRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF124A69" },
    };
    titleRow.alignment = { vertical: "middle", horizontal: "center" };
    ws.getRow(1).height = 30;

    // Add metadata rows
    ws.mergeCells(`A2:${String.fromCharCode(64 + totalColumns)}2`);
    const metadataRow = ws.getCell("A2");
    metadataRow.value = `${courseTitle} - ${courseSection} | Class Number: ${courseNumber} | Term: ${termToExport}`;
    metadataRow.font = { italic: true, size: 11 };
    metadataRow.alignment = { vertical: "middle", horizontal: "center" };

    // Add date row
    ws.mergeCells(`A3:${String.fromCharCode(64 + totalColumns)}3`);
    const dateRow = ws.getCell("A3");
    dateRow.value = `Export Date: ${new Date().toLocaleDateString()}`;
    dateRow.font = { italic: true, size: 11 };
    dateRow.alignment = { vertical: "middle", horizontal: "center" };

    ws.addRow([]);

    // Build header row
    const headers: string[] = ["Student ID", "Name"];
    pts.forEach((pt) => headers.push(pt.name));
    headers.push("PT Weighted");
    quizzes.forEach((quiz) => headers.push(quiz.name));
    headers.push("Quiz Weighted");
    if (exam) {
      headers.push(exam.name);
      headers.push("Exam Weighted");
    }
    headers.push("Total %", "Numeric Grade");

    const headerRow = ws.addRow(headers);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF124A69" },
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 25;

    headerRow.eachCell((cell: any) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // Add data rows
    filtered.forEach((student) => {
      const termGrade = computeTermGrade(student.id, termToExport);
      const fullName = studentName(student);
      const formattedName = fullName
        .replace(/\s+[A-Z]\.$/, "")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();

      const rowData: (string | number)[] = [
        student.studentId ?? "",
        formattedName,
      ];

      // PT scores
      pts.forEach((pt) => {
        const rawScore = getEffectiveScore(student.id, pt);
        const transmutedScore = transmuteScore(
          rawScore,
          pt.maxScore,
          pt.transmutationBase ?? 0
        );
        const baseThreshold =
          (pt.transmutationBase ?? 0) > 0
            ? ((pt.transmutationBase ?? 0) / 100) * pt.maxScore
            : null;
        const showTransmuted =
          rawScore !== null &&
          transmutedScore !== null &&
          baseThreshold !== null &&
          rawScore < baseThreshold;
        rowData.push(
          showTransmuted ? `${rawScore} (${transmutedScore})` : rawScore ?? ""
        );
      });

      // Ensure weighted values are valid
      const ptWeighted = termGrade?.ptWeighted;
      rowData.push(
        ptWeighted && ptWeighted !== "-" && !isNaN(parseFloat(ptWeighted))
          ? ptWeighted
          : ""
      );

      // Quiz scores
      quizzes.forEach((quiz) => {
        const rawScore = getEffectiveScore(student.id, quiz);
        const transmutedScore = transmuteScore(
          rawScore,
          quiz.maxScore,
          quiz.transmutationBase ?? 0
        );
        const baseThreshold =
          (quiz.transmutationBase ?? 0) > 0
            ? ((quiz.transmutationBase ?? 0) / 100) * quiz.maxScore
            : null;
        const showTransmuted =
          rawScore !== null &&
          transmutedScore !== null &&
          baseThreshold !== null &&
          rawScore < baseThreshold;
        rowData.push(
          showTransmuted ? `${rawScore} (${transmutedScore})` : rawScore ?? ""
        );
      });

      // Ensure weighted values are valid
      const quizWeighted = termGrade?.quizWeighted;
      rowData.push(
        quizWeighted && quizWeighted !== "-" && !isNaN(parseFloat(quizWeighted))
          ? quizWeighted
          : ""
      );

      // Exam score
      if (exam) {
        const rawScore = getEffectiveScore(student.id, exam);
        const transmutedScore = transmuteScore(
          rawScore,
          exam.maxScore,
          exam.transmutationBase ?? 0
        );
        const baseThreshold =
          (exam.transmutationBase ?? 0) > 0
            ? ((exam.transmutationBase ?? 0) / 100) * exam.maxScore
            : null;
        const showTransmuted =
          rawScore !== null &&
          transmutedScore !== null &&
          baseThreshold !== null &&
          rawScore < baseThreshold;
        rowData.push(
          showTransmuted ? `${rawScore} (${transmutedScore})` : rawScore ?? ""
        );
        // Ensure weighted values are valid
        const examWeighted = termGrade?.examWeighted;
        rowData.push(
          examWeighted &&
            examWeighted !== "-" &&
            !isNaN(parseFloat(examWeighted))
            ? examWeighted
            : ""
        );
      }

      // Ensure we export valid values (not NaN, handle "-" properly)
      const totalPercent = termGrade?.totalPercent;
      const numericGrade = termGrade?.numericGrade;

      rowData.push(
        totalPercent && totalPercent !== "-" && !isNaN(parseFloat(totalPercent))
          ? totalPercent
          : "",
        numericGrade && numericGrade !== "-" && numericGrade !== "(error)"
          ? numericGrade
          : ""
      );

      const row = ws.addRow(rowData);

      row.eachCell((cell: any) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFD3D3D3" } },
          left: { style: "thin", color: { argb: "FFD3D3D3" } },
          bottom: { style: "thin", color: { argb: "FFD3D3D3" } },
          right: { style: "thin", color: { argb: "FFD3D3D3" } },
        };
        cell.alignment = { vertical: "middle" };
      });

      if (row.number % 2 === 0) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF9FAFB" },
        };
      }
    });

    // Set column widths
    const columnWidths = [16, 30]; // Student ID, Name
    pts.forEach(() => columnWidths.push(12));
    columnWidths.push(12); // PT Weighted
    quizzes.forEach(() => columnWidths.push(12));
    columnWidths.push(12); // Quiz Weighted
    if (exam) {
      columnWidths.push(12, 12); // Exam, Exam Weighted
    }
    columnWidths.push(12, 12); // Total %, Numeric Grade

    ws.columns = columnWidths.map((width) => ({ width }));

    const buffer = await wb.xlsx.writeBuffer();
    const fileName = `${courseCode}_${courseSection}_ClassRecord_${termToExport}_Details.xlsx`;
    saveAs(new Blob([buffer]), fileName);
  };

  if (activeTerm === "SUMMARY") {
    return (
      <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg shadow-sm min-h-[400px] sm:min-h-[600px] md:min-h-[770px] max-h-[90vh] flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#124A69]">
              {courseCode}
            </h1>
            <p className="text-xs sm:text-sm text-gray-600">{courseSection}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search a name"
                value={search}
                onChange={(e) => {
                  const cleanedValue = removeEmojis(e.target.value);
                  setSearch(cleanedValue);
                }}
                className="pl-8 w-full sm:w-[200px] md:w-[240px] text-sm"
              />
            </div>
            <Select
              value={summarySelectedTerm}
              onValueChange={(value: Term | "ALL") =>
                setSummarySelectedTerm(value)
              }
            >
              <SelectTrigger className="w-full sm:w-[140px] md:w-[160px] text-sm">
                <SelectValue placeholder="Select term" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Terms</SelectItem>
                {(["PRELIM", "MIDTERM", "PREFINALS", "FINALS"] as const)
                  .filter((term) => termConfigs[term])
                  .map((term) => (
                    <SelectItem key={term} value={term}>
                      {term}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-white border border-[#124A69]/30 text-[#124A69] text-xs sm:text-sm rounded-lg hover:bg-[#124A69]/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
              disabled={true}
            >
              <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-black" />
              <span className="hidden xl:inline text-black">Settings</span>
            </button>
            <button
              onClick={() => setIsPasteModalOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-white border border-[#124A69]/30 text-[#124A69] text-xs sm:text-sm rounded-lg hover:bg-[#124A69]/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
              disabled={true}
            >
              <ClipboardPaste className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-black" />
              <span className="hidden xl:inline text-black">Paste Grades</span>
            </button>
            <button
              onClick={() => setShowExportDialog(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-[#124A69] text-white text-xs sm:text-sm rounded-lg hover:bg-[#0D3A54] transition-colors"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xl:inline">Export</span>
            </button>
          </div>
        </div>

        <div className="flex border-b border-gray-200 mb-4 sm:mb-6 overflow-x-auto">
          {TERMS.map((term) => (
            <button
              key={term}
              onClick={() => setActiveTerm(term)}
              className={`px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium whitespace-nowrap ${
                term === activeTerm
                  ? "text-[#124A69] border-b-2 border-[#124A69]"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {term}
            </button>
          ))}
        </div>

        <div className="w-full overflow-x-auto flex-1 min-h-0">
          <table className="table-fixed w-full min-w-[700px] border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="w-[30%] border border-gray-300 px-4 py-2 text-left font-medium text-gray-700"></th>
                {(["PRELIM", "MIDTERM", "PREFINALS", "FINALS"] as const)
                  .filter(
                    (term) =>
                      summarySelectedTerm === "ALL" ||
                      summarySelectedTerm === term
                  )
                  .map((term) => (
                    <th
                      key={term}
                      className="w-[14%] border border-gray-300 px-2 py-2 text-center font-medium text-gray-700"
                      colSpan={2}
                    >
                      {term}
                    </th>
                  ))}
                {summarySelectedTerm === "ALL" && (
                  <th
                    className="w-[14%] border border-gray-300 px-2 py-2 text-center font-medium text-gray-700"
                    colSpan={2}
                  >
                    FINAL GRADE
                  </th>
                )}
              </tr>
              <tr className="bg-gray-50 text-xs">
                <th className="border border-gray-300"></th>
                {(["PRELIM", "MIDTERM", "PREFINALS", "FINALS"] as const)
                  .filter(
                    (term) =>
                      summarySelectedTerm === "ALL" ||
                      summarySelectedTerm === term
                  )
                  .map((term) => (
                    <React.Fragment key={term}>
                      <th className="border border-gray-300 px-2 py-1">
                        {TERM_WEIGHTS[term] * 100}%
                      </th>
                      <th className="border border-gray-300 px-2 py-1">EQV</th>
                    </React.Fragment>
                  ))}
                {summarySelectedTerm === "ALL" && (
                  <>
                    <th className="border border-gray-300 px-2 py-1">GRADE</th>
                    <th className="border border-gray-300 px-2 py-1">
                      REMARKS
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {paginatedStudents.map((student) => {
                const finalGrade = computeFinalGrade(student.id);
                return (
                  <tr
                    key={student.id}
                    onClick={() =>
                      setSelectedStudentId(
                        student.id === selectedStudentId ? null : student.id
                      )
                    }
                    className={`border-b border-gray-300 cursor-pointer transition-colors ${
                      selectedStudentId === student.id
                        ? "bg-[#124A69] hover:bg-[#0D3A54]"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <td
                      className={`border px-2 py-2 ${
                        selectedStudentId === student.id
                          ? "bg-[#124A69] text-white border-white"
                          : "border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {student.image ? (
                          <img
                            src={student.image}
                            alt={studentName(student)}
                            className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                              selectedStudentId === student.id
                                ? "bg-white"
                                : "bg-[#124A69]"
                            }`}
                          >
                            <span
                              className={`text-[10px] font-semibold ${
                                selectedStudentId === student.id
                                  ? "text-[#124A69]"
                                  : "text-white"
                              }`}
                            >
                              {student.firstName[0]?.toUpperCase() || ""}
                              {student.lastName[0]?.toUpperCase() || ""}
                            </span>
                          </div>
                        )}
                        <span
                          className={`text-sm truncate ${
                            selectedStudentId === student.id
                              ? "text-white"
                              : "text-gray-700"
                          }`}
                        >
                          {studentName(student)}
                        </span>
                      </div>
                    </td>
                    {(["PRELIM", "MIDTERM", "PREFINALS", "FINALS"] as const)
                      .filter(
                        (term) =>
                          summarySelectedTerm === "ALL" ||
                          summarySelectedTerm === term
                      )
                      .map((term) => {
                        const termGrade = computeTermGrade(student.id, term);
                        const isSelected = selectedStudentId === student.id;
                        return (
                          <React.Fragment key={term}>
                            <td
                              className={`border py-3 text-center ${
                                isSelected ? "border-white" : "border-gray-300"
                              }`}
                            >
                              <input
                                type="text"
                                className={`w-14 h-8 text-center border rounded text-sm ${
                                  isSelected
                                    ? "border-white text-white bg-transparent"
                                    : "border-gray-200"
                                }`}
                                value={termGrade?.totalPercent || "-"}
                                readOnly
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                            <td
                              className={`border py-3 text-center ${
                                isSelected ? "border-white" : "border-gray-300"
                              }`}
                            >
                              <input
                                type="text"
                                className={`w-14 h-8 text-center border rounded text-sm ${
                                  isSelected
                                    ? termGrade?.numericGrade === "(error)"
                                      ? "border-white text-white bg-red-500"
                                      : "border-white text-white bg-transparent"
                                    : termGrade?.numericGrade === "(error)"
                                    ? "border-gray-200 bg-red-500 text-white"
                                    : "border-gray-200"
                                }`}
                                value={termGrade?.numericGrade || "-"}
                                readOnly
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                          </React.Fragment>
                        );
                      })}
                    {summarySelectedTerm === "ALL" && (
                      <>
                        <td
                          className={`border py-3 text-center ${
                            selectedStudentId === student.id
                              ? "border-white"
                              : "border-gray-300"
                          }`}
                        >
                          <input
                            type="text"
                            className={`w-14 h-8 text-center border rounded text-sm font-medium ${
                              selectedStudentId === student.id
                                ? finalGrade &&
                                  finalGrade.grade &&
                                  !isNaN(parseFloat(finalGrade.grade)) &&
                                  parseFloat(finalGrade.grade) > 3.0
                                  ? "border-white text-red-500 bg-transparent"
                                  : "border-white text-white bg-transparent"
                                : finalGrade &&
                                  finalGrade.grade &&
                                  !isNaN(parseFloat(finalGrade.grade)) &&
                                  parseFloat(finalGrade.grade) > 3.0
                                ? "text-red-500 border-gray-200"
                                : "border-gray-200"
                            }`}
                            value={
                              finalGrade?.grade &&
                              !isNaN(parseFloat(finalGrade.grade))
                                ? finalGrade.grade
                                : "-"
                            }
                            readOnly
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td
                          className={`border py-3 text-center ${
                            selectedStudentId === student.id
                              ? "border-white"
                              : "border-gray-300"
                          }`}
                        >
                          <span
                            className={`text-sm font-medium ${
                              selectedStudentId === student.id
                                ? finalGrade?.remarks === "PASSED"
                                  ? "text-green-600"
                                  : finalGrade?.remarks === "FAILED"
                                  ? "text-red-500"
                                  : "text-white"
                                : finalGrade?.remarks === "PASSED"
                                ? "text-green-600"
                                : "text-red-500"
                            }`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {finalGrade?.remarks || "-"}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between mt-auto pt-3 sm:pt-4 border-t border-gray-200 gap-3 sm:gap-0">
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <span className="text-xs sm:text-sm text-gray-600 w-[300px]">
                Showing {startIndex + 1}-{Math.min(endIndex, filtered.length)}{" "}
                of {filtered.length} student{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>
            <Pagination className="flex justify-end">
              <PaginationContent className="flex-wrap">
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                    className={
                      currentPage === 1 ? "pointer-events-none opacity-50" : ""
                    }
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => (
                  <PaginationItem key={i}>
                    <PaginationLink
                      onClick={() => setCurrentPage(i + 1)}
                      isActive={currentPage === i + 1}
                      className={
                        currentPage === i + 1
                          ? "bg-[#124A69] text-white hover:bg-[#0d3a56]"
                          : ""
                      }
                    >
                      {i + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                    }
                    className={
                      currentPage === totalPages
                        ? "pointer-events-none opacity-50"
                        : ""
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}

        <SettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          termConfigs={termConfigs}
          onSave={handleSaveSettings}
          availableCriteria={availableCriteria}
          assessmentScores={scores}
          onClearScores={handleClearScores}
          courseSlug={courseSlug}
        />

        {/* Export Dialog - Must be rendered here for SUMMARY view */}
        <ExportDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          onExport={handleExportToExcel}
          availableTerms={Object.keys(termConfigs) as Term[]}
        />

        <PasteGradesModal
          isOpen={isPasteModalOpen}
          onClose={() => setIsPasteModalOpen(false)}
          availableColumns={(() => {
            if (activeTerm === "SUMMARY") {
              return [];
            }
            const config =
              termConfigs[
                activeTerm as "PRELIM" | "MIDTERM" | "PREFINALS" | "FINALS"
              ];
            if (!config) {
              return [];
            }
            const ptColumns = config.assessments
              .filter((a) => a.type === "PT" && a.enabled)
              .sort((a, b) => a.order - b.order)
              .map((pt) => ({
                id: pt.id,
                name: pt.name,
                type: "PT" as const,
                maxScore: pt.maxScore,
                term: activeTerm,
              }));
            const quizColumns = config.assessments
              .filter((a) => a.type === "QUIZ" && a.enabled)
              .sort((a, b) => a.order - b.order)
              .map((quiz) => ({
                id: quiz.id,
                name: quiz.name,
                type: "QUIZ" as const,
                maxScore: quiz.maxScore,
                term: activeTerm,
              }));
            const examColumns = config.assessments
              .filter((a) => a.type === "EXAM" && a.enabled)
              .map((exam) => ({
                id: exam.id,
                name: exam.name,
                type: "EXAM" as const,
                maxScore: exam.maxScore,
                term: activeTerm,
              }));
            return [...ptColumns, ...quizColumns, ...examColumns];
          })()}
          students={filtered.map((s) => ({
            id: s.id,
            name: studentName(s),
            studentNumber: s.id,
          }))}
          onPasteGrades={async (columnId, grades) => {
            try {
              // Validate all grades before updating state
              const validGrades = grades.filter((g) => {
                if (g.score === null) return true;
                if (typeof g.score !== "number" || isNaN(g.score)) return false;
                if (g.score < 0) return false;
                return true;
              });

              if (validGrades.length !== grades.length) {
                toast.error(
                  "Some pasted grades are invalid and were not saved"
                );
                return;
              }

              // Update local state first (optimistic update)
              const updated = new Map(scores);
              validGrades.forEach(({ studentId, score }) => {
                const key = `${studentId}:${columnId}`;
                if (score === null) {
                  updated.delete(key);
                } else {
                  updated.set(key, {
                    studentId,
                    assessmentId: columnId,
                    score,
                  });
                }
              });
              setScores(updated);

              // Save all grades to API
              const gradesToSave = validGrades.map(({ studentId, score }) => ({
                studentId,
                assessmentId: columnId,
                score,
              }));
              await saveBulkScoresToAPI(gradesToSave);
            } catch (error) {
              // On error, reload data from server to ensure consistency
              console.error("Error pasting grades:", error);
              // Optionally reload data to ensure state consistency
              // This could be done by calling the load function again
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg shadow-sm min-h-[400px] sm:min-h-[600px] md:min-h-[770px] max-h-[90vh] flex flex-col">
      {hasTermConfigs && (
        <CustomTutorial
          steps={tutorialSteps}
          run={showTutorial}
          onComplete={handleTutorialComplete}
          onSkip={handleTutorialSkip}
          continuous={true}
          showProgress={true}
          showSkipButton={true}
          spotlightPadding={8}
        />
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#124A69]">
            {courseCode}
          </h1>
          <p className="text-xs sm:text-sm text-gray-600">{courseSection}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {hasTermConfigs && (
            <button
              onClick={() => {
                setShowTutorial(true);
              }}
              className="p-2 hover:bg-[#124A69]/10 rounded-lg transition-colors text-[#124A69]"
              title="Show Tutorial"
            >
              <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
          <div className="relative w-full sm:w-auto" data-tutorial="search-bar">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search a name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-full sm:w-[200px] md:w-[240px] text-sm"
              disabled={!hasTermConfigs}
            />
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            data-tutorial="settings-button"
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-white border border-[#124A69]/30 text-[#124A69] text-xs sm:text-sm rounded-lg hover:bg-[#124A69]/5 transition-colors"
          >
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-black" />
            <span className="hidden xl:inline text-black">Settings</span>
          </button>
          <button
            onClick={() => setIsPasteModalOpen(true)}
            data-tutorial="paste-grades-button"
            disabled={!hasTermConfigs}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-white border border-[#124A69]/30 text-xs sm:text-sm rounded-lg transition-colors ${
              hasTermConfigs
                ? "text-[#124A69] hover:bg-[#124A69]/5"
                : "text-gray-400 cursor-not-allowed opacity-50"
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-black" />
            <span className="hidden xl:inline text-black">Paste Grades</span>
          </button>
          <button
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-white text-xs sm:text-sm rounded-lg transition-colors ${
              hasTermConfigs
                ? "bg-[#124A69] hover:bg-[#0D3A54]"
                : "bg-gray-400 cursor-not-allowed"
            }`}
            onClick={() => setShowExportDialog(true)}
            data-tutorial="export-button"
            disabled={!hasTermConfigs}
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden xl:inline">Export</span>
          </button>
        </div>
      </div>

      <div
        className="flex border-b border-gray-200 mb-4 sm:mb-6 overflow-x-auto"
        data-tutorial="term-tabs"
      >
        {TERMS.map((term) => (
          <button
            key={term}
            onClick={() => setActiveTerm(term)}
            className={`px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium whitespace-nowrap ${
              term === activeTerm
                ? "text-[#124A69] border-b-2 border-[#124A69]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {term}
          </button>
        ))}
      </div>

      {!hasTermConfigs ? (
        <div className="flex flex-col items-center justify-center flex-1 min-h-[400px] mb-4 rounded-md border border-dashed border-gray-300 bg-gray-50/50 relative overflow-hidden">
          <div className="text-center px-4 pb-8 z-10 relative">
            <div className="mb-8">
              <SplitText
                text="Welcome to your Class Record"
                className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#124A69]"
                delay={0.2}
                duration={0.6}
                stagger={0.03}
              />
            </div>
            <AnimatedContent
              container={null}
              delay={1.5}
              duration={0.8}
              direction="vertical"
              distance={30}
              initialOpacity={0}
              className="mt-6"
              onComplete={() => {}}
              onDisappearanceComplete={() => {}}
            >
              <p className="text-lg sm:text-xl text-gray-600 mb-8">
                get started by setting up your class record!
              </p>
            </AnimatedContent>
            <div className="flex items-center justify-center mt-8">
              <button
                onClick={() => setSettingsOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-[#124A69] hover:bg-[#0D3A54] text-white rounded-lg transition-colors text-sm sm:text-base font-medium shadow-lg"
              >
                <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                Open Settings
              </button>
            </div>
          </div>
        </div>
      ) : !currentConfig ? (
        <div className="text-center py-12">
          <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">
            No configuration found for this term
          </p>
          <button
            onClick={() => setSettingsOpen(true)}
            className="px-4 py-2 bg-[#124A69] text-white rounded-lg hover:bg-[#0D3A54]"
          >
            Configure Settings
          </button>
        </div>
      ) : (
        <div
          className="w-full overflow-x-auto flex-1 min-h-0"
          data-tutorial="grade-table"
        >
          <table className="table-fixed w-full min-w-[1300px] border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th
                  className="w-[30%] border border-gray-300 px-2 py-2 text-left font-medium text-gray-700"
                  rowSpan={2}
                ></th>
                {pts.length > 0 && (
                  <th
                    className="border border-gray-300 px-2 py-2 text-center font-medium text-gray-700"
                    colSpan={pts.length + 1}
                  >
                    PT/LAB ({currentConfig.ptWeight}%)
                  </th>
                )}
                {quizzes.length > 0 && (
                  <th
                    className="border border-gray-300 px-2 py-2 text-center font-medium text-gray-700"
                    colSpan={quizzes.length + 1}
                  >
                    QUIZZES ({currentConfig.quizWeight}%)
                  </th>
                )}
                {exam && (
                  <th
                    className="border border-gray-300 px-2 py-2 text-center font-medium text-gray-700"
                    colSpan={2}
                  >
                    EXAM ({currentConfig.examWeight}%)
                  </th>
                )}
                <th
                  className="border border-gray-300 px-2 py-2 text-center font-medium text-gray-700"
                  rowSpan={2}
                  colSpan={2}
                >
                  GRADE
                </th>
              </tr>
              <tr className="bg-gray-50 text-xs">
                {pts.map((pt) => (
                  <th
                    key={pt.id}
                    className="border border-gray-300 px-1 py-1 text-center"
                  >
                    {pt.name}
                  </th>
                ))}
                {pts.length > 0 && (
                  <th className="border border-gray-300 px-1 py-1 text-center text-[#124A69] font-semibold">
                    {currentConfig.ptWeight}%
                  </th>
                )}
                {quizzes.map((quiz) => (
                  <th
                    key={quiz.id}
                    className="border border-gray-300 px-1 py-1 text-center"
                  >
                    {quiz.name}
                  </th>
                ))}
                {quizzes.length > 0 && (
                  <th className="border border-gray-300 px-1 py-1 text-center text-[#124A69] font-semibold">
                    {currentConfig.quizWeight}%
                  </th>
                )}
                {exam && (
                  <>
                    <th className="border border-gray-300 px-1 py-1 text-center">
                      {exam.name}
                    </th>
                    <th className="border border-gray-300 px-1 py-1 text-center text-[#124A69] font-semibold">
                      {currentConfig.examWeight}%
                    </th>
                  </>
                )}
              </tr>
              <tr className="bg-gray-50 text-[10px]">
                <th className="border border-gray-300 px-2 py-1"></th>
                {pts.map((pt) => (
                  <th
                    key={pt.id}
                    className="border border-gray-300 px-1 py-1 text-center text-gray-500"
                  >
                    {pt.maxScore}
                  </th>
                ))}
                {pts.length > 0 && (
                  <th className="border border-gray-300 px-1 py-1 text-center text-gray-500">
                    %
                  </th>
                )}
                {quizzes.map((quiz) => (
                  <th
                    key={quiz.id}
                    className="border border-gray-300 px-1 py-1 text-center text-gray-500"
                  >
                    {quiz.maxScore}
                  </th>
                ))}
                {quizzes.length > 0 && (
                  <th className="border border-gray-300 px-1 py-1 text-center text-gray-500">
                    %
                  </th>
                )}
                {exam && (
                  <>
                    <th className="border border-gray-300 px-1 py-1 text-center text-gray-500">
                      {exam.maxScore}
                    </th>
                    <th className="border border-gray-300 px-1 py-1 text-center text-gray-500">
                      %
                    </th>
                  </>
                )}
                <th className="border border-gray-300 px-1 py-1 text-center"></th>
                <th className="border border-gray-300 px-1 py-1 text-center">
                  EQV
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedStudents.map((student) => {
                const termGrade = computeTermGrade(student.id, activeTerm);
                return (
                  <tr
                    key={student.id}
                    onClick={() =>
                      setSelectedStudentId(
                        student.id === selectedStudentId ? null : student.id
                      )
                    }
                    className={`border-b border-gray-300 cursor-pointer transition-colors ${
                      selectedStudentId === student.id
                        ? "bg-[#124A69] hover:bg-[#0D3A54]"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <td
                      className={`border px-2 py-2 ${
                        selectedStudentId === student.id
                          ? "bg-[#124A69] text-white border-white"
                          : "border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {student.image ? (
                          <img
                            src={student.image}
                            alt={studentName(student)}
                            className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                              selectedStudentId === student.id
                                ? "bg-white"
                                : "bg-[#124A69]"
                            }`}
                          >
                            <span
                              className={`text-[10px] font-semibold ${
                                selectedStudentId === student.id
                                  ? "text-[#124A69]"
                                  : "text-white"
                              }`}
                            >
                              {student.firstName[0]?.toUpperCase() || ""}
                              {student.lastName[0]?.toUpperCase() || ""}
                            </span>
                          </div>
                        )}
                        <span
                          className={`text-sm truncate ${
                            selectedStudentId === student.id
                              ? "text-white"
                              : "text-gray-700"
                          }`}
                        >
                          {studentName(student)}
                        </span>
                      </div>
                    </td>
                    {pts.map((pt) => {
                      const rawScore = getEffectiveScore(student.id, pt);
                      const transmutedScore = transmuteScore(
                        rawScore,
                        pt.maxScore,
                        pt.transmutationBase ?? 0
                      );
                      const scoreKey = `${student.id}:${pt.id}`;
                      const isEditing = editingScores.has(scoreKey);
                      // Calculate base threshold to check if student passed it
                      const baseThreshold =
                        (pt.transmutationBase ?? 0) > 0
                          ? ((pt.transmutationBase ?? 0) / 100) * pt.maxScore
                          : null;
                      // Only show transmuted score if:
                      // 1. Not currently being edited
                      // 2. Raw score is below base threshold
                      const showTransmuted =
                        !isEditing &&
                        rawScore !== null &&
                        transmutedScore !== null &&
                        baseThreshold !== null &&
                        rawScore < baseThreshold;
                      const displayValue = showTransmuted
                        ? `${rawScore} (${transmutedScore})`
                        : rawScore ?? "";
                      const isSelected = selectedStudentId === student.id;
                      // Use transmuted score for styling (75% check)
                      const scoreForStyling = transmutedScore ?? rawScore;
                      return (
                        <td
                          key={pt.id}
                          className={`border py-3 text-center text-sm w-20 ${
                            isSelected ? "border-white" : "border-gray-300"
                          }`}
                        >
                          <input
                            type="text"
                            inputMode="numeric"
                            className={`w-[90%] h-8 text-center border rounded ${
                              isSelected
                                ? (() => {
                                    const style = getScoreStyle(
                                      scoreForStyling,
                                      pt.maxScore
                                    );
                                    return `border-white bg-transparent ${
                                      style.includes("text-red-500") ||
                                      style.includes("bg-red-500")
                                        ? "text-red-500"
                                        : "text-white"
                                    }`;
                                  })()
                                : pt.linkedCriteriaId
                                ? "bg-blue-50 cursor-not-allowed border-gray-200"
                                : `border-gray-200 ${getScoreStyle(
                                    scoreForStyling,
                                    pt.maxScore
                                  )}`
                            }`}
                            value={displayValue}
                            onChange={handleScoreChange(
                              student.id,
                              pt.id,
                              pt.maxScore
                            )}
                            onFocus={() => {
                              setEditingScores((prev) =>
                                new Set(prev).add(scoreKey)
                              );
                            }}
                            onBlur={() => {
                              setEditingScores((prev) => {
                                const next = new Set(prev);
                                next.delete(scoreKey);
                                return next;
                              });
                            }}
                            onKeyDown={handleNumericKeyDown}
                            onClick={(e) => e.stopPropagation()}
                            disabled={!!pt.linkedCriteriaId}
                            title={
                              pt.linkedCriteriaId
                                ? "This score is linked from existing grades"
                                : pt.transmutationBase &&
                                  pt.transmutationBase > 0
                                ? `Raw: ${rawScore ?? 0}, Transmuted: ${
                                    transmutedScore ?? 0
                                  }`
                                : ""
                            }
                          />
                        </td>
                      );
                    })}
                    {pts.length > 0 && (
                      <td
                        className={`border py-3 text-center text-sm ${
                          selectedStudentId === student.id
                            ? "border-white"
                            : "border-gray-300"
                        }`}
                      >
                        <input
                          type="text"
                          className={`w-[90%] h-8 text-center border rounded ${
                            selectedStudentId === student.id
                              ? "border-white text-white bg-transparent"
                              : "border-gray-200"
                          }`}
                          value={termGrade?.ptWeighted ?? ""}
                          readOnly
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                    )}
                    {quizzes.map((quiz) => {
                      const rawScore = getEffectiveScore(student.id, quiz);
                      const transmutedScore = transmuteScore(
                        rawScore,
                        quiz.maxScore,
                        quiz.transmutationBase ?? 0
                      );
                      const scoreKey = `${student.id}:${quiz.id}`;
                      const isEditing = editingScores.has(scoreKey);
                      // Calculate base threshold to check if student passed it
                      const baseThreshold =
                        (quiz.transmutationBase ?? 0) > 0
                          ? ((quiz.transmutationBase ?? 0) / 100) *
                            quiz.maxScore
                          : null;
                      // Only show transmuted score if:
                      // 1. Not currently being edited
                      // 2. Raw score is below base threshold
                      const showTransmuted =
                        !isEditing &&
                        rawScore !== null &&
                        transmutedScore !== null &&
                        baseThreshold !== null &&
                        rawScore < baseThreshold;
                      const displayValue = showTransmuted
                        ? `${rawScore} (${transmutedScore})`
                        : rawScore ?? "";
                      const isSelected = selectedStudentId === student.id;
                      // Use transmuted score for styling (75% check)
                      const scoreForStyling = transmutedScore ?? rawScore;
                      return (
                        <td
                          key={quiz.id}
                          className={`border py-3 text-center text-sm w-20 ${
                            isSelected ? "border-white" : "border-gray-300"
                          }`}
                        >
                          <input
                            type="text"
                            inputMode="numeric"
                            className={`w-[90%] h-8 text-center border rounded ${
                              isSelected
                                ? (() => {
                                    const style = getScoreStyle(
                                      scoreForStyling,
                                      quiz.maxScore
                                    );
                                    return `border-white bg-transparent ${
                                      style.includes("text-red-500") ||
                                      style.includes("bg-red-500")
                                        ? "text-red-500"
                                        : "text-white"
                                    }`;
                                  })()
                                : quiz.linkedCriteriaId
                                ? "bg-blue-50 cursor-not-allowed border-gray-200"
                                : `border-gray-200 ${getScoreStyle(
                                    scoreForStyling,
                                    quiz.maxScore
                                  )}`
                            }`}
                            value={displayValue}
                            onChange={handleScoreChange(
                              student.id,
                              quiz.id,
                              quiz.maxScore
                            )}
                            onFocus={() => {
                              setEditingScores((prev) =>
                                new Set(prev).add(scoreKey)
                              );
                            }}
                            onBlur={() => {
                              setEditingScores((prev) => {
                                const next = new Set(prev);
                                next.delete(scoreKey);
                                return next;
                              });
                            }}
                            onKeyDown={handleNumericKeyDown}
                            onClick={(e) => e.stopPropagation()}
                            disabled={!!quiz.linkedCriteriaId}
                            title={
                              quiz.linkedCriteriaId
                                ? "This score is linked from existing grades"
                                : quiz.transmutationBase &&
                                  quiz.transmutationBase > 0
                                ? `Raw: ${rawScore ?? 0}, Transmuted: ${
                                    transmutedScore ?? 0
                                  }`
                                : ""
                            }
                          />
                        </td>
                      );
                    })}
                    {quizzes.length > 0 && (
                      <td
                        className={`border py-3 text-center text-sm ${
                          selectedStudentId === student.id
                            ? "border-white"
                            : "border-gray-300"
                        }`}
                      >
                        <input
                          type="text"
                          className={`w-[90%] h-8 text-center border rounded ${
                            selectedStudentId === student.id
                              ? "border-white text-white bg-transparent"
                              : "border-gray-200"
                          }`}
                          value={termGrade?.quizWeighted ?? ""}
                          readOnly
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                    )}
                    {exam && (
                      <>
                        <td
                          className={`border py-3 text-center text-sm ${
                            selectedStudentId === student.id
                              ? "border-white"
                              : "border-gray-300"
                          }`}
                        >
                          {(() => {
                            const rawScore = getEffectiveScore(
                              student.id,
                              exam
                            );
                            const transmutedScore = transmuteScore(
                              rawScore,
                              exam.maxScore,
                              exam.transmutationBase ?? 0
                            );
                            const scoreKey = `${student.id}:${exam.id}`;
                            const isEditing = editingScores.has(scoreKey);
                            // Calculate base threshold to check if student passed it
                            const baseThreshold =
                              (exam.transmutationBase ?? 0) > 0
                                ? ((exam.transmutationBase ?? 0) / 100) *
                                  exam.maxScore
                                : null;
                            // Only show transmuted score if:
                            // 1. Not currently being edited
                            // 2. Raw score is below base threshold
                            const showTransmuted =
                              !isEditing &&
                              rawScore !== null &&
                              transmutedScore !== null &&
                              baseThreshold !== null &&
                              rawScore < baseThreshold;
                            const displayValue = showTransmuted
                              ? `${rawScore} (${transmutedScore})`
                              : rawScore ?? "";
                            const isSelected = selectedStudentId === student.id;
                            // Use transmuted score for styling (75% check)
                            const scoreForStyling = transmutedScore ?? rawScore;
                            return (
                              <input
                                type="text"
                                inputMode="numeric"
                                className={`w-[90%] h-8 text-center border rounded ${
                                  isSelected
                                    ? (() => {
                                        const style = getScoreStyle(
                                          scoreForStyling,
                                          exam.maxScore
                                        );
                                        return `border-white bg-transparent ${
                                          style.includes("text-red-500") ||
                                          style.includes("bg-red-500")
                                            ? "text-red-500"
                                            : "text-white"
                                        }`;
                                      })()
                                    : exam.linkedCriteriaId
                                    ? "bg-blue-50 cursor-not-allowed border-gray-200"
                                    : `border-gray-200 ${getScoreStyle(
                                        scoreForStyling,
                                        exam.maxScore
                                      )}`
                                }`}
                                value={displayValue}
                                onChange={handleScoreChange(
                                  student.id,
                                  exam.id,
                                  exam.maxScore
                                )}
                                onFocus={() => {
                                  setEditingScores((prev) =>
                                    new Set(prev).add(scoreKey)
                                  );
                                }}
                                onBlur={() => {
                                  setEditingScores((prev) => {
                                    const next = new Set(prev);
                                    next.delete(scoreKey);
                                    return next;
                                  });
                                }}
                                onKeyDown={handleNumericKeyDown}
                                onClick={(e) => e.stopPropagation()}
                                disabled={!!exam.linkedCriteriaId}
                                title={
                                  exam.linkedCriteriaId
                                    ? "This score is linked from existing grades"
                                    : exam.transmutationBase &&
                                      exam.transmutationBase > 0
                                    ? `Raw: ${rawScore ?? 0}, Transmuted: ${
                                        transmutedScore ?? 0
                                      }`
                                    : ""
                                }
                              />
                            );
                          })()}
                        </td>
                        <td
                          className={`border py-3 text-center text-sm ${
                            selectedStudentId === student.id
                              ? "border-white"
                              : "border-gray-300"
                          }`}
                        >
                          <input
                            type="text"
                            className={`w-[90%] h-8 text-center border rounded ${
                              selectedStudentId === student.id
                                ? "border-white text-white bg-transparent"
                                : "border-gray-200"
                            }`}
                            value={termGrade?.examWeighted ?? ""}
                            readOnly
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                      </>
                    )}
                    <td
                      className={`border py-3 text-center text-sm ${
                        selectedStudentId === student.id
                          ? "border-white"
                          : "border-gray-300"
                      }`}
                    >
                      <input
                        type="text"
                        className={`w-[90%] h-8 text-center border rounded font-medium ${
                          selectedStudentId === student.id
                            ? termGrade &&
                              parseFloat(termGrade.numericGrade) > 3.0
                              ? "border-white text-red-500 bg-transparent"
                              : "border-white text-white bg-transparent"
                            : termGrade &&
                              parseFloat(termGrade.numericGrade) > 3.0
                            ? "text-red-500 border-gray-200"
                            : "border-gray-200"
                        }`}
                        value={termGrade?.totalPercent ?? ""}
                        readOnly
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td
                      className={`border py-3 text-center text-sm ${
                        selectedStudentId === student.id
                          ? "border-white"
                          : "border-gray-300"
                      }`}
                    >
                      <input
                        type="text"
                        className={`w-[90%] h-8 text-center border rounded font-medium ${
                          selectedStudentId === student.id
                            ? termGrade?.numericGrade === "(error)"
                              ? "border-white text-white bg-red-500"
                              : termGrade &&
                                parseFloat(termGrade.numericGrade) > 3.0
                              ? "border-white text-red-500 bg-transparent"
                              : "border-white text-white bg-transparent"
                            : termGrade?.numericGrade === "(error)"
                            ? "bg-red-500 text-white border-gray-200"
                            : termGrade &&
                              parseFloat(termGrade.numericGrade) > 3.0
                            ? "text-red-500 border-gray-200"
                            : "border-gray-200"
                        }`}
                        value={termGrade?.numericGrade ?? ""}
                        readOnly
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination for Term Grades */}
      {filtered.length > 0 && currentConfig && (
        <div className="flex flex-col sm:flex-row items-center justify-between mt-auto pt-3 sm:pt-4 border-t border-gray-200 gap-3 sm:gap-0">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <span className="text-xs sm:text-sm text-gray-600 w-[300px]">
              Showing {startIndex + 1}-{Math.min(endIndex, filtered.length)} of{" "}
              {filtered.length} student{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
          <Pagination className="flex justify-end">
            <PaginationContent className="flex-wrap">
              <PaginationItem>
                <PaginationPrevious
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  className={
                    currentPage === 1 ? "pointer-events-none opacity-50" : ""
                  }
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink
                    onClick={() => setCurrentPage(i + 1)}
                    isActive={currentPage === i + 1}
                    className={
                      currentPage === i + 1
                        ? "bg-[#124A69] text-white hover:bg-[#0d3a56]"
                        : ""
                    }
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  className={
                    currentPage === totalPages
                      ? "pointer-events-none opacity-50"
                      : ""
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        termConfigs={termConfigs}
        onSave={handleSaveSettings}
        availableCriteria={availableCriteria}
        assessmentScores={scores}
        onClearScores={handleClearScores}
        courseSlug={courseSlug}
      />

      <PasteGradesModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        availableColumns={(() => {
          // Type guard: check if activeTerm is "SUMMARY" first
          if (activeTerm === ("SUMMARY" as Term)) {
            return [];
          }
          // After the check, TypeScript knows activeTerm is not "SUMMARY"
          const config =
            termConfigs[
              activeTerm as "PRELIM" | "MIDTERM" | "PREFINALS" | "FINALS"
            ];
          if (!config) {
            return [];
          }
          const ptColumns = config.assessments
            .filter((a) => a.type === "PT" && a.enabled)
            .sort((a, b) => a.order - b.order)
            .map((pt) => ({
              id: pt.id,
              name: pt.name,
              type: "PT" as const,
              maxScore: pt.maxScore,
              term: activeTerm,
            }));
          const quizColumns = config.assessments
            .filter((a) => a.type === "QUIZ" && a.enabled)
            .sort((a, b) => a.order - b.order)
            .map((quiz) => ({
              id: quiz.id,
              name: quiz.name,
              type: "QUIZ" as const,
              maxScore: quiz.maxScore,
              term: activeTerm,
            }));
          const examColumns = config.assessments
            .filter((a) => a.type === "EXAM" && a.enabled)
            .map((exam) => ({
              id: exam.id,
              name: exam.name,
              type: "EXAM" as const,
              maxScore: exam.maxScore,
              term: activeTerm,
            }));
          return [...ptColumns, ...quizColumns, ...examColumns];
        })()}
        students={filtered.map((s) => ({
          id: s.id,
          name: studentName(s),
          studentNumber: s.id,
        }))}
        onPasteGrades={async (columnId, grades) => {
          try {
            // Validate all grades before updating state
            const validGrades = grades.filter((g) => {
              if (g.score === null) return true;
              if (typeof g.score !== "number" || isNaN(g.score)) return false;
              if (g.score < 0) return false;
              return true;
            });

            if (validGrades.length !== grades.length) {
              toast.error("Some pasted grades are invalid and were not saved");
              return;
            }

            // Update local state first (optimistic update)
            const updated = new Map(scores);
            validGrades.forEach(({ studentId, score }) => {
              const key = `${studentId}:${columnId}`;
              if (score === null) {
                updated.delete(key);
              } else {
                updated.set(key, { studentId, assessmentId: columnId, score });
              }
            });
            setScores(updated);

            // Save all grades to API
            const gradesToSave = validGrades.map(({ studentId, score }) => ({
              studentId,
              assessmentId: columnId,
              score,
            }));
            await saveBulkScoresToAPI(gradesToSave);
          } catch (error) {
            // On error, reload data from server to ensure consistency
            console.error("Error pasting grades:", error);
            // Optionally reload data to ensure state consistency
            // This could be done by calling the load function again
          }
        }}
      />

      {/* Export Dialog */}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        onExport={handleExportToExcel}
        availableTerms={Object.keys(termConfigs) as Term[]}
      />
    </div>
  );
}

// Export Dialog Component
function ExportDialog({
  open,
  onOpenChange,
  onExport,
  availableTerms,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (term: Term | "SUMMARY", exportType: "summary" | "details") => void;
  availableTerms: Term[];
}) {
  const [selectedTerm, setSelectedTerm] = useState<Term | "SUMMARY">("SUMMARY");
  const [exportType, setExportType] = useState<"summary" | "details">(
    "summary"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] sm:w-[80vw] md:w-[70vw] lg:w-[60vw] max-w-[600px] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl font-semibold text-[#124A69]">
            Export Class Record
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Choose the term and export type for your class record
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-6">
          {/* Term Selection */}
          <div className="space-y-2">
            <Label
              htmlFor="term-select"
              className="text-sm font-medium text-[#124A69]"
            >
              Select Term
            </Label>
            <Select
              value={selectedTerm}
              onValueChange={(value: Term | "SUMMARY") =>
                setSelectedTerm(value)
              }
            >
              <SelectTrigger id="term-select" className="w-full">
                <SelectValue placeholder="Select term" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SUMMARY">Summary (All Terms)</SelectItem>
                {availableTerms.map((term) => (
                  <SelectItem key={term} value={term}>
                    {term}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Export Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-[#124A69]">
              Export Type
            </Label>
            <div className="space-y-3">
              <div
                className={`flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  exportType === "summary"
                    ? "border-[#124A69] bg-[#124A69]/5"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
                onClick={() => setExportType("summary")}
              >
                <div className="flex items-center h-5">
                  <input
                    type="radio"
                    checked={exportType === "summary"}
                    onChange={() => setExportType("summary")}
                    className="w-4 h-4 text-[#124A69] border-gray-300 focus:ring-[#124A69]"
                  />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">Summary</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Export final grades for all terms (current format)
                  </div>
                </div>
              </div>
              <div
                className={`flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  exportType === "details"
                    ? "border-[#124A69] bg-[#124A69]/5"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
                onClick={() => setExportType("details")}
              >
                <div className="flex items-center h-5">
                  <input
                    type="radio"
                    checked={exportType === "details"}
                    onChange={() => setExportType("details")}
                    className="w-4 h-4 text-[#124A69] border-gray-300 focus:ring-[#124A69]"
                  />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">Details</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Export all assessment scores with detailed breakdown
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            className="bg-[#124A69] hover:bg-[#0D3A54] text-white w-full sm:w-auto"
            onClick={() => onExport(selectedTerm, exportType)}
          >
            <Download className="h-4 w-4 mr-2" />
            Export to Excel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { Term, Assessment, TermConfig };
