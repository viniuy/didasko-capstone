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

export default function AcademicHeadDashboard() {
  const { data: session } = useSession();

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <AppSidebar />

      <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all overflow-y-auto">
        <div className="flex-1 px-4">
          <div className="flex flex-col flex-grow">
            <div className="px-4">
              <Header />
              <Greet />

              <Stats />
              <div className="space-y-4">
                <h2 className="pl-2 pb-1 text-2xl font-bold text-muted-foreground">
                  Your Subjects
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
  );
}
