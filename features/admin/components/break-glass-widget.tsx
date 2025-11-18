"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
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
} from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import { Role } from "@prisma/client";

interface FacultyMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface BreakGlassStatus {
  isActive: boolean;
  sessions?: Array<{
    id: string;
    reason: string;
    activatedAt: Date;
    activatedBy: string | null;
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
  }>;
  session: {
    id: string;
    reason: string;
    activatedAt: Date;
    activatedBy: string | null;
    user?: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
  } | null;
}

export function BreakGlassWidget() {
  const { data: session } = useSession();
  const [status, setStatus] = useState<BreakGlassStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>("");
  const [facultyList, setFacultyList] = useState<FacultyMember[]>([]);
  const [isLoadingFaculty, setIsLoadingFaculty] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  // Only show for Academic Head
  if (session?.user?.role !== Role.ACADEMIC_HEAD) {
    return null;
  }

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/break-glass/status");
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error("Failed to fetch break-glass status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll every 30 seconds to check status
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch faculty list when dialog opens
  useEffect(() => {
    if (isDialogOpen) {
      setIsLoadingFaculty(true);
      fetch("/api/users/faculty")
        .then((res) => res.json())
        .then((data) => {
          // Filter to only FACULTY role (exclude ACADEMIC_HEAD)
          const facultyOnly = data.filter(
            (user: FacultyMember) => user.role === "FACULTY"
          );
          setFacultyList(facultyOnly);
        })
        .catch((err) => {
          console.error("Failed to fetch faculty:", err);
          toast.error("Failed to load faculty list");
        })
        .finally(() => setIsLoadingFaculty(false));
    }
  }, [isDialogOpen]);

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

    setIsActivating(true);
    try {
      const response = await fetch("/api/break-glass/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          facultyUserId: selectedFacultyId,
          reason: reason.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to activate break-glass");
      }

      const result = await response.json();
      toast.success(
        result.message || "Break-glass override activated successfully"
      );
      setIsDialogOpen(false);
      setReason("");
      setSelectedFacultyId("");
      await fetchStatus();
    } catch (error: any) {
      toast.error(error.message || "Failed to activate break-glass override");
    } finally {
      setIsActivating(false);
    }
  };

  const handleDeactivate = async (userId: string) => {
    try {
      const response = await fetch("/api/break-glass/deactivate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to deactivate break-glass");
      }

      toast.success("Break-glass override deactivated");
      await fetchStatus();
    } catch (error: any) {
      toast.error(error.message || "Failed to deactivate break-glass override");
    }
  };

  if (isLoading) {
    return (
      <Card className="p-4 border-[#124A69] bg-gradient-to-br from-blue-50 to-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#124A69]/10 rounded-lg">
            <ShieldAlert className="w-5 h-5 text-[#124A69] animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-32 mb-2 animate-pulse"></div>
            <div className="h-3 bg-gray-200 rounded w-24 animate-pulse"></div>
          </div>
        </div>
      </Card>
    );
  }

  const isActive = status?.isActive || false;
  const sessionData = status?.session;

  return (
    <>
      <Card
        className={`p-4 border-2 ${
          isActive
            ? "border-green-500 bg-gradient-to-br from-green-50 to-white"
            : "border-[#124A69] bg-gradient-to-br from-blue-50 to-white"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div
              className={`p-2 rounded-lg ${
                isActive ? "bg-green-100" : "bg-[#124A69]/10"
              }`}
            >
              {isActive ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-[#124A69]" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-[#124A69] mb-1">
                Break-Glass Override
              </h3>
              {isActive && status?.sessions && status.sessions.length > 0 ? (
                <div className="space-y-3">
                  {status.sessions.map((session) => (
                    <div key={session.id} className="space-y-1">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="font-medium">Active:</span>{" "}
                        {session.user?.name || "Unknown"} (promoted to Admin)
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Activated:{" "}
                        {format(
                          new Date(session.activatedAt),
                          "MMM dd, yyyy HH:mm"
                        )}
                      </p>
                      {session.reason && (
                        <Alert className="mt-2 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                          <AlertTriangle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <AlertDescription className="text-xs text-blue-800 dark:text-blue-200">
                            {session.reason}
                          </AlertDescription>
                        </Alert>
                      )}
                      <Button
                        onClick={() => handleDeactivate(session.user.id)}
                        variant="outline"
                        size="sm"
                        className="mt-2 border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Deactivate
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Select a Faculty member to temporarily promote to Admin
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {!isActive && (
              <Button
                onClick={() => setIsDialogOpen(true)}
                size="sm"
                className="bg-[#124A69] dark:bg-[#1a5f7f] hover:bg-[#0a2f42] dark:hover:bg-[#134f6b] text-white"
              >
                <ShieldAlert className="w-4 h-4 mr-1" />
                Activate
              </Button>
            )}
          </div>
        </div>
      </Card>

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
                    The promoted faculty member will remain as Admin until you
                    manually deactivate the break-glass override. The role will
                    be automatically restored to Faculty upon deactivation.
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
            >
              Cancel
            </Button>
            <Button
              onClick={handleActivate}
              disabled={
                !selectedFacultyId ||
                !reason.trim() ||
                isActivating ||
                isLoadingFaculty
              }
              className="bg-[#124A69] dark:bg-[#1a5f7f] hover:bg-[#0a2f42] dark:hover:bg-[#134f6b] text-white"
            >
              {isActivating ? (
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
