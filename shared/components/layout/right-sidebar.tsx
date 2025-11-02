"use client";
import { useState } from "react";
import { usePathname, useParams } from "next/navigation";
import { Menu, X } from "lucide-react";
import UpcomingEvents from "@/features/dashboard/components/events";
import Notes from "@/features/dashboard/components/notes";
import { Button } from "@/components/ui/button";
import CourseShortcut from "@/features/right-sidebar/components/my-subjects";
import AttendanceLeaderboard from "@/features/right-sidebar/components/student-attendance";
import GradingLeaderboard from "@/features/right-sidebar/components/grading-leaderboard";

export default function Rightsidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const params = useParams();
  const courseSlug = (params.course_slug || params.slug) as string;

  // Route detection
  const isAttendanceList = pathname === "/main/attendance";
  const isClassAttendance =
    pathname.startsWith("/main/attendance/class/") && courseSlug;
  const isGradingClassRecord =
    pathname.startsWith("/main/grading/class-record/") && courseSlug;
  const isGradingList =
    pathname === "/main/grading" || pathname === "/main/grading/class-record";

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen(!open)}
        className="fixed top-4 right-4 z-50 bg-[#124A69] text-white hover:bg-[#0f3d58] lg:hidden"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </Button>

      <div
        className={`fixed top-0 right-0 z-40 h-screen bg-[#124A69] border-l p-4 pt-2 flex flex-col transition-all duration-300 overflow-hidden
          ${open ? "translate-x-0" : "translate-x-full"}
          lg:translate-x-0
          w-[360px] md:w-[360px] sm:w-[80vw]
        `}
      >
        <div className="flex-grow overflow-y-auto grid grid-rows-2 gap-4 h-[calc(100vh-32px)]">
          {/* Attendance List Page */}
          {isAttendanceList ? (
            <>
              <div className="h-[calc(50vh-20px)]">
                <CourseShortcut />
              </div>
              <div className="h-[calc(50vh-20px)]">
                <AttendanceLeaderboard />
              </div>
            </>
          ) : /* Attendance Class Page */
          isClassAttendance ? (
            <>
              <div className="h-[calc(50vh-20px)]">
                <CourseShortcut excludeCourseSlug={courseSlug} />
              </div>
              <div className="h-[calc(50vh-20px)]">
                <AttendanceLeaderboard courseSlug={courseSlug} />
              </div>
            </>
          ) : /* Grading Class Record Page */
          isGradingClassRecord ? (
            <>
              <div className="h-[calc(50vh-20px)]">
                <CourseShortcut excludeCourseSlug={courseSlug} />
              </div>
              <div className="h-[calc(50vh-20px)]">
                <GradingLeaderboard courseSlug={courseSlug} />
              </div>
            </>
          ) : /* Grading List Page */
          isGradingList ? (
            <>
              <div className="h-[calc(50vh-20px)]">
                <CourseShortcut />
              </div>
              <div className="h-[calc(50vh-20px)]">
                <GradingLeaderboard />
              </div>
            </>
          ) : (
            /* Default Dashboard */
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

      {/* Dimmed overlay when sidebar is open (for small screens) */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
