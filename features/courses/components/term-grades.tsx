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
import { Search, Download, TrendingUp } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { StudentWithGrades } from "../types/types";
import { StudentAvatar } from "./ui-components";

interface TermGradesTabProps {
  students: StudentWithGrades[];
  termKey: "prelims" | "midterm" | "preFinals" | "finals";
  globalSearchQuery?: string; // Add this prop
}

export const TermGradesTab = ({
  students,
  termKey,
  globalSearchQuery = "", // Default to empty string
}: TermGradesTabProps) => {
  const termName =
    termKey === "preFinals" ? "PRE-FINALS" : termKey.toUpperCase();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Sync local search with global search
  useEffect(() => {
    setSearchQuery(globalSearchQuery);
  }, [globalSearchQuery]);

  const hasData = students.some((s) => s.termGrades[termKey]);

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
    .filter((student) =>
      `${student.lastName} ${student.firstName} ${student.studentId}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
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

  const sampleTerm = students.find((s) => s.termGrades[termKey])?.termGrades[
    termKey
  ];
  const ptColumns = sampleTerm?.ptScores?.map((pt) => pt.name) || [];
  const quizColumns = sampleTerm?.quizScores?.map((q) => q.name) || [];
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
              {ptColumns.map((pt, idx) => (
                <TableHead
                  key={`pt-${idx}`}
                  className="text-center min-w-[100px]"
                >
                  {pt}
                </TableHead>
              ))}
              {quizColumns.map((quiz, idx) => (
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
              <TableHead className="text-center min-w-[100px]">
                Remarks
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.length > 0 ? (
              filteredStudents.map((student) => {
                const termData = student.termGrades[termKey];
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

                    {ptColumns.map((ptName, idx) => {
                      const pt = termData.ptScores?.find(
                        (p) => p.name === ptName
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

                    {quizColumns.map((quizName, idx) => {
                      const quiz = termData.quizScores?.find(
                        (q) => q.name === quizName
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
                      <span
                        className={`font-bold ${
                          isSelected ? "text-white" : "text-[#124A69]"
                        }`}
                      >
                        {termData.totalPercentage?.toFixed(2) || "—"}%
                      </span>
                    </TableCell>

                    <TableCell
                      className={`text-center ${
                        isSelected ? "text-white" : ""
                      }`}
                    >
                      <span
                        className={`font-bold ${
                          isSelected ? "text-white" : "text-[#124A69]"
                        }`}
                      >
                        {termData.numericGrade?.toFixed(2) || "—"}
                      </span>
                    </TableCell>

                    <TableCell className="text-center">
                      {termData.remarks && (
                        <Badge
                          className={
                            termData.remarks === "PASSED"
                              ? isSelected
                                ? "bg-green-400 hover:bg-green-500 text-white"
                                : "bg-green-500 hover:bg-green-600 text-white"
                              : isSelected
                              ? "bg-red-400 hover:bg-red-500 text-white"
                              : "bg-red-500 hover:bg-red-600 text-white"
                          }
                        >
                          {termData.remarks}
                        </Badge>
                      )}
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
                    4
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
