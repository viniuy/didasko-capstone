import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import axiosInstance from "@/lib/axios";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PasteGradesDialog } from "./paste-grades-dialog";

const TERMS = [
  "PRELIMS",
  "MIDTERM",
  "PRE-FINALS",
  "FINALS",
  "SUMMARY",
] as const;
type Term = (typeof TERMS)[number];

interface TermData {
  maxValues: {
    pt1: string;
    pt2: string;
    pt3: string;
    pt4: string;
    q1: string;
    q2: string;
    q3: string;
    q4: string;
    examMax: string;
  };
  cellValues: Record<string, string>;
}

// Summary card removed
interface ClassRecordTableProps {
  courseSlug: string;
  courseCode: string;
  courseSection: string;
}

interface StudentRow {
  id: string;
  name: string;
  pt: Array<{ score: number | null; max: number | null }>;
  quiz: Array<{ score: number | null; max: number | null }>;
  exam: { score: number | null; max: number | null };
  total?: number | null;
  rank?: number | null;
}

function percent(
  score: number | null | undefined,
  max: number | null | undefined
): number | null {
  if (score == null || max == null || max <= 0) return null;
  return Math.max(0, Math.min(100, (score / max) * 100));
}

function average(numbers: Array<number | null>): number | null {
  const vals = numbers.filter((n): n is number => typeof n === "number");
  if (vals.length === 0) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Number(avg.toFixed(2));
}

function getScoreStyle(
  score: number | null | undefined,
  max: number | null | undefined
): string {
  // Case 1: Has score but no max
  if (score != null && score > 0 && (max == null || max <= 0)) {
    return "bg-red-500 text-white";
  }
  // Case 2: Score exceeds max
  if (score != null && max != null && score > max) {
    return "bg-red-500 text-white";
  }
  // Case 3: Below 75%
  if (score != null && max != null && max > 0) {
    const percentage = (score / max) * 100;
    return percentage < 75 ? "text-red-500" : "";
  }
  return "";
}

const TERM_WEIGHTS = {
  PRELIMS: 0.2, // 20%
  MIDTERM: 0.2, // 20%
  "PRE-FINALS": 0.2, // 20%
  FINALS: 0.4, // 40%
} as const;

