import React, { useState, useMemo } from "react";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, Download, TrendingUp } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { StudentWithGrades } from "../types/types";
import { StudentAvatar } from "./ui-components";

interface TermGradesTabProps {
  students: StudentWithGrades[];
  termKey: "prelims" | "midterm" | "preFinals" | "finals";
}

export const TermGradesTab = ({ students, termKey }: TermGradesTabProps) => {
  const termName =
    termKey === "preFinals" ? "PRE-FINALS" : termKey.toUpperCase();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 10;

  const hasData = students.some((s) => s.termGrades[termKey]);

  if (!hasData) {
    return (
      <div className="text-center py-12 text-gray-500">
        <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p>No grades available for {termName}</p>
      </div>
    );
  }

  const filteredStudents = students.filter((student) =>
    `${student.lastName} ${student.firstName} ${student.studentId}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const paginatedStudents = filteredStudents.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const sampleTerm = students.find((s) => s.termGrades[termKey])?.termGrades[
    termKey
  ];
  const ptColumns = sampleTerm?.ptScores?.map((pt) => pt.name) || [];
  const quizColumns = sampleTerm?.quizScores?.map((q) => q.name) || [];
  const hasExam = sampleTerm?.examScore !== undefined;

  const handleExport = () => {
    try {
      const ws_data = [
        [`${termName} Grades Export`],
        [""],
        ["Date:", new Date().toLocaleDateString()],
        [""],
        [
          "Student ID",
          "Last Name",
          "First Name",
          ...ptColumns,
          ...quizColumns,
          hasExam ? "Exam" : "",
          "Final %",
          "Grade",
          "Remarks",
        ].filter(Boolean),
        ...filteredStudents
          .map((student) => {
            const termData = student.termGrades[termKey];
            if (!termData) return [];

            return [
              student.studentId,
              student.lastName,
              student.firstName,
              ...ptColumns.map((pt) => {
                const score = termData.ptScores?.find((p) => p.name === pt);
                return score?.score !== undefined
                  ? `${score.score}/${score.maxScore}`
                  : "—";
              }),
              ...quizColumns.map((q) => {
                const score = termData.quizScores?.find(
                  (quiz) => quiz.name === q
                );
                return score?.score !== undefined
                  ? `${score.score}/${score.maxScore}`
                  : "—";
              }),
              ...(hasExam
                ? [
                    termData.examScore?.score !== undefined
                      ? `${termData.examScore.score}/${termData.examScore.maxScore}`
                      : "—",
                  ]
                : []),
              termData.totalPercentage?.toFixed(2) || "—",
              termData.numericGrade?.toFixed(2) || "—",
              termData.remarks || "—",
            ];
          })
          .filter((row) => row.length > 0),
      ];

      const ws = XLSX.utils.aoa_to_sheet(ws_data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, termName);
      XLSX.writeFile(
        wb,
        `${termName}_grades_${new Date().toISOString().split("T")[0]}.xlsx`
      );
      toast.success("Exported successfully");
    } catch (error) {
      toast.error("Export failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-[400px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(0);
            }}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" />
            Export {termName}
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <div className="overflow-x-auto">
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
                <TableHead className="text-center min-w-[100px]">
                  Grade
                </TableHead>
                <TableHead className="text-center min-w-[100px]">
                  Remarks
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedStudents.length > 0 ? (
                paginatedStudents.map((student) => {
                  const termData = student.termGrades[termKey];
                  if (!termData) return null;

                  return (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium sticky left-0 bg-white z-10 border-r">
                        <StudentAvatar student={student} />
                      </TableCell>

                      {ptColumns.map((ptName, idx) => {
                        const pt = termData.ptScores?.find(
                          (p) => p.name === ptName
                        );
                        return (
                          <TableCell key={`pt-${idx}`} className="text-center">
                            {pt?.score !== undefined ? (
                              <div className="flex flex-col items-center">
                                <span className="font-semibold">
                                  {pt.score}
                                </span>
                                <span className="text-xs text-gray-500">
                                  / {pt.maxScore}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
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
                            className="text-center"
                          >
                            {quiz?.score !== undefined ? (
                              <div className="flex flex-col items-center">
                                <span className="font-semibold">
                                  {quiz.score}
                                </span>
                                <span className="text-xs text-gray-500">
                                  / {quiz.maxScore}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                        );
                      })}

                      {hasExam && (
                        <TableCell className="text-center">
                          {termData.examScore?.score !== undefined ? (
                            <div className="flex flex-col items-center">
                              <span className="font-semibold">
                                {termData.examScore.score}
                              </span>
                              <span className="text-xs text-gray-500">
                                / {termData.examScore.maxScore}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                      )}

                      <TableCell className="text-center">
                        <span className="font-bold text-[#124A69]">
                          {termData.totalPercentage?.toFixed(2) || "—"}%
                        </span>
                      </TableCell>

                      <TableCell className="text-center">
                        <span className="font-bold text-[#124A69]">
                          {termData.numericGrade?.toFixed(2) || "—"}
                        </span>
                      </TableCell>

                      <TableCell className="text-center">
                        {termData.remarks && (
                          <Badge
                            className={
                              termData.remarks === "PASSED"
                                ? "bg-green-500 hover:bg-green-600 text-white"
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 w-full">
            Showing {currentPage * itemsPerPage + 1} to{" "}
            {Math.min(
              (currentPage + 1) * itemsPerPage,
              filteredStudents.length
            )}{" "}
            of {filteredStudents.length} students
          </p>
          <Pagination className="justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  className={
                    currentPage === 0
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = i;
                if (totalPages > 5) {
                  if (currentPage > 2) {
                    pageNum = currentPage - 2 + i;
                  }
                  if (pageNum >= totalPages) {
                    pageNum = totalPages - 5 + i;
                  }
                }
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      onClick={() => setCurrentPage(pageNum)}
                      isActive={currentPage === pageNum}
                      className={
                        currentPage === pageNum
                          ? "bg-[#124A69] text-white hover:bg-[#0d3a56]"
                          : "cursor-pointer"
                      }
                    >
                      {pageNum + 1}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              <PaginationItem>
                <PaginationNext
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages - 1, currentPage + 1))
                  }
                  className={
                    currentPage >= totalPages - 1
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};
