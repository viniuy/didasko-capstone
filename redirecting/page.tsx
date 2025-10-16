"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function RedirectingPage() {
  const { data: session, status } = useSession();
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

      // If user is admin, show role selection
      if (role === "ADMIN") {
        setShowRoleSelection(true);
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
  }, [session, status, router]);

  const handleRoleSelection = async (selectedRole: "ADMIN" | "FACULTY") => {
    const roleMap: Record<string, string> = {
      ADMIN: "/dashboard/admin",
      FACULTY: "/dashboard/faculty",
    };

    // Update the session with the selected role
    if (session?.user) {
      session.user.role = selectedRole;
    }

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
