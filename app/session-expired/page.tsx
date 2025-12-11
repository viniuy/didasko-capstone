"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { AlertCircle, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SessionExpiredPage() {
  const router = useRouter();

  useEffect(() => {
    // Automatically sign out to clear any remaining session data
    signOut({ redirect: false });
  }, []);

  const handleSignIn = () => {
    router.push("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Session Expired
          </h1>
          <p className="text-gray-600 mb-4">
            This account has been logged in from another device or location.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-800">
              <strong>Security Notice:</strong> If you did not log in from
              another device, please contact your administrator immediately as
              this may indicate suspicious activity.
            </p>
          </div>
          <p className="text-sm text-gray-500">
            For security reasons, only one active session is allowed per
            account. Please sign in again to continue.
          </p>
        </div>

        <Button
          onClick={handleSignIn}
          className="w-full bg-[#124A69] hover:bg-[#0a2f42] text-white"
        >
          <LogIn className="w-4 h-4 mr-2" />
          Sign In Again
        </Button>
      </div>
    </div>
  );
}
