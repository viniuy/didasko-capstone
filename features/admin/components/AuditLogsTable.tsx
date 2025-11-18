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
                      IP Address
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
                                variant={getActionBadgeVariant(log.action)}
                                className={
                                  getActionBadgeVariant(log.action) ===
                                  "destructive"
                                    ? "bg-red-100 text-red-800 border-red-200"
                                    : getActionBadgeVariant(log.action) ===
                                      "secondary"
                                    ? "bg-blue-100 text-blue-800 border-blue-200"
                                    : "bg-[#124A69] text-white border-[#124A69]"
                                }
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
                          <TableCell className="font-mono text-sm">
                            {log.ip || "N/A"}
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
                            <TableCell colSpan={6} className="bg-muted/50">
                              <div className="space-y-4 py-4 px-2">
                                {log.reason && (
                                  <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                                    <div className="font-semibold mb-1 text-[#124A69] flex items-center gap-2">
                                      <span>📝</span> Reason
                                    </div>
                                    <div className="text-sm text-gray-700 mt-1">
                                      {log.reason}
                                    </div>
                                  </div>
                                )}
                                {log.before && (
                                  <div>
                                    <div className="font-semibold mb-2 text-[#124A69] flex items-center gap-2">
                                      <span>⬅️</span> Previous State
                                    </div>
                                    <div className="bg-red-50 border border-red-200 rounded p-3">
                                      <pre className="text-xs text-gray-800 overflow-auto max-h-48 font-mono">
                                        {JSON.stringify(log.before, null, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                )}
                                {log.after && (
                                  <div>
                                    <div className="font-semibold mb-2 text-[#124A69] flex items-center gap-2">
                                      <span>➡️</span> New State
                                    </div>
                                    <div className="bg-green-50 border border-green-200 rounded p-3">
                                      <pre className="text-xs text-gray-800 overflow-auto max-h-48 font-mono">
                                        {JSON.stringify(log.after, null, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                )}
                                {!log.before && !log.after && !log.reason && (
                                  <div className="text-sm text-muted-foreground text-center py-4">
                                    No additional details available for this log
                                    entry
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
