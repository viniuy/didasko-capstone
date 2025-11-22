import { useState, useEffect } from "react";
import {
  X,
  ClipboardPaste,
  AlertCircle,
  CheckCircle,
  Info,
  ArrowRight,
  Lightbulb,
} from "lucide-react";

interface PasteGradesModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableColumns: Array<{
    id: string;
    name: string;
    type: "PT" | "QUIZ" | "EXAM" | "RECITATION" | "ATTENDANCE";
    maxScore?: number;
    term?: string;
  }>;
  students: Array<{
    id: string;
    name: string;
    studentNumber: string;
  }>;
  onPasteGrades: (
    columnId: string,
    grades: Array<{ studentId: string; score: number | null }>
  ) => void;
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
    target: "[data-tutorial='column-select']",
    title: "Step 1: Select a Column",
    content:
      "First, choose which column you want to paste grades into. This could be a PT, Quiz, or Exam.",
    position: "bottom",
    highlightPadding: 8,
  },
  {
    target: "[data-tutorial='paste-area']",
    title: "Step 2: Paste Your Grades",
    content:
      "Copy grades from Excel (one per line) and paste them here. Make sure they're in the same order as your students!",
    position: "top",
    highlightPadding: 8,
  },
  {
    target: "[data-tutorial='parse-button']",
    title: "Step 3: Validate Grades",
    content:
      "Click this button to check if your grades are valid. It will show you any errors before pasting.",
    position: "top",
    highlightPadding: 8,
  },
  {
    target: "[data-tutorial='instructions']",
    title: "Pro Tips!",
    content:
      "You can use 'absent', 'abs', or '-' for students who were absent. The system will handle it automatically!",
    position: "bottom",
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
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updatePosition);
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
            <mask id="tutorial-mask">
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
            mask="url(#tutorial-mask)"
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
                {currentStep === totalSteps - 1 ? "Got it!" : "Next"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function PasteGradesModal({
  isOpen,
  onClose,
  availableColumns,
  students,
  onPasteGrades,
}: PasteGradesModalProps) {
  const [selectedColumn, setSelectedColumn] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [parsedGrades, setParsedGrades] = useState<
    Array<{ studentId: string; studentName: string; score: number | null }>
  >([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Tutorial state
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setSelectedColumn("");
      setPastedText("");
      setParsedGrades([]);
      setValidationErrors([]);
      setShowPreview(false);
      setNotification(null);

      // Check if user has seen tutorial (stored in localStorage)
      const hasSeenTutorial = localStorage.getItem(
        "didasko-paste-grades-tutorial"
      );
      if (!hasSeenTutorial) {
        setTimeout(() => setShowTutorial(true), 500);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
  };

  const selectedColumnData = availableColumns.find(
    (col) => col.id === selectedColumn
  );

  const parseGrades = () => {
    if (!selectedColumn) {
      showNotification("error", "Please select a column first");
      return;
    }

    if (!pastedText.trim()) {
      showNotification("error", "Please paste some grades");
      return;
    }

    const errors: string[] = [];
    const grades: Array<{
      studentId: string;
      studentName: string;
      score: number | null;
    }> = [];

    const lines = pastedText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length !== students.length) {
      errors.push(
        `Expected ${students.length} grades but found ${lines.length} lines`
      );
    }

    const maxScore = selectedColumnData?.maxScore || 100;

    lines.forEach((line, index) => {
      const student = students[index];
      if (!student) {
        errors.push(`Line ${index + 1}: No matching student`);
        return;
      }

      if (
        line.toLowerCase() === "absent" ||
        line.toLowerCase() === "abs" ||
        line === "-" ||
        line === ""
      ) {
        grades.push({
          studentId: student.id,
          studentName: student.name,
          score: null,
        });
        return;
      }

      // Check if the line contains a decimal point
      if (line.includes(".") || line.includes(",")) {
        errors.push(
          `Line ${index + 1} (${
            student.name
          }): "${line}" contains decimals. Only whole numbers are allowed.`
        );
        grades.push({
          studentId: student.id,
          studentName: student.name,
          score: null,
        });
        return;
      }

      // Use parseInt to ensure we only accept whole numbers
      const score = parseInt(line, 10);

      if (isNaN(score)) {
        errors.push(
          `Line ${index + 1} (${student.name}): "${line}" is not a valid number`
        );
        grades.push({
          studentId: student.id,
          studentName: student.name,
          score: null,
        });
        return;
      }

      if (score < 0) {
        errors.push(
          `Line ${index + 1} (${student.name}): Score cannot be negative`
        );
      }

      if (score > maxScore) {
        errors.push(
          `Line ${index + 1} (${
            student.name
          }): Score ${score} exceeds maximum ${maxScore}`
        );
      }

      grades.push({
        studentId: student.id,
        studentName: student.name,
        score: score,
      });
    });

    setParsedGrades(grades);
    setValidationErrors(errors);
    setShowPreview(true);

    if (errors.length === 0) {
      showNotification(
        "success",
        `Successfully parsed ${grades.length} grades`
      );
    } else {
      showNotification("error", `Found ${errors.length} validation error(s)`);
    }
  };

  const handlePaste = () => {
    if (validationErrors.length > 0) {
      showNotification("error", "Please fix validation errors before pasting");
      return;
    }

    if (parsedGrades.length === 0) {
      showNotification("error", "No grades to paste");
      return;
    }

    const gradesToPaste = parsedGrades.map((g) => ({
      studentId: g.studentId,
      score: g.score,
    }));

    onPasteGrades(selectedColumn, gradesToPaste);
    showNotification(
      "success",
      `Successfully pasted grades to ${selectedColumnData?.name || "column"}`
    );
    setTimeout(() => onClose(), 500);
  };

  const handleNextTutorialStep = () => {
    if (tutorialStep === tutorialSteps.length - 1) {
      setShowTutorial(false);
      setTutorialStep(0);
      localStorage.setItem("didasko-paste-grades-tutorial", "completed");
    } else {
      setTutorialStep(tutorialStep + 1);
    }
  };

  const handleSkipTutorial = () => {
    setShowTutorial(false);
    setTutorialStep(0);
    localStorage.setItem("didasko-paste-grades-tutorial", "completed");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[95vw] sm:max-w-3xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col relative">
        {/* Tutorial Overlay */}
        <Tutorial
          isActive={showTutorial}
          currentStep={tutorialStep}
          onNext={handleNextTutorialStep}
          onSkip={handleSkipTutorial}
          totalSteps={tutorialSteps.length}
        />

        {/* Notification */}
        {notification && (
          <div
            className={`absolute top-3 sm:top-4 right-3 sm:right-4 px-3 sm:px-4 py-2 sm:py-3 rounded-lg shadow-lg flex items-center gap-2 z-10 ${
              notification.type === "success"
                ? "bg-green-100 text-green-800 border border-green-200"
                : "bg-red-100 text-red-800 border border-red-200"
            }`}
          >
            {notification.type === "success" ? (
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
            <span className="text-xs sm:text-sm font-medium">
              {notification.message}
            </span>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 px-4 sm:px-6 py-3 sm:py-4 border-b">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-[#124A69]/10 rounded-lg">
              <ClipboardPaste className="w-4 h-4 sm:w-5 sm:h-5 text-[#124A69]" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[#124A69]">
                Paste Grades
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                Quickly paste grades from Excel or spreadsheet
              </p>
            </div>
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
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          {/* Instructions */}
          <div
            data-tutorial="instructions"
            className="mb-4 sm:mb-6 p-3 sm:p-4 bg-[#124A69]/5 border border-[#124A69]/20 rounded-lg"
          >
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 sm:w-5 sm:h-5 text-[#124A69] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-xs sm:text-sm font-semibold text-[#124A69] mb-2">
                  How to use:
                </h4>
                <ol className="text-xs sm:text-sm text-gray-700 space-y-1 list-decimal list-inside">
                  <li>Select the column where you want to paste grades</li>
                  <li>
                    Copy grades from Excel (one grade per line, in student
                    order)
                  </li>
                  <li>Paste in the text area below</li>
                  <li>Use "absent", "abs", or "-" for absent students</li>
                  <li>Click "Parse Grades" to validate</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Column Selection */}
          <div className="mb-4 sm:mb-6" data-tutorial="column-select">
            <label className="block text-xs sm:text-sm font-semibold text-[#124A69] mb-2">
              Select Target Column
            </label>
            <select
              value={selectedColumn}
              onChange={(e) => {
                setSelectedColumn(e.target.value);
                setShowPreview(false);
                setParsedGrades([]);
                setValidationErrors([]);
              }}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-[#124A69]/30 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-[#124A69] focus:border-[#124A69]"
            >
              <option value="">-- Choose a column --</option>
              {availableColumns.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.term ? `${col.term} - ` : ""}
                  {col.name}
                  {col.maxScore ? ` (${col.maxScore} pts)` : ""}
                </option>
              ))}
            </select>
            {selectedColumnData && (
              <p className="mt-2 text-xs text-gray-600">
                Max Score: {selectedColumnData.maxScore || "Not set"} points •
                Expected {students.length} grades
              </p>
            )}
          </div>

          {/* Paste Area */}
          <div className="mb-4" data-tutorial="paste-area">
            <label className="block text-xs sm:text-sm font-semibold text-[#124A69] mb-2">
              Paste Grades Here
            </label>
            <textarea
              value={pastedText}
              onChange={(e) => {
                setPastedText(e.target.value);
                setShowPreview(false);
                setParsedGrades([]);
                setValidationErrors([]);
              }}
              placeholder={`Paste grades here (one per line)...\n\nExample:\n95\n88\nabsent\n92\n85`}
              className="w-full h-32 sm:h-40 px-3 sm:px-4 py-2 sm:py-3 border border-[#124A69]/30 rounded-lg text-xs sm:text-sm font-mono focus:ring-2 focus:ring-[#124A69] focus:border-[#124A69] resize-none"
            />
            <p className="mt-2 text-xs text-gray-600">
              Lines pasted:{" "}
              {pastedText.split("\n").filter((l) => l.trim()).length} /{" "}
              {students.length} students
            </p>
          </div>

          {/* Parse Button */}
          <div data-tutorial="parse-button">
            <button
              onClick={parseGrades}
              disabled={!selectedColumn || !pastedText.trim()}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-[#124A69] text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-[#0D3A54] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors mb-4 sm:mb-6"
            >
              Parse Grades
            </button>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-xs sm:text-sm font-semibold text-red-800 mb-2">
                    Validation Errors:
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

          {/* Preview */}
          {showPreview && parsedGrades.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-700">
                  Preview ({parsedGrades.length} grades)
                </h4>
                {validationErrors.length === 0 && (
                  <div className="flex items-center gap-2 text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    <span>Ready to paste</span>
                  </div>
                )}
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700">
                          Student
                        </th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-700">
                          Score
                        </th>
                        <th className="px-4 py-2 text-center font-semibold text-gray-700">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {parsedGrades.map((grade, index) => {
                        const hasError = validationErrors.some((e) =>
                          e.includes(`Line ${index + 1}`)
                        );
                        return (
                          <tr
                            key={grade.studentId}
                            className={hasError ? "bg-red-50" : ""}
                          >
                            <td className="px-4 py-2 text-gray-800">
                              {grade.studentName}
                            </td>
                            <td className="px-4 py-2 text-right font-mono">
                              {grade.score !== null ? (
                                <span className="text-gray-900">
                                  {grade.score}
                                </span>
                              ) : (
                                <span className="text-gray-400 italic">
                                  Absent
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-center">
                              {hasError ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                                  <AlertCircle className="w-3 h-3" />
                                  Error
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                                  <CheckCircle className="w-3 h-3" />
                                  Valid
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 px-4 sm:px-6 py-3 sm:py-4 border-t bg-gray-50">
          <div className="text-xs sm:text-sm text-gray-600">
            {showPreview && parsedGrades.length > 0 && (
              <>
                {validationErrors.length === 0 ? (
                  <span className="text-green-600 font-medium">
                    ✓ All grades validated successfully
                  </span>
                ) : (
                  <span className="text-red-600 font-medium">
                    ⚠ Fix errors before pasting
                  </span>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onClose}
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePaste}
              disabled={
                !showPreview ||
                parsedGrades.length === 0 ||
                validationErrors.length > 0
              }
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-[#124A69] text-white hover:bg-[#0D3A54] disabled:bg-gray-300 disabled:cursor-not-allowed text-xs sm:text-sm transition-colors"
            >
              <ClipboardPaste className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Paste Grades</span>
              <span className="sm:hidden">Paste</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PasteGradesModal;
