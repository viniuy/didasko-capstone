"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { format } from "date-fns";
import { Role } from "@prisma/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  Search,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  UserCog,
  BookOpen,
  Activity,
  Download,
} from "lucide-react";
import { ExportModal } from "../modal/export-modal";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  module: string;
  before: any;
  after: any;
  reason: string | null;
  ip: string | null;
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

interface AuditLogsTableProps {
  logs: AuditLog[];
  currentPage: number;
  totalPages: number;
  userRole: Role;
  isLoading?: boolean;
}

function LoadingSpinner() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm min-h-[770px] max-h-[770px]">
      <div className="flex flex-col items-center gap-4 mt-40">
        <h2 className="text-3xl font-bold text-[#124A69] animate-pulse">
          Loading Audit Logs...
        </h2>
        <p
          className="text-lg text-gray-600 animate-pulse"
          style={{ animationDelay: "150ms" }}
        >
          Please sit tight while we are getting things ready for you...
        </p>
        <div className="flex gap-2 mt-4">
          <div className="w-3 h-3 bg-[#124A69] rounded-full animate-bounce"></div>
          <div
            className="w-3 h-3 bg-[#124A69] rounded-full animate-bounce"
            style={{ animationDelay: "150ms" }}
          ></div>
          <div
            className="w-3 h-3 bg-[#124A69] rounded-full animate-bounce"
            style={{ animationDelay: "300ms" }}
          ></div>
        </div>
      </div>
    </div>
  );
}

