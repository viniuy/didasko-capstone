// Part 1 of 2 - Copy this first
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import axiosInstance from "@/lib/axios";
import { Search, Loader2, Settings, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SettingsModal } from "./SettingsModal";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

function LoadingSpinner() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm min-h-[770px] max-h-[770px]">
      <div className="flex flex-col items-center gap-4 mt-40">
        <h2 className="text-3xl font-bold text-[#124A69] animate-pulse">
          Welcome to Didasko!
        </h2>
        <p
          className="text-lg text-gray-600 animate-pulse"
          style={{ animationDelay: "150ms" }}
        >
          Please sit tight while we are getting things ready for you...
        </p>
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
  courseTitle: string;
  courseNumber: Int16Array;
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
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => callback(...args), delay);
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
      if (digits === "") {
        setScore(studentId, assessmentId, null);
        return;
      }
      const num = Number(digits);
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
    if (!prelimGrade || !midtermGrade || !preFinalsGrade || !finalsGrade)
      return null;
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

  const studentName = (s: Student) =>
    `${s.lastName}, ${s.firstName}${
      s.middleInitial ? ` ${s.middleInitial}.` : ""
    }`;

  const handleSaveSettings = async (configs: Record<string, TermConfig>) => {
    try {
      toast.loading("Saving term configurations...");
      const payload = { termConfigs: configs };
      await axiosInstance.post(`/courses/${courseSlug}/term-configs`, payload);
      toast.dismiss();
      setTermConfigs(configs);
      toast.success("Settings saved successfully!");
    } catch (error: any) {
      toast.dismiss();
      console.error("Failed to save settings:", error.response?.data || error);
      toast.error("Failed to save settings");
    }
  };

  const handleExportToExcel = async () => {
    try {
      toast.loading("Generating Excel file...");

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
      headerRow.eachCell((cell, col) => {
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
        const prelim =
          computeTermGrade(student.id, "PRELIMS")?.totalPercent ?? "";
        const midterm =
          computeTermGrade(student.id, "MIDTERM")?.totalPercent ?? "";
        const prefinal =
          computeTermGrade(student.id, "PRE-FINALS")?.totalPercent ?? "";
        const finals =
          computeTermGrade(student.id, "FINALS")?.totalPercent ?? "";

        const fullName = studentName(student);
        const formattedName = fullName
          .replace(/\s+[A-Z]\.$/, "")
          .replace(/\s+/g, " ")
          .trim()
          .toUpperCase();

        const row = ws.addRow([
          student.id ?? "",
          formattedName,
          prelim,
          midterm,
          prefinal,
          finals,
        ]);

        row.eachCell((cell, col) => {
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
      const fileName = `${courseCode}_${courseSection}_ClassRecord.xlsx`;
      saveAs(new Blob([buffer]), fileName);

      toast.dismiss();
      toast.success("Excel exported successfully!");
    } catch (error) {
      toast.dismiss();
      console.error(error);
      toast.error("Failed to export Excel");
    }
  };

  if (loading) return <LoadingSpinner />;

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
            <button
              onClick={handleExportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-[#124A69] text-white text-sm rounded-lg hover:bg-[#0D3A54]"
            >
              <Download className="w-4 h-4" />
              Export to Excel
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
          <button
            className="flex items-center gap-2 px-4 py-2 bg-[#124A69] text-white text-sm rounded-lg hover:bg-[#0D3A54]"
            onClick={handleExportToExcel}
          >
            <Download className="w-4 h-4" />
            Export to Excel
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
                    {pts.map((pt) => {
                      const score = getEffectiveScore(student.id, pt);
                      return (
                        <td
                          key={pt.id}
                          className="border border-gray-300 py-3 text-center text-sm w-14"
                        >
                          <input
                            type="text"
                            inputMode="numeric"
                            className={`w-[90%] h-8 text-center border border-gray-200 rounded ${
                              pt.linkedCriteriaId
                                ? "bg-blue-50 cursor-not-allowed"
                                : ""
                            } ${getScoreStyle(score, pt.maxScore)}`}
                            value={score ?? ""}
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
                      );
                    })}
                    {pts.length > 0 && (
                      <td className="border border-gray-300 py-3 text-center text-sm">
                        <input
                          type="text"
                          className="w-[90%] h-8 text-center border border-gray-200 rounded"
                          value={termGrade?.ptWeighted ?? ""}
                          readOnly
                        />
                      </td>
                    )}
                    {quizzes.map((quiz) => {
                      const score = getEffectiveScore(student.id, quiz);
                      return (
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
                            } ${getScoreStyle(score, quiz.maxScore)}`}
                            value={score ?? ""}
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
                      );
                    })}
                    {quizzes.length > 0 && (
                      <td className="border border-gray-300 py-3 text-center text-sm">
                        <input
                          type="text"
                          className="w-[90%] h-8 text-center border border-gray-200 rounded"
                          value={termGrade?.quizWeighted ?? ""}
                          readOnly
                        />
                      </td>
                    )}
                    {exam && (
                      <>
                        <td className="border border-gray-300 py-3 text-center text-sm">
                          {(() => {
                            const score = getEffectiveScore(student.id, exam);
                            return (
                              <input
                                type="text"
                                inputMode="numeric"
                                className={`w-[90%] h-8 text-center border border-gray-200 rounded ${
                                  exam.linkedCriteriaId
                                    ? "bg-blue-50 cursor-not-allowed"
                                    : ""
                                } ${getScoreStyle(score, exam.maxScore)}`}
                                value={score == null ? "" : score}
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
                            );
                          })()}
                        </td>
                        <td className="border border-gray-300 py-3 text-center text-sm">
                          <input
                            type="text"
                            className="w-[90%] h-8 text-center border border-gray-200 rounded"
                            value={termGrade?.examWeighted ?? ""}
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
                        value={termGrade?.totalPercent ?? ""}
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
                        value={termGrade?.numericGrade ?? ""}
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

export type { Term, Assessment, TermConfig };
