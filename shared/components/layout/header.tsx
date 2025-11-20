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
import toast from "react-hot-toast";

export default function Header() {
  const { data: session } = useSession();
  const [isTempAdmin, setIsTempAdmin] = useState(false);
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);
  const [promotionCode, setPromotionCode] = useState("");
  const [isPromoting, setIsPromoting] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Check if user is temporary admin
  useEffect(() => {
    const checkTempAdmin = async () => {
      if (session?.user?.id) {
        try {
          setIsChecking(true);
          const response = await fetch(
            `/api/break-glass/status?userId=${session.user.id}`
          );
          if (response.ok) {
            const data = await response.json();
            setIsTempAdmin(!!data.isActive);
          }
        } catch (error) {
          console.error("Error checking temp admin status:", error);
        } finally {
          setIsChecking(false);
        }
      } else {
        setIsChecking(false);
      }
    };
    checkTempAdmin();

    // Poll every 5 seconds to check if break-glass status changed
    const interval = setInterval(checkTempAdmin, 5000);
    return () => clearInterval(interval);
  }, [session]);

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

    setIsPromoting(true);
    try {
      const response = await fetch("/api/break-glass/self-promote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          promotionCode: promotionCode.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to promote");
      }

      toast.success("You have been promoted to permanent Admin!");
      setShowPromoteDialog(false);
      setPromotionCode("");
      setIsTempAdmin(false);

      // Reload page to refresh session
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      toast.error(error.message || "Failed to promote");
    } finally {
      setIsPromoting(false);
    }
  };

  return (
    <>
      <div className="w-full bg-white border-b border-gray-400 flex justify-between shadow-lg items-center relative px-4 sm:px-5 lg:px-6">
        <Image
          src="/didasko-logo.png"
          alt="Logo"
          width={240}
          height={76}
          className="w-32 h-auto sm:w-48 md:w-60 sm:h-19"
        />
        {/* Sticky Temp Admin Button */}
        {!isChecking && isTempAdmin && (
          <div className="relative mr-2 sm:mr-4">
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
                sticky top-0 z-50
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
          </div>
        )}
      </div>

      {/* Self-Promotion Dialog */}
      <Dialog open={showPromoteDialog} onOpenChange={setShowPromoteDialog}>
        <DialogContent className="sm:max-w-[500px]">
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
              disabled={isPromoting}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#124A69] hover:bg-[#0D3A54] text-white"
              onClick={handleSelfPromote}
              disabled={isPromoting || !promotionCode.trim()}
            >
              {isPromoting ? (
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
    </>
  );
}
