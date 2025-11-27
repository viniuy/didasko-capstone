/**
 * Utility functions for checking RFID attendance session status
 */

const GLOBAL_RFID_SESSION_KEY = "attendance:global:activeRfidSession";

export interface ActiveRfidSession {
  courseSlug: string;
  date: string;
  startedAt: string;
}

/**
 * Check if there's an active RFID session for a specific course
 * @param courseSlug - The course slug to check
 * @returns The active session if found, null otherwise
 */
export function checkActiveRfidSession(
  courseSlug: string
): ActiveRfidSession | null {
  if (typeof window === "undefined") {
    // Server-side: return null (can't check localStorage)
    return null;
  }

  try {
    const activeSession = localStorage.getItem(GLOBAL_RFID_SESSION_KEY);
    if (activeSession) {
      const session = JSON.parse(activeSession) as ActiveRfidSession;
      // Debug logging
      if (process.env.NODE_ENV === "development") {
        console.log("checkActiveRfidSession:", {
          courseSlug,
          sessionCourseSlug: session.courseSlug,
          match: session.courseSlug === courseSlug,
          session,
        });
      }
      if (session.courseSlug === courseSlug) {
        return session;
      }
    }
    return null;
  } catch (e) {
    console.error("Error checking active RFID session:", e);
    return null;
  }
}

/**
 * Check if any course has an active RFID session
 * @returns The active session if found, null otherwise
 */
export function checkAnyActiveRfidSession(): ActiveRfidSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const activeSession = localStorage.getItem(GLOBAL_RFID_SESSION_KEY);
    if (activeSession) {
      return JSON.parse(activeSession) as ActiveRfidSession;
    }
    return null;
  } catch (e) {
    console.error("Error checking active RFID session:", e);
    return null;
  }
}
