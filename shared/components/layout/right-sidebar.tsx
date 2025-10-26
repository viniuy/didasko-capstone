"use client";
import { useState } from "react";
import { usePathname, useParams } from "next/navigation";
import { Menu, X } from "lucide-react";
import UpcomingEvents from "@/features/dashboard/components/events";
import Notes from "@/features/dashboard/components/notes";
import { Button } from "@/components/ui/button";
import AttendanceCourseShortcuts from "@/features/attendance/right-sidebar/my-subjects";
import AttendanceLeaderboard from "@/features/attendance/right-sidebar/student-attendance";

export default function Rightsidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const params = useParams();

  // Extract course slug from URL params
  // If your route is /main/attendance/class/[course_slug], use 'course_slug'
  // If your route is /main/attendance/class/[slug], use 'slug'
  const courseSlug = (params.course_slug || params.slug) as string;

  // Check if we're on the attendance page
  const isAttendanceList = pathname === "/main/attendance";
  const isClassAttendance =
    pathname.startsWith("/main/attendance/") &&
    pathname !== "/main/attendance/";

  return (
    <>
      {/* Burger button — visible only on small screens */}
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
          {isAttendanceList ? (
            // Show modules for /main/attendance
            <>
              <div className="h-[calc(50vh-20px)]">
                <AttendanceCourseShortcuts />
              </div>
              <div className="h-[calc(50vh-20px)]">
                <AttendanceLeaderboard />
              </div>
            </>
          ) : isClassAttendance ? (
            // Show modules for /main/attendance/class/[slug]
            <>
              <div className="h-[calc(50vh-20px)] w-full">
                <AttendanceCourseShortcuts />
              </div>
              <div className="h-[calc(50vh-20px)]">
                <AttendanceLeaderboard courseSlug={courseSlug} />
              </div>
            </>
          ) : (
            // Show default modules for other routes
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
