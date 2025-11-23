"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import NProgress from "nprogress";

// Configure NProgress
if (typeof window !== "undefined") {
  NProgress.configure({
    showSpinner: false,
    trickleSpeed: 100,
    minimum: 0.08,
    easing: "ease",
    speed: 400,
  });
}

export function NProgressProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const prevPathnameRef = useRef<string>(pathname);
  const isNavigatingRef = useRef<boolean>(false);

  // Intercept Link clicks
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a[href]");

      if (link) {
        const href = link.getAttribute("href");

        // Only intercept internal links (starting with /)
        if (href && href.startsWith("/") && !href.startsWith("//")) {
          // Don't intercept if it's the same path
          if (href !== pathname) {
            isNavigatingRef.current = true;
            NProgress.start();
          }
        }
      }
    };

    // Intercept router.push calls by wrapping it
    const originalPush = router.push.bind(router);
    const wrappedPush: typeof router.push = (href, options) => {
      const urlString = typeof href === "string" ? href : String(href);

      // Only start if navigating to a different path
      if (urlString !== pathname && !urlString.startsWith("#")) {
        isNavigatingRef.current = true;
        NProgress.start();
      }

      return originalPush(href, options);
    };
    (router as any).push = wrappedPush;

    // Intercept router.replace calls
    const originalReplace = router.replace.bind(router);
    const wrappedReplace: typeof router.replace = (href, options) => {
      const urlString = typeof href === "string" ? href : String(href);

      if (urlString !== pathname && !urlString.startsWith("#")) {
        isNavigatingRef.current = true;
        NProgress.start();
      }

      return originalReplace(href, options);
    };
    (router as any).replace = wrappedReplace;

    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
      (router as any).push = originalPush;
      (router as any).replace = originalReplace;
    };
  }, [router, pathname]);

  // Complete progress bar when route actually changes
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      // If we were navigating, complete the progress
      if (isNavigatingRef.current) {
        const timer = setTimeout(() => {
          NProgress.done();
          isNavigatingRef.current = false;
          prevPathnameRef.current = pathname;
        }, 100);

        return () => {
          clearTimeout(timer);
          NProgress.done();
        };
      } else {
        // Route changed but not from navigation (e.g., direct URL access)
        prevPathnameRef.current = pathname;
      }
    }
  }, [pathname, searchParams]);

  return null;
}
