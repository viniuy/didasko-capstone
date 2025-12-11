"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function SessionExpiredChecker() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Skip check on public pages
    if (
      pathname === "/" ||
      pathname === "/session-expired" ||
      pathname?.startsWith("/auth/")
    ) {
      return;
    }

    // Check if session has expired error
    if (
      !hasRedirected.current &&
      (session as any)?.error === "SessionExpired"
    ) {
      console.log("🚨 Session expired - redirecting to session-expired page");
      hasRedirected.current = true;
      window.location.href = "/session-expired";
    }
  }, [session, pathname]);

  return null;
}
