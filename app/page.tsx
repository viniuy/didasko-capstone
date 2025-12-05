"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { signIn } from "next-auth/react";
import VantaBackground from "@/shared/components/VantaBackground";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";

export default function AdminLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for error in URL params (from NextAuth callback)
  const authError = searchParams.get("error");

  const handleAdminLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await signIn("azure-ad", {
        callbackUrl: "/dashboard/admin",
        redirect: false,
      });

      if (result?.error) {
        console.error("Sign in error:", result.error);
        // Map NextAuth errors to user-friendly messages
        if (result.error === "AccessDenied") {
          setError(
            "Access denied. You are not authorized to access this portal."
          );
        } else if (result.error === "OAuthCallback") {
          setError("Authentication failed. Please try again.");
        } else {
          setError("Sign in failed. Please contact your administrator.");
        }
        return;
      }

      if (result?.ok) {
        router.push("/dashboard/admin");
      }
    } catch (err) {
      console.error("Login failed:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full">
      {/* Left Side - Vanta Effect */}
      <div className="relative w-1/2 flex flex-col justify-center items-center text-white p-10 text-center overflow-hidden">
        {/* Vanta Effect Layer */}
        <div className="absolute inset-0 z-0">
          <VantaBackground />
        </div>

        <div className="relative z-10">
          <motion.img
            src="/Logo.png"
            alt="Didasko Logo"
            className="w-60 mb-3 ml-6"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          />
          <h1 className="text-3xl drop-shadow-md font-bold mb-4">
            Welcome to Didasko
          </h1>
        </div>
      </div>

      {/* Right Side - Authentication Panel */}
      <div className="w-1/2 flex flex-col justify-center items-center p-10 bg-gray-100">
        <div className="relative w-full max-w-md bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="w-full overflow-hidden">
            <div className="w-full flex-shrink-0 flex flex-col justify-center items-center p-10">
              <h2 className="text-2xl font-semibold mb-4 text-gray-800">
                Sign In
              </h2>

              {/* Error Message from URL params */}
              {authError && (
                <div className="w-full mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-red-800 text-sm">
                      Authentication Error
                    </p>
                    <p className="text-sm text-red-700 mt-1">
                      {authError === "AccessDenied"
                        ? "Access denied. You are not authorized to access this portal."
                        : authError === "OAuthCallback"
                        ? "Authentication failed. Please try again."
                        : "Sign in failed. Please contact your administrator."}
                    </p>
                  </div>
                </div>
              )}

              {/* Error Message from state */}
              {error && (
                <div className="w-full mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-red-800 text-sm">
                      Sign In Failed
                    </p>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              )}

              <button
                className="flex items-center justify-center bg-[#124A69] text-white px-6 py-3 rounded-md w-full shadow-md hover:bg-[#0D3A54] transition disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleAdminLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Signing in...
                  </>
                ) : (
                  <>
                    <Image
                      src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg"
                      alt="Microsoft Logo"
                      width={20}
                      height={20}
                      className="mr-2"
                    />
                    Sign in with Microsoft 365
                  </>
                )}
              </button>
              <p className="mt-4 text-sm text-gray-500">
                Only authorized STI faculty can access this portal
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