export default function AuditLogsTable({
  logs,
  currentPage,
  totalPages,
  userRole,
  isLoading = false,
}: AuditLogsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [searchAction, setSearchAction] = useState(
    searchParams.get("action") || ""
  );
  const [selectedModule, setSelectedModule] = useState(
    searchParams.get("module") || "all"
  );
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Get unique modules from logs
  const uniqueModules = Array.from(
    new Set(logs.map((log) => log.module))
  ).sort();

  const toggleRow = (logId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedRows(newExpanded);
  };

  // Get current pathname for navigation
  const currentPath = pathname || "/main/logs";

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (searchAction) {
      params.set("action", searchAction);
    } else {
      params.delete("action");
    }
    params.set("page", "1");
    router.push(`${currentPath}?${params.toString()}`);
  };

  const handleModuleChange = (module: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (module !== "all") {
      params.set("module", module);
    } else {
      params.delete("module");
    }
    params.set("page", "1");
    router.push(`${currentPath}?${params.toString()}`);
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    router.push(`${currentPath}?${params.toString()}`);
  };

  const getActionBadgeVariant = (
    action: string
  ): "default" | "secondary" | "destructive" => {
    const actionUpper = action.toUpperCase();
    if (actionUpper.includes("CREATED")) {
      return "default";
    }
    if (actionUpper.includes("UPDATED")) {
      return "secondary";
    }
    if (
      actionUpper.includes("DELETED") ||
      actionUpper.includes("FAILED") ||
      actionUpper.includes("BREAK_GLASS")
    ) {
      return "destructive";
    }
    return "default";
  };

  const getModuleIcon = (module: string) => {
    const moduleLower = module.toLowerCase();
    if (moduleLower.includes("security")) {
      return <ShieldAlert className="w-4 h-4" />;
    }
    if (moduleLower.includes("user")) {
      return <UserCog className="w-4 h-4" />;
    }
    if (moduleLower.includes("course")) {
      return <BookOpen className="w-4 h-4" />;
    }
    return <Activity className="w-4 h-4" />;
  };

  // Format action name to be more user-friendly
  const formatActionName = (action: string): string => {
    // Replace underscores with spaces and capitalize words
    return action
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .replace(
        /\b(Success|Failed|Created|Updated|Deleted|Activated|Deactivated|Expired)\b/g,
        (match) => match
      );
  };

  // Format action description for better readability
  const getActionDescription = (action: string, module: string): string => {
    const actionUpper = action.toUpperCase();
    if (actionUpper.includes("CREATED")) {
      return `Created in ${module}`;
    }
    if (actionUpper.includes("UPDATED")) {
      return `Updated in ${module}`;
    }
    if (actionUpper.includes("DELETED")) {
      return `Deleted from ${module}`;
    }
    if (actionUpper.includes("SUCCESS")) {
      return `Successfully completed in ${module}`;
    }
    if (actionUpper.includes("FAILED")) {
      return `Failed in ${module}`;
    }
    if (actionUpper.includes("BREAK_GLASS")) {
      return `Security override in ${module}`;
    }
    return `Action in ${module}`;
  };

  // Format field names to be more user-friendly
  const formatFieldName = (key: string): string => {
    const fieldMap: Record<string, string> = {
      entityType: "Type",
      entityId: "ID",
      entityName: "Name",
      courseName: "Course Name",
      courseCode: "Course Code",
      courseSlug: "Course Slug",
      description: "Description",
      department: "Department",
      semester: "Semester",
      academicYear: "Academic Year",
      status: "Status",
      isActive: "Active",
      isArchived: "Archived",
      email: "Email",
      name: "Name",
      role: "Role",
      studentId: "Student ID",
      studentName: "Student Name",
      rfidCardNumber: "RFID Card Number",
      registrationSource: "Registration Source",
      loginMethod: "Login Method",
      logoutType: "Logout Type",
      sessionCreated: "Session Created",
      sessionEnded: "Session Ended",
      importType: "Import Type",
      exportType: "Export Type",
      fileFormat: "File Format",
      recordCount: "Total Records",
      successCount: "Successful",
      errorCount: "Errors",
      skippedCount: "Skipped",
      fileName: "File Name",
      fileSize: "File Size",
      filters: "Filters",
      dataRange: "Data Range",
      courseEnrolled: "Course Enrolled",
      hasRfid: "Has RFID",
      isReassignment: "Reassignment",
      previousRole: "Previous Role",
      newRole: "New Role",
      roleChanged: "Role Changed",
      statusChanged: "Status Changed",
      createdRole: "Created Role",
      createdDepartment: "Created Department",
      bulkOperation: "Bulk Operation",
      affectedCount: "Affected Count",
      newStatus: "New Status",
      scheduleCount: "Schedule Count",
      scheduleUpdated: "Schedule Updated",
      importedUsers: "Imported Users",
      importedCourses: "Imported Courses",
      exportedAt: "Exported At",
    };

    // Check if we have a friendly name
    if (fieldMap[key]) {
      return fieldMap[key];
    }

    // Otherwise, format the key: convert camelCase to Title Case
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  // Format file size to human-readable format
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  // Format value to be more readable
  const formatValue = (value: any, key?: string): string => {
    if (value === null || value === undefined) {
      return "N/A";
    }
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }
    if (typeof value === "number") {
      // Format file size if the key suggests it
      if (
        key &&
        key.toLowerCase().includes("size") &&
        key.toLowerCase().includes("file")
      ) {
        return formatFileSize(value);
      }
      // Format large numbers with commas
      return value.toLocaleString();
    }
    if (typeof value === "string") {
      // Check if string is a date
      const dateValue = new Date(value);
      if (!isNaN(dateValue.getTime()) && value.length > 10) {
        try {
          return format(dateValue, "MMM dd, yyyy HH:mm:ss");
        } catch {
          // If parsing fails, return as string
        }
      }
      return value;
    }
    if (typeof value === "object") {
      if (Array.isArray(value)) {
        if (value.length === 0) return "None";
        // If it's an array of simple values, show them
        if (value.every((v) => typeof v !== "object")) {
          return value.join(", ");
        }
        return `${value.length} item(s)`;
      }
      if (value instanceof Date) {
        return format(new Date(value), "MMM dd, yyyy HH:mm:ss");
      }
      // For objects, return a summary
      return JSON.stringify(value);
    }
    return String(value);
  };

  // Render organized details in a beginner-friendly format
  const renderOrganizedDetails = (data: any, title: string, icon: string) => {
    if (!data || typeof data !== "object") {
      return null;
    }

    // Filter out technical fields
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(
        ([key]) =>
          ![
            "status",
            "duration",
            "error",
            "_count",
            "id",
            "createdAt",
            "updatedAt",
            "userId",
          ].includes(key.toLowerCase())
      )
    );

    if (Object.keys(filteredData).length === 0) {
      return null;
    }

    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold mb-1.5 text-[#124A69] dark:text-[#4da6d1] flex items-center gap-1.5">
          <span className="text-[10px]">{icon}</span> {title}
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded p-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(filteredData).map(([key, value]) => (
              <div key={key} className="space-y-0.5">
                <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {formatFieldName(key)}
                </div>
                <div className="text-xs text-gray-900 dark:text-gray-100">
                  {typeof value === "object" && !Array.isArray(value) ? (
                    <div className="space-y-0.5 pl-1.5 border-l border-gray-300 dark:border-gray-600">
                      {Object.entries(value as Record<string, any>).map(
                        ([subKey, subValue]) => (
                          <div key={subKey} className="text-[10px]">
                            <span className="text-gray-500 dark:text-gray-400">
                              {formatFieldName(subKey)}:
                            </span>{" "}
                            <span>{formatValue(subValue, subKey)}</span>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    formatValue(value, key)
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Render metadata in an organized way
  const renderMetadata = (metadata: any) => {
    if (!metadata || typeof metadata !== "object") {
      return null;
    }

    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold mb-1.5 text-[#124A69] dark:text-[#4da6d1] flex items-center gap-1.5">
          <span className="text-[10px]">📊</span> Additional Information
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded p-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(metadata).map(([key, value]) => (
              <div key={key} className="space-y-0.5">
                <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {formatFieldName(key)}
                </div>
                <div className="text-xs text-gray-900 dark:text-gray-100">
                  {formatValue(value, key)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Handle export with filters
  const handleExport = async (filters: {
    startDate?: Date;
    endDate?: Date;
    action?: string;
    userId?: string;
  }): Promise<AuditLog[]> => {
    try {
      const response = await fetch("/api/logs/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(filters),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch logs for export");
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Export error:", error);
      throw error;
    }
  };

  // Show loading spinner if loading
  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <Card className="p-6 bg-white shadow-sm border border-gray-200">
        {/* Filters and Export */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex-1 flex gap-2">
            <Input
              placeholder="Search by action..."
              value={searchAction}
              onChange={(e) => setSearchAction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
              className="max-w-sm"
            />
            <Button
              onClick={handleSearch}
              variant="outline"
              className="border-[#124A69] text-[#124A69] hover:bg-[#124A69] hover:text-white"
            >
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>

          <div className="flex gap-2">
            <Select value={selectedModule} onValueChange={handleModuleChange}>
              <SelectTrigger className="w-[200px] border-[#124A69]">
                <SelectValue placeholder="All Modules" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {uniqueModules.map((module) => (
                  <SelectItem key={module} value={module}>
                    {module}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={() => setExportModalOpen(true)}
              className="bg-[#124A69] hover:bg-[#0a2f42] text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Table */}
        {logs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No audit logs found.</p>
          </div>
        ) : (
          <>
            <div className="rounded-md border border-gray-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-[#124A69] font-semibold">
                      Timestamp
                    </TableHead>
                    <TableHead className="text-[#124A69] font-semibold">
                      User
                    </TableHead>
                    <TableHead className="text-[#124A69] font-semibold">
                      Action
                    </TableHead>
                    <TableHead className="text-[#124A69] font-semibold">
                      Module
                    </TableHead>
                    <TableHead className="text-[#124A69] font-semibold">
                      Details
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const isExpanded = expandedRows.has(log.id);
                    return (
                      <React.Fragment key={log.id}>
                        <TableRow>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium text-sm">
                                {format(
                                  new Date(log.createdAt),
                                  "MMM dd, yyyy"
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {format(new Date(log.createdAt), "HH:mm:ss")}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {log.user ? (
                              <div>
                                <div className="font-medium">
                                  {log.user.name || "Unknown"}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {log.user.email}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                System
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Badge
                                variant="default"
                                className="bg-[#124A69] text-white border-[#124A69] dark:bg-[#4da6d1] dark:text-white dark:border-[#4da6d1]"
                              >
                                {formatActionName(log.action)}
                              </Badge>
                              <div className="text-xs text-muted-foreground">
                                {getActionDescription(log.action, log.module)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getModuleIcon(log.module)}
                              <span>{log.module}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleRow(log.id)}
                              className="text-[#124A69] hover:bg-[#124A69]/10"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-4 h-4 mr-1" />
                                  Hide
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-4 h-4 mr-1" />
                                  Show
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={5} className="bg-muted/50">
                              <div className="space-y-2 py-2 px-2">
                                {/* Status Badge */}
                                {log.status && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                                      Status:
                                    </span>
                                    <Badge
                                      variant="secondary"
                                      className="bg-[#124A69]/10 text-[#124A69] dark:bg-[#4da6d1]/20 dark:text-[#4da6d1] border border-[#124A69]/20 dark:border-[#4da6d1]/30 text-[10px] px-1.5 py-0.5"
                                    >
                                      {log.status}
                                    </Badge>
                                  </div>
                                )}

                                {/* Batch ID for import/export operations */}
                                {log.batchId && (
                                  <div className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded p-1.5">
                                    <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">
                                      Batch ID
                                    </div>
                                    <div className="text-xs font-mono text-gray-900 dark:text-gray-100">
                                      {log.batchId}
                                    </div>
                                  </div>
                                )}

                                {/* Reason */}
                                {log.reason && (
                                  <div className="bg-gray-50 dark:bg-gray-900/30 border-l-2 border-[#124A69] dark:border-[#4da6d1] p-1.5 rounded">
                                    <div className="text-xs font-semibold mb-0.5 text-[#124A69] dark:text-[#4da6d1] flex items-center gap-1.5">
                                      <span className="text-[10px]">📝</span>{" "}
                                      Reason
                                    </div>
                                    <div className="text-xs text-gray-700 dark:text-gray-300">
                                      {log.reason}
                                    </div>
                                  </div>
                                )}

                                {/* Previous State */}
                                {renderOrganizedDetails(
                                  log.before,
                                  "Previous State",
                                  "⬅️"
                                )}

                                {/* New State / Action Details */}
                                {renderOrganizedDetails(
                                  log.after,
                                  "New State / Action Details",
                                  "➡️"
                                )}

                                {/* Metadata */}
                                {renderMetadata(log.metadata)}

                                {/* Empty State */}
                                {!log.before &&
                                  !log.after &&
                                  !log.reason &&
                                  !log.metadata && (
                                    <div className="text-xs text-muted-foreground text-center py-2">
                                      No additional details available for this
                                      log entry
                                    </div>
                                  )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage > 1) {
                            handlePageChange(currentPage - 1);
                          }
                        }}
                        className={
                          currentPage === 1
                            ? "pointer-events-none opacity-50"
                            : ""
                        }
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(
                        (page) =>
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 2 && page <= currentPage + 2)
                      )
                      .map((page, idx, arr) => (
                        <React.Fragment key={page}>
                          {idx > 0 && arr[idx - 1] !== page - 1 && (
                            <PaginationItem>
                              <span className="px-2">...</span>
                            </PaginationItem>
                          )}
                          <PaginationItem>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                handlePageChange(page);
                              }}
                              isActive={currentPage === page}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        </React.Fragment>
                      ))}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage < totalPages) {
                            handlePageChange(currentPage + 1);
                          }
                        }}
                        className={
                          currentPage === totalPages
                            ? "pointer-events-none opacity-50"
                            : ""
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
                <div className="ml-4 text-sm text-gray-600 flex items-center">
                  Page {currentPage} of {totalPages}
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Export Modal */}
      <ExportModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        logs={logs}
        onExport={handleExport}
      />
    </>
  );
}
