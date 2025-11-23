"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

export function Loading() {
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();
  const prevPathnameRef = useRef<string>(pathname);
  const showTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only show loading if pathname actually changed
    if (prevPathnameRef.current !== pathname) {
      // Dispatch event to trigger sidebar rerenders immediately
      window.dispatchEvent(
        new CustomEvent("routeChangeStart", {
          detail: { pathname },
        })
      );

      // Only show loading overlay after a small delay (for fast navigations, don't show at all)
      showTimerRef.current = setTimeout(() => {
        setIsLoading(true);
      }, 150);

      // Hide loading after route change completes
      const hideTimer = setTimeout(() => {
        setIsLoading(false);
        // Dispatch event to signal route change complete
        window.dispatchEvent(
          new CustomEvent("routeChangeComplete", {
            detail: { pathname },
          })
        );
        prevPathnameRef.current = pathname;
      }, 200);

      return () => {
        if (showTimerRef.current) clearTimeout(showTimerRef.current);
        clearTimeout(hideTimer);
      };
    }
  }, [pathname]);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-white/90 backdrop-blur-sm flex items-center justify-center transition-opacity duration-200 pointer-events-none">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-[#124A69]" />
        <p className="text-sm text-gray-600 font-medium">Loading...</p>
      </div>
    </div>
  );
}
