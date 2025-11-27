"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  User,
  Eye,
  EyeOff,
} from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import {
  useBreakGlassStatus,
  useActivateBreakGlass,
  useDeactivateBreakGlass,
  useFaculty,
} from "@/lib/hooks/queries";

interface FacultyMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

type BreakGlassSession = {
  id: string;
  reason: string;
  activatedAt: Date;
  activatedBy: string | null;
  promotionCodePlain: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
};

interface BreakGlassStatus {
  isActive: boolean;
  sessions?: BreakGlassSession[];
  session: {
    id: string;
    reason: string;
    activatedAt: Date;
    activatedBy: string | null;
    promotionCodePlain?: string | null;
    user?: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
  } | null;
}

export function BreakGlassCompact() {
  const { data: session } = useSession();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [reason, setReason] = useState("");
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>("");
  const [visibleCodes, setVisibleCodes] = useState<Set<string>>(new Set());

  // React Query hooks
  const { data: status, isLoading } = useBreakGlassStatus();
  const { data: facultyData, isLoading: isLoadingFaculty } = useFaculty();
  const activateMutation = useActivateBreakGlass();
  const deactivateMutation = useDeactivateBreakGlass();

  // Filter faculty to only FACULTY role
  const facultyList = useMemo(() => {
    if (!facultyData || !Array.isArray(facultyData)) return [];
    return facultyData.filter((user: FacultyMember) => user.role === "FACULTY");
  }, [facultyData]);

  // Only show for Academic Head
  if (session?.user?.role !== Role.ACADEMIC_HEAD) {
    return null;
  }

  const handleActivate = async () => {
    if (!selectedFacultyId) {
      toast.error("Please select a faculty member to promote");
      return;
    }

    if (!reason.trim()) {
      toast.error(
        "Please provide a reason for activating break-glass override"
      );
      return;
    }

    try {
      await activateMutation.mutateAsync({
        facultyUserId: selectedFacultyId,
        reason: reason.trim(),
      });
      setIsDialogOpen(false);
      setReason("");
      setSelectedFacultyId("");
    } catch (error) {
      // Error is handled by the mutation hook
    }
  };

  const handleDeactivate = async (userId: string) => {
    try {
      await deactivateMutation.mutateAsync(userId);
    } catch (error) {
      // Error is handled by the mutation hook
    }
  };

  if (isLoading) {
    return (
      <div className="group relative">
        <div className="w-1 h-6 bg-gray-300 rounded transition-all duration-300 group-hover:w-32 group-hover:bg-gray-200"></div>
        <div className="absolute left-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap text-[10px] text-gray-600 px-2 py-1">
          Loading...
        </div>
      </div>
    );
  }

  const isActive = status?.isActive || false;
  const sessionData = status?.session;
  const hasActiveSessions =
    isActive && status?.sessions && status.sessions.length > 0;

  return (
    <>
      <div className="group relative">
        {/* Hidden rectangle that expands on hover or always visible if active */}
        <div
          className={cn(
            "h-6 rounded transition-all duration-300 cursor-pointer",
            hasActiveSessions
              ? "w-48 bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-700"
              : "w-1 bg-white group-hover:w-48"
          )}
          onClick={() => {
            // Only open if closed, don't toggle if already open
            if (!isExpanded) {
              setIsExpanded(true);
            }
          }}
        >
          {/* Hover reveal text - always visible if active, otherwise on hover */}
          <div
            className={cn(
              "absolute left-0 top-0 whitespace-nowrap text-[10px] px-2 py-1 flex items-center gap-1.5 h-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-md z-10 transition-opacity duration-300",
              hasActiveSessions
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100"
            )}
          >
            <ShieldAlert className="w-3 h-3" />
            <span className="font-medium text-gray-700 dark:text-gray-200">
              Secret Break-Glass Override
            </span>
            {isActive && (
              <span className="text-green-600 dark:text-green-400 font-semibold">
                • Active
              </span>
            )}
          </div>
        </div>

        {/* Expanded controls */}
        {isExpanded && (
          <div
            className="absolute left-0 top-8 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 z-50 min-w-[250px] max-w-[300px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-2">
              {isActive && status?.sessions && status.sessions.length > 0 ? (
                <div className="text-xs text-gray-600 dark:text-gray-300 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                    <span className="font-medium">Active Sessions</span>
                  </div>
                  {status.sessions.map((session: BreakGlassSession) => (
                    <div
                      key={session.id}
                      className="pl-5 space-y-1 border-l-2 border-green-500 pl-3"
                    >
                      <div className="font-medium text-[10px]">
                        {session.user?.name || "Unknown"}
                      </div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">
                        {format(new Date(session.activatedAt), "MMM dd, HH:mm")}
                      </div>
                      {session.reason && (
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 italic">
                          "{session.reason.substring(0, 50)}
                          {session.reason.length > 50 ? "..." : ""}"
                        </div>
                      )}
                      {session.promotionCodePlain && (
                        <div className="mt-2 p-2 bg-[#124A69]/10 dark:bg-[#124A69]/20 border border-[#124A69]/30 rounded">
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-[9px] font-semibold text-[#124A69] dark:text-[#4da6d1]">
                              Secret Code:
                            </div>
                            <Button
                              onClick={() => {
                                const newVisibleCodes = new Set(visibleCodes);
                                if (newVisibleCodes.has(session.id)) {
                                  newVisibleCodes.delete(session.id);
                                } else {
                                  newVisibleCodes.add(session.id);
                                }
                                setVisibleCodes(newVisibleCodes);
                              }}
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 text-[#124A69] hover:bg-[#124A69]/10 dark:hover:bg-[#124A69]/30"
                            >
                              {visibleCodes.has(session.id) ? (
                                <EyeOff className="w-3 h-3" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                          <div className="font-mono text-[10px] text-gray-900 dark:text-gray-100 break-all">
                            {visibleCodes.has(session.id)
                              ? session.promotionCodePlain
                              : "•".repeat(session.promotionCodePlain.length)}
                          </div>
                          <Button
                            onClick={() => {
                              navigator.clipboard.writeText(
                                session.promotionCodePlain!
                              );
                              toast.success("Code copied to clipboard");
                            }}
                            variant="ghost"
                            size="sm"
                            className="h-5 text-[9px] mt-1 text-[#124A69] hover:bg-[#124A69]/10 dark:hover:bg-[#124A69]/30 p-1"
                          >
                            Copy Code
                          </Button>
                        </div>
                      )}
                      <Button
                        onClick={() => handleDeactivate(session.user.id)}
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 p-1"
                        disabled={deactivateMutation.isPending}
                      >
                        {deactivateMutation.isPending ? (
                          <>
                            <span className="animate-spin mr-1">⏳</span>
                            Deactivating...
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 mr-1" />
                            Deactivate
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
                  <ShieldAlert className="w-3 h-3" />
                  <span>No active sessions</span>
                </div>
              )}
              <div className="flex gap-2 pt-1 border-t border-gray-200 dark:border-gray-700">
                {!isActive && (
                  <Button
                    onClick={() => setIsDialogOpen(true)}
                    size="sm"
                    className="flex-1 h-7 text-[10px] bg-[#124A69] hover:bg-[#0a2f42] text-white"
                  >
                    <ShieldAlert className="w-3 h-3 mr-1" />
                    Activate
                  </Button>
                )}
                <Button
                  onClick={() => setIsExpanded(false)}
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[10px]"
                >
                  ×
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Activation Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#124A69]">
              <ShieldAlert className="w-5 h-5" />
              Activate Break-Glass Override
            </DialogTitle>
            <DialogDescription>
              Select a Faculty member to temporarily promote to Admin. All
              actions will be logged for security auditing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
              <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              <AlertDescription className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Warning:</strong> This action will be logged and
                audited. Only activate when necessary for legitimate business
                purposes.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label
                htmlFor="faculty"
                className="text-[#124A69] dark:text-[#4da6d1] font-semibold"
              >
                Select Faculty Member <span className="text-red-500">*</span>
              </Label>
              {isLoadingFaculty ? (
                <div className="text-sm text-gray-500">Loading faculty...</div>
              ) : (
                <Select
                  value={selectedFacultyId}
                  onValueChange={setSelectedFacultyId}
                >
                  <SelectTrigger className="w-full border-[#124A69] dark:border-[#4da6d1]">
                    <SelectValue placeholder="Select a faculty member" />
                  </SelectTrigger>
                  <SelectContent>
                    {facultyList.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-gray-500">
                        No faculty members available
                      </div>
                    ) : (
                      facultyList.map((faculty) => (
                        <SelectItem key={faculty.id} value={faculty.id}>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span>{faculty.name}</span>
                            <span className="text-xs text-gray-500">
                              ({faculty.email})
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                The selected faculty member will be temporarily promoted to
                Admin role.
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="reason"
                className="text-[#124A69] dark:text-[#4da6d1] font-semibold"
              >
                Reason for Activation <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="reason"
                placeholder="Please provide a detailed reason for promoting this faculty member to Admin..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="border-[#124A69] dark:border-[#4da6d1] focus:ring-[#124A69] dark:focus:ring-[#4da6d1]"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                This reason will be recorded in the audit logs.
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="text-xs text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">
                    Manual Deactivation Required
                  </p>
                  <p>
                    The promoted faculty member will remain an Admin until
                    either the Admin or Academic Head manually deactivates the
                    break-glass override, or until the temporary Admin logs out.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                setReason("");
                setSelectedFacultyId("");
              }}
              disabled={activateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleActivate}
              disabled={
                !selectedFacultyId ||
                !reason.trim() ||
                activateMutation.isPending ||
                isLoadingFaculty
              }
              className="bg-[#124A69] dark:bg-[#1a5f7f] hover:bg-[#0a2f42] dark:hover:bg-[#134f6b] text-white"
            >
              {activateMutation.isPending ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Activating...
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4 mr-2" />
                  Promote to Admin
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
