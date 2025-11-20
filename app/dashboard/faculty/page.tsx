"use client";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Stats from "@/features/dashboard/components/stats";
import Greet from "@/features/dashboard/components/greeting";
import AllCourses from "@/features/courses/components/all-courses";
import WeeklySchedule from "@/features/dashboard/components/weekly-schedule";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import React from "react";
import { useSession } from "next-auth/react";

export default function FacultyDashboard() {
  const [open, setOpen] = React.useState(false);
  const { data: session } = useSession();

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <div className="relative h-screen w-screen overflow-hidden">
        <AppSidebar />

        <main className="h-full w-full lg:w-[calc(100%-22.5rem)] transition-all overflow-y-auto">
          <div className="flex-1 pl-[4rem] ">
            <div className="flex flex-col flex-grow">
              <div>
                <Header />
              </div>
              <div className="px-2 sm:px-4">
                <Greet />
                <Stats />
                <div className="space-y-3 sm:space-y-4">
                  <h2 className="pl-1 sm:pl-2 pb-1 text-lg sm:text-xl md:text-2xl font-bold text-muted-foreground">
                    My Courses
                  </h2>
                  <AllCourses type="attendance" />
                </div>
              </div>

              {session?.user?.id && (
                <WeeklySchedule
                  teacherInfo={{
                    id: session.user.id,
                  }}
                />
              )}
            </div>
          </div>

          <div className="hidden lg:block">
            <Rightsidebar />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
