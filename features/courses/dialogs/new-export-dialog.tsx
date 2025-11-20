import React, { useState, useMemo, useEffect } from "react";
import { Download, FileSpreadsheet, CalendarIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { StudentWithGrades, CourseInfo } from "../types/types";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: StudentWithGrades[];
  courseInfo: CourseInfo;
}

export const ExportDialog = ({
  open,
  onOpenChange,
  students,
  courseInfo,
}: ExportDialogProps) => {
  const [exportOptions, setExportOptions] = useState({
    // Basic Info
    studentId: true,
    fullName: true,
    // Terms with detailed scores
    prelimsDetailed: false,
    midtermDetailed: false,
    preFinalsDetailed: false,
    finalsDetailed: false,
    // Terms summary only
    prelimsSummary: false,
    midtermSummary: false,
    preFinalsSummary: false,
    finalsSummary: false,
  });
  const [selectedAttendanceDates, setSelectedAttendanceDates] = useState<
    Date[]
  >([]);
  const [exportAllAttendance, setExportAllAttendance] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Get all unique attendance dates from all students
  const attendanceDates = useMemo(() => {
    const dateSet = new Set<string>();
    students.forEach((student) => {
      student.attendanceRecords?.forEach((record) => {
        dateSet.add(record.date);
      });
    });
    return Array.from(dateSet)
      .map((dateStr) => new Date(dateStr))
      .sort((a, b) => a.getTime() - b.getTime());
  }, [students]);

  // When exportAllAttendance is checked, select all dates
  useEffect(() => {
    if (exportAllAttendance) {
      setSelectedAttendanceDates([...attendanceDates]);
    } else {
      setSelectedAttendanceDates([]);
    }
  }, [exportAllAttendance, attendanceDates]);

  const toggleExportOption = (key: keyof typeof exportOptions) => {
    setExportOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const selectAllBasicInfo = () => {
    setExportOptions((prev) => ({
      ...prev,
      studentId: true,
      fullName: true,
    }));
  };

  const selectAllDetailed = () => {
    setExportOptions((prev) => ({
      ...prev,
      prelimsDetailed: true,
      midtermDetailed: true,
      preFinalsDetailed: true,
      finalsDetailed: true,
    }));
  };

  const selectAllSummary = () => {
    setExportOptions((prev) => ({
      ...prev,
      prelimsSummary: true,
      midtermSummary: true,
      preFinalsSummary: true,
      finalsSummary: true,
    }));
  };

  const handleExport = async () => {
    if (!courseInfo) return;
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Student Grades");

      // Larger, more readable fonts throughout
      const titleFontSize = 18;
      const headerFontSize = 13;
      const subHeaderFontSize = 11;
      const dataFontSize = 11;

      // Title section - merged and centered
      worksheet.mergeCells("A1:F1");
      const titleRow = worksheet.getCell("A1");
      titleRow.value = `${courseInfo.code} - ${courseInfo.title}`;
      titleRow.font = {
        bold: true,
        size: titleFontSize,
        color: { argb: "FFFFFFFF" },
        name: "Arial",
      };
      titleRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF124A69" },
      };
      titleRow.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(1).height = 35;

      // Course info row
      worksheet.mergeCells("A2:F2");
      const infoRow = worksheet.getCell("A2");
      infoRow.value = `Section ${courseInfo.section} • Room ${courseInfo.room} • ${courseInfo.semester} • ${courseInfo.academicYear}`;
      infoRow.font = {
        size: subHeaderFontSize,
        color: { argb: "FF333333" },
        name: "Arial",
      };
      infoRow.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(2).height = 25;

      // Export date and info
      worksheet.mergeCells("A3:F3");
      const dateRow = worksheet.getCell("A3");
      dateRow.value = `Generated: ${new Date().toLocaleString()} | Total Students: ${
        students.length
      }`;
      dateRow.font = {
        italic: true,
        size: 10,
        color: { argb: "FF666666" },
        name: "Arial",
      };
      dateRow.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(3).height = 20;

      // Empty row for spacing
      worksheet.addRow([]);

      // Track current column
      let currentCol = 1;
      const headerCells: ExcelJS.Cell[] = [];
      const columnInfo: Array<{ col: number; width: number; type: string }> =
        [];

      // Helper to add a column
      const addColumn = (
        headerText: string,
        width: number,
        type: string = "text"
      ) => {
        const cell = worksheet.getCell(5, currentCol);
        cell.value = headerText;
        headerCells.push(cell);
        columnInfo.push({ col: currentCol, width, type });
        currentCol++;
      };

      // Basic Information columns
      if (exportOptions.studentId) addColumn("STUDENT ID", 16, "id");
      if (exportOptions.fullName) addColumn("FULL NAME", 35, "name");

      // Attendance columns for selected dates
      const datesToExport = exportAllAttendance
        ? attendanceDates
        : selectedAttendanceDates;
      datesToExport.forEach((date) => {
        addColumn(format(date, "MMM d, yyyy"), 14, "attendance");
      });

      // Helper to add term columns with visual grouping
      const addTermColumns = (
        termKey: "prelims" | "midterm" | "preFinals" | "finals",
        termName: string,
        detailed: boolean,
        summary: boolean
      ) => {
        if (!detailed && !summary) return;

        const sampleTerm = students.find((s) => s.termGrades[termKey])
          ?.termGrades[termKey];
        if (!sampleTerm) return;

        const startCol = currentCol;

        if (detailed) {
          // Performance Tasks with clear labeling
          sampleTerm.ptScores?.forEach((pt, idx) => {
            addColumn(`${termName.toUpperCase()}\n${pt.name}`, 14, "score");
          });

          // Quizzes with clear labeling
          sampleTerm.quizScores?.forEach((quiz, idx) => {
            addColumn(`${termName.toUpperCase()}\n${quiz.name}`, 14, "score");
          });

          // Exam with clear labeling
          if (sampleTerm.examScore !== undefined) {
            addColumn(`${termName.toUpperCase()}\nEXAM`, 14, "score");
          }
        }

        if (summary) {
          addColumn(`${termName.toUpperCase()}\nFinal %`, 13, "percentage");
          addColumn(`${termName.toUpperCase()}\nGrade`, 12, "grade");
          addColumn(`${termName.toUpperCase()}\nRemarks`, 14, "remarks");
        }

        // If we added columns for this term, mark the range for grouping
        if (currentCol > startCol) {
          // We'll use this info later for visual grouping
          const endCol = currentCol - 1;
          // Store term range for potential grouping
        }
      };

      // Add all term columns
      addTermColumns(
        "prelims",
        "Prelims",
        exportOptions.prelimsDetailed,
        exportOptions.prelimsSummary
      );
      addTermColumns(
        "midterm",
        "Midterm",
        exportOptions.midtermDetailed,
        exportOptions.midtermSummary
      );
      addTermColumns(
        "preFinals",
        "Pre-Finals",
        exportOptions.preFinalsDetailed,
        exportOptions.preFinalsSummary
      );
      addTermColumns(
        "finals",
        "Finals",
        exportOptions.finalsDetailed,
        exportOptions.finalsSummary
      );

      // Style all header cells with larger font and better contrast
      headerCells.forEach((cell) => {
        cell.font = {
          bold: true,
          color: { argb: "FFFFFFFF" },
          size: headerFontSize,
          name: "Arial",
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF124A69" },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: true,
        };
        cell.border = {
          top: { style: "medium", color: { argb: "FF124A69" } },
          left: { style: "medium", color: { argb: "FFFFFFFF" } },
          bottom: { style: "medium", color: { argb: "FF124A69" } },
          right: { style: "medium", color: { argb: "FFFFFFFF" } },
        };
      });

      worksheet.getRow(5).height = 40; // Taller header row

      // Set column widths
      columnInfo.forEach(({ col, width }) => {
        worksheet.getColumn(col).width = width;
      });

      // Sort students alphabetically by last name, then first name (case-insensitive)
      const sortedStudents = [...students].sort((a, b) => {
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

      // Add student data rows
      sortedStudents.forEach((student, index) => {
        const rowNum = 6 + index;
        let col = 1;

        // Basic Info
        if (exportOptions.studentId) {
          const cell = worksheet.getCell(rowNum, col++);
          cell.value = student.studentId;
          cell.font = { size: dataFontSize, name: "Courier New", bold: true };
        }
        if (exportOptions.fullName) {
          const cell = worksheet.getCell(rowNum, col++);
          const fullName = `${student.lastName.toUpperCase()}, ${
            student.firstName
          }${student.middleInitial ? ` ${student.middleInitial}.` : ""}`;
          cell.value = fullName;
          cell.font = { size: dataFontSize, name: "Arial", bold: true };
        }

        // Attendance columns for selected dates
        const datesToExport = exportAllAttendance
          ? attendanceDates
          : selectedAttendanceDates;
        datesToExport.forEach((date) => {
          // Match date in various formats
          const dateStr = format(date, "yyyy-MM-dd");
          const record = student.attendanceRecords?.find((r) => {
            const recordDate = new Date(r.date);
            return (
              recordDate.getFullYear() === date.getFullYear() &&
              recordDate.getMonth() === date.getMonth() &&
              recordDate.getDate() === date.getDate()
            );
          });
          const cell = worksheet.getCell(rowNum, col++);

          if (record) {
            cell.value = record.status;
            cell.font = {
              size: dataFontSize,
              name: "Arial",
              bold: true,
            };
            cell.alignment = { horizontal: "center" };

            // Color coding for attendance status
            if (record.status === "PRESENT") {
              cell.font = { ...cell.font, color: { argb: "FF059669" } }; // Green
            } else if (record.status === "LATE") {
              cell.font = { ...cell.font, color: { argb: "FFD97706" } }; // Orange
            } else {
              cell.font = { ...cell.font, color: { argb: "FFDC2626" } }; // Red
            }
          } else {
            cell.value = "—";
            cell.font = {
              size: dataFontSize,
              name: "Arial",
              color: { argb: "FF999999" },
            };
            cell.alignment = { horizontal: "center" };
          }
        });

        // Helper function to add term data
        const addTermData = (
          termKey: "prelims" | "midterm" | "preFinals" | "finals",
          detailed: boolean,
          summary: boolean
        ) => {
          if (!detailed && !summary) return;

          const termData = student.termGrades[termKey];
          const sampleTerm = students.find((s) => s.termGrades[termKey])
            ?.termGrades[termKey];

          if (!sampleTerm) return;

          if (detailed) {
            // PT scores with clear formatting
            sampleTerm.ptScores?.forEach((ptTemplate) => {
              const pt = termData?.ptScores?.find(
                (p) => p.name === ptTemplate.name
              );
              const cell = worksheet.getCell(rowNum, col++);

              if (pt?.score !== undefined) {
                cell.value = `${pt.score} / ${pt.maxScore}`;
                cell.font = { size: dataFontSize + 1, name: "Arial" };
                cell.alignment = { horizontal: "center" };

                // Color code based on percentage
                const percentage = (pt.score / pt.maxScore) * 100;
                if (percentage >= 90) {
                  cell.font = {
                    ...cell.font,
                    bold: true,
                    color: { argb: "FF059669" },
                  };
                } else if (percentage >= 75) {
                  cell.font = { ...cell.font, color: { argb: "FF333333" } };
                } else if (percentage >= 60) {
                  cell.font = { ...cell.font, color: { argb: "FFD97706" } };
                } else {
                  cell.font = { ...cell.font, color: { argb: "FFDC2626" } };
                }
              } else {
                cell.value = "—";
                cell.font = {
                  size: dataFontSize,
                  name: "Arial",
                  color: { argb: "FF999999" },
                };
                cell.alignment = { horizontal: "center" };
              }
            });

            // Quiz scores
            sampleTerm.quizScores?.forEach((quizTemplate) => {
              const quiz = termData?.quizScores?.find(
                (q) => q.name === quizTemplate.name
              );
              const cell = worksheet.getCell(rowNum, col++);

              if (quiz?.score !== undefined) {
                cell.value = `${quiz.score} / ${quiz.maxScore}`;
                cell.font = { size: dataFontSize + 1, name: "Arial" };
                cell.alignment = { horizontal: "center" };

                // Color code based on percentage
                const percentage = (quiz.score / quiz.maxScore) * 100;
                if (percentage >= 90) {
                  cell.font = {
                    ...cell.font,
                    bold: true,
                    color: { argb: "FF059669" },
                  };
                } else if (percentage >= 75) {
                  cell.font = { ...cell.font, color: { argb: "FF333333" } };
                } else if (percentage >= 60) {
                  cell.font = { ...cell.font, color: { argb: "FFD97706" } };
                } else {
                  cell.font = { ...cell.font, color: { argb: "FFDC2626" } };
                }
              } else {
                cell.value = "—";
                cell.font = {
                  size: dataFontSize,
                  name: "Arial",
                  color: { argb: "FF999999" },
                };
                cell.alignment = { horizontal: "center" };
              }
            });

            // Exam score
            if (sampleTerm.examScore !== undefined) {
              const cell = worksheet.getCell(rowNum, col++);

              if (termData?.examScore?.score !== undefined) {
                cell.value = `${termData.examScore.score} / ${termData.examScore.maxScore}`;
                cell.font = {
                  size: dataFontSize + 1,
                  name: "Arial",
                  bold: true,
                };
                cell.alignment = { horizontal: "center" };

                // Color code exam scores
                const percentage =
                  (termData.examScore.score / termData.examScore.maxScore) *
                  100;
                if (percentage >= 90) {
                  cell.font = { ...cell.font, color: { argb: "FF059669" } };
                } else if (percentage >= 75) {
                  cell.font = { ...cell.font, color: { argb: "FF333333" } };
                } else if (percentage >= 60) {
                  cell.font = { ...cell.font, color: { argb: "FFD97706" } };
                } else {
                  cell.font = { ...cell.font, color: { argb: "FFDC2626" } };
                }
              } else {
                cell.value = "—";
                cell.font = {
                  size: dataFontSize,
                  name: "Arial",
                  color: { argb: "FF999999" },
                };
                cell.alignment = { horizontal: "center" };
              }
            }
          }

          if (summary) {
            // Final percentage
            const percentCell = worksheet.getCell(rowNum, col++);
            if (termData?.totalPercentage) {
              percentCell.value = termData.totalPercentage / 100;
              percentCell.numFmt = "0.00%";
              percentCell.font = {
                size: dataFontSize + 1,
                name: "Arial",
                bold: true,
              };
              percentCell.alignment = { horizontal: "center" };
            } else {
              percentCell.value = "—";
              percentCell.font = {
                size: dataFontSize,
                name: "Arial",
                color: { argb: "FF999999" },
              };
              percentCell.alignment = { horizontal: "center" };
            }

            // Numeric grade
            const gradeCell = worksheet.getCell(rowNum, col++);
            if (termData?.numericGrade) {
              gradeCell.value = termData.numericGrade;
              gradeCell.numFmt = "0.00";
              gradeCell.font = {
                size: dataFontSize + 2,
                name: "Arial",
                bold: true,
                color: { argb: "FF124A69" },
              };
              gradeCell.alignment = { horizontal: "center" };
            } else {
              gradeCell.value = "—";
              gradeCell.font = {
                size: dataFontSize,
                name: "Arial",
                color: { argb: "FF999999" },
              };
              gradeCell.alignment = { horizontal: "center" };
            }

            // Remarks with color coding
            const remarksCell = worksheet.getCell(rowNum, col++);
            if (termData?.remarks) {
              remarksCell.value = termData.remarks;
              remarksCell.font = {
                size: dataFontSize + 1,
                name: "Arial",
                bold: true,
                color:
                  termData.remarks === "PASSED"
                    ? { argb: "FF059669" }
                    : { argb: "FFDC2626" },
              };
              remarksCell.alignment = { horizontal: "center" };

              // Add background color for better visibility
              remarksCell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor:
                  termData.remarks === "PASSED"
                    ? { argb: "FFD1FAE5" } // Light green
                    : { argb: "FFFECACA" }, // Light red
              };
            } else {
              remarksCell.value = "—";
              remarksCell.font = {
                size: dataFontSize,
                name: "Arial",
                color: { argb: "FF999999" },
              };
              remarksCell.alignment = { horizontal: "center" };
            }
          }
        };

        // Add term data based on selections
        addTermData(
          "prelims",
          exportOptions.prelimsDetailed,
          exportOptions.prelimsSummary
        );
        addTermData(
          "midterm",
          exportOptions.midtermDetailed,
          exportOptions.midtermSummary
        );
        addTermData(
          "preFinals",
          exportOptions.preFinalsDetailed,
          exportOptions.preFinalsSummary
        );
        addTermData(
          "finals",
          exportOptions.finalsDetailed,
          exportOptions.finalsSummary
        );

        // Style the entire row
        const row = worksheet.getRow(rowNum);
        row.height = 28; // Taller rows for better readability
        row.alignment = { vertical: "middle" };

        // Alternating row colors for easier reading
        if (index % 2 === 1) {
          for (let c = 1; c < col; c++) {
            const cell = worksheet.getCell(rowNum, c);
            const currentFill = cell.fill as any;
            if (
              !cell.fill ||
              !currentFill.fgColor ||
              currentFill.fgColor?.argb === "FFFFFFFF"
            ) {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFF8FAFC" },
              };
            }
          }
        }

        // Add borders to all cells in the row
        for (let c = 1; c < col; c++) {
          const cell = worksheet.getCell(rowNum, c);
          cell.border = {
            top: { style: "thin", color: { argb: "FFE5E7EB" } },
            left: { style: "thin", color: { argb: "FFE5E7EB" } },
            bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
            right: { style: "thin", color: { argb: "FFE5E7EB" } },
          };
        }
      });

      // Freeze panes - keep headers visible when scrolling
      worksheet.views = [
        { state: "frozen", xSplit: exportOptions.studentId ? 1 : 0, ySplit: 5 },
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const filename = `${courseInfo.code}_GradeSheet_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      saveAs(blob, filename);

      toast.success(
        `Successfully exported ${students.length} students with enhanced formatting!`
      );
      onOpenChange(false);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Export failed");
    }
  };

  const CheckboxItem = ({
    id,
    checked,
    label,
  }: {
    id: keyof typeof exportOptions;
    checked: boolean;
    label: string;
  }) => (
    <div
      onClick={() => toggleExportOption(id)}
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer group"
    >
      <div className="relative">
        {checked ? (
          <div className="w-5 h-5 bg-[#124A69] rounded flex items-center justify-center">
            <svg
              className="w-3 h-3 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        ) : (
          <div className="w-5 h-5 border-2 border-gray-300 rounded group-hover:border-gray-400"></div>
        )}
      </div>
      <label className="text-sm font-medium text-gray-700 cursor-pointer select-none">
        {label}
      </label>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle></DialogTitle>
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#124A69] to-[#1a6a94] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 backdrop-blur-sm p-2 rounded-lg">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                Export Student Data
              </h2>
              <p className="text-blue-100 text-sm mt-0.5">
                Select the fields to include in your export
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(90vh-180px)] overflow-y-auto">
          {/* Basic Information Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base text-gray-800 flex items-center gap-2">
                <div className="w-1 h-5 bg-[#124A69] rounded-full"></div>
                Basic Information
              </h3>
              <button
                onClick={selectAllBasicInfo}
                className="text-xs font-medium text-[#124A69] hover:text-[#0D3A54] px-3 py-1.5 rounded-md hover:bg-blue-50 transition-colors"
              >
                Select All
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <CheckboxItem
                id="studentId"
                checked={exportOptions.studentId}
                label="Student ID"
              />
              <CheckboxItem
                id="fullName"
                checked={exportOptions.fullName}
                label="Full Name"
              />
            </div>
          </div>

          <div className="border-t border-gray-200"></div>

          {/* Attendance Section */}
          <div className="space-y-3">
            <h3 className="font-semibold text-base text-gray-800 flex items-center gap-2 mb-4">
              <div className="w-1 h-5 bg-[#124A69] rounded-full"></div>
              Attendance by Day
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer group">
                <Checkbox
                  checked={exportAllAttendance}
                  onCheckedChange={(checked) =>
                    setExportAllAttendance(checked === true)
                  }
                />
                <label className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                  Export All Attendance Dates
                </label>
              </div>
              {!exportAllAttendance && (
                <div className="space-y-2">
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="rounded-full h-10 pl-3 pr-2 flex items-center gap-2 w-full justify-between"
                      >
                        <span className="truncate">
                          {selectedAttendanceDates.length > 0
                            ? `${selectedAttendanceDates.length} date${
                                selectedAttendanceDates.length > 1 ? "s" : ""
                              } selected`
                            : "Select attendance dates"}
                        </span>
                        <CalendarIcon className="h-4 w-4 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0"
                      align="start"
                      side="bottom"
                      sideOffset={8}
                    >
                      <div className="[&_button.rdp-day]:transition-colors [&_button.rdp-day]:duration-200 [&_button.rdp-day:hover]:bg-[#124A69]/10 [&_button.rdp-day:focus]:bg-[#124A69]/10">
                        <Calendar
                          mode="multiple"
                          selected={selectedAttendanceDates}
                          onSelect={(dates) => {
                            if (dates) {
                              setSelectedAttendanceDates(dates);
                            }
                          }}
                          disabled={(date) => {
                            // Only allow selecting dates that have attendance data
                            return !attendanceDates.some(
                              (attDate) =>
                                attDate.getFullYear() === date.getFullYear() &&
                                attDate.getMonth() === date.getMonth() &&
                                attDate.getDate() === date.getDate()
                            );
                          }}
                          modifiers={{
                            hasAttendance: (date) =>
                              attendanceDates.some(
                                (attDate) =>
                                  attDate.getFullYear() ===
                                    date.getFullYear() &&
                                  attDate.getMonth() === date.getMonth() &&
                                  attDate.getDate() === date.getDate()
                              ),
                          }}
                          modifiersStyles={{
                            hasAttendance: {
                              border: "1px solid #124A69",
                              color: "#000000",
                              borderRadius: "50%",
                            },
                            selected: {
                              backgroundColor: "#124A69",
                              color: "#ffffff",
                            },
                          }}
                          modifiersClassNames={{
                            selected:
                              "bg-[#124A69] text-white hover:bg-[#124A69] focus:bg-[#124A69]",
                            hasAttendance:
                              "border border-[#124A69] rounded-full text-black",
                          }}
                          initialFocus
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                  {selectedAttendanceDates.length > 0 && (
                    <div className="text-xs text-gray-500 mt-2">
                      Selected:{" "}
                      {selectedAttendanceDates
                        .sort((a, b) => a.getTime() - b.getTime())
                        .map((date) => format(date, "MMM d"))
                        .join(", ")}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-gray-200"></div>

          {/* Detailed Term Grades Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base text-gray-800 flex items-center gap-2">
                <div className="w-1 h-5 bg-[#124A69] rounded-full"></div>
                Detailed Grades (PTs, Quizzes, Exam)
              </h3>
              <button
                onClick={selectAllDetailed}
                className="text-xs font-medium text-[#124A69] hover:text-[#0D3A54] px-3 py-1.5 rounded-md hover:bg-blue-50 transition-colors"
              >
                Select All
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <CheckboxItem
                id="prelimsDetailed"
                checked={exportOptions.prelimsDetailed}
                label="Prelims (Detailed)"
              />
              <CheckboxItem
                id="midtermDetailed"
                checked={exportOptions.midtermDetailed}
                label="Midterm (Detailed)"
              />
              <CheckboxItem
                id="preFinalsDetailed"
                checked={exportOptions.preFinalsDetailed}
                label="Pre-Finals (Detailed)"
              />
              <CheckboxItem
                id="finalsDetailed"
                checked={exportOptions.finalsDetailed}
                label="Finals (Detailed)"
              />
            </div>
          </div>

          <div className="border-t border-gray-200"></div>

          {/* Summary Grades Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base text-gray-800 flex items-center gap-2">
                <div className="w-1 h-5 bg-[#124A69] rounded-full"></div>
                Summary Grades (Final %, Grade, Remarks)
              </h3>
              <button
                onClick={selectAllSummary}
                className="text-xs font-medium text-[#124A69] hover:text-[#0D3A54] px-3 py-1.5 rounded-md hover:bg-blue-50 transition-colors"
              >
                Select All
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <CheckboxItem
                id="prelimsSummary"
                checked={exportOptions.prelimsSummary}
                label="Prelims (Summary)"
              />
              <CheckboxItem
                id="midtermSummary"
                checked={exportOptions.midtermSummary}
                label="Midterm (Summary)"
              />
              <CheckboxItem
                id="preFinalsSummary"
                checked={exportOptions.preFinalsSummary}
                label="Pre-Finals (Summary)"
              />
              <CheckboxItem
                id="finalsSummary"
                checked={exportOptions.finalsSummary}
                label="Finals (Summary)"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {Object.values(exportOptions).filter(Boolean).length +
              (exportAllAttendance
                ? attendanceDates.length
                : selectedAttendanceDates.length)}{" "}
            fields selected
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              className="bg-[#124A69] hover:bg-[#0D3A54] shadow-sm hover:shadow-md"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
