"use client";

import Image from "next/image";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { useBreakGlassStatus, useSelfPromote } from "@/lib/hooks/queries";
import {
  useFacultyRequests,
  useCreateFacultyRequest,
  useApproveFacultyRequest,
  useRejectFacultyRequest,
} from "@/lib/hooks/queries";
import { BreakGlassCompact } from "@/features/admin/components/break-glass-compact";

export default function Header() {
  const { data: session } = useSession();
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);
  const [promotionCode, setPromotionCode] = useState("");

  // React Query hooks
  // Fetch break-glass status for all users except ACADEMIC_HEAD
  // Academic Heads (with or without Faculty role) should not see temp admin badge
  // We need to fetch for ADMIN users too because they might be temporary admins
  const userRoles = session?.user?.roles || [];
  const shouldFetchBreakGlass = !userRoles.includes("ACADEMIC_HEAD");
  const { data: breakGlassStatus, isLoading: isLoadingBreakGlass } =
    useBreakGlassStatus(shouldFetchBreakGlass ? session?.user?.id : undefined, {
      enabled: shouldFetchBreakGlass && !!session?.user?.id,
    });
  const selfPromoteMutation = useSelfPromote();

  // Only show "Temporary Admin" badge if:
  // 1. User's role is ADMIN (they were promoted from FACULTY to ADMIN via break-glass)
  // 2. AND there's an active break-glass session for them
  // Academic Head should NEVER see this badge - they activate break-glass for others, not themselves
  const isTempAdmin =
    !isLoadingBreakGlass &&
    !userRoles.includes("ACADEMIC_HEAD") &&
    userRoles.includes("ADMIN") &&
    breakGlassStatus?.isActive === true &&
    breakGlassStatus?.session?.user?.id === session?.user?.id;

  // For Academic Heads, we don't fetch break-glass status, so don't wait for it
  const isChecking =
    shouldFetchBreakGlass &&
    (isLoadingBreakGlass || breakGlassStatus === undefined);

  // Close dialog when user is no longer a temporary admin
  useEffect(() => {
    if (!isTempAdmin && showPromoteDialog) {
      setShowPromoteDialog(false);
      setPromotionCode("");
    }
  }, [isTempAdmin, showPromoteDialog]);

  const handleSelfPromote = async () => {
    if (!promotionCode.trim()) {
      toast.error("Please enter the secret code");
      return;
    }

    try {
      await selfPromoteMutation.mutateAsync({
        promotionCode: promotionCode.trim(),
      });

      setShowPromoteDialog(false);
      setPromotionCode("");

      // Reload page to refresh session
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      // Error is handled by the mutation hook
    }
  };

  // Faculty assignment request (Admin requests FACULTY role)
  const {
    data: facultyRequests = [],
    isLoading: isLoadingRequests,
    refetch: refetchRequests,
  } = useFacultyRequests();
  const createRequest = useCreateFacultyRequest();
  const approveRequest = useApproveFacultyRequest();
  const rejectRequest = useRejectFacultyRequest();

  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showRequestsListDialog, setShowRequestsListDialog] = useState(false);
  const [requestExpiresAt, setRequestExpiresAt] = useState<Date | undefined>(
    undefined
  );
  const [requestNote, setRequestNote] = useState("");

  const pendingCount = Array.isArray(facultyRequests)
    ? facultyRequests.filter((r: any) => r.status === "PENDING").length
    : 0;

  const hasOwnPending = Array.isArray(facultyRequests)
    ? facultyRequests.some(
        (r: any) => r.status === "PENDING" && r.adminId === session?.user?.id
      )
    : false;

  // Debugging: log session roles and faculty requests info to help troubleshoot visibility
  useEffect(() => {
    try {
      // eslint-disable-next-line no-console
      console.log("[Header Debug] session.roles:", session?.user?.roles);
      // eslint-disable-next-line no-console
      console.log(
        "[Header Debug] pendingCount:",
        pendingCount,
        "facultyRequests:",
        facultyRequests
      );
      // eslint-disable-next-line no-console
      console.log("[Header Debug] isLoadingRequests:", isLoadingRequests);
    } catch (e) {
      // ignore
    }
  }, [session?.user?.roles, pendingCount, facultyRequests, isLoadingRequests]);

  const handleCreateRequest = async () => {
    if (!requestExpiresAt) {
      toast.error("Please select an expiration date");
      return;
    }

    if (pendingCount > 0) {
      toast.error("You already have a pending request");
      return;
    }

    try {
      // Convert selected date to end-of-day ISO (so expiry covers the whole day)
      const expires = new Date(requestExpiresAt);
      expires.setHours(23, 59, 59, 999);
      const iso = expires.toISOString();
      await createRequest.mutateAsync({ expiresAt: iso, note: requestNote });
      setShowRequestDialog(false);
      setRequestExpiresAt(undefined);
      setRequestNote("");
    } catch (e) {
      // handled by hook
    }
  };

  return (
    <>
      <div className="w-screen bg-white border-b border-gray-400 flex shadow-lg items-center ml-16">
        {/* Left Section */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <Image
            src="/didasko-logo.png"
            alt="Logo"
            width={240}
            height={76}
            className="w-32 h-auto sm:w-48 md:w-60 sm:h-19"
          />
          {/* Break-Glass Compact - Only show for Academic Head and permanent Admin, not temporary Admin */}
          {!isChecking && !isTempAdmin && <BreakGlassCompact />}
          {/* Academic Head: single compact badge (moved next to BreakGlassCompact) */}
          {!isChecking && userRoles.includes("ACADEMIC_HEAD") && (
            <button
              onClick={() => setShowRequestsListDialog(true)}
              aria-label={
                pendingCount > 0
                  ? `${pendingCount} pending faculty requests`
                  : "No pending faculty requests"
              }
              title={
                pendingCount > 0
                  ? `${pendingCount} pending faculty requests`
                  : "Pending Requests"
              }
              className={`ml-3 sm:ml-4 relative z-20 inline-flex items-center justify-center h-6 w-6 rounded-full transition-shadow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#124A69] ${
                pendingCount > 0
                  ? "bg-[#124A69] text-white"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              <span className="sr-only">Pending Requests</span>
              {pendingCount > 0 ? (
                <span className="text-[11px] font-semibold leading-none">
                  {pendingCount}
                </span>
              ) : (
                <span className="h-2 w-2 rounded-full block" />
              )}
            </button>
          )}
          {/* Academic Head: minimal pending-requests badge (moved next to BreakGlassCompact) */}
          {!isChecking && userRoles.includes("ACADEMIC_HEAD") && false && (
            <div className="group relative ml-3 sm:ml-4">
              <div
                className={`h-8 rounded transition-all duration-300 cursor-pointer relative z-20 ${
                  pendingCount > 0
                    ? "w-48 bg-white border border-[#124A69]"
                    : "w-6 bg-white"
                }`}
                onClick={() => setShowRequestsListDialog(true)}
                role="button"
                tabIndex={0}
                aria-label={
                  pendingCount > 0
                    ? `${pendingCount} pending faculty requests`
                    : "Pending Requests"
                }
                title={
                  pendingCount > 0
                    ? `${pendingCount} pending faculty requests`
                    : "Pending Requests"
                }
              >
                {/* Collapsed icon */}
                <div className="absolute left-0 top-0 h-full w-6 flex items-center justify-center z-30 opacity-90">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="text-[#124A69]"
                  >
                    <path
                      d="M12 2v20"
                      stroke="#124A69"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M5 7h14"
                      stroke="#124A69"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                {/* Hover reveal text */}
                <div
                  className={`absolute left-0 top-0 whitespace-nowrap px-3 py-1 flex items-center gap-2 h-full z-10 transition-opacity duration-300 ${
                    pendingCount > 0
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                  }`}
                >
                  <span className="text-sm font-medium text-[#124A69]">
                    Pending Requests
                  </span>
                  {pendingCount > 0 && (
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-[#124A69] text-white text-[11px] font-semibold">
                      {pendingCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
          {/* Temp Admin Button */}
          {!isChecking && isTempAdmin && (
            <Button
              onClick={() => !showPromoteDialog && setShowPromoteDialog(true)}
              className={`
                  relative overflow-hidden
                  bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600
                  hover:from-yellow-500 hover:via-yellow-600 hover:to-yellow-700
                  text-white font-semibold
                  shadow-[0_0_15px_rgba(234,179,8,0.5)]
                  hover:shadow-[0_0_25px_rgba(234,179,8,0.7)]
                  flex items-center gap-1 sm:gap-2
                z-50
                  transition-all duration-300
                  transform hover:scale-105
                  text-xs sm:text-sm
                  px-2 sm:px-3 py-1.5 sm:py-2
                  min-h-[44px] sm:min-h-0
                  ${
                    showPromoteDialog
                      ? "opacity-75 cursor-not-allowed pointer-events-none"
                      : "animate-pulse"
                  }
                `}
              size="sm"
              disabled={showPromoteDialog}
              onMouseEnter={(e) => {
                if (showPromoteDialog) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
            >
              {/* Shimmer effect */}
              {!showPromoteDialog && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
              )}

              {/* Glow effect */}
              <div className="absolute inset-0 rounded-md bg-yellow-400/50 blur-xl animate-pulse opacity-50" />

              <ShieldCheck className="w-3 h-3 sm:w-4 sm:h-4 relative z-10 animate-[bounce_2s_infinite]" />
              <span className="hidden sm:inline relative z-10">
                Temporary Admin
              </span>
              <span className="sm:hidden relative z-10">Temp</span>
            </Button>
          )}
        </div>

        {/* Center Section - Flexible space */}
        <div className="flex-1 flex items-center justify-center">
          {/* Add center content here if needed */}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Admin: Request Faculty Role (only if not already FACULTY) */}
          {userRoles.includes("ADMIN") && !userRoles.includes("FACULTY") && (
            <>
              <div className="relative">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowRequestDialog(true)}
                  className="text-sm"
                  disabled={pendingCount > 0 || createRequest.isPending}
                >
                  {pendingCount > 0
                    ? `Request Pending (${pendingCount})`
                    : "Request Faculty Role"}
                </Button>
                {hasOwnPending && (
                  <span
                    className="absolute -top-1 -right-2 inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-600 text-white text-[10px] font-semibold"
                    aria-label="You have a pending request"
                    title="You have a pending request"
                  >
                    !
                  </span>
                )}
              </div>
            </>
          )}

          {/* (Moved) Academic Head pending-requests badge is rendered next to BreakGlassCompact */}
        </div>
      </div>

      {/* Self-Promotion Dialog */}
      <Dialog open={showPromoteDialog} onOpenChange={setShowPromoteDialog}>
        <DialogContent className="sm:max-w-[500px] z-[9999]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#124A69]">
              <ShieldCheck className="w-5 h-5" />
              Become Permanent Admin
            </DialogTitle>
            <DialogDescription>
              Enter the secret code provided by the Academic Head to become a
              permanent Admin.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-600 p-3 rounded">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <strong>Note:</strong> You are currently a temporary Admin.
                Enter the secret code to become a permanent Admin with full
                privileges.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="promotionCode">
                Secret Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="promotionCode"
                type="text"
                placeholder="Enter the 32-character secret code"
                value={promotionCode}
                onChange={(e) => setPromotionCode(e.target.value)}
                className="font-mono"
                maxLength={32}
              />
              <p className="text-xs text-gray-500">
                The code should be 32 characters long and was provided by the
                Academic Head.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowPromoteDialog(false);
                setPromotionCode("");
              }}
              disabled={selfPromoteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#124A69] hover:bg-[#0D3A54] text-white"
              onClick={handleSelfPromote}
              disabled={selfPromoteMutation.isPending || !promotionCode.trim()}
            >
              {selfPromoteMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Promoting...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Promote
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Admin: Create Faculty Request Dialog */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent className="sm:max-w-[480px] z-[9999]">
          <DialogHeader>
            <DialogTitle className="text-[#124A69]">
              Request Faculty Role
            </DialogTitle>
            <DialogDescription>
              Submit a request to be assigned the Faculty role. Choose an expiry
              for the role.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Expires At</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-full justify-start text-left font-normal ${
                      !requestExpiresAt ? "text-muted-foreground" : ""
                    }`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {requestExpiresAt ? (
                      format(requestExpiresAt, "PPP")
                    ) : (
                      <span>Pick expiry date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[9999]" align="start">
                  <Calendar
                    mode="single"
                    selected={requestExpiresAt}
                    onSelect={(date: Date | undefined) => {
                      setRequestExpiresAt(date);
                    }}
                    disabled={{
                      before: new Date(new Date().setHours(0, 0, 0, 0)),
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requestNote">Note (optional)</Label>
              <Input
                id="requestNote"
                type="text"
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowRequestDialog(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#124A69] text-white"
              onClick={handleCreateRequest}
              disabled={createRequest.isPending}
            >
              {createRequest.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Academic Head: Pending Requests Dialog */}
      <Dialog
        open={showRequestsListDialog}
        onOpenChange={setShowRequestsListDialog}
      >
        <DialogContent className="sm:max-w-[600px] z-[9999]">
          <DialogHeader>
            <DialogTitle className="text-[#124A69]">
              Pending Faculty Requests
            </DialogTitle>
            <DialogDescription>
              Approve or reject pending faculty assignment requests.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {isLoadingRequests ? (
              <div>Loading...</div>
            ) : (
              (facultyRequests || [])
                .filter((r: any) => r.status === "PENDING")
                .map((r: any) => (
                  <div
                    key={r.id}
                    className="p-3 border rounded flex items-start justify-between gap-3"
                  >
                    <div className="flex-1">
                      <div className="font-medium">
                        {r.admin?.name || "Unknown"}{" "}
                        <span className="text-xs text-gray-500">
                          ({r.admin?.email})
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Expires: {new Date(r.expiresAt).toLocaleString()}
                      </div>
                      {r.note && (
                        <div className="text-sm italic text-gray-500">
                          "{r.note}"
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 flex flex-col gap-2">
                      <Button
                        size="sm"
                        className="bg-green-600 text-white"
                        onClick={async () => {
                          await approveRequest.mutateAsync(r.id);
                          refetchRequests();
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                          await rejectRequest.mutateAsync(r.id);
                          refetchRequests();
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))
            )}
            {(!facultyRequests ||
              facultyRequests.filter((r: any) => r.status === "PENDING")
                .length === 0) && (
              <div className="text-sm text-gray-600">No pending requests</div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              variant="ghost"
              onClick={() => setShowRequestsListDialog(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
