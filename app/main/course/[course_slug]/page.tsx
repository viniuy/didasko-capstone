"use client";

import React from "react";
import { CourseDashboard } from "@/features/courses/components/course-dashboard";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { useParams, useRouter } from "next/navigation";

export default function CourseDashboardPage() {
  const params = useParams();
  const router = useRouter();

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Header />
      <AppSidebar />

      <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all">
        <div className="flex flex-col flex-grow px-4">
          {/* Course Dashboard Component */}
          <div className="mb-4 overflow-y-auto">
            <CourseDashboard courseSlug={params.course_slug as string} />
          </div>
        </div>
        {/* Right Sidebar */}
        <Rightsidebar />
      </main>
    </div>
  );
}
