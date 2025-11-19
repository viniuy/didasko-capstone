"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCircle, Clock, Shield } from "lucide-react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";

export default function CurrentSession() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <Card className="bg-[#124A69] border-white/20 h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            Current Session
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="space-y-2">
            <div className="h-4 bg-white/10 rounded animate-pulse" />
            <div className="h-4 bg-white/10 rounded animate-pulse" />
            <div className="h-4 bg-white/10 rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!session?.user) {
    return (
      <Card className="bg-[#124A69] border-white/20 h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            Current Session
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="text-sm text-white/60 text-center py-4">
            No active session
          </div>
        </CardContent>
      </Card>
    );
  }

  const sessionStartTime = new Date();

  return (
    <Card className="bg-[#124A69] border-white/20 h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-lg flex items-center gap-2">
          <UserCircle className="h-5 w-5" />
          Current Session
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col">
        <div className="space-y-4">
          {/* User Info */}
          <div className="bg-white/10 border border-white/20 rounded-lg p-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || "User"}
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <UserCircle className="h-6 w-6 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white truncate">
                  {session.user.name || "Unknown User"}
                </h3>
                <p className="text-xs text-white/70 truncate">
                  {session.user.email}
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-white/10">
              <div className="flex justify-between items-center">
                <span className="text-xs text-white/60 flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  Role:
                </span>
                <span className="text-xs text-white font-semibold uppercase">
                  {session.user.role || "N/A"}
                </span>
              </div>
              {session.user.selectedRole && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/60">Selected Role:</span>
                  <span className="text-xs text-white font-semibold uppercase">
                    {session.user.selectedRole}
                  </span>
                </div>
              )}
              {session.user.department && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/60">Department:</span>
                  <span className="text-xs text-white">
                    {session.user.department}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Session Details */}
          <div className="bg-white/10 border border-white/20 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-white/60" />
              <span className="text-xs font-semibold text-white/80">
                Session Info
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-white/60">User ID:</span>
                <span className="text-xs font-mono text-white truncate max-w-[200px]">
                  {session.user.id}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-white/60">Status:</span>
                <span className="text-xs text-green-300 font-semibold">
                  Active
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-white/60">Session Time:</span>
                <span className="text-xs text-white">
                  {format(sessionStartTime, "HH:mm:ss")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-white/60">Date:</span>
                <span className="text-xs text-white">
                  {format(sessionStartTime, "MMM dd, yyyy")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
