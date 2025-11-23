import { useEffect, useState, useRef } from "react";
import { toast } from "react-hot-toast";
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
  Lightbulb,
} from "lucide-react";
import type { Term, Assessment, TermConfig } from "../types/ClassRecordTable";
import type { CriteriaOption } from "../types/ClassRecordTable";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  termConfigs: Record<string, TermConfig>;
  onSave: (configs: Record<string, TermConfig>) => Promise<void>;
  availableCriteria: CriteriaOption[];
}

interface TutorialStep {
  target: string;
  title: string;
  content: string;
  position: "top" | "bottom" | "left" | "right";
  highlightPadding?: number;
}

const tutorialSteps: TutorialStep[] = [
  {
    target: "[data-tutorial='term-tabs-settings']",
    title: "Step 1: Select a Term",
    content:
      "Choose which term you want to configure. Each term can have different weights and assessments.",
    position: "bottom",
    highlightPadding: 8,
  },
  {
    target: "[data-tutorial='weight-distribution']",
    title: "Step 2: Set Grade Weights",
    content:
      "Adjust the percentage weights for PT/Lab, Quizzes, and Exam. They must add up to 100%!",
    position: "bottom",
    highlightPadding: 8,
  },
  {
    target: "[data-tutorial='pt-section']",
    title: "Step 3: Configure PT/Lab",
    content:
      "Add, edit, or remove PT/Lab assessments. Set max scores and dates. You can also link to existing grades!",
    position: "top",
    highlightPadding: 8,
  },
  {
    target: "[data-tutorial='quiz-section']",
    title: "Step 4: Configure Quizzes",
    content:
      "Same as PT/Lab - add multiple quizzes, set max scores, and schedule dates.",
    position: "top",
    highlightPadding: 8,
  },
  {
    target: "[data-tutorial='exam-section']",
    title: "Step 5: Configure Exam",
    content:
      "Set up your final exam. This is required and must be enabled for each term.",
    position: "top",
    highlightPadding: 8,
  },
  {
    target: "[data-tutorial='term-save-button']",
    title: "Step 6: Save Your Changes",
    content:
      "Click here to save this term's configuration. Remember to save before switching to another term!",
    position: "top",
    highlightPadding: 8,
  },
];

