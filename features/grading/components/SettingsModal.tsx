import { useEffect, useState, useRef } from "react";
import React from "react";
import { toast } from "react-hot-toast";
import CustomTutorial, { TutorialStep } from "@/components/ui/CustomTutorial";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  X,
  Calendar,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  CalendarIcon,
  ArrowRight,
  ArrowLeft,
  Lightbulb,
  Info,
} from "lucide-react";
import type { Term, Assessment, TermConfig } from "../types/ClassRecordTable";
import type { CriteriaOption } from "../types/ClassRecordTable";

interface StudentScore {
  studentId: string;
  assessmentId: string;
  score: number | null;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  termConfigs: Record<string, TermConfig>;
  onSave: (configs: Record<string, TermConfig>) => Promise<void>;
  availableCriteria: CriteriaOption[];
  assessmentScores?: Map<string, StudentScore> | Record<string, StudentScore>;
  onClearScores?: (assessmentId: string, studentIds: string[]) => Promise<void>;
  courseSlug?: string;
}

const getTutorialSteps = (savedTerms: Set<Term>): TutorialStep[] => {
  const baseSteps: TutorialStep[] = [
    {
      target: "[data-tutorial='term-tabs-settings']",
      title: "Step 1: Select a Term",
      content:
        "Choose which term you want to configure. Each term (PRELIM, MIDTERM, PREFINALS, FINALS) can have different weights and assessments. Start with PRELIM to get started!",
      placement: "bottom",
      spotlightPadding: 8,
    },
    {
      target: "[data-tutorial='weight-distribution']",
      title: "Step 2: Set Grade Weight Distribution",
      content:
        "Adjust the percentage weights for PT/Lab, Quizzes, and Exam. They MUST add up to exactly 100%! Try entering values now - the total will update in real-time. This determines how much each category contributes to the final grade.",
      placement: "bottom",
      spotlightPadding: 8,
    },
    {
      target: "[data-tutorial='pt-section']",
      title: "Step 3: Configure PT/Lab Assessments",
      content:
        "Add, edit, or remove PT/Lab assessments. You can add up to 6 PT/Lab assessments. Let's explore the different fields you can configure.",
      placement: "top",
      spotlightPadding: 8,
    },
    {
      target: "[data-tutorial='pt-name']",
      title: "Step 3a: Assessment Name",
      content:
        "Enter the name for your PT/Lab assessment (e.g., PT1, Lab1). This name will appear in the grade table. Maximum 5 characters.",
      placement: "bottom",
      spotlightPadding: 8,
    },
    {
      target: "[data-tutorial='pt-max-score']",
      title: "Step 3b: Max Score",
      content:
        "Set the maximum score for this assessment (0-200). If you link this to existing criteria (Recitation, Group Reporting, Individual Reporting), the max score will be automatically calculated and this field will be disabled.",
      placement: "bottom",
      spotlightPadding: 8,
    },
    {
      target: "[data-tutorial='pt-base-scoring']",
      title: "Step 3c: Base Scoring (Transmutation)",
      content:
        "Set the transmutation base score (0-75). This is used for base scoring calculations. Only PT/Lab and Quizzes support base scoring - the Exam does not.",
      placement: "bottom",
      spotlightPadding: 8,
    },
    {
      target: "[data-tutorial='quiz-section']",
      title: "Step 4: Configure Quiz Assessments",
      content:
        "Same as PT/Lab - add multiple quizzes (up to 6), set max scores, schedule dates, and link to existing criteria. You can also set transmutation base scoring for quizzes. Each quiz can be enabled or disabled independently.",
      placement: "top",
      spotlightPadding: 8,
    },
    {
      target: "[data-tutorial='quiz-name']",
      title: "Step 4a: Quiz Name",
      content:
        "Enter the name for your quiz assessment (e.g., Q1, Quiz1). This name will appear in the grade table. Maximum 5 characters.",
      placement: "bottom",
      spotlightPadding: 8,
    },
    {
      target: "[data-tutorial='quiz-max-score']",
      title: "Step 4b: Quiz Max Score",
      content:
        "Set the maximum score for this quiz (0-200). If linked to criteria, the max score will be auto-calculated and this field will be disabled.",
      placement: "bottom",
      spotlightPadding: 8,
    },
    {
      target: "[data-tutorial='quiz-base-scoring']",
      title: "Step 4c: Quiz Base Scoring",
      content:
        "Set the transmutation base score for this quiz (0-75). This is used for base scoring calculations in the grade computation.",
      placement: "bottom",
      spotlightPadding: 8,
    },
    {
      target: "[data-tutorial='exam-section']",
      title: "Step 5: Configure Final Exam",
      content:
        "Set up your final exam. This is REQUIRED and must be enabled for each term. Unlike PT/Lab and Quizzes, the Exam cannot have transmutation base scoring. You can link it to criteria and set the max score.",
      placement: "top",
      spotlightPadding: 8,
    },
    {
      target: "[data-tutorial='term-save-button']",
      title: "Step 6: Save Your Configuration",
      content:
        "Click here to save this term's configuration. The system will validate all settings before saving. If there are errors, they'll be shown at the top. Remember to save before switching to another term! Once saved, you'll be able to access this term in the main class record.",
      placement: "top",
      spotlightPadding: 8,
    },
  ];

  // Add conditional steps after PRELIM is saved
  if (savedTerms.has("PRELIM")) {
    baseSteps.push({
      target: "[data-tutorial='term-tabs-settings']",
      title: "Step 7: Accessing Saved Terms",
      content:
        "Great! You've saved PRELIM. Now you can access the PRELIM tab in the main class record to start entering grades. To access MIDTERM, PREFINALS, and FINALS, you need to save their configurations first. Each term must be saved individually.",
      placement: "bottom",
      spotlightPadding: 8,
    });
  }

  return baseSteps;
};

