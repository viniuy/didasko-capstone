import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  X,
  Calendar,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  CalendarIcon,
} from "lucide-react";
import type { Term, Assessment, TermConfig } from "../types/ClassRecordTable";
import type { CriteriaOption } from "../types/ClassRecordTable";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  termConfigs: Record<string, TermConfig>;
  onSave: (configs: Record<string, TermConfig>) => void;
  availableCriteria: CriteriaOption[];
}

export function SettingsModal({
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

  const validateConfigs = (): string[] => {
    const errors: string[] = [];

    Object.entries(termConfigs).forEach(([term, cfg]) => {
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
                      maxLength={5}
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
                    maxLength={5}
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
                  maxLength={5}
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