function Tutorial({
  isActive,
  currentStep,
  onNext,
  onSkip,
  totalSteps,
}: {
  isActive: boolean;
  currentStep: number;
  onNext: () => void;
  onSkip: () => void;
  totalSteps: number;
}) {
  const [highlightBox, setHighlightBox] = useState<DOMRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const step = tutorialSteps[currentStep];

  useEffect(() => {
    if (!isActive || !step) return;

    const updatePosition = () => {
      const element = document.querySelector(step.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        setHighlightBox(rect);

        const padding = step.highlightPadding || 8;
        let top = 0;
        let left = 0;

        switch (step.position) {
          case "bottom":
            top = rect.bottom + padding + 10;
            left = rect.left + rect.width / 2;
            break;
          case "top":
            top = rect.top - padding - 200;
            left = rect.left + rect.width / 2;
            break;
          case "left":
            top = rect.top + rect.height / 2;
            left = rect.left - padding - 10;
            break;
          case "right":
            top = rect.top + rect.height / 2;
            left = rect.right + padding + 10;
            break;
        }

        setTooltipPosition({ top, left });
      }
    };

    updatePosition();
    const timer = setTimeout(updatePosition, 100);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isActive, currentStep, step]);

  if (!isActive || !step || !highlightBox) return null;

  const padding = step.highlightPadding || 8;

  return (
    <>
      {/* Dark Overlay with Cutout */}
      <div className="fixed inset-0 z-[100] pointer-events-none">
        <svg className="w-full h-full">
          <defs>
            <mask id="settings-tutorial-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={highlightBox.left - padding}
                y={highlightBox.top - padding}
                width={highlightBox.width + padding * 2}
                height={highlightBox.height + padding * 2}
                rx="8"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.75)"
            mask="url(#settings-tutorial-mask)"
          />
        </svg>
      </div>

      {/* Highlight Border */}
      <div
        className="fixed z-[101] border-4 border-blue-500 rounded-lg pointer-events-none animate-pulse"
        style={{
          top: highlightBox.top - padding,
          left: highlightBox.left - padding,
          width: highlightBox.width + padding * 2,
          height: highlightBox.height + padding * 2,
        }}
      />

      {/* Tooltip */}
      <div
        className="fixed z-[102] pointer-events-auto"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          transform:
            step.position === "bottom" || step.position === "top"
              ? "translateX(-50%)"
              : step.position === "right"
              ? "translateX(0)"
              : "translateX(-100%)",
        }}
      >
        <div className="bg-white rounded-lg shadow-2xl p-5 max-w-sm border-2 border-blue-500">
          <div className="flex items-start gap-3 mb-3">
            <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
              <Lightbulb className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 mb-1">{step.title}</h3>
              <p className="text-sm text-gray-600">{step.content}</p>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <span className="text-xs text-gray-500 font-medium">
              {currentStep + 1} of {totalSteps}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onSkip}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Skip Tour
              </button>
              <button
                onClick={onNext}
                className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
              >
                {currentStep === tutorialSteps.length - 1 ? "Got it!" : "Next"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function SettingsModal({
  isOpen,
  onClose,
  termConfigs: initialConfigs,
  onSave,
  availableCriteria,
}: SettingsModalProps) {
  const [activeTerm, setActiveTerm] = useState<Term>("PRELIM");
  const [termConfigs, setTermConfigs] = useState(initialConfigs);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [savedTerms, setSavedTerms] = useState<Set<Term>>(new Set());
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingTerm, setPendingTerm] = useState<Term | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const initialConfigsRef = useRef(initialConfigs);

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

  const updateAssessment = (
    type: "PT" | "QUIZ" | "EXAM",
    id: string,
    updates: Partial<Assessment>
  ) => {
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

    const prefix = type;
    const existingNumbers = existing
      .map((a) => {
        const match = a.name.match(new RegExp(`^${prefix}(\\d+)$`));
        return match ? parseInt(match[1]) : 0;
      })
      .filter((n) => n > 0);

    const nextNumber =
      existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

    const newAssessment: Assessment = {
      id: `temp-${Math.random().toString(36).substr(2, 9)}`,
      name: `${type}${nextNumber}`,
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
    updateConfig({
      assessments: config.assessments.filter((a) => a.id !== id),
    });
  };

  const getTotalWeight = () => {
    return config.ptWeight + config.quizWeight + config.examWeight;
  };

  const totalWeight = getTotalWeight();
  const isValidWeight = totalWeight === 100;

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
      const transmutationBase = exam.transmutationBase ?? 0;
      if (transmutationBase < 0 || transmutationBase > 75) {
        errors.push(`${term}: Exam transmutation base must be between 0-75`);
      }
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

    setIsSaving(true);
    const loadingToast = toast.loading(`Saving ${term} configuration...`);

    try {
      // Save only this term's config
      const updatedConfigs = {
        ...termConfigs,
        [term]: termConfigs[term],
      };
      await onSave(updatedConfigs);

      // Mark as saved
      setSavedTerms((prev) => new Set(prev).add(term));
      toast.dismiss(loadingToast);

      // Close modal after successful save
      setTimeout(() => {
        onClose();
      }, 100);
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(`Failed to save ${term} configuration`);
      console.error("Error saving term config:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleNextTutorialStep = () => {
    if (tutorialStep === tutorialSteps.length - 1) {
      setShowTutorial(false);
      setTutorialStep(0);
      localStorage.setItem("didasko-settings-tutorial", "completed");
    } else {
      setTutorialStep(tutorialStep + 1);
    }
  };

  const handleSkipTutorial = () => {
    setShowTutorial(false);
    setTutorialStep(0);
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
        <Tutorial
          isActive={showTutorial}
          currentStep={tutorialStep}
          onNext={handleNextTutorialStep}
          onSkip={handleSkipTutorial}
          totalSteps={tutorialSteps.length}
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
                setTutorialStep(0);
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
                    type="number"
                    value={config.ptWeight}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      const value = clamp(raw, 0, 100);
                      updateConfig({ ptWeight: value });
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
                    type="number"
                    value={config.quizWeight}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      const value = clamp(raw, 0, 100);
                      updateConfig({ quizWeight: value });
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
                    type="number"
                    value={config.examWeight}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      const value = clamp(raw, 0, 100);
                      updateConfig({ examWeight: value });
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
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">Max Score:</span>
                      <input
                        type="number"
                        value={pt.maxScore}
                        onChange={(e) =>
                          updateAssessment("PT", pt.id, {
                            maxScore: Number(e.target.value),
                          })
                        }
                        onKeyDown={(e) => {
                          if ([".", ",", "e", "E", "+", "-"].includes(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Max"
                        min="0"
                        max="200"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-600">Base</span>
                      <input
                        type="number"
                        value={pt.transmutationBase ?? 0}
                        onChange={(e) => {
                          const raw = Number(e.target.value);
                          const value = clamp(raw, 0, 75);
                          updateAssessment("PT", pt.id, {
                            transmutationBase: value,
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
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">Max Score:</span>
                      <input
                        type="number"
                        value={quiz.maxScore}
                        onChange={(e) =>
                          updateAssessment("QUIZ", quiz.id, {
                            maxScore: Number(e.target.value),
                          })
                        }
                        onKeyDown={(e) => {
                          if ([".", ",", "e", "E", "+", "-"].includes(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Max"
                        min="0"
                        max="200"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-600">Base</span>
                      <input
                        type="number"
                        value={quiz.transmutationBase ?? 0}
                        onChange={(e) => {
                          const raw = Number(e.target.value);
                          const value = clamp(raw, 0, 75);
                          updateAssessment("QUIZ", quiz.id, {
                            transmutationBase: value,
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
                    <input
                      type="number"
                      value={exam.maxScore}
                      onChange={(e) =>
                        updateAssessment("EXAM", exam.id, {
                          maxScore: Number(e.target.value),
                        })
                      }
                      onKeyDown={(e) => {
                        if ([".", ",", "e", "E", "+", "-"].includes(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Max"
                      min="0"
                      max="200"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-600">Base</span>
                    <input
                      type="number"
                      value={exam.transmutationBase ?? 0}
                      onChange={(e) => {
                        const raw = Number(e.target.value);
                        const value = clamp(raw, 0, 75);
                        updateAssessment("EXAM", exam.id, {
                          transmutationBase: value,
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
              disabled={isSaving}
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
      </div>
    </div>
  );
}
