"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Download, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import toast from "react-hot-toast";

interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  module: string;
  before: any;
  after: any;
  reason: string | null;
  metadata: any;
  batchId: string | null;
  status: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
}

interface Faculty {
  id: string;
  name: string | null;
  email: string | null;
}

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logs: AuditLog[];
  onExport: (filters: {
    startDate?: Date;
    endDate?: Date;
    actions?: string[];
    modules?: string[];
    faculty?: string[];
  }) => Promise<AuditLog[]>;
  availableActions?: string[];
  availableModules?: string[];
  availableFaculty?: Faculty[];
  isLoadingFaculty?: boolean;
}

export function ExportModal({
  open,
  onOpenChange,
  logs,
  onExport,
  availableActions = [],
  availableModules = [],
  availableFaculty = [],
  isLoadingFaculty = false,
}: ExportModalProps) {
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [selectedFaculty, setSelectedFaculty] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  // Use all possible actions and modules from props (same as filter sheet)
  const uniqueActions = availableActions.length > 0 ? availableActions : [];
  const uniqueModules = availableModules.length > 0 ? availableModules : [];

  // Use faculty from props
  const faculty = availableFaculty;

  // Reset all selections when modal closes
  useEffect(() => {
    if (!open) {
      setStartDate(undefined);
      setEndDate(undefined);
      setSelectedActions([]);
      setSelectedModules([]);
      setSelectedFaculty([]);
    }
  }, [open]);

  const handleClearAll = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedActions([]);
    setSelectedModules([]);
    setSelectedFaculty([]);
  };

  const handleActionToggle = (action: string) => {
    setSelectedActions((prev) =>
      prev.includes(action)
        ? prev.filter((a) => a !== action)
        : [...prev, action]
    );
  };

  const handleModuleToggle = (module: string) => {
    setSelectedModules((prev) =>
      prev.includes(module)
        ? prev.filter((m) => m !== module)
        : [...prev, module]
    );
  };

  const handleFacultyToggle = (facultyId: string) => {
    setSelectedFaculty((prev) =>
      prev.includes(facultyId)
        ? prev.filter((f) => f !== facultyId)
        : [...prev, facultyId]
    );
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Build filters
      const filters: {
        startDate?: Date;
        endDate?: Date;
        actions?: string[];
        modules?: string[];
        faculty?: string[];
      } = {};

      // Date range is optional but if provided, both should be set
      if (startDate || endDate) {
        if (!startDate || !endDate) {
          toast.error("Please select both start and end dates");
          setIsExporting(false);
          return;
        }
        filters.startDate = startDate;
        filters.endDate = endDate;
      }

      // Add action filters if any selected
      if (selectedActions.length > 0) {
        filters.actions = selectedActions;
      }

      // Add module filters if any selected
      if (selectedModules.length > 0) {
        filters.modules = selectedModules;
      }

      // Add faculty filters if any selected
      if (selectedFaculty.length > 0) {
        filters.faculty = selectedFaculty;
      }

      // At least one filter should be selected
      if (
        !filters.startDate &&
        !filters.actions &&
        !filters.modules &&
        !filters.faculty
      ) {
        toast.error("Please select at least one filter option");
        setIsExporting(false);
        return;
      }

      // Fetch filtered logs
      const filteredLogs = await onExport(filters);

      if (filteredLogs.length === 0) {
        toast.error("No logs found matching the selected criteria");
        setIsExporting(false);
        return;
      }

      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Audit Logs");

      // Title row
      worksheet.mergeCells("A1:G1");
      const titleRow = worksheet.getCell("A1");
      titleRow.value = "Audit Logs Export";
      titleRow.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
      titleRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF124A69" },
      };
      titleRow.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(1).height = 30;

      // Info row
      worksheet.mergeCells("A2:G2");
      const infoRow = worksheet.getCell("A2");
      const filterParts: string[] = [];

      if (filters.startDate && filters.endDate) {
        filterParts.push(
          `Date Range: ${format(filters.startDate, "MMM dd, yyyy")} - ${format(
            filters.endDate,
            "MMM dd, yyyy"
          )}`
        );
      }
      if (filters.actions && filters.actions.length > 0) {
        filterParts.push(`Actions: ${filters.actions.join(", ")}`);
      }
      if (filters.modules && filters.modules.length > 0) {
        filterParts.push(`Modules: ${filters.modules.join(", ")}`);
      }
      if (filters.faculty && filters.faculty.length > 0) {
        const facultyNames = filters.faculty
          .map(
            (id) => availableFaculty.find((f) => f.id === id)?.name || "Unknown"
          )
          .join(", ");
        filterParts.push(`Faculty: ${facultyNames}`);
      }

      infoRow.value = filterParts.join(" | ") || "All logs";
      infoRow.font = { italic: true, size: 11 };
      infoRow.alignment = { vertical: "middle", horizontal: "center" };

      // Export date row
      worksheet.mergeCells("A3:G3");
      const dateRow = worksheet.getCell("A3");
      dateRow.value = `Exported on: ${format(
        new Date(),
        "MMM dd, yyyy HH:mm:ss"
      )}`;
      dateRow.font = { italic: true, size: 10, color: { argb: "FF666666" } };
      dateRow.alignment = { vertical: "middle", horizontal: "center" };

      worksheet.addRow([]);

      // Headers
      const headers = [
        "Timestamp",
        "User",
        "Email",
        "Action",
        "Module",
        "Status",
        "Reason",
      ];
      const headerRow = worksheet.addRow(headers);

      // Style header row
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF124A69" },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        };
      });
      worksheet.getRow(headerRow.number).height = 25;

      // Add data rows
      filteredLogs.forEach((log) => {
        const row = worksheet.addRow([
          format(new Date(log.createdAt), "MMM dd, yyyy HH:mm:ss"),
          log.user?.name || "System",
          log.user?.email || "N/A",
          log.action,
          log.module,
          log.status || "N/A",
          log.reason || "N/A",
        ]);

        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFD3D3D3" } },
            left: { style: "thin", color: { argb: "FFD3D3D3" } },
            bottom: { style: "thin", color: { argb: "FFD3D3D3" } },
            right: { style: "thin", color: { argb: "FFD3D3D3" } },
          };
          cell.alignment = { vertical: "middle" };
        });

        if (row.number % 2 === 0) {
          row.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF9FAFB" },
          };
        }
      });

      // Set column widths
      worksheet.columns = [
        { width: 20 }, // Timestamp
        { width: 25 }, // User
        { width: 30 }, // Email
        { width: 25 }, // Action
        { width: 20 }, // Module
        { width: 18 }, // Status
        { width: 40 }, // Reason
      ];

      // Generate filename
      const filename = `audit_logs_${format(
        new Date(),
        "yyyy-MM-dd_HH-mm-ss"
      )}.xlsx`;

      // Save file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(blob, filename);

      toast.success(
        `Successfully exported ${filteredLogs.length} audit log${
          filteredLogs.length !== 1 ? "s" : ""
        }`
      );
      onOpenChange(false);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export audit logs");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#124A69] to-[#1a6a94] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 backdrop-blur-sm p-2 rounded-lg">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-white">
                Export Audit Logs
              </DialogTitle>
              <DialogDescription className="text-blue-100 text-sm mt-0.5">
                Choose how to filter and export audit logs
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Date Range Filter */}
          <div className="space-y-4">
            <Label className="text-[#124A69] font-semibold">
              Date Range (Optional)
            </Label>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm text-gray-600">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal border-[#124A69]",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? (
                        format(startDate, "PPP")
                      ) : (
                        <span>Pick a start date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date: Date | undefined) => {
                        setStartDate(date);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-gray-600">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal border-[#124A69]",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? (
                        format(endDate, "PPP")
                      ) : (
                        <span>Pick an end date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date: Date | undefined) => {
                        setEndDate(date);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Action Filter */}
          <div className="space-y-4">
            <Label className="text-[#124A69] font-semibold">
              Actions (Optional)
            </Label>
            <div className="space-y-3 border rounded-lg p-4 max-h-[200px] overflow-y-auto">
              {uniqueActions.length === 0 ? (
                <p className="text-sm text-gray-500">No actions available</p>
              ) : (
                uniqueActions.map((action) => (
                  <div
                    key={action}
                    className="flex items-center space-x-2 p-1.5 rounded hover:bg-[#124A69]/5 transition-colors"
                  >
                    <Checkbox
                      id={`export-action-${action}`}
                      checked={selectedActions.includes(action)}
                      onCheckedChange={() => handleActionToggle(action)}
                      className="data-[state=checked]:bg-[#124A69] data-[state=checked]:border-[#124A69] border-[#124A69]/30"
                    />
                    <Label
                      htmlFor={`export-action-${action}`}
                      className="text-sm cursor-pointer text-gray-700 hover:text-[#124A69] transition-colors"
                    >
                      {action
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (char) => char.toUpperCase())}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Module Filter */}
          <div className="space-y-4">
            <Label className="text-[#124A69] font-semibold">
              Modules (Optional)
            </Label>
            <div className="space-y-3 border rounded-lg p-4 max-h-[200px] overflow-y-auto">
              {uniqueModules.length === 0 ? (
                <p className="text-sm text-gray-500">No modules available</p>
              ) : (
                uniqueModules.map((module) => (
                  <div
                    key={module}
                    className="flex items-center space-x-2 p-1.5 rounded hover:bg-[#124A69]/5 transition-colors"
                  >
                    <Checkbox
                      id={`export-module-${module}`}
                      checked={selectedModules.includes(module)}
                      onCheckedChange={() => handleModuleToggle(module)}
                      className="data-[state=checked]:bg-[#124A69] data-[state=checked]:border-[#124A69] border-[#124A69]/30"
                    />
                    <Label
                      htmlFor={`export-module-${module}`}
                      className="text-sm cursor-pointer text-gray-700 hover:text-[#124A69] transition-colors"
                    >
                      {module}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Faculty Filter */}
          <div className="space-y-4">
            <Label className="text-[#124A69] font-semibold">
              Faculty (Optional)
            </Label>
            <div className="space-y-3 border rounded-lg p-4 max-h-[200px] overflow-y-auto">
              {isLoadingFaculty ? (
                <p className="text-sm text-gray-500">Loading faculty...</p>
              ) : faculty.length === 0 ? (
                <p className="text-sm text-gray-500">No faculty available</p>
              ) : (
                faculty.map((fac) => (
                  <div
                    key={fac.id}
                    className="flex items-center space-x-2 p-1.5 rounded hover:bg-[#124A69]/5 transition-colors"
                  >
                    <Checkbox
                      id={`export-faculty-${fac.id}`}
                      checked={selectedFaculty.includes(fac.id)}
                      onCheckedChange={() => handleFacultyToggle(fac.id)}
                      className="data-[state=checked]:bg-[#124A69] data-[state=checked]:border-[#124A69] border-[#124A69]/30"
                    />
                    <Label
                      htmlFor={`export-faculty-${fac.id}`}
                      className="text-sm cursor-pointer text-gray-700 hover:text-[#124A69] transition-colors"
                    >
                      {fac.name || fac.email || "Unknown"}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 bg-gray-50 border-t">
          <Button
            variant="outline"
            onClick={handleClearAll}
            className="border-gray-300"
            disabled={
              !startDate &&
              !endDate &&
              selectedActions.length === 0 &&
              selectedModules.length === 0 &&
              selectedFaculty.length === 0
            }
          >
            Clear All
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="bg-[#124A69] hover:bg-[#0a2f42] text-white"
          >
            {isExporting ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export to Excel
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
