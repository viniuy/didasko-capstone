"use client";

import React, { useRef } from "react";
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
  "Course Code",
  "Course Title",
  "Room",
  "Semester",
  "Academic Year",
  "Class Number",
  "Section",
  "Status",
];

interface CsvRow {
  "Course Code": string;
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
}: ImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={onFileChange}
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
                      .map((row, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2 text-xs text-gray-500">
                            {index + 1}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {row["Course Code"]}
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
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center p-8 border-2 border-dashed rounded-lg bg-gray-50">
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium mb-1">No file selected</p>
              <p className="text-sm text-gray-500">
                Upload an Excel file to preview the data before importing
              </p>
            </div>
          )}

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
