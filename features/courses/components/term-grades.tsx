import React, { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Download, TrendingUp, Loader2 } from "lucide-react";
// XLSX removed - not used in this component
import toast from "react-hot-toast";
import { StudentWithGrades, TermGradeData } from "../types/types";
import { StudentAvatar } from "./ui-components";
import { useTermGrades } from "@/lib/hooks/queries/useGrading";

interface TermGradesTabProps {
  courseSlug: string;
  termKey: "prelims" | "midterm" | "preFinals" | "finals";
  globalSearchQuery?: string; // Add this prop
  onLoadingChange?: (loading: boolean) => void; // Callback to notify parent of loading state
}

export const TermGradesTab = ({
  courseSlug,
  termKey,
  globalSearchQuery = "", // Default to empty string
  onLoadingChange,
}: TermGradesTabProps) => {
  const termName =
    termKey === "preFinals" ? "PRE-FINALS" : termKey.toUpperCase();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Normalize termKey to match API route (preFinals -> prefinals)
  const apiTermKey = termKey === "preFinals" ? "prefinals" : termKey;

  // Fetch term grades for this specific term
  const {
    data: termGradesData,
    isLoading,
    isError,
  } = useTermGrades(courseSlug, apiTermKey, true);

  // Notify parent of loading state changes
  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  // Sync local search with global search
  useEffect(() => {
    setSearchQuery(globalSearchQuery);
  }, [globalSearchQuery]);

  // Transform fetched data to match expected format
  const students = useMemo(() => {
    if (!termGradesData?.students) return [];

    interface ApiStudent {
      id: string;
      studentId: string;
      lastName: string;
      firstName: string;
      middleInitial?: string;
      image?: string;
      termGrade: TermGradeData;
    }

    return termGradesData.students.map((student: ApiStudent) => {
      const normalizedTermKey = termKey === "preFinals" ? "prefinals" : termKey;
      return {
        id: student.id,
        studentId: student.studentId,
        lastName: student.lastName,
        firstName: student.firstName,
        middleInitial: student.middleInitial,
        image: student.image,
        termGrades: {
          [normalizedTermKey]: student.termGrade,
        },
      };
    });
  }, [termGradesData, termKey]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#124A69]" />
        <span className="ml-3 text-gray-600">Loading {termName} grades...</span>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="text-center py-12 text-red-500">
        <TrendingUp className="w-12 h-12 mx-auto mb-3 text-red-400" />
        <p>Failed to load {termName} grades. Please try again.</p>
      </div>
    );
  }

  // No data state
  if (!students || students.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p>No grades available for {termName}</p>
      </div>
    );
  }

  const normalizedTermKey = termKey === "preFinals" ? "prefinals" : termKey;
  const hasData = students.some(
    (s: StudentWithGrades) =>
      s.termGrades[normalizedTermKey as keyof typeof s.termGrades]
  );

  if (!hasData) {
    return (
      <div className="text-center py-12 text-gray-500">
        <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p>No grades available for {termName}</p>
      </div>
    );
  }

  // Sort students alphabetically by last name, then first name (case-insensitive)
  const filteredStudents = students
    .filter((student: StudentWithGrades) =>
      `${student.lastName} ${student.firstName} ${student.studentId}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    )
    .sort((a: StudentWithGrades, b: StudentWithGrades) => {
      const lastNameCompare = a.lastName
        .toLowerCase()
        .localeCompare(b.lastName.toLowerCase(), undefined, {
          sensitivity: "base",
        });
      if (lastNameCompare !== 0) return lastNameCompare;
      return a.firstName
        .toLowerCase()
        .localeCompare(b.firstName.toLowerCase(), undefined, {
          sensitivity: "base",
        });
    });

  // Get term config weights from API response
  const termConfig = termGradesData?.termConfig;
  const ptWeight = termConfig?.ptWeight || 0;
  const quizWeight = termConfig?.quizWeight || 0;
  const examWeight = termConfig?.examWeight || 0;

  // Helper function to convert percentage to numeric grade
  const getNumericGrade = (totalPercent: number): number => {
    if (totalPercent >= 97.5) return 1.0;
    if (totalPercent >= 94.5) return 1.25;
    if (totalPercent >= 91.5) return 1.5;
    if (totalPercent >= 86.5) return 1.75;
    if (totalPercent >= 81.5) return 2.0;
    if (totalPercent >= 76.0) return 2.25;
    if (totalPercent >= 70.5) return 2.5;
    if (totalPercent >= 65.0) return 2.75;
    if (totalPercent >= 59.5) return 3.0;
    return 5.0;
  };

  // Helper function to calculate final percentage and grade for a student
  const calculateTermGrade = (termData: TermGradeData) => {
    // Calculate PT average percentage
    const ptPercentages: number[] = [];
    termData.ptScores?.forEach((pt) => {
      if (pt.score !== null && pt.score !== undefined && pt.maxScore > 0) {
        const percentage = (pt.score / pt.maxScore) * 100;
        ptPercentages.push(percentage);
      }
    });
    const ptAvg =
      ptPercentages.length > 0
        ? ptPercentages.reduce((a, b) => a + b, 0) / ptPercentages.length
        : 0;

    // Calculate Quiz average percentage
    const quizPercentages: number[] = [];
    termData.quizScores?.forEach((quiz) => {
      if (
        quiz.score !== null &&
        quiz.score !== undefined &&
        quiz.maxScore > 0
      ) {
        const percentage = (quiz.score / quiz.maxScore) * 100;
        quizPercentages.push(percentage);
      }
    });
    const quizAvg =
      quizPercentages.length > 0
        ? quizPercentages.reduce((a, b) => a + b, 0) / quizPercentages.length
        : 0;

    // Calculate Exam percentage
    let examPercentage: number | null = null;
    if (termData.examScore) {
      const exam = termData.examScore;
      if (
        exam.score !== null &&
        exam.score !== undefined &&
        exam.maxScore > 0
      ) {
        examPercentage = (exam.score / exam.maxScore) * 100;
      }
    }

    // If no exam score, can't compute term grade
    if (examPercentage === null) {
      return { totalPercentage: null, numericGrade: null };
    }

    // Calculate weighted total
    const ptWeighted = (ptAvg / 100) * ptWeight;
    const quizWeighted = (quizAvg / 100) * quizWeight;
    const examWeighted = (examPercentage / 100) * examWeight;
    const totalPercentage = ptWeighted + quizWeighted + examWeighted;

    // Calculate numeric grade
    const numericGrade = getNumericGrade(totalPercentage);

    return { totalPercentage, numericGrade };
  };

  const sampleTerm = students.find(
    (s: StudentWithGrades) =>
      s.termGrades[normalizedTermKey as keyof typeof s.termGrades]
  )?.termGrades[normalizedTermKey as keyof (typeof students)[0]["termGrades"]];
  const ptColumns =
    sampleTerm?.ptScores?.map((pt: { name: string }) => pt.name) || [];
  const quizColumns =
    sampleTerm?.quizScores?.map((q: { name: string }) => q.name) || [];
  const hasExam = sampleTerm?.examScore !== undefined;

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4 mt-4 pb-4">
      <div
        className="rounded-md border overflow-auto flex-1 min-h-[200px] mb-4"
        style={{
          height: "auto",
          maxHeight: "100%",
          alignSelf: "stretch",
        }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px] sticky left-0 bg-white z-10 border-r">
                Student
              </TableHead>
              {ptColumns.map((pt: string, idx: number) => (
                <TableHead
                  key={`pt-${idx}`}
                  className="text-center min-w-[100px]"
                >
                  {pt}
                </TableHead>
              ))}
              {quizColumns.map((quiz: string, idx: number) => (
                <TableHead
                  key={`quiz-${idx}`}
                  className="text-center min-w-[100px]"
                >
                  {quiz}
                </TableHead>
              ))}
              {hasExam && (
                <TableHead className="text-center min-w-[100px]">
                  Exam
                </TableHead>
              )}
              <TableHead className="text-center min-w-[100px]">
                Final %
              </TableHead>
              <TableHead className="text-center min-w-[100px]">Grade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.length > 0 ? (
              filteredStudents.map((student: StudentWithGrades) => {
                const termData = student.termGrades[
                  normalizedTermKey as keyof typeof student.termGrades
                ] as TermGradeData | undefined;
                if (!termData) return null;

                const isSelected = selectedRowId === student.id;
                return (
                  <TableRow
                    key={student.id}
                    onClick={() =>
                      setSelectedRowId(isSelected ? null : student.id)
                    }
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[#124A69] hover:bg-[#0D3A54]"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <TableCell
                      className={`font-medium sticky left-0 z-10 border-r ${
                        isSelected ? "bg-[#124A69] text-white" : "bg-white"
                      }`}
                    >
                      <div className={isSelected ? "[&_span]:text-white" : ""}>
                        <StudentAvatar student={student} />
                      </div>
                    </TableCell>

                    {ptColumns.map((ptName: string, idx: number) => {
                      const pt = termData.ptScores?.find(
                        (p: { name: string }) => p.name === ptName
                      );
                      return (
                        <TableCell
                          key={`pt-${idx}`}
                          className={`text-center ${
                            isSelected ? "text-white" : ""
                          }`}
                        >
                          {pt?.score !== undefined ? (
                            <div className="flex flex-col items-center">
                              <span className="font-semibold">{pt.score}</span>
                              <span
                                className={`text-xs ${
                                  isSelected ? "text-white/80" : "text-gray-500"
                                }`}
                              >
                                / {pt.maxScore}
                              </span>
                            </div>
                          ) : (
                            <span
                              className={
                                isSelected ? "text-white/70" : "text-gray-400"
                              }
                            >
                              —
                            </span>
                          )}
                        </TableCell>
                      );
                    })}

                    {quizColumns.map((quizName: string, idx: number) => {
                      const quiz = termData.quizScores?.find(
                        (q: { name: string }) => q.name === quizName
                      );
                      return (
                        <TableCell
                          key={`quiz-${idx}`}
                          className={`text-center ${
                            isSelected ? "text-white" : ""
                          }`}
                        >
                          {quiz?.score !== undefined ? (
                            <div className="flex flex-col items-center">
                              <span className="font-semibold">
                                {quiz.score}
                              </span>
                              <span
                                className={`text-xs ${
                                  isSelected ? "text-white/80" : "text-gray-500"
                                }`}
                              >
                                / {quiz.maxScore}
                              </span>
                            </div>
                          ) : (
                            <span
                              className={
                                isSelected ? "text-white/70" : "text-gray-400"
                              }
                            >
                              —
                            </span>
                          )}
                        </TableCell>
                      );
                    })}

                    {hasExam && (
                      <TableCell
                        className={`text-center ${
                          isSelected ? "text-white" : ""
                        }`}
                      >
                        {termData.examScore?.score !== undefined ? (
                          <div className="flex flex-col items-center">
                            <span className="font-semibold">
                              {termData.examScore.score}
                            </span>
                            <span
                              className={`text-xs ${
                                isSelected ? "text-white/80" : "text-gray-500"
                              }`}
                            >
                              / {termData.examScore.maxScore}
                            </span>
                          </div>
                        ) : (
                          <span
                            className={
                              isSelected ? "text-white/70" : "text-gray-400"
                            }
                          >
                            —
                          </span>
                        )}
                      </TableCell>
                    )}

                    <TableCell
                      className={`text-center ${
                        isSelected ? "text-white" : ""
                      }`}
                    >
                      {(() => {
                        const { totalPercentage } =
                          calculateTermGrade(termData);
                        return (
                          <span
                            className={`font-bold ${
                              isSelected ? "text-white" : "text-[#124A69]"
                            }`}
                          >
                            {totalPercentage !== null
                              ? `${totalPercentage.toFixed(2)}%`
                              : "—"}
                          </span>
                        );
                      })()}
                    </TableCell>

                    <TableCell
                      className={`text-center ${
                        isSelected ? "text-white" : ""
                      }`}
                    >
                      {(() => {
                        const { numericGrade } = calculateTermGrade(termData);
                        return (
                          <span
                            className={`font-bold ${
                              isSelected ? "text-white" : "text-[#124A69]"
                            }`}
                          >
                            {numericGrade !== null
                              ? numericGrade.toFixed(2)
                              : "—"}
                          </span>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={
                    ptColumns.length +
                    quizColumns.length +
                    (hasExam ? 1 : 0) +
                    3
                  }
                  className="text-center py-8 text-gray-500"
                >
                  No students found matching your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
