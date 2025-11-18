"use client";

import React, { useState, useEffect } from "react";
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
  ShieldAlert,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import { Role } from "@prisma/client";
import { cn } from "@/lib/utils";

interface BreakGlassStatus {
  isActive: boolean;
  session: {
    id: string;
    reason: string;
    activatedAt: Date;
    expiresAt: Date;
    activatedBy: string | null;
  } | null;
}

export function BreakGlassCompact() {
  const { data: session } = useSession();
  const [status, setStatus] = useState<BreakGlassStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [reason, setReason] = useState("");
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

  const handleActivate = async () => {
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
          userId: session?.user?.id,
          reason: reason.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to activate break-glass");
      }

      toast.success("Break-glass override activated successfully");
      setIsDialogOpen(false);
      setReason("");
      await fetchStatus();
    } catch (error: any) {
      toast.error(error.message || "Failed to activate break-glass override");
    } finally {
      setIsActivating(false);
    }
  };

  const handleDeactivate = async () => {
    try {
      const response = await fetch("/api/break-glass/deactivate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: session?.user?.id,
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

  return (
    <>
      <div className="group relative">
        {/* Hidden rectangle that expands on hover */}
        <div
          className={cn(
            "w-1 h-6 rounded transition-all duration-300 cursor-pointer",
            isActive
              ? "bg-green-400 group-hover:w-48 group-hover:bg-green-300"
              : "bg-gray-300 group-hover:w-48 group-hover:bg-gray-200"
          )}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {/* Hover reveal text */}
          <div className="absolute left-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap text-[10px] px-2 py-1 flex items-center gap-1.5 h-full">
            <ShieldAlert className="w-3 h-3" />
            <span className="font-medium text-gray-700">
              Secret Break-Glass Override
            </span>
            {isActive && (
              <span className="text-green-600 font-semibold">• Active</span>
            )}
          </div>
        </div>

        {/* Expanded controls */}
        {isExpanded && (
          <div className="absolute right-0 top-8 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-50 min-w-[200px]">
            <div className="space-y-2">
              {isActive && sessionData && (
                <div className="text-xs text-gray-600 space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                    <span className="font-medium">Active</span>
                  </div>
                  <div className="pl-5 text-[10px]">
                    Expires in:{" "}
                    {formatDistanceToNow(new Date(sessionData.expiresAt), {
                      addSuffix: false,
                    })}
                  </div>
                  {sessionData.reason && (
                    <div className="pl-5 text-[10px] text-gray-500 italic">
                      "{sessionData.reason}"
                    </div>
                  )}
                </div>
              )}
              {!isActive && (
                <div className="text-xs text-gray-600 flex items-center gap-2">
                  <ShieldAlert className="w-3 h-3" />
                  <span>Inactive</span>
                </div>
              )}
              <div className="flex gap-2 pt-1 border-t">
                {isActive ? (
                  <Button
                    onClick={handleDeactivate}
                    variant="ghost"
                    size="sm"
                    className="flex-1 h-7 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <XCircle className="w-3 h-3 mr-1" />
                    Deactivate
                  </Button>
                ) : (
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
              Break-glass override grants you elevated privileges for 1 hour.
              All actions will be logged for security auditing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <AlertDescription className="text-sm text-yellow-800">
                <strong>Warning:</strong> This action will be logged and
                audited. Only activate when necessary for legitimate business
                purposes.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="reason" className="text-[#124A69] font-semibold">
                Reason for Activation <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="reason"
                placeholder="Please provide a detailed reason for activating break-glass override..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="border-[#124A69] focus:ring-[#124A69]"
              />
              <p className="text-xs text-gray-500">
                This reason will be recorded in the audit logs.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-blue-600 mt-0.5" />
                <div className="text-xs text-blue-800">
                  <p className="font-medium mb-1">Duration: 1 hour</p>
                  <p>
                    The override will automatically expire after 1 hour. You can
                    manually deactivate it at any time.
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
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleActivate}
              disabled={!reason.trim() || isActivating}
              className="bg-[#124A69] hover:bg-[#0a2f42] text-white"
            >
              {isActivating ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Activating...
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4 mr-2" />
                  Activate Override
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
