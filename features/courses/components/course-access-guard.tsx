"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { checkActiveRfidSession } from "@/lib/utils/rfid-session";
import toast from "react-hot-toast";
import { UserRole } from "@/lib/permission";

interface CourseAccessGuardProps {
  courseSlug: string;
  userRole: UserRole;
  children: React.ReactNode;
}

/**
 * Client component that blocks access to a course if there's an active RFID attendance session.
 * Academic heads are exempt from this restriction.
 */
export function CourseAccessGuard({
  courseSlug,
  userRole,
  children,
}: CourseAccessGuardProps) {
  const router = useRouter();
  const [isBlocked, setIsBlocked] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasRedirectedRef = useRef(false);

  const checkAndBlock = () => {
    // Academic heads can always access
    if (userRole === "ACADEMIC_HEAD") {
      return false;
    }

    // Check for active RFID session
    const activeSession = checkActiveRfidSession(courseSlug);

    // Debug logging
    if (process.env.NODE_ENV === "development") {
      console.log("CourseAccessGuard check:", {
        courseSlug,
        activeSession,
        isBlocked,
        hasRedirected: hasRedirectedRef.current,
        userRole,
      });
    }

    if (activeSession && !hasRedirectedRef.current) {
      setIsBlocked(true);
      hasRedirectedRef.current = true;
      toast.error(
        `Cannot access course: RFID attendance is currently active for this course. Please wait until the attendance session ends.`,
        {
          id: `rfid-block-${courseSlug}`,
          duration: 5000,
        }
      );
      // Redirect back to courses page after a short delay
      setTimeout(() => {
        router.push("/main/course");
      }, 2000);
      return true;
    }
    return false;
  };

  useEffect(() => {
    // Academic heads can always access
    if (userRole === "ACADEMIC_HEAD") {
      setHasChecked(true);
      return;
    }

    // Initial check
    const wasBlocked = checkAndBlock();
    setHasChecked(true);

    // Set up periodic checks (every 1 second) to catch sessions that start after mount
    checkIntervalRef.current = setInterval(() => {
      checkAndBlock();
    }, 1000);

    // Listen for storage changes (when session is created/removed in another tab/window)
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === "attendance:global:activeRfidSession" ||
        e.key === null // null means all keys changed
      ) {
        checkAndBlock();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    // Also listen for custom events (for same-tab changes)
    const handleCustomStorageChange = () => {
      checkAndBlock();
    };
    window.addEventListener("rfid-session-changed", handleCustomStorageChange);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        "rfid-session-changed",
        handleCustomStorageChange
      );
    };
  }, [courseSlug, userRole, router]);

  // Show loading state while checking
  if (!hasChecked) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#124A69]"></div>
          <p className="text-sm text-gray-600">Checking access...</p>
        </div>
      </div>
    );
  }

  // Show blocked message
  if (isBlocked) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Access Restricted
            </h2>
            <p className="text-gray-600 mb-4">
              RFID attendance is currently active for this course. Please wait
              until the attendance session ends before accessing the course.
            </p>
            <p className="text-sm text-gray-500">
              Redirecting to courses page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Allow access
  return <>{children}</>;
}
