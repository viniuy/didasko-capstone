"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/svdialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ImportStatus {
  imported: number;
  skipped: number;
  errors: Array<{ code: string; message: string }>;
  total: number;
  detailedFeedback: Array<{
    row?: number;
    code?: string;
    studentNumber?: string;
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

interface ImportStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importStatus: ImportStatus | null;
  importProgress: ImportProgress | null;
  onClose: () => void;
  onImportMore: () => void;
}

export function ImportStatusDialog({
  open,
  onOpenChange,
  importStatus,
  importProgress,
  onClose,
  onImportMore,
}: ImportStatusDialogProps) {
  const [windowHeight, setWindowHeight] = useState(800);
  const [windowWidth, setWindowWidth] = useState(1024);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const updateDimensions = () => {
        setWindowHeight(window.innerHeight);
        setWindowWidth(window.innerWidth);
      };

      updateDimensions();
      window.addEventListener("resize", updateDimensions);
      return () => window.removeEventListener("resize", updateDimensions);
    }
  }, []);

  // Calculate dynamic dimensions based on viewport and content
  const feedbackCount = importStatus?.detailedFeedback?.length || 0;

  // Dynamic dialog width based on screen size
  const dialogWidth = useMemo(() => {
    if (windowWidth < 640) return "95vw"; // Mobile
    if (windowWidth < 768) return "90vw"; // Small tablet
    if (windowWidth < 1024) return "85vw"; // Tablet
    if (windowWidth < 1280) return "75vw"; // Small desktop
    return "70vw"; // Large desktop
  }, [windowWidth]);

  // Dynamic table height based on content and viewport
  const tableHeight = useMemo(() => {
    if (feedbackCount === 0) return 200;

    // Reserve space for header, summary cards, buttons, and padding
    const reservedHeight = 400;
    const availableHeight = windowHeight - reservedHeight;

    // Calculate based on number of rows (min 40px per row)
    const contentHeight = Math.max(feedbackCount * 40, 200);

    // Use available height but cap at 60% of viewport or content height
    return Math.min(
      Math.max(contentHeight, 200),
      Math.min(availableHeight, windowHeight * 0.6)
    );
  }, [feedbackCount, windowHeight]);

  // Calculate summary stats dynamically
  const summaryStats = useMemo(() => {
    if (!importStatus) return { imported: 0, skipped: 0, errors: 0 };

    return {
      imported: importStatus.detailedFeedback.filter(
        (f) => f.status === "imported"
      ).length,
      skipped: importStatus.detailedFeedback.filter(
        (f) => f.status === "skipped"
      ).length,
      errors: importStatus.detailedFeedback.filter((f) => f.status === "error")
        .length,
    };
  }, [importStatus]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[1200px] max-h-[90vh] p-4 sm:p-6 flex flex-col"
        style={{ width: dialogWidth }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-[#124A69]">
            Import Status
          </DialogTitle>
          <DialogDescription>
            {importProgress
              ? "Import in progress..."
              : "Summary of the import process"}
          </DialogDescription>
        </DialogHeader>

        {importProgress ? (
          <div className="mt-6 space-y-6 flex-1 overflow-auto">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border">
              {importProgress.hasError ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-red-500"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              ) : (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#124A69]" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">
                  {importProgress.status}
                </p>
                {importProgress.error && (
                  <p className="mt-2 text-sm text-red-600">
                    {importProgress.error}
                  </p>
                )}
                {importProgress.total > 0 && !importProgress.hasError && (
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-[#124A69] h-2.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${
                          (importProgress.current / importProgress.total) * 100
                        }%`,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
            {importProgress.hasError && (
              <div className="flex justify-end">
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
              </div>
            )}
          </div>
        ) : (
          importStatus && (
            <div className="mt-6 space-y-4 sm:space-y-6 flex-1 flex flex-col min-h-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 flex-shrink-0">
                <div className="bg-green-50 p-3 sm:p-4 rounded-lg border border-green-200 transition-all hover:shadow-md">
                  <h3 className="text-xs sm:text-sm font-medium text-green-800">
                    Imported
                  </h3>
                  <p className="text-xl sm:text-2xl font-semibold text-green-600 mt-1">
                    {summaryStats.imported}
                  </p>
                  {importStatus.total > 0 && (
                    <p className="text-xs text-green-600 mt-1 opacity-75">
                      {Math.round(
                        (summaryStats.imported / importStatus.total) * 100
                      )}
                      %
                    </p>
                  )}
                </div>
                <div className="bg-amber-50 p-3 sm:p-4 rounded-lg border border-amber-200 transition-all hover:shadow-md">
                  <h3 className="text-xs sm:text-sm font-medium text-amber-800">
                    Skipped
                  </h3>
                  <p className="text-xl sm:text-2xl font-semibold text-amber-600 mt-1">
                    {summaryStats.skipped}
                  </p>
                  {importStatus.total > 0 && (
                    <p className="text-xs text-amber-600 mt-1 opacity-75">
                      {Math.round(
                        (summaryStats.skipped / importStatus.total) * 100
                      )}
                      %
                    </p>
                  )}
                </div>
                <div className="bg-red-50 p-3 sm:p-4 rounded-lg border border-red-200 transition-all hover:shadow-md">
                  <h3 className="text-xs sm:text-sm font-medium text-red-800">
                    Errors
                  </h3>
                  <p className="text-xl sm:text-2xl font-semibold text-red-600 mt-1">
                    {summaryStats.errors}
                  </p>
                  {importStatus.total > 0 && (
                    <p className="text-xs text-red-600 mt-1 opacity-75">
                      {Math.round(
                        (summaryStats.errors / importStatus.total) * 100
                      )}
                      %
                    </p>
                  )}
                </div>
              </div>

              {importStatus.detailedFeedback?.length > 0 && (
                <div className="border rounded-lg overflow-hidden flex-1 flex flex-col min-h-0">
                  <div className="bg-gray-50 p-3 sm:p-4 border-b flex-shrink-0">
                    <h3 className="font-medium text-gray-700 text-sm sm:text-base">
                      Detailed Import Feedback
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                      Status of each row processed during import.
                    </p>
                  </div>
                  <div
                    className="flex-1 overflow-auto min-h-0"
                    style={{ maxHeight: `${tableHeight}px` }}
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse min-w-[600px]">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th className="px-2 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-500 whitespace-nowrap">
                              Row
                            </th>
                            <th className="px-2 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-500 whitespace-nowrap">
                              {windowWidth < 640 ? "Code" : "Student Number"}
                            </th>
                            <th className="px-2 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-500 whitespace-nowrap">
                              Status
                            </th>
                            <th className="px-2 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-500">
                              Message
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {importStatus.detailedFeedback.map(
                            (feedback, index) => (
                              <tr
                                key={index}
                                className="border-t hover:bg-gray-50 transition-colors"
                              >
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm text-gray-900 whitespace-nowrap">
                                  {feedback.row || index + 1}
                                </td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm text-gray-900 font-medium font-mono">
                                  {feedback.code ||
                                    feedback.studentNumber ||
                                    "N/A"}
                                </td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium whitespace-nowrap">
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
                                        ? "bg-green-500 hover:bg-green-600 text-white text-xs border-0"
                                        : feedback.status === "skipped"
                                        ? "text-xs"
                                        : "text-xs"
                                    }
                                  >
                                    {feedback.status.charAt(0).toUpperCase() +
                                      feedback.status.slice(1)}
                                  </Badge>
                                </td>
                                <td
                                  className={`px-2 sm:px-4 py-2 text-xs sm:text-sm ${
                                    feedback.status === "error"
                                      ? "text-red-600"
                                      : "text-gray-900"
                                  } break-words max-w-[300px]`}
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
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-4 pt-4 border-t flex-shrink-0">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="w-full sm:w-auto"
                >
                  Close
                </Button>
                <Button
                  className="bg-[#124A69] hover:bg-[#0D3A54] text-white w-full sm:w-auto"
                  onClick={onImportMore}
                >
                  Import More Courses
                </Button>
              </div>
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
