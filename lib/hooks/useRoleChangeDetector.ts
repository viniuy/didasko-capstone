"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const ROLE_CHANGE_CHECK_INTERVAL = 5000; // Check every 5 seconds

export function useRoleChangeDetector() {
  const { data: session, update } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!session?.user?.id) return;

    const checkRoleChange = async () => {
      try {
        // Fetch current session from server to check if roles have changed
        const response = await fetch("/api/auth/session");
        const freshSession = await response.json();

        if (!freshSession?.user?.id) return;

        // Compare roles
        const currentRoles = JSON.stringify(session.user.roles?.sort() || []);
        const freshRoles = JSON.stringify(
          freshSession.user.roles?.sort() || []
        );

        if (currentRoles !== freshRoles) {
          console.log("🔄 Role change detected, refreshing session...");

          // Update the session
          await update();

          // Force a hard refresh after a short delay
          setTimeout(() => {
            window.location.reload();
          }, 500);
        }
      } catch (error) {
        console.error("Error checking role change:", error);
      }
    };

    // Start checking periodically
    const interval = setInterval(checkRoleChange, ROLE_CHANGE_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [session?.user?.id, session?.user?.roles, update, router]);
}
