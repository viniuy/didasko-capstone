"use client";
import { useState, useEffect } from "react";
import { usePathname, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Menu } from "lucide-react";
import UpcomingEvents from "@/features/dashboard/components/events";
import Notes from "@/features/dashboard/components/notes";
import { Button } from "@/components/ui/button";
import CourseShortcut from "@/features/right-sidebar/components/my-subjects";
import AttendanceLeaderboard from "@/features/right-sidebar/components/student-attendance";
import GradingLeaderboard from "@/features/right-sidebar/components/grading-leaderboard";
import CourseAnalytics from "@/features/right-sidebar/components/course-analytics";

export default function Rightsidebar() {
  const [open, setOpen] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [key, setKey] = useState(0); // Force rerender on route change

  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };

    checkScreenSize(); // Check on mount
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  // Listen for route changes to trigger rerender
  useEffect(() => {
    const handleRouteChange = () => {
      setKey((prev) => prev + 1); // Force rerender
    };

    window.addEventListener("routeChangeStart", handleRouteChange);
    return () => {
      window.removeEventListener("routeChangeStart", handleRouteChange);
    };
  }, []);

  const pathname = usePathname();
  const params = useParams();
  const { data: session } = useSession();
  const courseSlug = (params.course_slug || params.slug) as string;

  // Route detection
  const isAttendanceList = pathname === "/main/attendance";
  const isClassAttendance =
    pathname.startsWith("/main/attendance/class/") && courseSlug;
  const isGradingClassRecord =
    pathname.startsWith("/main/grading/class-record/") && courseSlug;
  const isGradingList =
    pathname === "/main/grading" || pathname === "/main/grading/class-record";
  const isCourseDashboard = pathname.startsWith("/main/course/") && courseSlug;

  return (
    <div key={key}>
      {!open && !isLargeScreen && (
        <Button
          variant="outline"
          size="icon"
          onClick={() => setOpen(!open)}
          className="fixed top-2 right-2 sm:top-4 sm:right-4 z-50 bg-[#124A69] text-white hover:bg-[#0f3d58] min-h-[44px] min-w-[44px]"
        >
          <Menu size={20} />
        </Button>
      )}

      <div
        className={`fixed top-0 right-0 z-40 h-screen bg-[#124A69] border-l p-2 sm:p-3 md:p-4 pt-2 flex flex-col transition-all duration-300 overflow-hidden
          ${open ? "translate-x-0" : "translate-x-full"}
          lg:translate-x-0
          w-[85vw] sm:w-[80vw] md:w-[360px] lg:w-[360px]
        `}
      >
        <div className="flex-grow overflow-y-auto grid grid-rows-2 gap-4 h-[calc(100vh-32px)]">
          {isCourseDashboard ? (
            <>
              <div className="h-[calc(50vh-25px)]">
                <CourseShortcut excludeCourseSlug={courseSlug} />
              </div>
              <div className="h-[calc(50vh-25px)]">
                <CourseAnalytics courseSlug={courseSlug} />
              </div>
            </>
          ) : /* Attendance List Page */
          isAttendanceList ? (
            <>
              <div className="h-[calc(50vh-25px)]">
                <CourseShortcut />
              </div>
              <div className="h-[calc(50vh-25px)]">
                <AttendanceLeaderboard />
              </div>
            </>
          ) : isClassAttendance ? (
            <>
              <div className="h-[calc(50vh-25px)]">
                <CourseShortcut excludeCourseSlug={courseSlug} />
              </div>
              <div className="h-[calc(50vh-25px)]">
                <AttendanceLeaderboard courseSlug={courseSlug} />
              </div>
            </>
          ) : isGradingClassRecord ? (
            <>
              <div className="h-[calc(50vh-25px)]">
                <CourseShortcut excludeCourseSlug={courseSlug} />
              </div>
              <div className="h-[calc(50vh-25px)]">
                <GradingLeaderboard courseSlug={courseSlug} />
              </div>
            </>
          ) : isGradingList ? (
            <>
              <div className="h-[calc(50vh-20px)]">
                <CourseShortcut />
              </div>
              <div className="h-[calc(50vh-20px)]">
                <GradingLeaderboard />
              </div>
            </>
          ) : (
            <>
              <div className="h-[calc(50vh-25px)]">
                <UpcomingEvents />
              </div>
              <div className="h-[calc(50vh-25px)]">
                <Notes />
              </div>
            </>
          )}
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}
