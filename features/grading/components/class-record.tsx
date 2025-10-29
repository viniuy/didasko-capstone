import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import axiosInstance from "@/lib/axios";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Search,
  Loader2,
  Settings,
  Download,
  X,
  Calendar,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  CalendarIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
function LoadingSpinner() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm min-h-[770px] max-h-[770px]">
      <div className="flex flex-col items-center gap-4 mt-40">
        {/* Animated spinner */}
        <h2 className="text-3xl font-bold text-[#124A69] animate-pulse">
          Welcome to Didasko!
        </h2>
        <p
          className="text-lg text-gray-600 animate-pulse"
          style={{ animationDelay: "150ms" }}
        >
          Please sit tight while we are getting things ready for you...
        </p>

        {/* Optional: Add a loading bar or dots */}
        <div className="flex gap-2 mt-4">
          <div className="w-3 h-3 bg-[#124A69] rounded-full animate-bounce"></div>
          <div
            className="w-3 h-3 bg-[#124A69] rounded-full animate-bounce"
            style={{ animationDelay: "150ms" }}
          ></div>
          <div
            className="w-3 h-3 bg-[#124A69] rounded-full animate-bounce"
            style={{ animationDelay: "300ms" }}
          ></div>
        </div>
      </div>
    </div>
  );
}
const TERMS = [
  "PRELIMS",
  "MIDTERM",
  "PRE-FINALS",
  "FINALS",
  "SUMMARY",
] as const;
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
}

interface Student {
  id: string;
  lastName: string;
  firstName: string;
  middleInitial: string | null;
}

interface ClassRecordTableProps {
  courseSlug: string;
  courseCode: string;
  courseSection: string;
}

const TERM_WEIGHTS = {
  PRELIMS: 0.2,
  MIDTERM: 0.2,
  "PRE-FINALS": 0.2,
  FINALS: 0.4,
} as const;

function percent(score: number | null, max: number | null): number | null {
  if (score == null || max == null || max <= 0) return null;
  return Math.max(0, Math.min(100, (score / max) * 100));
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
  if (score != null && score > 0 && (max == null || max <= 0)) {
    return "bg-red-500 text-white";
  }
  if (score != null && max != null && score > max) {
    return "bg-red-500 text-white";
  }
  if (score != null && max != null && max > 0) {
    const percentage = (score / max) * 100;
    return percentage < 75 ? "text-red-500" : "";
  }
  return "";
}

interface CriteriaOption {
  id: string;
  name: string;
  date?: string | null;
  maxScore?: number;
  type: "RECITATION" | "GROUP_REPORTING" | "INDIVIDUAL_REPORTING";
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  termConfigs: Record<string, TermConfig>;
  onSave: (configs: Record<string, TermConfig>) => void;
  availableCriteria: CriteriaOption[];
}

