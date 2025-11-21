"use client";
import React from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import SemesterCourses from "@/features/courses/components/semester-courses";

export default function GradebookPage() {
  const [open, setOpen] = React.useState(false);

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <div className="relative h-screen w-screen overflow-hidden">
        <Header />
        <AppSidebar />
        <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all">
          <div className="flex flex-col flex-grow px-4">
            <div className="flex-1 p-4">
              <SemesterCourses type="class-record" />
            </div>
          </div>
          <Rightsidebar />
        </main>
      </div>
    </SidebarProvider>
  );
}
