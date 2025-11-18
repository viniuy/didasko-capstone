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
  ShieldAlert,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import { Role } from "@prisma/client";

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

export function BreakGlassWidget() {
  const { data: session } = useSession();
  const [status, setStatus] = useState<BreakGlassStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
              {isActive && sessionData ? (
                <div className="space-y-1">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Active</span> - Expires in{" "}
                    {formatDistanceToNow(new Date(sessionData.expiresAt), {
                      addSuffix: false,
                    })}
                  </p>
                  <p className="text-xs text-gray-600">
                    Activated:{" "}
                    {format(
                      new Date(sessionData.activatedAt),
                      "MMM dd, yyyy HH:mm"
                    )}
                  </p>
                  <p className="text-xs text-gray-600">
                    Expires:{" "}
                    {format(
                      new Date(sessionData.expiresAt),
                      "MMM dd, yyyy HH:mm"
                    )}
                  </p>
                  {sessionData.reason && (
                    <Alert className="mt-2 bg-blue-50 border-blue-200">
                      <AlertTriangle className="w-4 h-4 text-blue-600" />
                      <AlertDescription className="text-xs text-blue-800">
                        {sessionData.reason}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  Activate elevated privileges for 1 hour
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {isActive ? (
              <Button
                onClick={handleDeactivate}
                variant="outline"
                size="sm"
                className="border-red-500 text-red-600 hover:bg-red-50"
              >
                <XCircle className="w-4 h-4 mr-1" />
                Deactivate
              </Button>
            ) : (
              <Button
                onClick={() => setIsDialogOpen(true)}
                size="sm"
                className="bg-[#124A69] hover:bg-[#0a2f42] text-white"
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