function SettingsModal({
  isOpen,
  onClose,
  termConfigs: initialConfigs,
  onSave,
  availableCriteria,
}: SettingsModalProps) {
  const [activeTerm, setActiveTerm] = useState<Term>("PRELIMS");
  const [termConfigs, setTermConfigs] = useState(initialConfigs);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setTermConfigs(initialConfigs);
      setValidationErrors([]);
    }
  }, [isOpen, initialConfigs]);

  const config = termConfigs[activeTerm];

  const clamp = (value: number, min: number, max: number) => {
    return Math.min(Math.max(value, min), max);
  };

  const updateConfig = (updates: Partial<TermConfig>) => {
    setTermConfigs((prev) => ({
      ...prev,
      [activeTerm]: { ...prev[activeTerm], ...updates },
    }));
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

    // Check maximum limit
    if (existing.length >= 6) {
      toast.error(
        `Maximum of 6 ${type === "PT" ? "PT/Lab" : "Quiz"} assessments allowed.`
      );
      return;
    }

    const count = existing.length + 1;
    const newAssessment: Assessment = {
      id: Math.random().toString(36).substr(2, 9),
      name: `${type}${count}`,
      type,
      maxScore: 0,
      date: null,
      enabled: true,
      order: existing.length,
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

  // Comprehensive validation function
  const validateConfigs = (): string[] => {
    const errors: string[] = [];

    Object.entries(termConfigs).forEach(([term, cfg]) => {
      // Validate weights
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

      // Validate PT assessments
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
      });

      // Validate Quiz assessments
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
      });

      // Validate Exam
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
      }

      // Check for duplicate names within same type
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
    });

    return errors;
  };

  const handleSave = () => {
    const errors = validateConfigs();

    if (errors.length > 0) {
      setValidationErrors(errors);
      toast.error(
        `Found ${errors.length} validation error${errors.length > 1 ? "s" : ""}`
      );
      return;
    }

    setValidationErrors([]);
    onSave(termConfigs);
    onClose();
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              Class Record Settings
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">
              Configure assessments and weights for each term
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Validation Errors Display */}
        {validationErrors.length > 0 && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-red-800 mb-2">
                  Please fix the following errors:
                </h4>
                <ul className="text-sm text-red-700 space-y-1">
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
        <div className="flex border-b">
          {(["PRELIMS", "MIDTERM", "PRE-FINALS", "FINALS"] as const).map(
            (term) => {
              // Show error indicator on tabs with issues
              const termErrors = validationErrors.filter((e) =>
                e.startsWith(term)
              );
              return (
                <button
                  key={term}
                  onClick={() => setActiveTerm(term)}
                  className={`relative px-6 py-3 text-sm font-medium ${
                    term === activeTerm
                      ? "text-[#124A69] border-b-2 border-[#124A69]"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {term}
                  {termErrors.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                  )}
                </button>
              );
            }
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Weight Configuration */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">
              Grade Weight Distribution
            </h3>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700 w-20">
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
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <span className="text-sm text-gray-600 font-medium">%</span>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700 w-20">
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
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  min="0"
                  max="100"
                />
                <span className="text-sm text-gray-600 font-medium">%</span>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700 w-20">
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
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  min="0"
                  max="100"
                />
                <span className="text-sm text-gray-600 font-medium">%</span>
              </div>
              <div className="ml-auto">
                <div
                  className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                    isValidWeight
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  Total: {totalWeight}%
                  {!isValidWeight && (
                    <AlertCircle className="inline w-4 h-4 ml-1" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* PT/Lab Section */}
          <div className="mb-6">
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
                    <input
                      type="checkbox"
                      checked={pt.enabled}
                      onChange={(e) =>
                        updateAssessment("PT", pt.id, {
                          enabled: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-[#124A69]"
                    />
                    <input
                      type="text"
                      value={pt.name}
                      onChange={(e) =>
                        updateAssessment("PT", pt.id, { name: e.target.value })
                      }
                      className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Name"
                    />
                    <div className="flex items-center gap-2">
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
                      <span className="text-xs text-gray-500">pts</span>
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
                  <div className="flex items-center gap-2 flex-1">
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

                      {/* Grouped based on type */}
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
          <div className="mb-6">
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
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <input
                    type="checkbox"
                    checked={quiz.enabled}
                    onChange={(e) =>
                      updateAssessment("QUIZ", quiz.id, {
                        enabled: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-[#124A69]"
                  />
                  <input
                    type="text"
                    value={quiz.name}
                    onChange={(e) =>
                      updateAssessment("QUIZ", quiz.id, {
                        name: e.target.value,
                      })
                    }
                    className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Name"
                  />
                  <div className="flex items-center gap-2">
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
                    <span className="text-xs text-gray-500">pts</span>
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
                          selected={quiz.date ? new Date(quiz.date) : undefined}
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
              ))}
            </div>
          </div>

          {/* Exam Section */}
          <div>
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
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={exam.enabled}
                  onChange={(e) =>
                    updateAssessment("EXAM", exam.id, {
                      enabled: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-[#124A69]"
                />
                <input
                  type="text"
                  value={exam.name}
                  onChange={(e) =>
                    updateAssessment("EXAM", exam.id, { name: e.target.value })
                  }
                  className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Name"
                />
                <div className="flex items-center gap-2">
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
                  <span className="text-xs text-gray-500">pts</span>
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
            )}
          </div>
        </div>
        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            <AlertCircle className="inline w-4 h-4 mr-1" />
            All enabled assessments must have valid names and max scores
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setValidationErrors([]);
                onClose();
              }}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#124A69] text-white hover:bg-[#0D3A54]"
            >
              <Save className="w-4 h-4" />
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export function ClassRecordTable({
  courseSlug,
  courseCode,
  courseSection,
}: ClassRecordTableProps) {
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [termConfigs, setTermConfigs] = useState<Record<string, TermConfig>>({
    PRELIMS: {
      id: "prelims",
      term: "PRELIMS",
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
          name: "Final Exam",
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
          name: "Q1",
          type: "QUIZ",
          maxScore: 20,
          date: null,
          enabled: true,
          order: 0,
        },
        {
          id: "exam2",
          name: "Final Exam",
          type: "EXAM",
          maxScore: 100,
          date: null,
          enabled: true,
          order: 0,
        },
      ],
    },
    "PRE-FINALS": {
      id: "prefinals",
      term: "PRE-FINALS",
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
          name: "Q1",
          type: "QUIZ",
          maxScore: 20,
          date: null,
          enabled: true,
          order: 0,
        },
        {
          id: "exam3",
          name: "Final Exam",
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
          name: "Q1",
          type: "QUIZ",
          maxScore: 20,
          date: null,
          enabled: true,
          order: 0,
        },
        {
          id: "exam4",
          name: "Final Exam",
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
  const [search, setSearch] = useState("");
  const [activeTerm, setActiveTerm] = useState<Term>("PRELIMS");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const useDebouncedCallback = (callback: Function, delay: number) => {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    return useCallback(
      (...args: any[]) => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          callback(...args);
        }, delay);
      },
      [callback, delay]
    );
  };

  const shownMessagesRef = useRef<Set<string>>(new Set());
  const notifyOnce = (message: string) => {
    if (shownMessagesRef.current.has(message)) return;
    shownMessagesRef.current.add(message);
    toast.error(message, { id: `toast:${message}` });
  };

  useEffect(() => {
    const load = async () => {
      if (!courseSlug) return;
      setLoading(true);

      try {
        const [studentsRes, configRes, scoresRes, criteriaLinksRes] =
          await Promise.all([
            axiosInstance.get(`/courses/${courseSlug}/students`),
            axiosInstance.get(`/courses/${courseSlug}/term-configs`),
            axiosInstance.get(`/courses/${courseSlug}/assessment-scores`),
            axiosInstance.get(`/courses/${courseSlug}/criteria/link`),
          ]);

        const studentList = studentsRes.data?.students || [];
        setStudents(studentList);

        if (configRes.data && Object.keys(configRes.data).length > 0) {
          setTermConfigs(configRes.data);
        }

        const {
          recitations = [],
          groupReportings = [],
          individualReportings = [],
        } = criteriaLinksRes.data || {};

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

        const scoresMap = new Map(
          Object.entries(scoresRes.data).map(([key, value]: any) => [
            key,
            value,
          ])
        );
        setScores(scoresMap);

        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (err) {
        console.error("Error loading data:", err);
        toast.error("Failed to load class records");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [courseSlug]);

  const saveScoreToAPI = useDebouncedCallback(
    async (studentId: string, assessmentId: string, score: number | null) => {
      try {
        toast.loading("Updating Student Grades...");
        await axiosInstance.put(`/courses/${courseSlug}/assessment-scores`, {
          studentId,
          assessmentId,
          score,
        });
        toast.dismiss();
        toast.success("Grades updated successfully");
      } catch (error) {
        toast.dismiss();
        toast.error("Failed to save grades");
        console.error(error);
      }
    },
    1000
  );

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
    return scores.get(`${studentId}:${assessmentId}`)?.score || null;
  };

  const getLinkedCriteriaScore = (
    studentId: string,
    criteriaId: string
  ): number | null => {
    const student = scores.get(`${studentId}:criteria:${criteriaId}`);
    return student?.score || null;
  };

  const getEffectiveScore = (
    studentId: string,
    assessment: Assessment
  ): number | null => {
    if (assessment.linkedCriteriaId) {
      const percentageScore = getLinkedCriteriaScore(
        studentId,
        assessment.linkedCriteriaId
      );
      if (percentageScore === null) return null;

      return (
        Math.round((percentageScore / 100) * assessment.maxScore * 100) / 100
      );
    }

    return getScore(studentId, assessment.id);
  };

  const setScore = (
    studentId: string,
    assessmentId: string,
    score: number | null
  ) => {
    const key = `${studentId}:${assessmentId}`;
    const updated = new Map(scores);

    if (score === null) {
      updated.delete(key);
    } else {
      updated.set(key, { studentId, assessmentId, score });
    }

    setScores(updated);

    saveScoreToAPI(studentId, assessmentId, score);
  };

  const handleNumericKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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

  const handleScoreChange =
    (studentId: string, assessmentId: string, max: number) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = sanitizeDigits(e.target.value);
      if (!digits) {
        setScore(studentId, assessmentId, null);
        return;
      }
      const num = Number(digits);
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

    let ptPercentages: number[] = [];
    ptAssessments.forEach((pt) => {
      const score = getEffectiveScore(studentId, pt);
      if (score !== null) {
        const pct = percent(score, pt.maxScore);
        if (pct !== null) ptPercentages.push(pct);
      }
    });
    let quizPercentages: number[] = [];
    quizAssessments.forEach((quiz) => {
      const score = getEffectiveScore(studentId, quiz);
      if (score !== null) {
        const pct = percent(score, quiz.maxScore);
        if (pct !== null) quizPercentages.push(pct);
      }
    });

    let examPercentage: number | null = null;
    if (examAssessment) {
      const examScore = getEffectiveScore(studentId, examAssessment);
      if (examScore !== null) {
        examPercentage = percent(examScore, examAssessment.maxScore);
      }
    }

    if (examPercentage === null) return null;

    const ptAvg =
      ptPercentages.length > 0
        ? ptPercentages.reduce((a, b) => a + b, 0) / ptAssessments.length
        : 0;
    const quizAvg =
      quizPercentages.length > 0
        ? quizPercentages.reduce((a, b) => a + b, 0) / quizAssessments.length
        : 0;

    const ptWeighted = (ptAvg / 100) * config.ptWeight;
    const quizWeighted = (quizAvg / 100) * config.quizWeight;
    const examWeighted = (examPercentage / 100) * config.examWeight;

    const totalPercent = ptWeighted + quizWeighted + examWeighted;

    return {
      totalPercent: totalPercent.toFixed(2),
      numericGrade: getNumericGrade(totalPercent),
      ptWeighted: ptWeighted.toFixed(2),
      quizWeighted: quizWeighted.toFixed(2),
      examWeighted: examWeighted.toFixed(2),
    };
  };

  const computeFinalGrade = (studentId: string) => {
    const prelimGrade = computeTermGrade(studentId, "PRELIMS");
    const midtermGrade = computeTermGrade(studentId, "MIDTERM");
    const preFinalsGrade = computeTermGrade(studentId, "PRE-FINALS");
    const finalsGrade = computeTermGrade(studentId, "FINALS");

    if (!prelimGrade || !midtermGrade || !preFinalsGrade || !finalsGrade) {
      return null;
    }

    const finalWeighted =
      parseFloat(prelimGrade.numericGrade) * TERM_WEIGHTS.PRELIMS +
      parseFloat(midtermGrade.numericGrade) * TERM_WEIGHTS.MIDTERM +
      parseFloat(preFinalsGrade.numericGrade) * TERM_WEIGHTS["PRE-FINALS"] +
      parseFloat(finalsGrade.numericGrade) * TERM_WEIGHTS.FINALS;

    return {
      grade: finalWeighted.toFixed(2),
      remarks: finalWeighted <= 3.0 ? "PASSED" : "FAILED",
    };
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      `${s.lastName} ${s.firstName}`.toLowerCase().includes(q)
    );
  }, [students, search]);

  const studentName = (s: Student) =>
    `${s.lastName}, ${s.firstName}${
      s.middleInitial ? ` ${s.middleInitial}.` : ""
    }`;

  const handleSaveSettings = async (configs: Record<string, TermConfig>) => {
    try {
      toast.loading("Saving term configurations...");
      await axiosInstance.post(`/courses/${courseSlug}/term-configs`, {
        termConfigs: configs,
      });
      toast.dismiss();
      setTermConfigs(configs);
      toast.success("Settings saved successfully!");
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to save settings");
      console.error(error);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (activeTerm === "SUMMARY") {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm min-h-[770px] max-h-[770px]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{courseCode}</h1>
            <p className="text-sm text-gray-600">{courseSection}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search a name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-[240px]"
              />
            </div>
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-[#124A69] text-white text-sm rounded-lg hover:bg-[#0D3A54]">
              <Download className="w-4 h-4" />
              Export to PDF
            </button>
          </div>
        </div>

        <div className="flex border-b border-gray-200 mb-6">
          {TERMS.map((term) => (
            <button
              key={term}
              onClick={() => setActiveTerm(term)}
              className={`px-6 py-3 text-sm font-medium ${
                term === activeTerm
                  ? "text-[#124A69] border-b-2 border-[#124A69]"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {term}
            </button>
          ))}
        </div>

        <div className="w-full overflow-x-auto">
          <table className="table-fixed w-full border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="w-[30%] border border-gray-300 px-4 py-2 text-left font-medium text-gray-700">
                  Students
                </th>
                {(["PRELIMS", "MIDTERM", "PRE-FINALS", "FINALS"] as const).map(
                  (term) => (
                    <th
                      key={term}
                      className="w-[14%] border border-gray-300 px-2 py-2 text-center font-medium text-gray-700"
                      colSpan={2}
                    >
                      {term}
                    </th>
                  )
                )}
                <th
                  className="w-[14%] border border-gray-300 px-2 py-2 text-center font-medium text-gray-700"
                  colSpan={2}
                >
                  FINAL GRADE
                </th>
              </tr>
              <tr className="bg-gray-50 text-xs">
                <th className="border border-gray-300"></th>
                {(["PRELIMS", "MIDTERM", "PRE-FINALS", "FINALS"] as const).map(
                  (term) => (
                    <>
                      <th
                        key={`${term}-pct`}
                        className="border border-gray-300 px-2 py-1"
                      >
                        {TERM_WEIGHTS[term] * 100}%
                      </th>
                      <th
                        key={`${term}-eqv`}
                        className="border border-gray-300 px-2 py-1"
                      >
                        EQV
                      </th>
                    </>
                  )
                )}
                <th className="border border-gray-300 px-2 py-1">GRADE</th>
                <th className="border border-gray-300 px-2 py-1">REMARKS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student) => {
                const finalGrade = computeFinalGrade(student.id);
                return (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-2 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-[10px]">👤</span>
                        </div>
                        <span className="text-sm text-gray-700 truncate">
                          {studentName(student)}
                        </span>
                      </div>
                    </td>
                    {(
                      ["PRELIMS", "MIDTERM", "PRE-FINALS", "FINALS"] as const
                    ).map((term) => {
                      const termGrade = computeTermGrade(student.id, term);
                      return (
                        <>
                          <td
                            key={`${term}-pct`}
                            className="border border-gray-300 py-3 text-center"
                          >
                            <input
                              type="text"
                              className="w-14 h-8 text-center border border-gray-200 rounded text-sm"
                              value={termGrade?.totalPercent || "-"}
                              readOnly
                            />
                          </td>
                          <td
                            key={`${term}-eqv`}
                            className="border border-gray-300 py-3 text-center"
                          >
                            <input
                              type="text"
                              className="w-14 h-8 text-center border border-gray-200 rounded text-sm"
                              value={termGrade?.numericGrade || "-"}
                              readOnly
                            />
                          </td>
                        </>
                      );
                    })}
                    <td className="border border-gray-300 py-3 text-center">
                      <input
                        type="text"
                        className={`w-14 h-8 text-center border border-gray-200 rounded text-sm font-medium ${
                          finalGrade && parseFloat(finalGrade.grade) > 3.0
                            ? "text-red-500"
                            : ""
                        }`}
                        value={finalGrade?.grade || "-"}
                        readOnly
                      />
                    </td>
                    <td className="border border-gray-300 py-3 text-center">
                      <span
                        className={`text-sm font-medium ${
                          finalGrade?.remarks === "PASSED"
                            ? "text-green-600"
                            : "text-red-500"
                        }`}
                      >
                        {finalGrade?.remarks || "-"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <SettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          termConfigs={termConfigs}
          onSave={handleSaveSettings}
          availableCriteria={availableCriteria}
        />
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm min-h-[770px] max-h-[770px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{courseCode}</h1>
          <p className="text-sm text-gray-600">{courseSection}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search a name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-[240px]"
            />
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#124A69] text-white text-sm rounded-lg hover:bg-[#0D3A54]">
            <Download className="w-4 h-4" />
            Export to PDF
          </button>
          {loading && (
            <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
          )}
        </div>
      </div>

      <div className="flex border-b border-gray-200 mb-6">
        {TERMS.map((term) => (
          <button
            key={term}
            onClick={() => setActiveTerm(term)}
            className={`px-6 py-3 text-sm font-medium ${
              term === activeTerm
                ? "text-[#124A69] border-b-2 border-[#124A69]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {term}
          </button>
        ))}
      </div>

      {!currentConfig ? (
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
        <div className="w-full overflow-x-auto">
          <table className="table-fixed w-full border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th
                  className="w-[30%] border border-gray-300 px-2 py-2 text-left font-medium text-gray-700"
                  rowSpan={2}
                >
                  Students
                </th>
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
                      0
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
              {filtered.map((student) => {
                const termGrade = computeTermGrade(student.id, activeTerm);
                return (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-2 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-[10px]">👤</span>
                        </div>
                        <span className="text-sm text-gray-700 truncate">
                          {studentName(student)}
                        </span>
                      </div>
                    </td>
                    {pts.map((pt) => (
                      <td
                        key={pt.id}
                        className="border border-gray-300 py-3 text-center text-sm w-14 "
                      >
                        <input
                          type="text"
                          inputMode="numeric"
                          className={`w-[90%] h-8 text-center border border-gray-200 rounded ${
                            pt.linkedCriteriaId
                              ? "bg-blue-50 cursor-not-allowed"
                              : ""
                          } ${getScoreStyle(
                            getEffectiveScore(student.id, pt),
                            pt.maxScore
                          )}`}
                          value={getEffectiveScore(student.id, pt) ?? ""}
                          onChange={handleScoreChange(
                            student.id,
                            pt.id,
                            pt.maxScore
                          )}
                          onKeyDown={handleNumericKeyDown}
                          disabled={!!pt.linkedCriteriaId}
                          title={
                            pt.linkedCriteriaId
                              ? "This score is linked from existing grades"
                              : ""
                          }
                        />
                      </td>
                    ))}
                    {pts.length > 0 && (
                      <td className="border border-gray-300 py-3 text-center text-sm">
                        <input
                          type="text"
                          className="w-[90%] h-8 text-center border border-gray-200 rounded"
                          value={termGrade?.ptWeighted || ""}
                          readOnly
                        />
                      </td>
                    )}
                    {quizzes.map((quiz) => (
                      <td
                        key={quiz.id}
                        className="border border-gray-300 py-3 text-center text-sm"
                      >
                        <input
                          type="text"
                          inputMode="numeric"
                          className={`w-[90%] h-8 text-center border border-gray-200 rounded ${
                            quiz.linkedCriteriaId
                              ? "bg-blue-50 cursor-not-allowed"
                              : ""
                          } ${getScoreStyle(
                            getEffectiveScore(student.id, quiz),
                            quiz.maxScore
                          )}`}
                          value={getEffectiveScore(student.id, quiz) ?? ""}
                          onChange={handleScoreChange(
                            student.id,
                            quiz.id,
                            quiz.maxScore
                          )}
                          onKeyDown={handleNumericKeyDown}
                          disabled={!!quiz.linkedCriteriaId}
                          title={
                            quiz.linkedCriteriaId
                              ? "This score is linked from existing grades"
                              : ""
                          }
                        />
                      </td>
                    ))}
                    {quizzes.length > 0 && (
                      <td className="border border-gray-300 py-3 text-center text-sm">
                        <input
                          type="text"
                          className="w-[90%] h-8 text-center border border-gray-200 rounded"
                          value={termGrade?.quizWeighted || ""}
                          readOnly
                        />
                      </td>
                    )}
                    {exam && (
                      <>
                        <td className="border border-gray-300 py-3 text-center text-sm">
                          <input
                            type="text"
                            inputMode="numeric"
                            className={`w-[90%] h-8 text-center border border-gray-200 rounded ${
                              exam.linkedCriteriaId
                                ? "bg-blue-50 cursor-not-allowed"
                                : ""
                            } ${getScoreStyle(
                              getEffectiveScore(student.id, exam),
                              exam.maxScore
                            )}`}
                            value={getEffectiveScore(student.id, exam) ?? ""}
                            onChange={handleScoreChange(
                              student.id,
                              exam.id,
                              exam.maxScore
                            )}
                            onKeyDown={handleNumericKeyDown}
                            disabled={!!exam.linkedCriteriaId}
                            title={
                              exam.linkedCriteriaId
                                ? "This score is linked from existing grades"
                                : ""
                            }
                          />
                        </td>
                        <td className="border border-gray-300 py-3 text-center text-sm">
                          <input
                            type="text"
                            className="w-[90%] h-8 text-center border border-gray-200 rounded"
                            value={termGrade?.examWeighted || ""}
                            readOnly
                          />
                        </td>
                      </>
                    )}
                    <td className="border border-gray-300 py-3 text-center text-sm">
                      <input
                        type="text"
                        className={`w-[90%] h-8 text-center border border-gray-200 rounded font-medium ${
                          termGrade && parseFloat(termGrade.numericGrade) > 3.0
                            ? "text-red-500"
                            : ""
                        }`}
                        value={termGrade?.totalPercent || ""}
                        readOnly
                      />
                    </td>
                    <td className="border border-gray-300 py-3 text-center text-sm">
                      <input
                        type="text"
                        className={`w-[90%] h-8 text-center border border-gray-200 rounded font-medium ${
                          termGrade && parseFloat(termGrade.numericGrade) > 3.0
                            ? "text-red-500"
                            : ""
                        }`}
                        value={termGrade?.numericGrade || ""}
                        readOnly
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        termConfigs={termConfigs}
        onSave={handleSaveSettings}
        availableCriteria={availableCriteria}
      />
    </div>
  );
}
