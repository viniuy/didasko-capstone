"use client";
import { useState } from "react";
import { usePathname, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Menu, X } from "lucide-react";
import UpcomingEvents from "@/features/dashboard/components/events";
import Notes from "@/features/dashboard/components/notes";
import { Button } from "@/components/ui/button";
import CourseShortcut from "@/features/right-sidebar/components/my-subjects";
import AttendanceLeaderboard from "@/features/right-sidebar/components/student-attendance";
import GradingLeaderboard from "@/features/right-sidebar/components/grading-leaderboard";
import CourseAnalytics from "@/features/right-sidebar/components/course-analytics";
import UserIdSearch from "@/features/right-sidebar/components/user-id-search";
import ActiveFaculty from "@/features/right-sidebar/components/active-faculty";

export default function Rightsidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const params = useParams();
  const { data: session } = useSession();
  const courseSlug = (params.course_slug || params.slug) as string;

  // Check if user is ADMIN
  const isAdmin = session?.user?.role === "ADMIN";

  // Route detection
  const isAttendanceList = pathname === "/main/attendance";
  const isClassAttendance =
    pathname.startsWith("/main/attendance/class/") && courseSlug;
  const isGradingClassRecord =
    pathname.startsWith("/main/grading/class-record/") && courseSlug;
  const isGradingList =
    pathname === "/main/grading" || pathname === "/main/grading/class-record";
  const isCourseDashboard = pathname.startsWith("/main/course/") && courseSlug;
  const isAdminDashboard =
    isAdmin &&
    (pathname.startsWith("/dashboard/admin") ||
      pathname.startsWith("/main/logs") ||
      pathname.startsWith("/main/students"));

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen(!open)}
        className="fixed top-2 right-2 sm:top-4 sm:right-4 z-50 bg-[#124A69] text-white hover:bg-[#0f3d58] lg:hidden min-h-[44px] min-w-[44px]"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </Button>

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
              <div className="h-[calc(50vh-20px)]">
                <CourseShortcut excludeCourseSlug={courseSlug} />
              </div>
              <div className="h-[calc(50vh-20px)]">
                <CourseAnalytics courseSlug={courseSlug} />
              </div>
            </>
          ) : /* Attendance List Page */
          isAttendanceList ? (
            <>
              <div className="h-[calc(50vh-20px)]">
                <CourseShortcut />
              </div>
              <div className="h-[calc(50vh-20px)]">
                <AttendanceLeaderboard />
              </div>
            </>
          ) : isClassAttendance ? (
            <>
              <div className="h-[calc(50vh-20px)]">
                <CourseShortcut excludeCourseSlug={courseSlug} />
              </div>
              <div className="h-[calc(50vh-20px)]">
                <AttendanceLeaderboard courseSlug={courseSlug} />
              </div>
            </>
          ) : isGradingClassRecord ? (
            <>
              <div className="h-[calc(50vh-20px)]">
                <CourseShortcut excludeCourseSlug={courseSlug} />
              </div>
              <div className="h-[calc(50vh-20px)]">
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
          ) : isAdminDashboard ? (
            <>
              <div className="h-[calc(50vh-20px)]">
                <UserIdSearch />
              </div>
              <div className="h-[calc(50vh-20px)]">
                <ActiveFaculty />
              </div>
            </>
          ) : (
            <>
              <div className="h-[calc(50vh-20px)]">
                <UpcomingEvents />
              </div>
              <div className="h-[calc(50vh-20px)]">
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
    </>
  );
}