export function SettingsModal({
  isOpen,
  onClose,
  termConfigs: initialConfigs,
  onSave,
  availableCriteria,
  assessmentScores = new Map(),
  onClearScores,
  courseSlug,
}: SettingsModalProps) {
  const [activeTerm, setActiveTerm] = useState<Term>("PRELIM");
  const [termConfigs, setTermConfigs] = useState(initialConfigs);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showTutorial, setShowTutorial] = useState(false);
  const [savedTerms, setSavedTerms] = useState<Set<Term>>(new Set());
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingTerm, setPendingTerm] = useState<Term | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const initialConfigsRef = useRef(initialConfigs);

  // Validation dialogs state
  const [showDeleteAssessmentDialog, setShowDeleteAssessmentDialog] =
    useState(false);
  const [pendingDeleteAssessment, setPendingDeleteAssessment] = useState<{
    type: "PT" | "QUIZ";
    id: string;
  } | null>(null);
  const [showMaxScoreDialog, setShowMaxScoreDialog] = useState(false);
  const [pendingMaxScoreChange, setPendingMaxScoreChange] = useState<{
    assessmentId: string;
    oldMaxScore: number;
    newMaxScore: number;
    affectedScores: Array<{ studentId: string; score: number }>;
  } | null>(null);
  const [showDisableAssessmentDialog, setShowDisableAssessmentDialog] =
    useState(false);
  const [pendingDisableAssessment, setPendingDisableAssessment] = useState<{
    assessmentId: string;
    assessmentName: string;
  } | null>(null);

  // Convert assessmentScores to Map if it's a Record
  const scoresMap = React.useMemo(() => {
    if (assessmentScores instanceof Map) {
      return assessmentScores;
    }
    const map = new Map<string, StudentScore>();
    Object.entries(assessmentScores).forEach(([key, value]) => {
      map.set(key, value);
    });
    return map;
  }, [assessmentScores]);

  useEffect(() => {
    if (isOpen) {
      setTermConfigs(initialConfigs);
      setValidationErrors([]);
      setSavedTerms(new Set());
      initialConfigsRef.current = initialConfigs;

      // Check if user has seen tutorial
      const hasSeenTutorial = localStorage.getItem("didasko-settings-tutorial");
      if (!hasSeenTutorial) {
        setTimeout(() => setShowTutorial(true), 500);
      }
    }
  }, [isOpen, initialConfigs]);

  // Check if current term has unsaved changes
  const hasUnsavedChanges = (term: Term): boolean => {
    if (savedTerms.has(term)) return false;

    const currentConfig = termConfigs[term];
    const initialConfig = initialConfigsRef.current[term];

    if (!currentConfig || !initialConfig) return false;

    // Deep comparison of configs
    return JSON.stringify(currentConfig) !== JSON.stringify(initialConfig);
  };

  // Handle term tab change with unsaved changes check
  const handleTermChange = (newTerm: Term) => {
    if (activeTerm === newTerm) return;

    // Check if current term has unsaved changes
    if (hasUnsavedChanges(activeTerm)) {
      setPendingTerm(newTerm);
      setShowUnsavedDialog(true);
    } else {
      setActiveTerm(newTerm);
    }
  };

  // Handle unsaved changes dialog actions
  const handleUnsavedDialogSave = () => {
    handleSaveTerm(activeTerm);
    if (isClosing) {
      setValidationErrors([]);
      onClose();
      setIsClosing(false);
    } else if (pendingTerm) {
      setActiveTerm(pendingTerm);
      setPendingTerm(null);
    }
    setShowUnsavedDialog(false);
  };

  const handleUnsavedDialogDiscard = () => {
    // Revert to initial config for current term
    setTermConfigs((prev) => ({
      ...prev,
      [activeTerm]: initialConfigsRef.current[activeTerm],
    }));
    setSavedTerms((prev) => {
      const newSet = new Set(prev);
      newSet.delete(activeTerm);
      return newSet;
    });

    if (isClosing) {
      setValidationErrors([]);
      onClose();
      setIsClosing(false);
    } else if (pendingTerm) {
      setActiveTerm(pendingTerm);
      setPendingTerm(null);
    }
    setShowUnsavedDialog(false);
  };

  const handleUnsavedDialogCancel = () => {
    setPendingTerm(null);
    setIsClosing(false);
    setShowUnsavedDialog(false);
  };

  // Handle close button click
  const handleClose = () => {
    // Check if there are unsaved changes in any term
    const hasAnyUnsaved = (
      ["PRELIM", "MIDTERM", "PREFINALS", "FINALS"] as const
    ).some((term) => hasUnsavedChanges(term));

    if (hasAnyUnsaved) {
      setIsClosing(true);
      setShowUnsavedDialog(true);
    } else {
      setValidationErrors([]);
      onClose();
    }
  };

  const config = termConfigs[activeTerm];

  const clamp = (value: number, min: number, max: number) => {
    return Math.min(Math.max(value, min), max);
  };

  // Helper function to validate and sanitize numeric input
  const handleNumericInput = (
    value: string,
    min: number,
    max: number,
    callback: (value: number) => void
  ) => {
    // Remove any non-numeric characters
    const numericValue = value.replace(/[^0-9]/g, "");

    // If no numeric characters remain, set to min (usually 0)
    if (numericValue === "") {
      callback(min);
      return;
    }

    // Convert to number and clamp to min/max
    const numValue = parseInt(numericValue, 10);
    if (isNaN(numValue)) {
      callback(min);
      return;
    }
    const clampedValue = clamp(numValue, min, max);
    callback(clampedValue);
  };

  const updateConfig = (updates: Partial<TermConfig>) => {
    setTermConfigs((prev) => ({
      ...prev,
      [activeTerm]: { ...prev[activeTerm], ...updates },
    }));
    // Clear saved status when term is modified
    setSavedTerms((prev) => {
      const newSet = new Set(prev);
      newSet.delete(activeTerm);
      return newSet;
    });
  };

  // Helper function to check if assessment has existing scores
  const hasAssessmentScores = (assessmentId: string): boolean => {
    for (const [key, score] of scoresMap.entries()) {
      // Key format is "studentId:assessmentId" for regular assessments
      // or "studentId:criteria:criteriaId" for linked criteria
      // We need to check if the assessmentId matches (not criteria scores)
      if (key.includes(":criteria:")) {
        // Skip criteria scores - they're linked to criteria, not assessments directly
        continue;
      }
      const parts = key.split(":");
      if (
        parts.length === 2 &&
        parts[1] === assessmentId &&
        score.score !== null
      ) {
        return true;
      }
    }
    return false;
  };

  // Helper function to get scores for an assessment
  const getAssessmentScores = (
    assessmentId: string
  ): Array<{ studentId: string; score: number }> => {
    const scores: Array<{ studentId: string; score: number }> = [];
    for (const [key, scoreData] of scoresMap.entries()) {
      // Key format is "studentId:assessmentId" for regular assessments
      // Skip criteria scores as they're handled separately
      if (key.includes(":criteria:")) {
        continue;
      }
      const parts = key.split(":");
      if (
        parts.length === 2 &&
        parts[1] === assessmentId &&
        scoreData.score !== null
      ) {
        scores.push({
          studentId: scoreData.studentId,
          score: scoreData.score,
        });
      }
    }
    return scores;
  };

  // Helper function to check if scores exceed new maxScore
  const getScoresExceedingMax = (
    assessmentId: string,
    newMaxScore: number
  ): Array<{ studentId: string; score: number }> => {
    return getAssessmentScores(assessmentId).filter(
      (s) => s.score > newMaxScore
    );
  };

  const updateAssessment = (
    type: "PT" | "QUIZ" | "EXAM",
    id: string,
    updates: Partial<Assessment>
  ) => {
    // Allow updates immediately - validation will happen on save
    const assessments = config.assessments.map((a) =>
      a.id === id ? { ...a, ...updates } : a
    );
    updateConfig({ assessments });
  };

  const addAssessment = (type: "PT" | "QUIZ") => {
    const existing = config.assessments.filter((a) => a.type === type);

    if (existing.length >= 6) {
      toast.error(
        `Maximum of 6 ${type === "PT" ? "PT/Lab" : "Quiz"} assessments allowed.`
      );
      return;
    }

    const maxOrder =
      existing.length > 0 ? Math.max(...existing.map((a) => a.order)) : -1;

    // Use "Q" prefix for quizzes, "PT" for PT/Lab
    const prefix = type === "QUIZ" ? "Q" : type;
    const existingNumbers = existing
      .map((a) => {
        // Match both "Q1" and "QUIZ1" for quizzes, "PT1" for PT
        const patterns =
          type === "QUIZ"
            ? [new RegExp(`^Q(\\d+)$`), new RegExp(`^QUIZ(\\d+)$`)]
            : [new RegExp(`^${prefix}(\\d+)$`)];

        for (const pattern of patterns) {
          const match = a.name.match(pattern);
          if (match) return parseInt(match[1]);
        }
        return 0;
      })
      .filter((n) => n > 0);

    const nextNumber =
      existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

    const newAssessment: Assessment = {
      id: `temp-${Math.random().toString(36).substr(2, 9)}`,
      name: `${prefix}${nextNumber}`,
      type,
      maxScore: 0,
      date: null,
      enabled: true,
      order: maxOrder + 1,
      transmutationBase: 0,
    };

    updateConfig({ assessments: [...config.assessments, newAssessment] });
  };

  const removeAssessment = (type: "PT" | "QUIZ", id: string) => {
    const existing = config.assessments.filter(
      (a) => a.type === type && a.enabled
    );
    if (existing.length <= 1) {
      toast.error(`You must have at least one ${type} assessment.`);
      return;
    }

    // Allow deletion immediately - validation will happen on save
    updateConfig({
      assessments: config.assessments.filter((a) => a.id !== id),
    });
  };

  // Handle confirmation dialogs
  const handleConfirmDeleteAssessment = async () => {
    setShowDeleteAssessmentDialog(false);
    setPendingDeleteAssessment(null);

    // Re-validate to check for other issues
    const scoreValidation = validateScoreIssues(activeTerm);

    // If there are more issues, show next dialog
    if (scoreValidation.maxScoreIssues.length > 0) {
      setPendingMaxScoreChange({
        assessmentId: scoreValidation.maxScoreIssues[0].id,
        oldMaxScore: scoreValidation.maxScoreIssues[0].oldMaxScore,
        newMaxScore: scoreValidation.maxScoreIssues[0].newMaxScore,
        affectedScores: scoreValidation.maxScoreIssues[0].affectedScores,
      });
      setShowMaxScoreDialog(true);
    } else if (scoreValidation.disabledAssessments.length > 0) {
      setPendingDisableAssessment({
        assessmentId: scoreValidation.disabledAssessments[0].id,
        assessmentName: scoreValidation.disabledAssessments[0].name,
      });
      setShowDisableAssessmentDialog(true);
    } else {
      // No more issues, proceed with save
      await performSave(activeTerm);
    }
  };

  const handleConfirmMaxScoreChange = async (keepScores: boolean) => {
    setShowMaxScoreDialog(false);

    if (!pendingMaxScoreChange) return;

    const { assessmentId, affectedScores, newMaxScore, oldMaxScore } =
      pendingMaxScoreChange;
    const isReduced = newMaxScore < oldMaxScore;

    // If maxScore was reduced and user confirmed, clear the exceeding scores
    const clearScoresForAssessment =
      isReduced && !keepScores
        ? {
            assessmentId,
            studentIds: affectedScores.map((s) => s.studentId),
          }
        : undefined;

    // Re-validate to check for other issues
    const scoreValidation = validateScoreIssues(activeTerm);

    // If there are more issues, show next dialog
    if (scoreValidation.disabledAssessments.length > 0) {
      setPendingDisableAssessment({
        assessmentId: scoreValidation.disabledAssessments[0].id,
        assessmentName: scoreValidation.disabledAssessments[0].name,
      });
      setShowDisableAssessmentDialog(true);
    } else {
      // No more issues, proceed with save
      setPendingMaxScoreChange(null);
      await performSave(activeTerm, clearScoresForAssessment);
    }
  };

  const handleConfirmDisableAssessment = async () => {
    setShowDisableAssessmentDialog(false);
    // No more issues after this, proceed with save
    setPendingDisableAssessment(null);
    await performSave(activeTerm);
  };

  const getTotalWeight = () => {
    return config.ptWeight + config.quizWeight + config.examWeight;
  };

  const totalWeight = getTotalWeight();
  const isValidWeight = totalWeight === 100;

  // Validate score-related issues before saving
  const validateScoreIssues = (
    term: Term
  ): {
    hasIssues: boolean;
    deletedAssessments: Array<{ id: string; name: string; type: string }>;
    maxScoreIssues: Array<{
      id: string;
      name: string;
      oldMaxScore: number;
      newMaxScore: number;
      affectedScores: Array<{ studentId: string; score: number }>;
    }>;
    disabledAssessments: Array<{ id: string; name: string }>;
  } => {
    const cfg = termConfigs[term];
    const initialCfg = initialConfigsRef.current[term];

    if (!cfg || !initialCfg) {
      return {
        hasIssues: false,
        deletedAssessments: [],
        maxScoreIssues: [],
        disabledAssessments: [],
      };
    }

    const deletedAssessments: Array<{
      id: string;
      name: string;
      type: string;
    }> = [];
    const maxScoreIssues: Array<{
      id: string;
      name: string;
      oldMaxScore: number;
      newMaxScore: number;
      affectedScores: Array<{ studentId: string; score: number }>;
    }> = [];
    const disabledAssessments: Array<{ id: string; name: string }> = [];

    // Find deleted assessments (in initial but not in current)
    initialCfg.assessments.forEach((initialAssessment) => {
      const stillExists = cfg.assessments.some(
        (a) => a.id === initialAssessment.id
      );
      if (!stillExists && hasAssessmentScores(initialAssessment.id)) {
        deletedAssessments.push({
          id: initialAssessment.id,
          name: initialAssessment.name,
          type: initialAssessment.type,
        });
      }
    });

    // Find maxScore changes and disabled assessments
    cfg.assessments.forEach((assessment) => {
      const initialAssessment = initialCfg.assessments.find(
        (a) => a.id === assessment.id
      );

      if (initialAssessment) {
        // Check for maxScore change
        if (
          assessment.maxScore !== initialAssessment.maxScore &&
          hasAssessmentScores(assessment.id)
        ) {
          const exceedingScores = getScoresExceedingMax(
            assessment.id,
            assessment.maxScore
          );

          if (assessment.maxScore < initialAssessment.maxScore) {
            // MaxScore reduced - warn user that exceeding scores will be deleted
            if (exceedingScores.length > 0) {
              maxScoreIssues.push({
                id: assessment.id,
                name: assessment.name,
                oldMaxScore: initialAssessment.maxScore,
                newMaxScore: assessment.maxScore,
                affectedScores: exceedingScores,
              });
            }
          } else if (assessment.maxScore > initialAssessment.maxScore) {
            // MaxScore increased - ask if user wants to keep existing scores
            const existingScores = getAssessmentScores(assessment.id);
            if (existingScores.length > 0) {
              maxScoreIssues.push({
                id: assessment.id,
                name: assessment.name,
                oldMaxScore: initialAssessment.maxScore,
                newMaxScore: assessment.maxScore,
                affectedScores: existingScores,
              });
            }
          }
        }

        // Check for disabling
        if (
          !assessment.enabled &&
          initialAssessment.enabled &&
          hasAssessmentScores(assessment.id)
        ) {
          disabledAssessments.push({
            id: assessment.id,
            name: assessment.name,
          });
        }
      }
    });

    return {
      hasIssues:
        deletedAssessments.length > 0 ||
        maxScoreIssues.length > 0 ||
        disabledAssessments.length > 0,
      deletedAssessments,
      maxScoreIssues,
      disabledAssessments,
    };
  };

  const validateTerm = (term: Term): string[] => {
    const errors: string[] = [];
    const cfg = termConfigs[term];
    const total = cfg.ptWeight + cfg.quizWeight + cfg.examWeight;
    if (total !== 100) {
      errors.push(
        `${term}: Total weight must equal 100% (currently ${total}%)`
      );
    }

    if (cfg.ptWeight < 0 || cfg.ptWeight > 100) {
      errors.push(`${term}: PT/Lab weight must be between 0-100%`);
    }
    if (cfg.quizWeight < 0 || cfg.quizWeight > 100) {
      errors.push(`${term}: Quiz weight must be between 0-100%`);
    }
    if (cfg.examWeight < 0 || cfg.examWeight > 100) {
      errors.push(`${term}: Exam weight must be between 0-100%`);
    }

    const enabledPTs = cfg.assessments.filter(
      (a) => a.type === "PT" && a.enabled
    );
    if (enabledPTs.length === 0) {
      errors.push(`${term}: At least one PT/Lab assessment must be enabled`);
    }

    enabledPTs.forEach((pt) => {
      if (!pt.name.trim()) {
        errors.push(`${term}: PT/Lab assessment name cannot be empty`);
      }
      if (pt.maxScore <= 0) {
        errors.push(`${term}: ${pt.name} max score must be greater than 0`);
      }
      if (pt.maxScore > 200) {
        errors.push(`${term}: ${pt.name} max score cannot exceed 200`);
      }
      const transmutationBase = pt.transmutationBase ?? 0;
      if (transmutationBase < 0 || transmutationBase > 75) {
        errors.push(
          `${term}: ${pt.name} transmutation base must be between 0-75`
        );
      }
    });

    const enabledQuizzes = cfg.assessments.filter(
      (a) => a.type === "QUIZ" && a.enabled
    );
    if (enabledQuizzes.length === 0) {
      errors.push(`${term}: At least one Quiz assessment must be enabled`);
    }

    enabledQuizzes.forEach((quiz) => {
      if (!quiz.name.trim()) {
        errors.push(`${term}: Quiz assessment name cannot be empty`);
      }
      if (quiz.maxScore <= 0) {
        errors.push(`${term}: ${quiz.name} max score must be greater than 0`);
      }
      if (quiz.maxScore > 200) {
        errors.push(`${term}: ${quiz.name} max score cannot exceed 200`);
      }
      const transmutationBase = quiz.transmutationBase ?? 0;
      if (transmutationBase < 0 || transmutationBase > 75) {
        errors.push(
          `${term}: ${quiz.name} transmutation base must be between 0-75`
        );
      }
    });

    const exam = cfg.assessments.find((a) => a.type === "EXAM");
    if (!exam) {
      errors.push(`${term}: Exam assessment is missing`);
    } else {
      if (!exam.enabled) {
        errors.push(`${term}: Exam must be enabled`);
      }
      if (!exam.name.trim()) {
        errors.push(`${term}: Exam name cannot be empty`);
      }
      if (exam.maxScore <= 0) {
        errors.push(`${term}: Exam max score must be greater than 0`);
      }
      if (exam.maxScore > 200) {
        errors.push(`${term}: Exam max score cannot exceed 200`);
      }
      // Note: Exam does not have transmutation base
    }

    const ptNames = new Set<string>();
    const quizNames = new Set<string>();

    cfg.assessments.forEach((a) => {
      if (a.type === "PT" && a.enabled) {
        const name = a.name.trim().toLowerCase();
        if (ptNames.has(name)) {
          errors.push(`${term}: Duplicate PT/Lab name "${a.name}"`);
        }
        ptNames.add(name);
      } else if (a.type === "QUIZ" && a.enabled) {
        const name = a.name.trim().toLowerCase();
        if (quizNames.has(name)) {
          errors.push(`${term}: Duplicate Quiz name "${a.name}"`);
        }
        quizNames.add(name);
      }
    });

    return errors;
  };

  const validateConfigs = (): string[] => {
    const errors: string[] = [];

    Object.entries(termConfigs).forEach(([term, cfg]) => {
      const termErrors = validateTerm(term as Term);
      errors.push(...termErrors);
    });

    return errors;
  };

  const handleSaveTerm = async (term: Term) => {
    const errors = validateTerm(term);

    if (errors.length > 0) {
      // Filter to show only errors for this term
      const allErrors = validationErrors.filter((e) => !e.startsWith(term));
      setValidationErrors([...allErrors, ...errors]);
      toast.error(
        `Found ${errors.length} validation error${
          errors.length > 1 ? "s" : ""
        } for ${term}`
      );
      return;
    }

    // Remove errors for this term
    setValidationErrors((prev) => prev.filter((e) => !e.startsWith(term)));

    // Validate score-related issues
    const scoreValidation = validateScoreIssues(term);

    if (scoreValidation.hasIssues) {
      // Set pending issues for the confirmation dialog
      setPendingDeleteAssessment(
        scoreValidation.deletedAssessments.length > 0
          ? {
              type: scoreValidation.deletedAssessments[0].type as "PT" | "QUIZ",
              id: scoreValidation.deletedAssessments[0].id,
            }
          : null
      );
      setPendingMaxScoreChange(
        scoreValidation.maxScoreIssues.length > 0
          ? {
              assessmentId: scoreValidation.maxScoreIssues[0].id,
              oldMaxScore: scoreValidation.maxScoreIssues[0].oldMaxScore,
              newMaxScore: scoreValidation.maxScoreIssues[0].newMaxScore,
              affectedScores: scoreValidation.maxScoreIssues[0].affectedScores,
            }
          : null
      );
      setPendingDisableAssessment(
        scoreValidation.disabledAssessments.length > 0
          ? {
              assessmentId: scoreValidation.disabledAssessments[0].id,
              assessmentName: scoreValidation.disabledAssessments[0].name,
            }
          : null
      );

      // Show appropriate dialog based on the first issue
      if (scoreValidation.deletedAssessments.length > 0) {
        setShowDeleteAssessmentDialog(true);
      } else if (scoreValidation.maxScoreIssues.length > 0) {
        setShowMaxScoreDialog(true);
      } else if (scoreValidation.disabledAssessments.length > 0) {
        setShowDisableAssessmentDialog(true);
      }
      return;
    }

    // No score issues, proceed with save
    await performSave(term);
  };

  const performSave = async (
    term: Term,
    clearScoresForAssessment?: {
      assessmentId: string;
      studentIds: string[];
    }
  ) => {
    setIsSaving(true);

    try {
      // Clear scores if user confirmed deletion (for reduced maxScore)
      if (clearScoresForAssessment && onClearScores) {
        await onClearScores(
          clearScoresForAssessment.assessmentId,
          clearScoresForAssessment.studentIds
        );
        toast.success(
          `Cleared ${clearScoresForAssessment.studentIds.length} score(s) that exceeded the new max score.`
        );
      }

      // Save only this term's config
      const updatedConfigs = {
        ...termConfigs,
        [term]: termConfigs[term],
      };
      await onSave(updatedConfigs);

      // Mark as saved
      setSavedTerms((prev) => new Set(prev).add(term));
      toast.success(`${term} configuration saved successfully!`);

      // Close modal after successful save
      setTimeout(() => {
        onClose();
      }, 100);
    } catch (error) {
      toast.error(`Failed to save ${term} configuration`);
      console.error("Error saving term config:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const tutorialSteps = React.useMemo(
    () => getTutorialSteps(savedTerms),
    [savedTerms]
  );

  const handleTutorialComplete = () => {
    setShowTutorial(false);
    localStorage.setItem("didasko-settings-tutorial", "completed");
  };

  const handleTutorialSkip = () => {
    setShowTutorial(false);
    localStorage.setItem("didasko-settings-tutorial", "completed");
  };

  if (!isOpen) return null;

  const pts = config.assessments
    .filter((a) => a.type === "PT")
    .sort((a, b) => a.order - b.order);
  const quizzes = config.assessments
    .filter((a) => a.type === "QUIZ")
    .sort((a, b) => a.order - b.order);
  const exam = config.assessments.find((a) => a.type === "EXAM");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[95vw] sm:max-w-5xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col relative">
        {/* Blocking Spinner Overlay */}
        {isSaving && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-[100] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#124A69]"></div>
              <p className="text-sm text-gray-600 font-medium">
                Saving configuration...
              </p>
            </div>
          </div>
        )}

        {/* Tutorial Overlay */}
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

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 px-4 sm:px-6 py-3 sm:py-4 border-b">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[#124A69]">
              Class Record Settings
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
              Configure assessments and weights for each term
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowTutorial(true);
              }}
              className="p-2 hover:bg-[#124A69]/10 rounded-lg transition-colors text-[#124A69]"
              title="Show Tutorial"
            >
              <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Validation Errors Display */}
        {validationErrors.length > 0 && (
          <div className="mx-4 sm:mx-6 mt-3 sm:mt-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-xs sm:text-sm font-semibold text-red-800 mb-2">
                  Please fix the following errors:
                </h4>
                <ul className="text-xs sm:text-sm text-red-700 space-y-1 max-h-32 sm:max-h-40 overflow-y-auto">
                  {validationErrors.map((error, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-red-600">•</span>
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Term Tabs */}
        <div
          className="flex border-b overflow-x-auto"
          data-tutorial="term-tabs-settings"
        >
          {(["PRELIM", "MIDTERM", "PREFINALS", "FINALS"] as const).map(
            (term) => {
              const termErrors = validationErrors.filter((e) =>
                e.startsWith(term)
              );
              const isSaved = savedTerms.has(term);
              return (
                <button
                  key={term}
                  onClick={() => handleTermChange(term)}
                  className={`relative px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium whitespace-nowrap ${
                    term === activeTerm
                      ? "text-[#124A69] border-b-2 border-[#124A69]"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {term}
                  {termErrors.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                  )}
                  {isSaved && !termErrors.length && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full"></span>
                  )}
                  {hasUnsavedChanges(term) &&
                    !isSaved &&
                    !termErrors.length && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-yellow-500 rounded-full"></span>
                    )}
                </button>
              );
            }
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          {/* Weight Configuration and Transmutation */}
          <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
            {/* Weight Configuration */}
            <div
              className="flex-1 p-3 sm:p-4 bg-[#124A69]/5 border border-[#124A69]/20 rounded-lg"
              data-tutorial="weight-distribution"
            >
              <h3 className="text-xs sm:text-sm font-semibold text-[#124A69] mb-3">
                Grade Weight Distribution
              </h3>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 md:gap-6">
                <div className="flex items-center gap-2 sm:gap-3">
                  <label className="text-xs sm:text-sm font-medium text-gray-700 w-16 sm:w-20">
                    PT/Lab:
                  </label>
                  <input
                    type="text"
                    value={config.ptWeight}
                    onChange={(e) => {
                      handleNumericInput(e.target.value, 0, 100, (value) => {
                        updateConfig({ ptWeight: value });
                      });
                    }}
                    onKeyDown={(e) => {
                      if ([".", ",", "e", "E", "+", "-"].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    min="0"
                    max="100"
                    className="w-16 sm:w-20 px-2 sm:px-3 py-1.5 sm:py-2 border border-[#124A69]/30 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-[#124A69] focus:border-[#124A69]"
                  />
                  <span className="text-xs sm:text-sm text-gray-600 font-medium">
                    %
                  </span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <label className="text-xs sm:text-sm font-medium text-gray-700 w-16 sm:w-20">
                    Quizzes:
                  </label>
                  <input
                    type="text"
                    value={config.quizWeight}
                    onChange={(e) => {
                      handleNumericInput(e.target.value, 0, 100, (value) => {
                        updateConfig({ quizWeight: value });
                      });
                    }}
                    onKeyDown={(e) => {
                      if ([".", ",", "e", "E", "+", "-"].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    className="w-16 sm:w-20 px-2 sm:px-3 py-1.5 sm:py-2 border border-[#124A69]/30 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-[#124A69] focus:border-[#124A69]"
                    min="0"
                    max="100"
                  />
                  <span className="text-xs sm:text-sm text-gray-600 font-medium">
                    %
                  </span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <label className="text-xs sm:text-sm font-medium text-gray-700 w-16 sm:w-20">
                    Exam:
                  </label>
                  <input
                    type="text"
                    value={config.examWeight}
                    onChange={(e) => {
                      handleNumericInput(e.target.value, 0, 100, (value) => {
                        updateConfig({ examWeight: value });
                      });
                    }}
                    onKeyDown={(e) => {
                      if ([".", ",", "e", "E", "+", "-"].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    className="w-16 sm:w-20 px-2 sm:px-3 py-1.5 sm:py-2 border border-[#124A69]/30 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-[#124A69] focus:border-[#124A69]"
                    min="0"
                    max="100"
                  />
                  <span className="text-xs sm:text-sm text-gray-600 font-medium">
                    %
                  </span>
                </div>
                <div className="sm:ml-auto">
                  <div
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold ${
                      isValidWeight
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    Total: {totalWeight}%
                    {!isValidWeight && (
                      <AlertCircle className="inline w-3 h-3 sm:w-4 sm:h-4 ml-1" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PT/Lab Section */}
          <div className="mb-6" data-tutorial="pt-section">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <span className="px-2 py-1 bg-[#124A69] text-white rounded text-xs font-bold">
                  {config.ptWeight}%
                </span>
                PT/Lab Assessments
                <span className="text-xs text-gray-500 font-normal">
                  ({pts.filter((p) => p.enabled).length} enabled)
                </span>
              </h3>
              <button
                onClick={() => addAssessment("PT")}
                disabled={pts.length >= 6}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg ${
                  pts.length >= 6
                    ? "text-gray-400 bg-gray-100 cursor-not-allowed"
                    : "text-[#124A69] hover:bg-blue-50"
                }`}
              >
                <Plus className="w-4 h-4" />
                Add PT/Lab
              </button>
            </div>
            <div className="space-y-2">
              {pts.map((pt) => (
                <div
                  key={pt.id}
                  className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg"
                >
                  {/* First Row: Checkbox, Name, Max Score, Date */}
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={pt.enabled}
                      onCheckedChange={(checked) =>
                        updateAssessment("PT", pt.id, {
                          enabled: checked === true,
                        })
                      }
                      className="data-[state=checked]:bg-[#124A69] data-[state=checked]:border-[#124A69] border-[#124A69]/30"
                    />
                    <input
                      type="text"
                      value={pt.name}
                      onChange={(e) =>
                        updateAssessment("PT", pt.id, {
                          name: e.target.value,
                        })
                      }
                      className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Name"
                      maxLength={5}
                      data-tutorial="pt-name"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">Max Score:</span>
                      <div className="relative flex items-center gap-1">
                        <input
                          type="text"
                          value={pt.maxScore}
                          onChange={(e) => {
                            if (pt.linkedCriteriaId) return;
                            handleNumericInput(
                              e.target.value,
                              0,
                              200,
                              (value) => {
                                updateAssessment("PT", pt.id, {
                                  maxScore: value,
                                });
                              }
                            );
                          }}
                          onKeyDown={(e) => {
                            if (
                              [".", ",", "e", "E", "+", "-"].includes(e.key)
                            ) {
                              e.preventDefault();
                            }
                          }}
                          disabled={!!pt.linkedCriteriaId}
                          className={`w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm ${
                            pt.linkedCriteriaId
                              ? "bg-gray-100 cursor-not-allowed text-gray-500"
                              : ""
                          }`}
                          placeholder="Max"
                          min="0"
                          max="200"
                          data-tutorial="pt-max-score"
                        />
                        {pt.linkedCriteriaId && (
                          <div className="group relative cursor-help">
                            <Info className="w-4 h-4 text-blue-500 hover:text-blue-600" />
                            <div className="absolute left-0 top-6 z-50 hidden w-64 rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg group-hover:block">
                              Max score is automatically calculated from the
                              linked criteria (number of rubrics × scoring
                              range). Unlink the criteria to edit manually.
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-600">Base</span>
                      <input
                        type="text"
                        value={pt.transmutationBase ?? 0}
                        onChange={(e) => {
                          handleNumericInput(e.target.value, 0, 75, (value) => {
                            updateAssessment("PT", pt.id, {
                              transmutationBase: value,
                            });
                          });
                        }}
                        onKeyDown={(e) => {
                          if ([".", ",", "e", "E", "+", "-"].includes(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        min="0"
                        max="75"
                        className="w-20 px-2 py-2 border border-gray-300 rounded-lg text-xs"
                        data-tutorial="pt-base-scoring"
                      />
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="flex-1 justify-start text-left font-normal"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
                            {pt.date ? (
                              format(new Date(pt.date), "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={pt.date ? new Date(pt.date) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                updateAssessment("PT", pt.id, {
                                  date: format(date, "yyyy-MM-dd"),
                                });
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    {pts.length > 1 && (
                      <button
                        onClick={() => removeAssessment("PT", pt.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Second Row: Linking dropdowns */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-32">
                      Link to Existing Grades:
                    </span>

                    <select
                      value={pt.linkedCriteriaId || ""}
                      onChange={(e) => {
                        const linkedId = e.target.value || null;
                        const linkedCriteria = availableCriteria.find(
                          (c) => c.id === linkedId
                        );

                        updateAssessment("PT", pt.id, {
                          linkedCriteriaId: linkedId,
                          // Update maxScore from availableCriteria (now correctly calculated)
                          ...(linkedCriteria?.maxScore && {
                            maxScore: linkedCriteria.maxScore,
                          }),
                        });
                      }}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs"
                    >
                      <option value="">No Link</option>

                      <optgroup label="Recitation">
                        {availableCriteria
                          .filter((c) => c.type === "RECITATION")
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.maxScore ? `(${c.maxScore} pts)` : ""}
                            </option>
                          ))}
                      </optgroup>

                      <optgroup label="Group Reporting">
                        {availableCriteria
                          .filter((c) => c.type === "GROUP_REPORTING")
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.maxScore ? `(${c.maxScore} pts)` : ""}
                            </option>
                          ))}
                      </optgroup>

                      <optgroup label="Individual Reporting">
                        {availableCriteria
                          .filter((c) => c.type === "INDIVIDUAL_REPORTING")
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.maxScore ? `(${c.maxScore} pts)` : ""}
                            </option>
                          ))}
                      </optgroup>
                    </select>

                    {pt.linkedCriteriaId && (
                      <span className="text-xs text-green-600 font-medium">
                        ✓ Linked
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quizzes Section */}
          <div className="mb-6" data-tutorial="quiz-section">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <span className="px-2 py-1 bg-[#124A69] text-white rounded text-xs font-bold">
                  {config.quizWeight}%
                </span>
                Quiz Assessments
                <span className="text-xs text-gray-500 font-normal">
                  ({quizzes.filter((q) => q.enabled).length} enabled)
                </span>
              </h3>
              <button
                onClick={() => addAssessment("QUIZ")}
                disabled={quizzes.length >= 6}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg ${
                  quizzes.length >= 6
                    ? "text-gray-400 bg-gray-100 cursor-not-allowed"
                    : "text-[#124A69] hover:bg-blue-50"
                }`}
              >
                <Plus className="w-4 h-4" />
                Add Quiz
              </button>
            </div>
            <div className="space-y-2">
              {quizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg"
                >
                  {/* First Row: Checkbox, Name, Max Score, Date */}
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={quiz.enabled}
                      onCheckedChange={(checked) =>
                        updateAssessment("QUIZ", quiz.id, {
                          enabled: checked === true,
                        })
                      }
                      className="data-[state=checked]:bg-[#124A69] data-[state=checked]:border-[#124A69] border-[#124A69]/30"
                    />
                    <input
                      type="text"
                      value={quiz.name}
                      onChange={(e) =>
                        updateAssessment("QUIZ", quiz.id, {
                          name: e.target.value,
                        })
                      }
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Name"
                      maxLength={5}
                      data-tutorial="quiz-name"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">Max Score:</span>
                      <div className="relative flex items-center gap-1">
                        <input
                          type="text"
                          value={quiz.maxScore}
                          onChange={(e) => {
                            if (quiz.linkedCriteriaId) return;
                            handleNumericInput(
                              e.target.value,
                              0,
                              200,
                              (value) => {
                                updateAssessment("QUIZ", quiz.id, {
                                  maxScore: value,
                                });
                              }
                            );
                          }}
                          onKeyDown={(e) => {
                            if (
                              [".", ",", "e", "E", "+", "-"].includes(e.key)
                            ) {
                              e.preventDefault();
                            }
                          }}
                          disabled={!!quiz.linkedCriteriaId}
                          className={`w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm ${
                            quiz.linkedCriteriaId
                              ? "bg-gray-100 cursor-not-allowed text-gray-500"
                              : ""
                          }`}
                          placeholder="Max"
                          min="0"
                          max="200"
                          data-tutorial="quiz-max-score"
                        />
                        {quiz.linkedCriteriaId && (
                          <div className="group relative cursor-help">
                            <Info className="w-4 h-4 text-blue-500 hover:text-blue-600" />
                            <div className="absolute left-0 top-6 z-50 hidden w-64 rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg group-hover:block">
                              Max score is automatically calculated from the
                              linked criteria (number of rubrics × scoring
                              range). Unlink the criteria to edit manually.
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-600">Base</span>
                      <input
                        type="text"
                        value={quiz.transmutationBase ?? 0}
                        onChange={(e) => {
                          handleNumericInput(e.target.value, 0, 75, (value) => {
                            updateAssessment("QUIZ", quiz.id, {
                              transmutationBase: value,
                            });
                          });
                        }}
                        onKeyDown={(e) => {
                          if ([".", ",", "e", "E", "+", "-"].includes(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        min="0"
                        max="75"
                        className="w-20 px-2 py-2 border border-gray-300 rounded-lg text-xs"
                        data-tutorial="quiz-base-scoring"
                      />
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="flex-1 justify-start text-left font-normal"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
                            {quiz.date ? (
                              format(new Date(quiz.date), "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={
                              quiz.date ? new Date(quiz.date) : undefined
                            }
                            onSelect={(date) => {
                              if (date) {
                                updateAssessment("QUIZ", quiz.id, {
                                  date: format(date, "yyyy-MM-dd"),
                                });
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    {quizzes.length > 1 && (
                      <button
                        onClick={() => removeAssessment("QUIZ", quiz.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Second Row: Linking dropdowns */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-32">
                      Link to Existing Grades:
                    </span>

                    <select
                      value={quiz.linkedCriteriaId || ""}
                      onChange={(e) => {
                        const linkedId = e.target.value || null;
                        const linkedCriteria = availableCriteria.find(
                          (c) => c.id === linkedId
                        );

                        updateAssessment("QUIZ", quiz.id, {
                          linkedCriteriaId: linkedId,
                          // Update maxScore from availableCriteria (now correctly calculated)
                          ...(linkedCriteria?.maxScore && {
                            maxScore: linkedCriteria.maxScore,
                          }),
                        });
                      }}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs"
                    >
                      <option value="">No Link</option>

                      <optgroup label="Recitation">
                        {availableCriteria
                          .filter((c) => c.type === "RECITATION")
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.maxScore ? `(${c.maxScore} pts)` : ""}
                            </option>
                          ))}
                      </optgroup>

                      <optgroup label="Group Reporting">
                        {availableCriteria
                          .filter((c) => c.type === "GROUP_REPORTING")
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.maxScore ? `(${c.maxScore} pts)` : ""}
                            </option>
                          ))}
                      </optgroup>

                      <optgroup label="Individual Reporting">
                        {availableCriteria
                          .filter((c) => c.type === "INDIVIDUAL_REPORTING")
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.maxScore ? `(${c.maxScore} pts)` : ""}
                            </option>
                          ))}
                      </optgroup>
                    </select>

                    {quiz.linkedCriteriaId && (
                      <span className="text-xs text-green-600 font-medium">
                        ✓ Linked
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Exam Section */}
          <div data-tutorial="exam-section">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="px-2 py-1 bg-[#124A69] text-white rounded text-xs font-bold">
                {config.examWeight}%
              </span>
              Final Exam
              <span className="text-xs text-gray-500 font-normal">
                (Required)
              </span>
            </h3>
            {exam && (
              <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg">
                {/* First Row: Checkbox, Name, Max Score, Date */}
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={exam.enabled}
                    onCheckedChange={(checked) =>
                      updateAssessment("EXAM", exam.id, {
                        enabled: checked === true,
                      })
                    }
                    className="data-[state=checked]:bg-[#124A69] data-[state=checked]:border-[#124A69] border-[#124A69]/30"
                  />
                  <input
                    type="text"
                    value={exam.name}
                    onChange={(e) =>
                      updateAssessment("EXAM", exam.id, {
                        name: e.target.value,
                      })
                    }
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Name"
                    maxLength={5}
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Max Score:</span>
                    <div className="relative flex items-center gap-1">
                      <input
                        type="text"
                        value={exam.maxScore}
                        onChange={(e) => {
                          if (exam.linkedCriteriaId) return;
                          handleNumericInput(
                            e.target.value,
                            0,
                            200,
                            (value) => {
                              updateAssessment("EXAM", exam.id, {
                                maxScore: value,
                              });
                            }
                          );
                        }}
                        onKeyDown={(e) => {
                          if ([".", ",", "e", "E", "+", "-"].includes(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        disabled={!!exam.linkedCriteriaId}
                        className={`w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm ${
                          exam.linkedCriteriaId
                            ? "bg-gray-100 cursor-not-allowed text-gray-500"
                            : ""
                        }`}
                        placeholder="Max"
                        min="0"
                        max="200"
                      />
                      {exam.linkedCriteriaId && (
                        <div
                          className="group relative cursor-help"
                          title="Max score is automatically calculated from linked criteria (number of rubrics × scoring range)"
                        >
                          <Info className="w-4 h-4 text-blue-500 hover:text-blue-600" />
                          <div className="absolute left-0 top-6 z-50 hidden w-64 rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg group-hover:block">
                            Max score is automatically calculated from the
                            linked criteria (number of rubrics × scoring range).
                            Unlink the criteria to edit manually.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="flex-1 justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
                          {exam.date ? (
                            format(new Date(exam.date), "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={exam.date ? new Date(exam.date) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              updateAssessment("EXAM", exam.id, {
                                date: format(date, "yyyy-MM-dd"),
                              });
                            }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 px-4 sm:px-6 py-3 sm:py-4 border-t bg-gray-50">
          <div className="text-xs sm:text-sm text-gray-600">
            <AlertCircle className="inline w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            {savedTerms.has(activeTerm) ? (
              <span className="flex items-center gap-2 text-green-600">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                {activeTerm} saved
              </span>
            ) : (
              "Save each term individually before switching tabs"
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleClose}
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => handleSaveTerm(activeTerm)}
              data-tutorial="term-save-button"
              disabled={
                isSaving ||
                (!hasUnsavedChanges(activeTerm) &&
                  activeTerm !== "PRELIM" &&
                  savedTerms.has(activeTerm))
              }
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-[#124A69] text-white hover:bg-[#0D3A54] text-xs sm:text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Save {activeTerm}</span>
              <span className="sm:hidden">Save</span>
            </button>
          </div>
        </div>

        {/* Unsaved Changes Dialog */}
        <Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
          <DialogContent className="">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Unsaved Changes
              </DialogTitle>
              <DialogDescription>
                {isClosing
                  ? "You have unsaved changes. What would you like to do?"
                  : `You have unsaved changes in ${activeTerm}. What would you like to do?`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={handleUnsavedDialogCancel}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleUnsavedDialogDiscard}
                className="w-full sm:w-auto"
              >
                Discard Changes
              </Button>
              <Button
                onClick={handleUnsavedDialogSave}
                className="w-full sm:w-auto bg-[#124A69] hover:bg-[#0D3A54]"
              >
                <Save className="w-4 h-4 mr-2" />
                {isClosing ? "Save & Close" : "Save & Continue"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Assessment with Scores Dialog */}
        <Dialog
          open={showDeleteAssessmentDialog}
          onOpenChange={setShowDeleteAssessmentDialog}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                Delete Assessment with Existing Grades
              </DialogTitle>
              <DialogDescription>
                This assessment has existing student grades. Deleting it will
                permanently remove all associated grades. This action cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteAssessmentDialog(false);
                  setPendingDeleteAssessment(null);
                }}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDeleteAssessment}
                className="w-full sm:w-auto"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Assessment & Grades
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Max Score Change Dialog */}
        <Dialog open={showMaxScoreDialog} onOpenChange={setShowMaxScoreDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Change Max Score
              </DialogTitle>
              <DialogDescription>
                {pendingMaxScoreChange && (
                  <div className="space-y-2">
                    {pendingMaxScoreChange.newMaxScore <
                    pendingMaxScoreChange.oldMaxScore ? (
                      <>
                        <p>
                          You are reducing the max score from{" "}
                          <strong>{pendingMaxScoreChange.oldMaxScore}</strong>{" "}
                          to{" "}
                          <strong>{pendingMaxScoreChange.newMaxScore}</strong>.
                        </p>
                        <p className="text-red-600 font-medium">
                          {pendingMaxScoreChange.affectedScores.length}{" "}
                          student(s) have scores that exceed the new max score.
                          If you proceed, these scores will be permanently
                          deleted.
                        </p>
                      </>
                    ) : (
                      <>
                        <p>
                          You are increasing the max score from{" "}
                          <strong>{pendingMaxScoreChange.oldMaxScore}</strong>{" "}
                          to{" "}
                          <strong>{pendingMaxScoreChange.newMaxScore}</strong>.
                        </p>
                        <p>
                          This assessment has{" "}
                          {pendingMaxScoreChange.affectedScores.length} existing
                          grade(s). Would you like to keep them?
                        </p>
                      </>
                    )}
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowMaxScoreDialog(false);
                  setPendingMaxScoreChange(null);
                }}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              {pendingMaxScoreChange &&
              pendingMaxScoreChange.newMaxScore <
                pendingMaxScoreChange.oldMaxScore ? (
                // MaxScore reduced - show "Proceed & Delete" button (only option)
                <Button
                  variant="destructive"
                  onClick={() => handleConfirmMaxScoreChange(false)}
                  className="w-full sm:w-auto"
                >
                  Proceed & Delete Scores
                </Button>
              ) : (
                // MaxScore increased - show both options
                <>
                  <Button
                    variant="destructive"
                    onClick={() => handleConfirmMaxScoreChange(false)}
                    className="w-full sm:w-auto"
                  >
                    Delete Existing Scores
                  </Button>
                  <Button
                    onClick={() => handleConfirmMaxScoreChange(true)}
                    className="w-full sm:w-auto bg-[#124A69] hover:bg-[#0D3A54]"
                  >
                    Keep Existing Scores
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Disable Assessment with Scores Dialog */}
        <Dialog
          open={showDisableAssessmentDialog}
          onOpenChange={setShowDisableAssessmentDialog}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Disable Assessment with Existing Grades
              </DialogTitle>
              <DialogDescription>
                {pendingDisableAssessment && (
                  <>
                    The assessment "{pendingDisableAssessment.assessmentName}"
                    has existing student grades. Disabling it will exclude it
                    from grade calculations, but the grades will be preserved.
                    You can re-enable it later.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDisableAssessmentDialog(false);
                  setPendingDisableAssessment(null);
                }}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDisableAssessment}
                className="w-full sm:w-auto bg-[#124A69] hover:bg-[#0D3A54]"
              >
                Disable Assessment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
