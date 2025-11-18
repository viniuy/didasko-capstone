"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const SELECTED_ROLE_KEY = "admin_selected_role";

export default function RedirectingPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showRedirecting, setShowRedirecting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      const role = session?.user?.role;

      if (!role) {
        console.error("No role found in session");
        router.replace("/unauthorized");
        return;
      }

      // If user is admin, check if they're a temp admin first
      if (role === "ADMIN") {
        // Check if user is a temporary admin (break-glass active)
        const checkTempAdmin = async () => {
          try {
            const response = await fetch(
              `/api/break-glass/status?userId=${session?.user?.id}`
            );
            if (response.ok) {
              const data = await response.json();
              if (data.isActive) {
                // Temp admin - redirect to admin dashboard immediately
                router.replace("/dashboard/admin");
                return true;
              }
            }
          } catch (error) {
            console.error("Error checking temp admin status:", error);
          }
          return false;
        };

        // Check for temp admin status
        checkTempAdmin().then((isTempAdmin) => {
          if (isTempAdmin) {
            return; // Already redirected
          }

          // Continue with normal admin flow
          // Check localStorage for previously selected role
          const savedRole = localStorage.getItem(SELECTED_ROLE_KEY);

          // Check session for selectedRole (from JWT token)
          const sessionSelectedRole = session?.user?.selectedRole;

          // If localStorage has a saved role but session doesn't, restore it
          if (savedRole && !sessionSelectedRole) {
            update({ selectedRole: savedRole as "ADMIN" | "FACULTY" }).then(
              () => {
                // After updating, redirect based on saved role
                const roleMap: Record<string, string> = {
                  ADMIN: "/dashboard/admin",
                  FACULTY: "/dashboard/faculty",
                };
                router.replace(roleMap[savedRole] || "/dashboard/admin");
              }
            );
            return;
          }

          // Use session selectedRole first, then localStorage, then show selection
          const effectiveRole = sessionSelectedRole || savedRole;

          if (effectiveRole === "FACULTY") {
            // Admin has selected faculty role - redirect to faculty dashboard
            router.replace("/dashboard/faculty");
            return;
          } else if (effectiveRole === "ADMIN") {
            // Admin has explicitly selected admin role - redirect to admin dashboard
            router.replace("/dashboard/admin");
            return;
          } else {
            // No previous selection - show role selection
            setShowRoleSelection(true);
            return;
          }
        });
        return;
      }

      // For other roles, proceed with normal redirection
      const roleMap: Record<string, string> = {
        ACADEMIC_HEAD: "/dashboard/academic-head",
        FACULTY: "/dashboard/faculty",
      };

      const path = roleMap[role] || "/dashboard";
      router.replace(path);
    }
  }, [session, status, router, update]);

  // Trigger fade-in animation when role selection appears
  useEffect(() => {
    if (showRoleSelection) {
      // Small delay to ensure the element is rendered before animating
      const timer = setTimeout(() => {
        setIsMounted(true);
      }, 10);
      return () => clearTimeout(timer);
    } else {
      setIsMounted(false);
    }
  }, [showRoleSelection]);

  // Trigger fade-in animation for redirecting text when exiting
  useEffect(() => {
    if (isExiting) {
      // Small delay to ensure the element is rendered before animating
      const timer = setTimeout(() => {
        setShowRedirecting(true);
      }, 10);
      return () => clearTimeout(timer);
    } else {
      setShowRedirecting(false);
    }
  }, [isExiting]);

  const handleRoleSelection = async (selectedRole: "ADMIN" | "FACULTY") => {
    const roleMap: Record<string, string> = {
      ADMIN: "/dashboard/admin",
      FACULTY: "/dashboard/faculty",
    };

    // Trigger exit animation
    setIsExiting(true);

    // Store in localStorage as backup
    localStorage.setItem(SELECTED_ROLE_KEY, selectedRole);

    // Update the session using NextAuth's update() method
    // This will trigger the JWT callback with trigger === "update"
    await update({
      selectedRole: selectedRole,
    });

    // Wait for animation to complete before navigating
    setTimeout(() => {
      router.replace(roleMap[selectedRole]);
    }, 500); // Match the animation duration
  };

  if (showRoleSelection) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-6 relative">
        <div
          className={`flex flex-col items-center gap-6 transition-all duration-500 ease-in-out ${
            isExiting
              ? "opacity-0 translate-y-8"
              : isMounted
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
          }`}
        >
          <h2 className="text-2xl font-semibold text-[#124A69] mb-4">
            Select Your Role
          </h2>
          <div className="flex gap-4">
            <Button
              onClick={() => handleRoleSelection("ADMIN")}
              className="bg-[#124A69] text-white hover:bg-[#0d3a56] px-6 py-3"
            >
              Continue as Admin
            </Button>
            <Button
              onClick={() => handleRoleSelection("FACULTY")}
              className="bg-[#124A69] text-white hover:bg-[#0d3a56] px-6 py-3"
            >
              Continue as Faculty
            </Button>
          </div>
        </div>
        {isExiting && (
          <div
            className={`absolute flex flex-col items-center transition-all duration-500 ease-in-out ${
              showRedirecting
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            <p className="text-lg text-gray-600">Redirecting...</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <h2 className="text-3xl font-bold text-[#124A69] animate-float">
        Welcome to Didasko!
      </h2>
      <p className="text-lg text-gray-600 animate-float-delayed">
        Please sit tight while we are getting things ready for you...
      </p>
    </div>
  );
}
