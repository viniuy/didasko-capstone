"use client";

import React, { useState } from "react";
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
  ip: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
}

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logs: AuditLog[];
  onExport: (filters: {
    startDate?: Date;
    endDate?: Date;
    action?: string;
    userId?: string;
  }) => Promise<AuditLog[]>;
}

export function ExportModal({
  open,
  onOpenChange,
  logs,
  onExport,
}: ExportModalProps) {
  const [exportType, setExportType] = useState<"date" | "action" | "user">(
    "date"
  );
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [selectedAction, setSelectedAction] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);

  // Get unique actions and users from logs
  const uniqueActions = Array.from(
    new Set(logs.map((log) => log.action))
  ).sort();
  const uniqueUsers = Array.from(
    new Set(
      logs
        .filter((log) => log.user)
        .map((log) => ({
          id: log.user!.id,
          name: log.user!.name || log.user!.email || "Unknown",
          email: log.user!.email || "",
        }))
    )
  ).sort((a, b) => a.name.localeCompare(b.name));

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Build filters based on export type
      const filters: {
        startDate?: Date;
        endDate?: Date;
        action?: string;
        userId?: string;
      } = {};

      if (exportType === "date") {
        if (!startDate || !endDate) {
          toast.error("Please select both start and end dates");
          setIsExporting(false);
          return;
        }
        filters.startDate = startDate;
        filters.endDate = endDate;
      } else if (exportType === "action") {
        if (!selectedAction) {
          toast.error("Please select an action");
          setIsExporting(false);
          return;
        }
        filters.action = selectedAction;
      } else if (exportType === "user") {
        if (!selectedUserId) {
          toast.error("Please select a user");
          setIsExporting(false);
          return;
        }
        filters.userId = selectedUserId;
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
      const filterInfo =
        exportType === "date"
          ? `Date Range: ${format(startDate!, "MMM dd, yyyy")} - ${format(
              endDate!,
              "MMM dd, yyyy"
            )}`
          : exportType === "action"
          ? `Action: ${selectedAction}`
          : `User: ${
              uniqueUsers.find((u) => u.id === selectedUserId)?.name ||
              "Unknown"
            }`;
      infoRow.value = filterInfo;
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
        "IP Address",
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
          log.ip || "N/A",
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
        { width: 18 }, // IP Address
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
        <div className="p-6 space-y-6">
          {/* Export Type Selection */}
          <div className="space-y-2">
            <Label className="text-[#124A69] font-semibold">
              Export Filter Type
            </Label>
            <Select
              value={exportType}
              onValueChange={(value: any) => setExportType(value)}
            >
              <SelectTrigger className="border-[#124A69]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">By Date Range</SelectItem>
                <SelectItem value="action">By Action</SelectItem>
                <SelectItem value="user">By User</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range Filter */}
          {exportType === "date" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[#124A69] font-semibold">
                  Start Date
                </Label>
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
                <Label className="text-[#124A69] font-semibold">End Date</Label>
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
          )}

          {/* Action Filter */}
          {exportType === "action" && (
            <div className="space-y-2">
              <Label className="text-[#124A69] font-semibold">
                Select Action
              </Label>
              <Select value={selectedAction} onValueChange={setSelectedAction}>
                <SelectTrigger className="border-[#124A69]">
                  <SelectValue placeholder="Select an action" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueActions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* User Filter */}
          {exportType === "user" && (
            <div className="space-y-2">
              <Label className="text-[#124A69] font-semibold">
                Select User
              </Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="border-[#124A69]">
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} {user.email && `(${user.email})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 bg-gray-50 border-t">
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
