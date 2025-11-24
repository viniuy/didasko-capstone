"use client";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import React from "react";
import Studentlist from "@/features/attendance/components/attendance-studentlist";

export default function ClassAttendancePage({
  params,
}: {
  params: Promise<{ course_slug: string }>;
}) {
  const [open, setOpen] = React.useState(false);
  const resolvedParams = React.use(params);
  const { course_slug } = resolvedParams;

  if (!course_slug) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-xl text-gray-500">No course selected</p>
      </div>
    );
  }

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <div className="relative h-screen w-screen overflow-hidden">
        <Header />
        <AppSidebar />

        <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all">
          <div className="flex flex-col flex-grow px-4">
            <div className="flex-1 overflow-y-auto pb-6">
              <div className="mt-6">
                <Studentlist courseSlug={course_slug} />
              </div>
            </div>
          </div>

          <Rightsidebar />
        </main>
      </div>
    </SidebarProvider>
  );
}
