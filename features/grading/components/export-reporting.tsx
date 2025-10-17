import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";

interface ExportReportingProps {
  showExportPreview: boolean;
  setShowExportPreview: (show: boolean) => void;
  exportData: {
    header: string[][];
    studentRows: string[][];
  } | null;
  selectedDate: Date | undefined;
  courseCode: string;
  courseSection: string;
  rubricDetails: {
    name: string;
    percentage: number;
  }[];
}

export function ExportReporting({
  showExportPreview,
  setShowExportPreview,
  exportData,
  selectedDate,
  courseCode,
  courseSection,
  rubricDetails,
}: ExportReportingProps) {
  const handleConfirmExport = () => {
    if (!exportData) return;

    try {
      const { header, studentRows } = exportData;
      const ws = XLSX.utils.aoa_to_sheet([...header, ...studentRows]);

      // Configure column widths
      ws["!cols"] = [
        { wch: 30 }, // Student Name
        ...rubricDetails.map(() => ({ wch: 15 })), // Rubric scores
        { wch: 15 }, // Total Grade
        { wch: 15 }, // Remarks
      ];

      // Style configurations
      const headerStyle = {
        fill: { fgColor: { rgb: "124A69" } }, // Dark blue background
        font: { color: { rgb: "FFFFFF" }, bold: true }, // White bold text
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
      };

      const subHeaderStyle = {
        fill: { fgColor: { rgb: "F5F6FA" } }, // Light gray background
        font: { bold: true },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
      };

      const cellStyle = {
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
      };

      // Apply styles to cells
      const range = XLSX.utils.decode_range(ws["!ref"] || "A1");

      // Style the title row
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: C });
        if (!ws[cellRef]) ws[cellRef] = { v: "" };
        ws[cellRef].s = headerStyle;
      }

      // Style the subheader row (column headers)
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: 5, c: C });
        if (!ws[cellRef]) ws[cellRef] = { v: "" };
        ws[cellRef].s = subHeaderStyle;
      }

      // Style all other cells
      for (let R = 6; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[cellRef]) ws[cellRef] = { v: "" };

          // Special styling for remarks column
          if (C === range.e.c) {
            const value = ws[cellRef].v;
            if (value === "PASSED") {
              ws[cellRef].s = {
                ...cellStyle,
                font: { color: { rgb: "008000" }, bold: true }, // Green for PASSED
              };
            } else if (value === "FAILED") {
              ws[cellRef].s = {
                ...cellStyle,
                font: { color: { rgb: "FF0000" }, bold: true }, // Red for FAILED
              };
            } else {
              ws[cellRef].s = cellStyle;
            }
          } else {
            ws[cellRef].s = cellStyle;
          }
        }
      }

      // Merge cells for title and info rows
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: range.e.c } }, // Title row
        { s: { r: 1, c: 0 }, e: { r: 1, c: range.e.c } }, // Empty row
        { s: { r: 2, c: 1 }, e: { r: 2, c: range.e.c } }, // Date row
        { s: { r: 3, c: 1 }, e: { r: 3, c: range.e.c } }, // Report name row
        { s: { r: 4, c: 0 }, e: { r: 4, c: range.e.c } }, // Empty row
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Grades");

      // Generate filename with date
      const formattedDate = selectedDate?.toISOString().split("T")[0];
      const filename = `${courseCode}-${courseSection}-${formattedDate}-grades.xlsx`;
      XLSX.writeFile(wb, filename);

      setShowExportPreview(false);
      toast.success("Grades exported successfully", {
        duration: 3000,
        style: {
          background: "#fff",
          color: "#124A69",
          border: "1px solid #e5e7eb",
        },
      });
    } catch (error) {
      console.error("Error exporting grades:", error);
      toast.error("Failed to export grades", {
        duration: 3000,
        style: {
          background: "#fff",
          color: "#dc2626",
          border: "1px solid #e5e7eb",
        },
      });
    }
  };

  return (
    <Dialog open={showExportPreview} onOpenChange={setShowExportPreview}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#124A69] text-xl font-bold">
            Export Preview
          </DialogTitle>
          <DialogDescription className="text-gray-500">
            Preview how your grades will look in the Excel file
          </DialogDescription>
        </DialogHeader>

        {exportData && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse">
              <tbody>
                {exportData.header.map((row, rowIndex) => (
                  <tr key={`header-${rowIndex}`}>
                    {row.map((cell, cellIndex) => (
                      <td
                        key={`header-cell-${cellIndex}`}
                        className={`border border-gray-200 p-2 ${
                          rowIndex === 0
                            ? "bg-[#124A69] text-white text-center font-bold"
                            : rowIndex === 5
                            ? "bg-gray-100 font-medium"
                            : ""
                        }`}
                        colSpan={
                          rowIndex === 0 ? exportData.header[5].length : 1
                        }
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
                {exportData.studentRows.map((row, rowIndex) => (
                  <tr key={`student-${rowIndex}`}>
                    {row.map((cell, cellIndex) => (
                      <td
                        key={`student-cell-${cellIndex}`}
                        className={`border border-gray-200 p-2 ${
                          cellIndex === row.length - 1
                            ? cell === "PASSED"
                              ? "text-green-600 font-medium"
                              : cell === "FAILED"
                              ? "text-red-600 font-medium"
                              : ""
                            : ""
                        }`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => setShowExportPreview(false)}
            className="border-gray-200"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmExport}
            className="bg-[#124A69] hover:bg-[#0d3a56] text-white"
          >
            Export to Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
