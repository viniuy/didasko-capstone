"use client";

import React, { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/svdialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Download } from "lucide-react";

const MAX_PREVIEW_ROWS = 100;
const EXPECTED_HEADERS = [
  "Course Abbreviation",
  "Course Title",
  "Room",
  "Semester",
  "Academic Year",
  "Class Number",
  "Section",
  "Status",
];

interface CsvRow {
  "Course Abbreviation": string;
  "Course Title": string;
  Room: string;
  Semester: string;
  "Academic Year": string;
  "Class Number": string;
  Section: string;
  Status: string;
}

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewData: CsvRow[];
  selectedFile: File | null;
  isValidFile: boolean;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onImport: () => void;
  onDownloadTemplate: () => void;
  importProgress: {
    current: number;
    total: number;
    status: string;
  } | null;
  importedRows?: Set<number>; // Track which rows were successfully imported
}

export function ImportDialog({
  open,
  onOpenChange,
  previewData,
  selectedFile,
  isValidFile,
  onFileChange,
  onImport,
  onDownloadTemplate,
  importProgress,
  importedRows = new Set(),
}: ImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!importProgress && !selectedFile) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (importProgress || selectedFile) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      // Validate file type
      const extension = file.name.toLowerCase().split(".").pop();
      if (extension !== "xlsx") {
        return;
      }
      // Create a synthetic event to trigger onFileChange
      const syntheticEvent = {
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      onFileChange(syntheticEvent);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`p-4 sm:p-6 h-auto transition-all ${
          previewData.length > 0
            ? "w-[90vw] max-w-[1200px]"
            : "w-[90vw] max-w-[500px]"
        }`}
      >
        <DialogHeader className="w-full">
          <DialogTitle className="text-xl font-semibold text-[#124A69]">
            Import Courses
          </DialogTitle>
          <DialogDescription>
            Upload an Excel file (.xlsx) to import courses. Download the
            template to get started.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-6">
          {/* File Upload Section */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={onFileChange}
              accept=".xlsx"
              className="hidden"
            />

          {/* Drag and Drop Zone - Hidden when file is selected */}
          {!selectedFile && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !importProgress && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 transition-all ${
                isDragging
                  ? "border-[#124A69] bg-[#124A69]/5"
                  : "border-gray-300 bg-gray-50 hover:border-[#124A69]/50 hover:bg-gray-100/50"
              } ${
                importProgress
                  ? "opacity-50 pointer-events-none"
                  : "cursor-pointer"
              }`}
            >
              <div className="flex flex-col items-center justify-center gap-3 text-center">
                <Upload
                  className={`h-10 w-10 ${
                    isDragging ? "text-[#124A69]" : "text-gray-400"
                  }`}
                />
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {isDragging
                      ? "Drop file here"
                      : "Drag and drop your Excel file here"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    or{" "}
                    <span className="text-[#124A69] font-medium underline">
                      click to browse
                    </span>
                  </p>
                </div>
                <p className="text-xs text-gray-400">
                  Only .xlsx files are supported
                </p>
              </div>
            </div>
          )}

          {/* Selected File Info */}
            {selectedFile && (
            <div className="flex items-center gap-2 p-3 bg-white border rounded-lg">
              <Upload className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-700 truncate flex-1">
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
                  {previewData.length === 1 ? "row" : "rows"}
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
                      .map((row, index) => {
                        const isImported = importedRows.has(index);
                        return (
                          <tr
                            key={index}
                            className={`border-b hover:bg-gray-50 ${
                              isImported ? "bg-green-50 hover:bg-green-100" : ""
                            }`}
                          >
                          <td className="px-4 py-2 text-xs text-gray-500">
                            {index + 1}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                              {row["Course Abbreviation"]}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 max-w-[200px] truncate">
                            {row["Course Title"]}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {row["Room"]}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {row["Semester"]}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {row["Academic Year"]}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {row["Class Number"]}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {row["Section"]}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {row["Status"]}
                          </td>
                        </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* Import Progress */}
          {importProgress && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#124A69]" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {importProgress.status}
                  </p>
                  <p className="text-xs text-gray-600">
                    Processing {importProgress.current} of{" "}
                    {importProgress.total} courses
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row justify-between gap-3">
            <Button
              variant="outline"
              onClick={onDownloadTemplate}
              className="flex items-center gap-2"
              disabled={!!importProgress}
            >
              <Download className="h-4 w-4" />
              Download Template
            </Button>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={!!importProgress}
              >
                Cancel
              </Button>
              <Button
                className="bg-[#124A69] hover:bg-[#0D3A54] text-white"
                onClick={onImport}
                disabled={!selectedFile || !isValidFile || !!importProgress}
              >
                {importProgress ? "Importing..." : "Import Courses"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
