"use client";

import React, { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, AlertCircle } from "lucide-react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { useImportStudentsToCourse } from "@/lib/hooks/queries";

const MAX_PREVIEW_ROWS = 100;
const EXPECTED_HEADERS = ["Student Number", "Full Name"];

interface StudentRow {
  "Student Number": string;
  "Full Name": string;
}

interface ImportStatus {
  imported: number;
  skipped: number;
  errors: Array<{ studentNumber: string; message: string }>;
  total: number;
  detailedFeedback: Array<{
    row: number;
    studentNumber: string;
    fullName: string;
    status: string;
    message: string;
  }>;
}

interface ImportProgress {
  current: number;
  total: number;
  status: string;
  error?: string;
  hasError?: boolean;
}

interface StudentImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseSlug: string;
  onImportComplete: () => void;
}

export function StudentImportDialog({
  open,
  onOpenChange,
  courseSlug,
  onImportComplete,
}: StudentImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<StudentRow[]>([]);
  const [isValidFile, setIsValidFile] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(
    null
  );
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);

  // React Query hook
  const importMutation = useImportStudentsToCourse();

  const validateHeaders = (headers: string[]): boolean => {
    const trimmedHeaders = headers.map((h) => h?.toString().trim() || "");
    return EXPECTED_HEADERS.every((expected) =>
      trimmedHeaders.includes(expected)
    );
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        setIsValidFile(false);
        setPreviewData([]);
        return;
      }

      const rows: any[][] = [];
      worksheet.eachRow((row, rowNumber) => {
        rows.push(row.values as any[]);
      });

      if (rows.length < 2) {
        setIsValidFile(false);
        setPreviewData([]);
        return;
      }

      // First row is headers (skip index 0 as it's undefined in ExcelJS)
      const headers = rows[0].slice(1).map((h) => h?.toString().trim() || "");
      const isValid = validateHeaders(headers);
      setIsValidFile(isValid);

      if (isValid) {
        const dataRows = rows.slice(1);
        const formattedData: StudentRow[] = dataRows
          .filter((row) => row && row.length > 1 && row[1])
          .map((row) => ({
            "Student Number": String(row[1] || "").trim(),
            "Full Name": String(row[2] || "").trim(),
          }));

        setPreviewData(formattedData);
      } else {
        setPreviewData([]);
      }
    } catch (error) {
      console.error("Error parsing file:", error);
      setIsValidFile(false);
      setPreviewData([]);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !isValidFile || previewData.length === 0) return;

    setImportProgress({
      current: 0,
      total: previewData.length,
      status: "Starting import...",
    });

    try {
      const result = await importMutation.mutateAsync({
        courseSlug,
        students: previewData,
      });

      setImportStatus(result);
      setImportProgress(null);
      setShowStatusDialog(true);
      onImportComplete();
    } catch (error) {
      console.error("Import error:", error);
      setImportProgress({
        current: 0,
        total: previewData.length,
        status: "Import failed",
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        hasError: true,
      });
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Students");

      // Header row (row 1)
      const headers = ["Student Number", "Full Name"];
      const headerRow = worksheet.addRow(headers);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF124A69" },
      };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.height = 25;

      headerRow.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      // Sample data rows
      const sampleData = [
        ["2021-00001", "Dela Cruz, Juan A."],
        ["2021-00002", "Santos, Maria B."],
        ["2021-00003", "Reyes, Pedro C."],
      ];

      sampleData.forEach((data, index) => {
        const row = worksheet.addRow(data);
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFD3D3D3" } },
            left: { style: "thin", color: { argb: "FFD3D3D3" } },
            bottom: { style: "thin", color: { argb: "FFD3D3D3" } },
            right: { style: "thin", color: { argb: "FFD3D3D3" } },
          };
          cell.alignment = { vertical: "middle" };
        });

        if ((index + 1) % 2 === 0) {
          row.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF9FAFB" },
          };
        }
      });

      // Set column widths
      worksheet.columns = [{ width: 20 }, { width: 30 }];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(blob, "student_import_template.xlsx");
    } catch (error) {
      console.error("Error generating template:", error);
    }
  };
  const resetDialog = () => {
    setSelectedFile(null);
    setPreviewData([]);
    setIsValidFile(false);
    setImportProgress(null);
    setImportStatus(null);
    setShowStatusDialog(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
  };

  return (
    <>
      {/* Import Dialog */}
      <Dialog open={open && !showStatusDialog} onOpenChange={handleClose}>
        <DialogContent
          className={`p-4 sm:p-6 h-auto transition-all ${
            previewData.length > 0
              ? "w-[90vw] max-w-[800px]"
              : "w-[90vw] max-w-[500px]"
          }`}
        >
          <DialogHeader className="w-full">
            <DialogTitle className="text-xl font-semibold text-[#124A69]">
              Import Students
            </DialogTitle>
            <DialogDescription>
              Upload an Excel file (.xlsx) with student information. Only
              students with registered RFID will be added.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-6">
            {/* RFID Warning */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">RFID Required</p>
                <p>
                  Students without RFID registration will be automatically
                  skipped during import.
                </p>
              </div>
            </div>

            {/* File Upload Section */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx"
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 bg-white hover:bg-gray-50"
                disabled={!!importProgress}
              >
                <Upload className="h-4 w-4" />
                Choose File
              </Button>

              {selectedFile && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 truncate max-w-[200px]">
                    {selectedFile.name}
                  </span>
                  <Badge
                    variant={isValidFile ? "default" : "destructive"}
                    className={
                      isValidFile
                        ? "bg-[#124A69] text-white hover:bg-[#0D3A54]"
                        : ""
                    }
                  >
                    {isValidFile ? "Valid" : "Invalid"}
                  </Badge>
                </div>
              )}
            </div>

            {/* Preview Section */}
            {previewData.length > 0 ? (
              <div className="border rounded-lg w-full">
                <div className="bg-gray-50 p-4 border-b">
                  <h3 className="font-medium text-gray-700">
                    Preview Import Data
                  </h3>
                  <p className="text-sm text-gray-500">
                    Showing {Math.min(previewData.length, MAX_PREVIEW_ROWS)} of{" "}
                    {previewData.length}{" "}
                    {previewData.length === 1 ? "student" : "students"}
                  </p>
                </div>
                <div className="max-h-[400px] overflow-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 border-b">
                          #
                        </th>
                        {EXPECTED_HEADERS.map((header) => (
                          <th
                            key={header}
                            className="px-4 py-2 text-left text-xs font-medium text-gray-500 border-b whitespace-nowrap"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData
                        .slice(0, MAX_PREVIEW_ROWS)
                        .map((row, index) => (
                          <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-2 text-xs text-gray-500">
                              {index + 1}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 font-mono">
                              {row["Student Number"]}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {row["Full Name"]}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center p-8 border-2 border-dashed rounded-lg bg-gray-50">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium mb-1">
                  No file selected
                </p>
                <p className="text-sm text-gray-500">
                  Upload an Excel file to preview the data before importing
                </p>
              </div>
            )}

            {/* Import Progress */}
            {importProgress && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  {importProgress.hasError ? (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  ) : (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#124A69]" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {importProgress.status}
                    </p>
                    {importProgress.error && (
                      <p className="text-sm text-red-600 mt-1">
                        {importProgress.error}
                      </p>
                    )}
                    {importProgress.total > 0 && !importProgress.hasError && (
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-[#124A69] h-2.5 rounded-full transition-all duration-300"
                          style={{
                            width: `${
                              (importProgress.current / importProgress.total) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row justify-between gap-3">
              <Button
                variant="outline"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2"
                disabled={!!importProgress}
              >
                <Download className="h-4 w-4" />
                Download Template
              </Button>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  disabled={!!importProgress}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-[#124A69] hover:bg-[#0D3A54] text-white"
                  onClick={handleImport}
                  disabled={!selectedFile || !isValidFile || !!importProgress}
                >
                  {importProgress ? "Importing..." : "Import Students"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent className="w-[90vw] max-w-[800px] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#124A69]">
              Import Status
            </DialogTitle>
            <DialogDescription>
              Summary of the student import process
            </DialogDescription>
          </DialogHeader>

          {importStatus && (
            <div className="mt-6 space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h3 className="text-sm font-medium text-green-800">
                    Successfully Added
                  </h3>
                  <p className="text-2xl font-semibold text-green-600">
                    {importStatus.imported}
                  </p>
                </div>
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                  <h3 className="text-sm font-medium text-amber-800">
                    Skipped (No RFID)
                  </h3>
                  <p className="text-2xl font-semibold text-amber-600">
                    {importStatus.skipped}
                  </p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <h3 className="text-sm font-medium text-red-800">Errors</h3>
                  <p className="text-2xl font-semibold text-red-600">
                    {importStatus.errors.length}
                  </p>
                </div>
              </div>

              {/* Detailed Feedback */}
              {importStatus.detailedFeedback?.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 p-4 border-b">
                    <h3 className="font-medium text-gray-700">
                      Detailed Import Feedback
                    </h3>
                    <p className="text-sm text-gray-500">
                      Status of each student processed during import
                    </p>
                  </div>
                  <div className="max-h-[400px] overflow-auto">
                    <table className="w-full border-collapse">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">
                            Row
                          </th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">
                            Student Number
                          </th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">
                            Full Name
                          </th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">
                            Status
                          </th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">
                            Message
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {importStatus.detailedFeedback.map(
                          (feedback, index) => (
                            <tr
                              key={index}
                              className="border-t hover:bg-gray-50"
                            >
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {feedback.row}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900 font-mono">
                                {feedback.studentNumber}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {feedback.fullName}
                              </td>
                              <td className="px-4 py-2 text-sm font-medium">
                                <Badge
                                  variant={
                                    feedback.status === "imported"
                                      ? "default"
                                      : feedback.status === "skipped"
                                      ? "secondary"
                                      : "destructive"
                                  }
                                  className={
                                    feedback.status === "imported"
                                      ? "bg-green-500 text-white"
                                      : feedback.status === "skipped"
                                      ? "bg-amber-500 text-white"
                                      : ""
                                  }
                                >
                                  {feedback.status.charAt(0).toUpperCase() +
                                    feedback.status.slice(1)}
                                </Badge>
                              </td>
                              <td
                                className={`px-4 py-2 text-sm ${
                                  feedback.status === "error"
                                    ? "text-red-600"
                                    : "text-gray-900"
                                }`}
                              >
                                {feedback.message || "-"}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowStatusDialog(false);
                    handleClose();
                  }}
                >
                  Close
                </Button>
                <Button
                  className="bg-[#124A69] hover:bg-[#0D3A54] text-white"
                  onClick={() => {
                    setShowStatusDialog(false);
                    resetDialog();
                  }}
                >
                  Import More Students
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
