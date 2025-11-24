"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import NProgress from "nprogress";

// Route complexity heuristics (base times in ms)
const ROUTE_COMPLEXITY = {
  // Simple static routes
  dashboard: 200,
  // Dynamic routes with data fetching
  course: 400,
  class: 500,
  attendance: 450,
  grading: 600,
  reporting: 700,
  recitation: 550,
  students: 400,
  logs: 500,
  // Default for unknown routes
  default: 300,
};

// Storage key for historical data
const STORAGE_KEY = "nprogress_route_times";

interface RouteTimeData {
  [route: string]: number[];
}

// Get estimated load time for a route
function getEstimatedLoadTime(route: string): number {
  // Try to get historical data
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data: RouteTimeData = JSON.parse(stored);
        const routePattern = getRoutePattern(route);
        const times = data[routePattern];

        if (times && times.length > 0) {
          // Use average of last 5 loads, with 20% buffer
          const recent = times.slice(-5);
          const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
          return avg * 1.2; // 20% buffer for safety
        }
      }
    } catch (e) {
      // Ignore storage errors
    }
  }

  // Fall back to route complexity heuristics
  const routePattern = getRoutePattern(route);
  for (const [pattern, time] of Object.entries(ROUTE_COMPLEXITY)) {
    if (routePattern.includes(pattern)) {
      return time;
    }
  }

  return ROUTE_COMPLEXITY.default;
}

// Extract route pattern (normalize dynamic segments)
function getRoutePattern(route: string): string {
  // Replace dynamic segments with placeholders
  return route
    .replace(/\/\[[^\]]+\]/g, "/[id]")
    .replace(/\/[^/]+$/g, "/[slug]")
    .split("/")
    .filter(Boolean)
    .join("/");
}

// Store route load time
function storeRouteTime(route: string, time: number) {
  if (typeof window === "undefined") return;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const data: RouteTimeData = stored ? JSON.parse(stored) : {};
    const routePattern = getRoutePattern(route);

    if (!data[routePattern]) {
      data[routePattern] = [];
    }

    // Keep only last 20 entries per route
    data[routePattern].push(time);
    if (data[routePattern].length > 20) {
      data[routePattern] = data[routePattern].slice(-20);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // Ignore storage errors
  }
}

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
  const startTimeRef = useRef<number>(0);
  const estimatedTimeRef = useRef<number>(0);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const targetRouteRef = useRef<string>("");

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
            targetRouteRef.current = href;
            startTimeRef.current = Date.now();
            estimatedTimeRef.current = getEstimatedLoadTime(href);

            NProgress.start();
            startPredictiveProgress(estimatedTimeRef.current);
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
        targetRouteRef.current = urlString;
        startTimeRef.current = Date.now();
        estimatedTimeRef.current = getEstimatedLoadTime(urlString);

        NProgress.start();
        startPredictiveProgress(estimatedTimeRef.current);
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
        targetRouteRef.current = urlString;
        startTimeRef.current = Date.now();
        estimatedTimeRef.current = getEstimatedLoadTime(urlString);

        NProgress.start();
        startPredictiveProgress(estimatedTimeRef.current);
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

  // Start predictive progress simulation
  const startPredictiveProgress = (estimatedTime: number) => {
    // Clear any existing interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    const startTime = Date.now();
    const updateInterval = 50; // Update every 50ms for smooth progress
    let currentProgress = 0.08; // Start at minimum

    // Use an easing function for more realistic progress
    const easeOutCubic = (t: number): number => {
      return 1 - Math.pow(1 - t, 3);
    };

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progressRatio = Math.min(elapsed / estimatedTime, 0.95); // Cap at 95% until actual completion

      // Apply easing for smoother progress
      const easedProgress = easeOutCubic(progressRatio);

      // Set progress (0.08 to 0.95 range)
      currentProgress = 0.08 + easedProgress * 0.87;
      NProgress.set(currentProgress);
    }, updateInterval);
  };

  // Complete progress bar when route actually changes
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      // If we were navigating, complete the progress
      if (isNavigatingRef.current) {
        // Clear predictive progress interval
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }

        // Calculate actual load time and store it
        const actualTime = Date.now() - startTimeRef.current;
        if (targetRouteRef.current) {
          storeRouteTime(targetRouteRef.current, actualTime);
        }

        const timer = setTimeout(() => {
          NProgress.done();
          isNavigatingRef.current = false;
          prevPathnameRef.current = pathname;
          targetRouteRef.current = "";
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
