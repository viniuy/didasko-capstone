"use client";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import React from "react";
import AttendanceLeaderboard from "@/features/attendance/components/attendance-ranks";
import SemesterCourses from "@/features/courses/components/semester-courses";

export default function AttendancePage() {
  const [open, setOpen] = React.useState(false);

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <div className="relative h-screen w-screen overflow-hidden">
        <AppSidebar />

        <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all overflow-y-auto">
          <div className="flex flex-col flex-grow px-2 sm:px-4 md:px-6 lg:px-8">
            <Header />

            <div className="space-y-2 md:space-y-6 lg:space-y-8">
              <div className="space-y-2">
                <h2 className="pl-2 pb-1 text-xl sm:text-2xl font-bold text-muted-foreground">
                  Overview of Attendance
                </h2>

                <div className="grid gap-4 md:gap-6 lg:gap-8">
                  <div className="space-y-2">
                    <h2 className="pl-2 pb-1 text-lg sm:text-xl font-bold text-muted-foreground">
                      1st Semester
                    </h2>
                    <SemesterCourses
                      semester="1st Semester"
                      type="attendance"
                    />
                  </div>

                  <div className="space-y-2">
                    <h2 className="pl-2 pb-1 text-lg sm:text-xl font-bold text-muted-foreground">
                      2nd Semester
                    </h2>
                    <SemesterCourses
                      semester="2nd Semester"
                      type="attendance"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <Rightsidebar />
        </main>
      </div>
    </SidebarProvider>
  );
}
