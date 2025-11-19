"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  Filter,
} from "lucide-react";
import { ExportModal } from "../modal/export-modal";
import { AuditLogsFilterSheet } from "./AuditLogsFilterSheet";
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
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [faculty, setFaculty] = useState<
    Array<{ id: string; name: string | null; email: string | null }>
  >([]);
  const [isLoadingFaculty, setIsLoadingFaculty] = useState(false);

  // Parse filters from URL params
  const parsedFilters = useMemo(() => {
    const actions = searchParams.get("actions")
      ? searchParams.get("actions")!.split(",")
      : [];
    const faculty = searchParams.get("faculty")
      ? searchParams.get("faculty")!.split(",")
      : [];
    const modules = searchParams.get("modules")
      ? searchParams.get("modules")!.split(",")
      : [];
    const startDate = searchParams.get("startDate")
      ? new Date(searchParams.get("startDate")!)
      : undefined;
    const endDate = searchParams.get("endDate")
      ? new Date(searchParams.get("endDate")!)
      : undefined;

    return {
      actions,
      faculty,
      modules,
      startDate,
      endDate,
    };
  }, [searchParams]);

  const [filters, setFilters] = useState(parsedFilters);

  // Sync filters with URL params when they change
  useEffect(() => {
    setFilters(parsedFilters);
  }, [parsedFilters]);

  // Get unique modules and actions from logs
  const uniqueModules = Array.from(
    new Set(logs.map((log) => log.module))
  ).sort();
  const uniqueActions = Array.from(
    new Set(logs.map((log) => log.action))
  ).sort();

  // Fetch faculty data once when component mounts
  useEffect(() => {
    const fetchFaculty = async () => {
      setIsLoadingFaculty(true);
      try {
        const response = await fetch("/api/users/faculty");
        if (!response.ok) {
          throw new Error("Failed to fetch faculty");
        }
        const data = await response.json();
        setFaculty(data);
      } catch (error) {
        console.error("Error fetching faculty:", error);
      } finally {
        setIsLoadingFaculty(false);
      }
    };

    fetchFaculty();
  }, []);

  // Count active filters
  const activeFilterCount =
    filters.actions.length +
    filters.faculty.length +
    filters.modules.length +
    (filters.startDate ? 1 : 0) +
    (filters.endDate ? 1 : 0);

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
    params.delete("p"); // Remove page param, defaults to 1
    router.push(`${currentPath}?${params.toString()}`);
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page === 1) {
      params.delete("p"); // Don't show page=1 in URL
    } else {
      params.set("p", page.toString());
    }
    router.push(`${currentPath}?${params.toString()}`);
  };

  const handleApplyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());

    // Clear existing filter params
    params.delete("actions");
    params.delete("faculty");
    params.delete("modules");
    params.delete("startDate");
    params.delete("endDate");
    params.delete("action"); // Clear old single action filter
    params.delete("module"); // Clear old single module filter
    params.delete("p"); // Reset to page 1 (don't show in URL)

    // Set new filter params
    if (filters.actions.length > 0) {
      params.set("actions", filters.actions.join(","));
    }
    if (filters.faculty.length > 0) {
      params.set("faculty", filters.faculty.join(","));
    }
    if (filters.modules.length > 0) {
      params.set("modules", filters.modules.join(","));
    }
    if (filters.startDate) {
      params.set("startDate", filters.startDate.toISOString());
    }
    if (filters.endDate) {
      params.set("endDate", filters.endDate.toISOString());
    }

    router.push(`${currentPath}?${params.toString()}`);
    setFilterSheetOpen(false);
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

  // Keep field names as-is for technical display
  const formatFieldName = (key: string): string => {
    return key;
  };

  // Format file size to human-readable format
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  // Format value for technical display
  const formatValue = (value: any, key?: string): string => {
    if (value === null || value === undefined) {
      return "null";
    }
    if (typeof value === "boolean") {
      return value.toString();
    }
    if (typeof value === "number") {
      return value.toString();
    }
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "object") {
      if (Array.isArray(value)) {
        return JSON.stringify(value);
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  // Render technical details in compact format
  const renderOrganizedDetails = (data: any, title: string) => {
    if (!data || typeof data !== "object") {
      return null;
    }

    if (Object.keys(data).length === 0) {
      return null;
    }

    return (
      <div className="space-y-1">
        <div className="text-xs font-semibold text-[#124A69] dark:text-[#4da6d1] uppercase tracking-wide">
          {title}
        </div>
        <pre className="text-[10px] font-mono bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded p-2 overflow-x-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  };

  // Render metadata in technical format
  const renderMetadata = (metadata: any) => {
    if (!metadata || typeof metadata !== "object") {
      return null;
    }

    return (
      <div className="space-y-1">
        <div className="text-xs font-semibold text-[#124A69] dark:text-[#4da6d1] uppercase tracking-wide">
          metadata
        </div>
        <pre className="text-[10px] font-mono bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded p-2 overflow-x-auto">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      </div>
    );
  };

  // Handle export with filters
  const handleExport = async (filters: {
    startDate?: Date;
    endDate?: Date;
    actions?: string[];
    modules?: string[];
    faculty?: string[];
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
            <Button
              variant="outline"
              className="relative border-[#124A69] text-[#124A69] hover:bg-[#124A69] hover:text-white"
              onClick={() => setFilterSheetOpen(true)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filter
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#124A69] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>

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
          <div className="flex flex-col">
            <div className="rounded-md border border-gray-200 max-h-[580px] min-h-[580px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-gray-50 z-10">
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
                              <div className="space-y-3 py-3 px-3">
                                {/* Technical Info Grid */}
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                  {log.status && (
                                    <div>
                                      <span className="font-mono text-gray-500">
                                        status:
                                      </span>{" "}
                                      <span className="font-mono text-gray-900">
                                        {log.status}
                                      </span>
                                    </div>
                                  )}
                                  {log.batchId && (
                                    <div>
                                      <span className="font-mono text-gray-500">
                                        batchId:
                                      </span>{" "}
                                      <span className="font-mono text-gray-900">
                                        {log.batchId}
                                      </span>
                                    </div>
                                  )}
                                  {log.ip && (
                                    <div>
                                      <span className="font-mono text-gray-500">
                                        ip:
                                      </span>{" "}
                                      <span className="font-mono text-gray-900">
                                        {log.ip}
                                      </span>
                                    </div>
                                  )}
                                  {log.userId && (
                                    <div>
                                      <span className="font-mono text-gray-500">
                                        userId:
                                      </span>{" "}
                                      <span className="font-mono text-gray-900">
                                        {log.userId}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Reason */}
                                {log.reason && (
                                  <div>
                                    <div className="text-xs font-semibold text-[#124A69] dark:text-[#4da6d1] uppercase tracking-wide mb-1">
                                      reason
                                    </div>
                                    <div className="text-xs font-mono bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded p-2">
                                      {log.reason}
                                    </div>
                                  </div>
                                )}

                                {/* Before State */}
                                {renderOrganizedDetails(log.before, "before")}

                                {/* After State */}
                                {renderOrganizedDetails(log.after, "after")}

                                {/* Metadata */}
                                {renderMetadata(log.metadata)}

                                {/* Empty State */}
                                {!log.before &&
                                  !log.after &&
                                  !log.reason &&
                                  !log.metadata &&
                                  !log.status &&
                                  !log.batchId &&
                                  !log.ip && (
                                    <div className="text-xs text-muted-foreground text-center py-2 font-mono">
                                      No additional data
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
            {totalPages > 0 && (
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-200">
                <div className="flex items-center gap-4 w-full">
                  <span className="text-sm text-gray-600">
                    Showing {(currentPage - 1) * 9 + 1}-
                    {(currentPage - 1) * 9 + logs.length} of{" "}
                    {currentPage === totalPages
                      ? (totalPages - 1) * 9 + logs.length
                      : totalPages * 9}{" "}
                    log
                    {currentPage === totalPages
                      ? (totalPages - 1) * 9 + logs.length !== 1
                        ? "s"
                        : ""
                      : totalPages * 9 !== 1
                      ? "s"
                      : ""}
                  </span>
                </div>
                <Pagination className="flex justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage > 1) {
                            handlePageChange(currentPage - 1);
                          }
                        }}
                        className={
                          currentPage === 1
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <PaginationItem key={i}>
                        <PaginationLink
                          onClick={(e) => {
                            e.preventDefault();
                            handlePageChange(i + 1);
                          }}
                          isActive={currentPage === i + 1}
                          className={
                            currentPage === i + 1
                              ? "bg-[#124A69] text-white hover:bg-[#0d3a56] cursor-pointer"
                              : "cursor-pointer"
                          }
                        >
                          {i + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage < totalPages) {
                            handlePageChange(currentPage + 1);
                          }
                        }}
                        className={
                          currentPage === totalPages
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
        )}
      </Card>

      {/* Export Modal */}
      <ExportModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        logs={logs}
        onExport={handleExport}
        availableActions={uniqueActions}
        availableModules={uniqueModules}
        availableFaculty={faculty}
        isLoadingFaculty={isLoadingFaculty}
      />

      {/* Filter Sheet */}
      <AuditLogsFilterSheet
        isOpen={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        filters={filters}
        onFiltersChange={setFilters}
        onApplyFilters={handleApplyFilters}
        availableActions={uniqueActions}
        availableModules={uniqueModules}
        availableFaculty={faculty}
        isLoadingFaculty={isLoadingFaculty}
      />
    </>
  );
}