export function ClassRecordTable({
  courseSlug,
  courseCode,
  courseSection,
}: ClassRecordTableProps) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState("");
  const [activeTerm, setActiveTerm] = useState<Term>("PRELIMS");

  // Term-specific data
  const [termData, setTermData] = useState<Record<Term, TermData>>({
    PRELIMS: { maxValues: defaultMaxValues(), cellValues: {} },
    MIDTERM: { maxValues: defaultMaxValues(), cellValues: {} },
    "PRE-FINALS": { maxValues: defaultMaxValues(), cellValues: {} },
    FINALS: { maxValues: defaultMaxValues(), cellValues: {} },
    SUMMARY: { maxValues: defaultMaxValues(), cellValues: {} },
  });

  // Helper to create default max values
  function defaultMaxValues() {
    return {
      pt1: "",
      pt2: "",
      pt3: "",
      pt4: "",
      q1: "",
      q2: "",
      q3: "",
      q4: "",
      examMax: "",
    };
  }

  // Update getCell and setCell to use term-specific data
  const getCell = (id: string, key: string): string => {
    const value = termData[activeTerm].cellValues[`${id}:${key}`];
    return value === undefined ? "" : value;
  };

  const setCell = (id: string, key: string, value: string) => {
    setTermData((prev) => ({
      ...prev,
      [activeTerm]: {
        ...prev[activeTerm],
        cellValues: {
          ...prev[activeTerm].cellValues,
          [`${id}:${key}`]: value,
        },
      },
    }));
  };

  // Current term's max values
  const maxValues = termData[activeTerm].maxValues;

  // Update max values setter
  const setMaxValues = (
    updater: (prev: TermData["maxValues"]) => TermData["maxValues"]
  ) => {
    setTermData((prev) => ({
      ...prev,
      [activeTerm]: {
        ...prev[activeTerm],
        maxValues: updater(prev[activeTerm].maxValues),
      },
    }));
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

  const handleNumericChange =
    (setter: (next: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(sanitizeDigits(e.target.value));
    };

  const handleNumericPaste =
    (setter: (next: string) => void) =>
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text");
      setter(sanitizeDigits(pasted));
    };

  // Deduplicate identical toast messages per mount
  const shownMessagesRef = useRef<Set<string>>(new Set());
  const notifyOnce = (message: string) => {
    if (shownMessagesRef.current.has(message)) return;
    shownMessagesRef.current.add(message);
    toast.error(message, { id: `toast:${message}` });
  };

  const ABSOLUTE_MAX = 200;
  const handleAbsoluteMaxChange =
    (setter: (next: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const digits = sanitizeDigits(raw);
      if (!digits) {
        setter("");
        return;
      }
      const num = Number(digits);
      if (isNaN(num)) {
        setter("");
        return;
      }
      if (num === 0) {
        notifyOnce("Max score cannot be 0.");
        setter("");
        return;
      }
      if (num > ABSOLUTE_MAX) {
        notifyOnce(`Max score cannot exceed ${ABSOLUTE_MAX}.`);
        setter(String(ABSOLUTE_MAX));
      } else {
        setter(String(num));
      }
    };

  const handleAbsoluteMaxPaste =
    (setter: (next: string) => void) =>
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text");
      const digits = sanitizeDigits(pasted);
      if (!digits) {
        setter("");
        return;
      }
      const num = Number(digits);
      if (isNaN(num)) {
        setter("");
        return;
      }
      if (num === 0) {
        notifyOnce("Max score cannot be 0.");
        setter("");
        return;
      }
      if (num > ABSOLUTE_MAX) {
        notifyOnce(`Max score cannot exceed ${ABSOLUTE_MAX}.`);
        setter(String(ABSOLUTE_MAX));
      } else {
        setter(String(num));
      }
    };

  const clampToMax = (raw: string, max?: number | null) => {
    const digits = sanitizeDigits(raw);
    if (!digits) return "";
    if (max == null || isNaN(max)) return digits;
    const num = Number(digits);
    if (isNaN(num)) return "";
    return String(Math.min(num, max));
  };

  const handleBoundedNumericChange =
    (setter: (next: string) => void, getMax: () => number | null | undefined) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const max = getMax();
      const raw = e.target.value;
      const digits = sanitizeDigits(raw);
      if (!digits) {
        setter("");
        return;
      }
      if (max == null || isNaN(max)) {
        setter(digits);
        return;
      }
      const num = Number(digits);
      if (isNaN(num)) {
        setter("");
        return;
      }
      if (num > max) {
        notifyOnce(`Score cannot exceed max (${max}).`);
        setter(String(max));
      } else {
        setter(String(num));
      }
    };

  const handleBoundedNumericPaste =
    (setter: (next: string) => void, getMax: () => number | null | undefined) =>
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const max = getMax();
      const pasted = e.clipboardData.getData("text");
      const digits = sanitizeDigits(pasted);
      if (!digits) {
        setter("");
        return;
      }
      if (max == null || isNaN(max)) {
        setter(digits);
        return;
      }
      const num = Number(digits);
      if (isNaN(num)) {
        setter("");
        return;
      }
      if (num > max) {
        notifyOnce(`Score cannot exceed max (${max}).`);
        setter(String(max));
      } else {
        setter(String(num));
      }
    };

  // Editing guards driven by header max values
  const canEditPt1 = !!maxValues.pt1;
  const canEditPt2 = !!maxValues.pt2;
  const canEditPt3 = !!maxValues.pt3;
  const canEditPt4 = !!maxValues.pt4;
  const canEditQ1 = !!maxValues.q1;
  const canEditQ2 = !!maxValues.q2;
  const canEditQ3 = !!maxValues.q3;
  const canEditQ4 = !!maxValues.q4;
  const canEditExam = !!maxValues.examMax;
  const ptTotalMax = ["pt1", "pt2", "pt3", "pt4"]
    .map((k) => Number((maxValues as any)[k] || 0))
    .reduce((a, b) => a + (isNaN(b) ? 0 : b), 0);
  const qTotalMax = ["q1", "q2", "q3", "q4"]
    .map((k) => Number((maxValues as any)[k] || 0))
    .reduce((a, b) => a + (isNaN(b) ? 0 : b), 0);

  useEffect(() => {
    const load = async () => {
      if (!courseSlug) return;
      setLoading(true);
      try {
        const res = await axiosInstance.get(`/courses/${courseSlug}/students`);
        const list = (res.data?.students || []) as Array<any>;
        const next: StudentRow[] = list.map((s: any) => ({
          id: s.id,
          name: `${s.lastName}, ${s.firstName}${
            s.middleInitial ? ` ${s.middleInitial}.` : ""
          }`,
          pt: [0, 1, 2, 3].map(() => ({ score: null, max: null })),
          quiz: [0, 1, 2, 3].map(() => ({ score: null, max: null })),
          exam: { score: null, max: null },
          total: null,
          rank: null,
        }));
        setRows(next);

        // Initialize empty values for all possible score fields
        const initialCells: Record<string, string> = {};
        list.forEach((s: any) => {
          [
            "pt1",
            "pt2",
            "pt3",
            "pt4",
            "q1",
            "q2",
            "q3",
            "q4",
            "examScore",
          ].forEach((key) => {
            initialCells[`${s.id}:${key}`] = "";
          });
        });
        setTermData((prev) => ({
          ...prev,
          PRELIMS: { ...prev.PRELIMS, cellValues: initialCells },
          MIDTERM: { ...prev.MIDTERM, cellValues: initialCells },
          "PRE-FINALS": { ...prev["PRE-FINALS"], cellValues: initialCells },
          FINALS: { ...prev.FINALS, cellValues: initialCells },
          SUMMARY: { ...prev.SUMMARY, cellValues: initialCells },
        }));
      } catch (_err) {
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [courseSlug]);

  const computedRows = useMemo(() => {
    const withTotals = rows.map((r) => {
      const ptAvg = average(r.pt.map((p) => percent(p.score, p.max)));
      const quizAvg = average(r.quiz.map((q) => percent(q.score, q.max)));
      const examPct = percent(r.exam.score, r.exam.max);
      const total = average([ptAvg, quizAvg, examPct]);
      return { ...r, total } as StudentRow;
    });

    const ranked = [...withTotals]
      .filter((r) => typeof r.total === "number")
      .sort((a, b) => b.total! - a.total!);
    const idToRank = new Map<string, number>();
    let last: number | null = null;
    let curRank = 0;
    ranked.forEach((r, i) => {
      if (last == null || r.total! < last) {
        curRank = i + 1;
        last = r.total!;
      }
      idToRank.set(r.id, curRank);
    });

    return withTotals.map((r) => ({ ...r, rank: idToRank.get(r.id) ?? null }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return computedRows;
    return computedRows.filter((r) => r.name.toLowerCase().includes(q));
  }, [computedRows, search]);

  // No right-side summary for this layout

  const updateCell = (id: string, updater: (r: StudentRow) => StudentRow) => {
    setRows((prev) => prev.map((r) => (r.id === id ? updater(r) : r)));
  };

  const computeQuizWeight = (studentId: string): string => {
    const qScores = ["q1", "q2", "q3", "q4"] as const;

    // Check for invalid scenarios
    let hasInvalidScore = false;
    let validMaxCount = 0;
    qScores.forEach((k) => {
      const maxValue = Number((maxValues as any)[k] || "");
      const rawScore = getCell(studentId, k);
      const score = Number(rawScore || "");

      // Case 1: Score exceeds max
      if (
        !isNaN(maxValue) &&
        maxValue > 0 &&
        !isNaN(score) &&
        score > maxValue
      ) {
        hasInvalidScore = true;
      }
      // Case 2: Has score but no max
      if ((!maxValue || isNaN(maxValue)) && rawScore !== "" && !isNaN(score)) {
        hasInvalidScore = true;
      }

      if (!isNaN(maxValue) && maxValue > 0) {
        validMaxCount++;
      }
    });

    if (hasInvalidScore) return "error";
    if (validMaxCount === 0) return "";

    // Get valid scores and their corresponding max values
    const validScores: number[] = [];

    qScores.forEach((k) => {
      const maxValue = Number((maxValues as any)[k] || "");
      const rawScore = getCell(studentId, k);
      const score = Number(rawScore || "");

      // Include if there's a valid max and score
      if (
        !isNaN(maxValue) &&
        maxValue > 0 &&
        !isNaN(score) &&
        rawScore !== ""
      ) {
        const percentage = percent(score, maxValue);
        validScores.push(percentage!);
      }
    });

    // Return empty if no valid scores
    if (validScores.length === 0) return "";

    // Calculate average considering the number of max scores, not just valid scores
    const avg =
      validScores.reduce((sum, score) => sum + score, 0) / validMaxCount;
    const weighted = (avg / 100) * 20; // 20% weight
    return weighted.toFixed(2);
  };

  // Compute PT/Lab Weighted Score (30% of the average PT percentage)
  const computePtWeight = (studentId: string): string => {
    const ptScores = ["pt1", "pt2", "pt3", "pt4"] as const;

    // Check for invalid scenarios
    let hasInvalidScore = false;
    let validMaxCount = 0;
    ptScores.forEach((k) => {
      const maxValue = Number((maxValues as any)[k] || "");
      const rawScore = getCell(studentId, k);
      const score = Number(rawScore || "");

      // Case 1: Score exceeds max
      if (
        !isNaN(maxValue) &&
        maxValue > 0 &&
        !isNaN(score) &&
        score > maxValue
      ) {
        hasInvalidScore = true;
      }
      // Case 2: Has score but no max
      if ((!maxValue || isNaN(maxValue)) && rawScore !== "" && !isNaN(score)) {
        hasInvalidScore = true;
      }

      if (!isNaN(maxValue) && maxValue > 0) {
        validMaxCount++;
      }
    });

    if (hasInvalidScore) return "error";
    if (validMaxCount === 0) return "";

    // Get valid scores and their corresponding max values
    const validScores: number[] = [];

    ptScores.forEach((k) => {
      const maxValue = Number((maxValues as any)[k] || "");
      const rawScore = getCell(studentId, k);
      const score = Number(rawScore || "");

      // Include if there's a valid max and score
      if (
        !isNaN(maxValue) &&
        maxValue > 0 &&
        !isNaN(score) &&
        rawScore !== ""
      ) {
        const percentage = percent(score, maxValue);
        validScores.push(percentage!);
      }
    });

    // Return empty if no valid scores
    if (validScores.length === 0) return "";

    // Calculate average considering the number of max scores, not just valid scores
    const avg =
      validScores.reduce((sum, score) => sum + score, 0) / validMaxCount;
    const weighted = (avg / 100) * 30; // 30% weight
    return weighted.toFixed(2);
  };

  const computeExamWeight = (studentId: string): string => {
    const maxValue = Number(maxValues.examMax || "");
    const rawScore = getCell(studentId, "examScore");
    const score = Number(rawScore || "");

    // Check for invalid scenarios
    // Case 1: Score exceeds max
    if (!isNaN(maxValue) && maxValue > 0 && !isNaN(score) && score > maxValue) {
      return "error";
    }
    // Case 2: Has score but no max
    if ((!maxValue || isNaN(maxValue)) && rawScore !== "" && !isNaN(score)) {
      return "error";
    }

    if (!maxValue || isNaN(maxValue)) return "";
    if (!score || isNaN(score)) return "";

    const percentage = percent(score, maxValue);
    if (percentage === null) return "";

    const weighted = (percentage / 100) * 50; // 50% weight
    return weighted.toFixed(2);
  };

  const computeFinalGrade = (studentId: string): string => {
    const examScore = getCell(studentId, "examScore");
    // Return empty if no exam score
    if (!examScore) return "";

    const ptWeight = Number(computePtWeight(studentId) || "0");
    const quizWeight = Number(computeQuizWeight(studentId) || "0");
    const examWeight = Number(computeExamWeight(studentId) || "0");

    // Check for errors
    if (
      computePtWeight(studentId) === "error" ||
      computeQuizWeight(studentId) === "error" ||
      computeExamWeight(studentId) === "error"
    ) {
      return "error";
    }

    // Calculate total
    const totalPercent = ptWeight + quizWeight + examWeight;
    if (totalPercent === 0) return "";

    return totalPercent.toFixed(2);
  };

  const getNumericGrade = (totalPercent: number | string): string => {
    const percent =
      typeof totalPercent === "string" ? Number(totalPercent) : totalPercent;
    if (isNaN(percent)) return "";
    if (percent >= 97.5) return "1.00";
    if (percent >= 94.5) return "1.25";
    if (percent >= 91.5) return "1.50";
    if (percent >= 86.5) return "1.75";
    if (percent >= 81.5) return "2.00";
    if (percent >= 76.0) return "2.25";
    if (percent >= 70.5) return "2.50";
    if (percent >= 65.0) return "2.75";
    if (percent >= 59.5) return "3.00";
    return "5.00";
  };

  const handleTabNavigation = (
    e: React.KeyboardEvent<HTMLInputElement>,
    studentId: string,
    currentField: string,
    nextField: string
  ) => {
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      // Get next enabled field
      let nextFieldToTry = nextField;
      const fieldOrder = [
        "pt1",
        "pt2",
        "pt3",
        "pt4",
        "q1",
        "q2",
        "q3",
        "q4",
        "examScore",
      ];

      while (true) {
        // Check if current nextField is enabled
        const isEnabled = (() => {
          switch (nextFieldToTry) {
            case "pt1":
              return canEditPt1;
            case "pt2":
              return canEditPt2;
            case "pt3":
              return canEditPt3;
            case "pt4":
              return canEditPt4;
            case "q1":
              return canEditQ1;
            case "q2":
              return canEditQ2;
            case "q3":
              return canEditQ3;
            case "q4":
              return canEditQ4;
            case "examScore":
              return canEditExam;
            default:
              return false;
          }
        })();

        if (isEnabled) {
          // Found an enabled field, focus it
          const nextInput = document.querySelector(
            `input[data-field="${nextFieldToTry}"][data-student-id="${studentId}"]`
          ) as HTMLInputElement;
          nextInput?.focus();
          break;
        }

        // Field was disabled, try next one
        const currentIndex = fieldOrder.indexOf(nextFieldToTry);
        if (currentIndex === fieldOrder.length - 1) {
          // We're at the last field, move to next row
          const nextId = getNextStudentId(studentId);
          if (nextId) {
            // Find first enabled field in next row
            for (const field of fieldOrder) {
              const isNextEnabled = (() => {
                switch (field) {
                  case "pt1":
                    return canEditPt1;
                  case "pt2":
                    return canEditPt2;
                  case "pt3":
                    return canEditPt3;
                  case "pt4":
                    return canEditPt4;
                  case "q1":
                    return canEditQ1;
                  case "q2":
                    return canEditQ2;
                  case "q3":
                    return canEditQ3;
                  case "q4":
                    return canEditQ4;
                  case "examScore":
                    return canEditExam;
                  default:
                    return false;
                }
              })();

              if (isNextEnabled) {
                const nextRowInput = document.querySelector(
                  `input[data-field="${field}"][data-student-id="${nextId}"]`
                ) as HTMLInputElement;
                nextRowInput?.focus();
                break;
              }
            }
          }
          break;
        }

        nextFieldToTry = fieldOrder[currentIndex + 1];
      }
    }
  };

  // Add this helper function
  const getNextStudentId = (currentId: string): string | undefined => {
    const currentIndex = filtered.findIndex((s) => s.id === currentId);
    if (currentIndex < filtered.length - 1) {
      return filtered[currentIndex + 1].id;
    }
    return undefined;
  };

  const handlePasteGrades = (
    type: string,
    target: string,
    gradesText: string
  ) => {
    const grades = gradesText.trim().split(/\s+/).map(Number);

    if (type === "column") {
      // Paste to column
      filtered.forEach((student, index) => {
        if (grades[index] != null) {
          setCell(student.id, target, String(grades[index]));
        }
      });
    } else {
      // Paste to student row
      const fields = [
        "pt1",
        "pt2",
        "pt3",
        "pt4",
        "q1",
        "q2",
        "q3",
        "q4",
        "examScore",
      ];
      fields.forEach((field, index) => {
        if (grades[index] != null) {
          setCell(target, field, String(grades[index]));
        }
      });
    }
  };

  // Add this helper function for remarks
  const getRemarks = (finalGrade: number): string => {
    if (isNaN(finalGrade)) return "";
    if (finalGrade >= 1.0 && finalGrade <= 3.0) return "PASSED";
    return "FAILED";
  };

  // Add this function to compute term grade
  const getTermGrade = (studentId: string, term: Term): number | null => {
    if (term === "SUMMARY") return null;
    const finalGrade = computeFinalGrade(studentId);
    if (finalGrade === "" || finalGrade === "error") return null;
    const grade = getNumericGrade(finalGrade);
    return grade ? Number(grade) : null;
  };

  // Add this function to compute final weighted grade
  const computeFinalWeightedGrade = (studentId: string): number | null => {
    const prelimScores = getTermScores(studentId, "PRELIMS");
    const midtermScores = getTermScores(studentId, "MIDTERM");
    const preFinalsScores = getTermScores(studentId, "PRE-FINALS");
    const finalsScores = getTermScores(studentId, "FINALS");

    if (
      prelimScores.grade === "-" ||
      prelimScores.grade === "" ||
      midtermScores.grade === "-" ||
      midtermScores.grade === "" ||
      preFinalsScores.grade === "-" ||
      preFinalsScores.grade === "" ||
      finalsScores.grade === "-" ||
      finalsScores.grade === ""
    ) {
      return null;
    }

    const grades = {
      PRELIMS: Number(prelimScores.grade),
      MIDTERM: Number(midtermScores.grade),
      "PRE-FINALS": Number(preFinalsScores.grade),
      FINALS: Number(finalsScores.grade),
    };

    if (Object.values(grades).some((g) => isNaN(g))) {
      return null;
    }

    let weightedSum = 0;
    Object.entries(grades).forEach(([term, grade]) => {
      weightedSum += grade * TERM_WEIGHTS[term as keyof typeof TERM_WEIGHTS];
    });

    return Number(weightedSum.toFixed(2));
  };
  // Add this function to get term-specific grades and EQV
  const getTermScores = (
    studentId: string,
    term: Term
  ): { grade: string; eqv: string } => {
    if (term === "SUMMARY") return { grade: "", eqv: "" };

    // Get the specific term's data
    const specificTermData = termData[term];
    const termMaxValues = specificTermData.maxValues;

    // Helper to get cell value from specific term
    const getTermCell = (key: string): string => {
      const value = specificTermData.cellValues[`${studentId}:${key}`];
      return value === undefined ? "" : value;
    };

    // Compute PT weight for this term
    const ptScores = ["pt1", "pt2", "pt3", "pt4"] as const;
    let ptHasInvalidScore = false;
    let ptValidMaxCount = 0;
    const ptValidScores: number[] = [];

    ptScores.forEach((k) => {
      const maxValue = Number((termMaxValues as any)[k] || "");
      const rawScore = getTermCell(k);
      const score = Number(rawScore || "");

      if (
        !isNaN(maxValue) &&
        maxValue > 0 &&
        !isNaN(score) &&
        score > maxValue
      ) {
        ptHasInvalidScore = true;
      }
      if ((!maxValue || isNaN(maxValue)) && rawScore !== "" && !isNaN(score)) {
        ptHasInvalidScore = true;
      }
      if (!isNaN(maxValue) && maxValue > 0) {
        ptValidMaxCount++;
        if (!isNaN(score) && rawScore !== "") {
          const percentage = percent(score, maxValue);
          if (percentage !== null) ptValidScores.push(percentage);
        }
      }
    });

    // Compute Quiz weight for this term
    const qScores = ["q1", "q2", "q3", "q4"] as const;
    let qHasInvalidScore = false;
    let qValidMaxCount = 0;
    const qValidScores: number[] = [];

    qScores.forEach((k) => {
      const maxValue = Number((termMaxValues as any)[k] || "");
      const rawScore = getTermCell(k);
      const score = Number(rawScore || "");

      if (
        !isNaN(maxValue) &&
        maxValue > 0 &&
        !isNaN(score) &&
        score > maxValue
      ) {
        qHasInvalidScore = true;
      }
      if ((!maxValue || isNaN(maxValue)) && rawScore !== "" && !isNaN(score)) {
        qHasInvalidScore = true;
      }
      if (!isNaN(maxValue) && maxValue > 0) {
        qValidMaxCount++;
        if (!isNaN(score) && rawScore !== "") {
          const percentage = percent(score, maxValue);
          if (percentage !== null) qValidScores.push(percentage);
        }
      }
    });

    // Compute Exam weight for this term
    const examMaxValue = Number(termMaxValues.examMax || "");
    const examRawScore = getTermCell("examScore");
    const examScore = Number(examRawScore || "");
    let examHasInvalidScore = false;

    if (
      !isNaN(examMaxValue) &&
      examMaxValue > 0 &&
      !isNaN(examScore) &&
      examScore > examMaxValue
    ) {
      examHasInvalidScore = true;
    }
    if (
      (!examMaxValue || isNaN(examMaxValue)) &&
      examRawScore !== "" &&
      !isNaN(examScore)
    ) {
      examHasInvalidScore = true;
    }

    // Check for any errors
    if (ptHasInvalidScore || qHasInvalidScore || examHasInvalidScore) {
      return { grade: "-", eqv: "-" };
    }

    // Return empty if no exam score
    if (!examRawScore) return { grade: "-", eqv: "-" };

    // Calculate weighted scores
    const ptWeight =
      ptValidMaxCount > 0 && ptValidScores.length > 0
        ? (ptValidScores.reduce((sum, s) => sum + s, 0) /
            ptValidMaxCount /
            100) *
          30
        : 0;

    const qWeight =
      qValidMaxCount > 0 && qValidScores.length > 0
        ? (qValidScores.reduce((sum, s) => sum + s, 0) / qValidMaxCount / 100) *
          20
        : 0;

    const examPercentage =
      examMaxValue && examScore !== null
        ? percent(examScore, examMaxValue)
        : null;
    const examWeight =
      examPercentage !== null ? (examPercentage / 100) * 50 : 0;

    const totalPercent = ptWeight + qWeight + examWeight;
    if (totalPercent === 0) return { grade: "-", eqv: "-" };

    return {
      grade: totalPercent.toFixed(2),
      eqv: getNumericGrade(totalPercent.toFixed(2)),
    };
  };
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm min-h-[770px] max-h-[770px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">MIS</h1>
          <p className="text-sm text-gray-600">
            {courseCode} • {courseSection}
          </p>
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
          <PasteGradesDialog
            onPaste={handlePasteGrades}
            students={filtered}
            maxValues={maxValues}
          />
          <button className="px-4 py-2 bg-[#124A69] text-white text-sm rounded-lg hover:bg-[#0D3A54]">
            Export to PDF
          </button>
          {loading && (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
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

      {activeTerm === "SUMMARY" ? (
        <div className="w-full">
          <table className="table-fixed w-full border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="w-[30%] border border-gray-300 px-2 py-2 text-left font-medium text-gray-700">
                  Students
                </th>
                <th
                  className="w-[14%] border border-gray-300 px-2 py-2 text-center font-medium text-gray-700"
                  colSpan={2}
                >
                  PRELIMS
                </th>
                <th
                  className="w-[14%] border border-gray-300 px-2 py-2 text-center font-medium text-gray-700"
                  colSpan={2}
                >
                  MIDTERM
                </th>
                <th
                  className="w-[14%] border border-gray-300 px-2 py-2 text-center font-medium text-gray-700"
                  colSpan={2}
                >
                  PRE-FINALS
                </th>
                <th
                  className="w-[14%] border border-gray-300 px-2 py-2 text-center font-medium text-gray-700"
                  colSpan={2}
                >
                  FINALS
                </th>
                <th
                  className="w-[14%] border border-gray-300 px-2 py-2 text-center font-medium text-gray-700"
                  colSpan={2}
                >
                  FINAL GRADE
                </th>
              </tr>
              <tr className="bg-gray-50 text-xs">
                <th className="border border-gray-300 px-2 py-1"></th>
                <th className="border border-gray-300 px-1 py-1 text-center">
                  20%
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center">
                  EQV
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center">
                  20%
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center">
                  EQV
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center">
                  20%
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center">
                  EQV
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center">
                  40%
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center">
                  EQV
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center">
                  GRADE
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center">
                  REMARKS
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student) => {
                const prelimScores = getTermScores(student.id, "PRELIMS");
                const midtermScores = getTermScores(student.id, "MIDTERM");
                const preFinalsScores = getTermScores(student.id, "PRE-FINALS");
                const finalsScores = getTermScores(student.id, "FINALS");
                const finalWeightedGrade = computeFinalWeightedGrade(
                  student.id
                );

                return (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-2 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-[10px] text-gray-600">👤</span>
                        </div>
                        <span className="text-sm text-gray-700 truncate">
                          {student.name}
                        </span>
                      </div>
                    </td>
                    <td className="border border-gray-300 py-3 text-center">
                      <input
                        type="text"
                        className="w-14 h-8 text-center border border-gray-200 rounded"
                        value={prelimScores.grade || "-"}
                        readOnly
                      />
                    </td>
                    <td className="border border-gray-300 py-3 text-center">
                      <input
                        type="text"
                        className="w-14 h-8 text-center border border-gray-200 rounded"
                        value={prelimScores.eqv || "-"}
                        readOnly
                      />
                    </td>
                    <td className="border border-gray-300 py-3 text-center">
                      <input
                        type="text"
                        className="w-14 h-8 text-center border border-gray-200 rounded"
                        value={midtermScores.grade || "-"}
                        readOnly
                      />
                    </td>
                    <td className="border border-gray-300 py-3 text-center">
                      <input
                        type="text"
                        className="w-14 h-8 text-center border border-gray-200 rounded"
                        value={midtermScores.eqv || "-"}
                        readOnly
                      />
                    </td>
                    <td className="border border-gray-300 py-3 text-center">
                      <input
                        type="text"
                        className="w-14 h-8 text-center border border-gray-200 rounded"
                        value={preFinalsScores.grade || "-"}
                        readOnly
                      />
                    </td>
                    <td className="border border-gray-300 py-3 text-center">
                      <input
                        type="text"
                        className="w-14 h-8 text-center border border-gray-200 rounded"
                        value={preFinalsScores.eqv || "-"}
                        readOnly
                      />
                    </td>
                    <td className="border border-gray-300 py-3 text-center">
                      <input
                        type="text"
                        className="w-14 h-8 text-center border border-gray-200 rounded"
                        value={finalsScores.grade || "-"}
                        readOnly
                      />
                    </td>
                    <td className="border border-gray-300 py-3 text-center">
                      <input
                        type="text"
                        className="w-14 h-8 text-center border border-gray-200 rounded"
                        value={finalsScores.eqv || "-"}
                        readOnly
                      />
                    </td>
                    <td className="border border-gray-300 py-3 text-center">
                      <input
                        type="text"
                        className={`w-14 h-8 text-center border border-gray-200 rounded font-medium
      ${
        finalWeightedGrade
          ? parseFloat(getNumericGrade(finalWeightedGrade)) > 3.0
            ? "text-red-500"
            : ""
          : ""
      }`}
                        value={
                          finalWeightedGrade
                            ? getNumericGrade(finalWeightedGrade)
                            : "-"
                        }
                        readOnly
                      />
                    </td>
                    <td className="border border-gray-300 py-3 text-center">
                      <span
                        className={`text-sm font-medium
      ${
        finalWeightedGrade
          ? parseFloat(getNumericGrade(finalWeightedGrade)) > 3.0
            ? "text-red-500"
            : "text-green-600"
          : ""
      }`}
                      >
                        {finalWeightedGrade
                          ? getRemarks(
                              parseFloat(getNumericGrade(finalWeightedGrade))
                            )
                          : "-"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="w-full">
          <table className="table-fixed w-full border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="w-[30%] border border-gray-300 px-2 py-2 text-left font-medium text-gray-700">
                  Students
                </th>
                <th
                  className="w-[25%] border border-gray-300 px-2 py-2 text-center font-medium text-gray-700"
                  colSpan={5}
                >
                  PT/LAB
                </th>
                <th
                  className="w-[25%] border border-gray-300 px-2 py-2 text-center font-medium text-gray-700"
                  colSpan={5}
                >
                  QUIZZES
                </th>
                <th
                  className="w-[10%] border border-gray-300 px-2 py-2 text-center font-medium text-gray-700"
                  colSpan={2}
                >
                  EXAM
                </th>
              </tr>

              <tr className="bg-gray-50 text-xs">
                <th className="border border-gray-300 px-2 py-1"></th>
                <th className="border border-gray-300 px-1 py-1 text-center">
                  PT1
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center">
                  PT2
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center">
                  PT3
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center">
                  PT4
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center">
                  30%
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center">
                  Q1
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center">
                  Q2
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center">
                  Q3
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center">
                  Q4
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center text-[#124A69] font-semibold">
                  20%
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center">
                  0
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center">
                  50%
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center">
                  GRADE
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center">
                  EQV
                </th>
              </tr>
              {/* Max Score Row (editable) */}
              <tr className="bg-gray-50 text-[10px] ">
                <th className="border border-gray-300 px-2 py-1"></th>

                <th className="border border-gray-300 px-1 py-1 text-center text-gray-500">
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    className="w-14 h-6 text-xs text-center border border-gray-200 rounded px-1"
                    placeholder="Max"
                    value={maxValues.pt1}
                    onKeyDown={handleNumericKeyDown}
                    onPaste={handleAbsoluteMaxPaste((next) =>
                      setMaxValues((m) => ({ ...m, pt1: next }))
                    )}
                    onChange={handleAbsoluteMaxChange((next) =>
                      setMaxValues((m) => ({ ...m, pt1: next }))
                    )}
                  />
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center text-gray-500">
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    className="w-14 h-6 text-xs text-center border border-gray-200 rounded px-1"
                    placeholder="Max"
                    value={maxValues.pt2}
                    onKeyDown={handleNumericKeyDown}
                    onPaste={handleAbsoluteMaxPaste((next) =>
                      setMaxValues((m) => ({ ...m, pt2: next }))
                    )}
                    onChange={handleAbsoluteMaxChange((next) =>
                      setMaxValues((m) => ({ ...m, pt2: next }))
                    )}
                  />
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center text-gray-500">
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    className="w-14 h-6 text-xs text-center border border-gray-200 rounded px-1"
                    placeholder="Max"
                    value={maxValues.pt3}
                    onKeyDown={handleNumericKeyDown}
                    onPaste={handleAbsoluteMaxPaste((next) =>
                      setMaxValues((m) => ({ ...m, pt3: next }))
                    )}
                    onChange={handleAbsoluteMaxChange((next) =>
                      setMaxValues((m) => ({ ...m, pt3: next }))
                    )}
                  />
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center text-gray-500">
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    className="w-14 h-6 text-xs text-center border border-gray-200 rounded px-1"
                    placeholder="Max"
                    value={maxValues.pt4}
                    onKeyDown={handleNumericKeyDown}
                    onPaste={handleAbsoluteMaxPaste((next) =>
                      setMaxValues((m) => ({ ...m, pt4: next }))
                    )}
                    onChange={handleAbsoluteMaxChange((next) =>
                      setMaxValues((m) => ({ ...m, pt4: next }))
                    )}
                  />
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center text-gray-700 font-semibold">
                  {ptTotalMax || 0}
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center text-gray-500">
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    className="w-14 h-6 text-xs text-center border border-gray-200 rounded px-1"
                    placeholder="Max"
                    value={maxValues.q1}
                    onKeyDown={handleNumericKeyDown}
                    onPaste={handleAbsoluteMaxPaste((next) =>
                      setMaxValues((m) => ({ ...m, q1: next }))
                    )}
                    onChange={handleAbsoluteMaxChange((next) =>
                      setMaxValues((m) => ({ ...m, q1: next }))
                    )}
                  />
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center text-gray-500">
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    className="w-14 h-6 text-xs text-center border border-gray-200 rounded px-1"
                    placeholder="Max"
                    value={maxValues.q2}
                    onKeyDown={handleNumericKeyDown}
                    onPaste={handleAbsoluteMaxPaste((next) =>
                      setMaxValues((m) => ({ ...m, q2: next }))
                    )}
                    onChange={handleAbsoluteMaxChange((next) =>
                      setMaxValues((m) => ({ ...m, q2: next }))
                    )}
                  />
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center text-gray-500">
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    className="w-14 h-6 text-xs text-center border border-gray-200 rounded px-1"
                    placeholder="Max"
                    value={maxValues.q3}
                    onKeyDown={handleNumericKeyDown}
                    onPaste={handleAbsoluteMaxPaste((next) =>
                      setMaxValues((m) => ({ ...m, q3: next }))
                    )}
                    onChange={handleAbsoluteMaxChange((next) =>
                      setMaxValues((m) => ({ ...m, q3: next }))
                    )}
                  />
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center text-gray-500">
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    className="w-14 h-6 text-xs text-center border border-gray-200 rounded px-1"
                    placeholder="Max"
                    value={maxValues.q4}
                    onKeyDown={handleNumericKeyDown}
                    onPaste={handleAbsoluteMaxPaste((next) =>
                      setMaxValues((m) => ({ ...m, q4: next }))
                    )}
                    onChange={handleAbsoluteMaxChange((next) =>
                      setMaxValues((m) => ({ ...m, q4: next }))
                    )}
                  />
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center text-gray-700 font-semibold">
                  {qTotalMax || 0}
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center text-gray-500">
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    className="w-14 h-6 text-xs text-center border border-gray-200 rounded px-1"
                    placeholder="Max"
                    value={maxValues.examMax}
                    onKeyDown={handleNumericKeyDown}
                    onPaste={handleAbsoluteMaxPaste((next) =>
                      setMaxValues((m) => ({ ...m, examMax: next }))
                    )}
                    onChange={handleAbsoluteMaxChange((next) =>
                      setMaxValues((m) => ({ ...m, examMax: next }))
                    )}
                  />
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center text-gray-500">
                  %
                </th>
                <th className="border border-gray-300 px-1 py-1 text-center text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-2 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-[10px] text-gray-600">👤</span>
                      </div>
                      <span className="text-sm text-gray-700 truncate">
                        {s.name}
                      </span>
                    </div>
                  </td>
                  {/* PT/LAB */}
                  <td className="border border-gray-300 py-3 text-center text-sm">
                    <input
                      type="text"
                      data-field="pt1"
                      data-student-id={s.id}
                      inputMode="decimal"
                      pattern="[0-9]*"
                      className={`w-14 h-8 text-center border border-gray-200 rounded ${getScoreStyle(
                        Number(getCell(s.id, "pt1")) || null,
                        Number(maxValues.pt1) || null
                      )}`}
                      value={getCell(s.id, "pt1")}
                      onKeyDown={(e) => {
                        handleNumericKeyDown(e);
                        handleTabNavigation(e, s.id, "pt1", "pt2");
                      }}
                      onPaste={handleBoundedNumericPaste(
                        (next) => setCell(s.id, "pt1", next),
                        () => Number(maxValues.pt1 || "") || null
                      )}
                      onChange={handleBoundedNumericChange(
                        (next) => setCell(s.id, "pt1", next),
                        () => Number(maxValues.pt1 || "") || null
                      )}
                      disabled={!canEditPt1}
                      title={!canEditPt1 ? "No max score" : undefined}
                    />
                  </td>
                  <td className="border border-gray-300 py-3 text-center text-sm">
                    <input
                      type="text"
                      data-field="pt2"
                      data-student-id={s.id}
                      inputMode="decimal"
                      pattern="[0-9]*"
                      className={`w-14 h-8 text-center border border-gray-200 rounded ${getScoreStyle(
                        Number(getCell(s.id, "pt2")) || null,
                        Number(maxValues.pt2) || null
                      )}`}
                      value={getCell(s.id, "pt2")}
                      onKeyDown={(e) => {
                        handleNumericKeyDown(e);
                        handleTabNavigation(e, s.id, "pt2", "pt3");
                      }}
                      onPaste={handleBoundedNumericPaste(
                        (next) => setCell(s.id, "pt2", next),
                        () => Number(maxValues.pt2 || "") || null
                      )}
                      onChange={handleBoundedNumericChange(
                        (next) => setCell(s.id, "pt2", next),
                        () => Number(maxValues.pt2 || "") || null
                      )}
                      disabled={!canEditPt2}
                      title={!canEditPt2 ? "No max score" : undefined}
                    />
                  </td>
                  <td className="border border-gray-300 py-3 text-center text-sm">
                    <input
                      type="text"
                      data-field="pt3"
                      data-student-id={s.id}
                      inputMode="decimal"
                      pattern="[0-9]*"
                      className={`w-14 h-8 text-center border border-gray-200 rounded ${getScoreStyle(
                        Number(getCell(s.id, "pt3")) || null,
                        Number(maxValues.pt3) || null
                      )}`}
                      value={getCell(s.id, "pt3")}
                      onKeyDown={(e) => {
                        handleNumericKeyDown(e);
                        handleTabNavigation(e, s.id, "pt3", "pt4");
                      }}
                      onPaste={handleBoundedNumericPaste(
                        (next) => setCell(s.id, "pt3", next),
                        () => Number(maxValues.pt3 || "") || null
                      )}
                      onChange={handleBoundedNumericChange(
                        (next) => setCell(s.id, "pt3", next),
                        () => Number(maxValues.pt3 || "") || null
                      )}
                      disabled={!canEditPt3}
                      title={!canEditPt3 ? "No max score" : undefined}
                    />
                  </td>
                  <td className="border border-gray-300 py-3 text-center text-sm">
                    <input
                      type="text"
                      data-field="pt4"
                      data-student-id={s.id}
                      inputMode="decimal"
                      pattern="[0-9]*"
                      className={`w-14 h-8 text-center border border-gray-200 rounded ${getScoreStyle(
                        Number(getCell(s.id, "pt4")) || null,
                        Number(maxValues.pt4) || null
                      )}`}
                      value={getCell(s.id, "pt4")}
                      onKeyDown={(e) => {
                        handleNumericKeyDown(e);
                        handleTabNavigation(e, s.id, "pt4", "q1");
                      }}
                      onPaste={handleBoundedNumericPaste(
                        (next) => setCell(s.id, "pt4", next),
                        () => Number(maxValues.pt4 || "") || null
                      )}
                      onChange={handleBoundedNumericChange(
                        (next) => setCell(s.id, "pt4", next),
                        () => Number(maxValues.pt4 || "") || null
                      )}
                      disabled={!canEditPt4}
                      title={!canEditPt4 ? "No max score" : undefined}
                    />
                  </td>
                  <td className="border border-gray-300 py-3 text-center text-sm">
                    <input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9]*"
                      className="w-14 h-8 text-center border border-gray-200 rounded"
                      value={computePtWeight(s.id)}
                      readOnly
                      title={"30% of avg PT %"}
                    />
                  </td>
                  {/* Quizzes */}
                  <td className="border border-gray-300 py-3 text-center text-sm">
                    <input
                      type="text"
                      data-field="q1"
                      data-student-id={s.id}
                      inputMode="decimal"
                      pattern="[0-9]*"
                      className={`w-14 h-8 text-center border border-gray-200 rounded ${getScoreStyle(
                        Number(getCell(s.id, "q1")) || null,
                        Number(maxValues.q1) || null
                      )}`}
                      value={getCell(s.id, "q1")}
                      onKeyDown={(e) => {
                        handleNumericKeyDown(e);
                        handleTabNavigation(e, s.id, "q1", "q2");
                      }}
                      onPaste={handleBoundedNumericPaste(
                        (next) => setCell(s.id, "q1", next),
                        () => Number(maxValues.q1 || "") || null
                      )}
                      onChange={handleBoundedNumericChange(
                        (next) => setCell(s.id, "q1", next),
                        () => Number(maxValues.q1 || "") || null
                      )}
                      disabled={!canEditQ1}
                      title={!canEditQ1 ? "No max score" : undefined}
                    />
                  </td>
                  <td className="border border-gray-300 py-3 text-center text-sm">
                    <input
                      type="text"
                      data-field="q2"
                      data-student-id={s.id}
                      inputMode="decimal"
                      pattern="[0-9]*"
                      className={`w-14 h-8 text-center border border-gray-200 rounded ${getScoreStyle(
                        Number(getCell(s.id, "q2")) || null,
                        Number(maxValues.q2) || null
                      )}`}
                      value={getCell(s.id, "q2")}
                      onKeyDown={(e) => {
                        handleNumericKeyDown(e);
                        handleTabNavigation(e, s.id, "q2", "q3");
                      }}
                      onPaste={handleBoundedNumericPaste(
                        (next) => setCell(s.id, "q2", next),
                        () => Number(maxValues.q2 || "") || null
                      )}
                      onChange={handleBoundedNumericChange(
                        (next) => setCell(s.id, "q2", next),
                        () => Number(maxValues.q2 || "") || null
                      )}
                      disabled={!canEditQ2}
                      title={!canEditQ2 ? "No max score" : undefined}
                    />
                  </td>
                  <td className="border border-gray-300 py-3 text-center text-sm">
                    <input
                      type="text"
                      data-field="q3"
                      data-student-id={s.id}
                      inputMode="decimal"
                      pattern="[0-9]*"
                      className={`w-14 h-8 text-center border border-gray-200 rounded ${getScoreStyle(
                        Number(getCell(s.id, "q3")) || null,
                        Number(maxValues.q3) || null
                      )}`}
                      value={getCell(s.id, "q3")}
                      onKeyDown={(e) => {
                        handleNumericKeyDown(e);
                        handleTabNavigation(e, s.id, "q3", "q4");
                      }}
                      onPaste={handleBoundedNumericPaste(
                        (next) => setCell(s.id, "q3", next),
                        () => Number(maxValues.q3 || "") || null
                      )}
                      onChange={handleBoundedNumericChange(
                        (next) => setCell(s.id, "q3", next),
                        () => Number(maxValues.q3 || "") || null
                      )}
                      disabled={!canEditQ3}
                      title={!canEditQ3 ? "No max score" : undefined}
                    />
                  </td>
                  <td className="border border-gray-300 py-3 text-center text-sm">
                    <input
                      type="text"
                      data-field="q4"
                      data-student-id={s.id}
                      inputMode="decimal"
                      pattern="[0-9]*"
                      className={`w-14 h-8 text-center border border-gray-200 rounded ${getScoreStyle(
                        Number(getCell(s.id, "q4")) || null,
                        Number(maxValues.q4) || null
                      )}`}
                      value={getCell(s.id, "q4")}
                      onKeyDown={(e) => {
                        handleNumericKeyDown(e);
                        handleTabNavigation(e, s.id, "q4", "examScore");
                      }}
                      onPaste={handleBoundedNumericPaste(
                        (next) => setCell(s.id, "q4", next),
                        () => Number(maxValues.q4 || "") || null
                      )}
                      onChange={handleBoundedNumericChange(
                        (next) => setCell(s.id, "q4", next),
                        () => Number(maxValues.q4 || "") || null
                      )}
                      disabled={!canEditQ4}
                      title={!canEditQ4 ? "No max score" : undefined}
                    />
                  </td>
                  <td className="border border-gray-300 py-3 text-center text-sm">
                    <input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9]*"
                      className="w-14 h-8 text-center border border-gray-200 rounded"
                      value={computeQuizWeight(s.id)}
                      readOnly
                      title={"20% of avg quiz %"}
                    />
                  </td>
                  {/* Exam */}
                  <td className="border border-gray-300 py-3 text-center text-sm">
                    <input
                      type="text"
                      data-field="examScore"
                      data-student-id={s.id}
                      inputMode="decimal"
                      pattern="[0-9]*"
                      className={`w-14 h-8 text-center border border-gray-200 rounded ${getScoreStyle(
                        Number(getCell(s.id, "examScore")) || null,
                        Number(maxValues.examMax) || null
                      )}`}
                      value={getCell(s.id, "examScore")}
                      onKeyDown={(e) => {
                        handleNumericKeyDown(e);
                        if (e.key === "Tab") {
                          e.preventDefault();
                          const nextId = getNextStudentId(s.id);
                          if (nextId) {
                            const nextRowPt1 = document.querySelector(
                              `input[data-field="pt1"][data-student-id="${nextId}"]`
                            ) as HTMLInputElement;
                            nextRowPt1?.focus();
                          }
                        }
                      }}
                      onPaste={handleBoundedNumericPaste(
                        (next) => setCell(s.id, "examScore", next),
                        () => Number(maxValues.examMax || "") || null
                      )}
                      onChange={handleBoundedNumericChange(
                        (next) => setCell(s.id, "examScore", next),
                        () => Number(maxValues.examMax || "") || null
                      )}
                      disabled={!canEditExam}
                      title={!canEditExam ? "No max score" : undefined}
                    />
                  </td>
                  <td className="border border-gray-300 py-3 text-center text-sm">
                    <input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9]*"
                      className="w-14 h-8 text-center border border-gray-200 rounded"
                      value={computeExamWeight(s.id)}
                      readOnly
                      title={"50% of exam score"}
                    />
                  </td>

                  <td className="border border-gray-300 py-3 text-center text-sm">
                    <input
                      type="text"
                      className={`w-14 h-8 text-center border border-gray-200 rounded ${
                        getCell(s.id, "examScore") &&
                        getNumericGrade(computeFinalGrade(s.id)) === "5.00"
                          ? "text-red-500"
                          : ""
                      }`}
                      value={computeFinalGrade(s.id)}
                      readOnly
                      title={"Total Sum"}
                    />
                  </td>
                  <td className="border border-gray-300 py-3 text-center text-sm">
                    <input
                      type="text"
                      className={`w-14 h-8 text-center border border-gray-200 rounded ${
                        getCell(s.id, "examScore") &&
                        getNumericGrade(computeFinalGrade(s.id)) === "5.00"
                          ? "text-red-500"
                          : ""
                      }`}
                      value={
                        getCell(s.id, "examScore")
                          ? getNumericGrade(computeFinalGrade(s.id))
                          : ""
                      }
                      readOnly
                      title={"Numeric Grade"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
