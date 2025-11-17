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

  useEffect(() => {
    if (status === "authenticated") {
      const role = session?.user?.role;

      if (!role) {
        console.error("No role found in session");
        router.replace("/unauthorized");
        return;
      }

      // If user is admin, check for previously selected role
      if (role === "ADMIN") {
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

  const handleRoleSelection = async (selectedRole: "ADMIN" | "FACULTY") => {
    const roleMap: Record<string, string> = {
      ADMIN: "/dashboard/admin",
      FACULTY: "/dashboard/faculty",
    };

    // Store in localStorage as backup
    localStorage.setItem(SELECTED_ROLE_KEY, selectedRole);

    // Update the session using NextAuth's update() method
    // This will trigger the JWT callback with trigger === "update"
    await update({
      selectedRole: selectedRole,
    });

    router.replace(roleMap[selectedRole]);
  };

  if (showRoleSelection) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-6">
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
