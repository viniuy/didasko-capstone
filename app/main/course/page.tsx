import React from "react";
import { CourseDataTable } from "@/features/admin/components/course-data-table";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { getCourseDashboardData } from "@/features/admin/hook/course-dashboard";

export default async function CourseDashboardPage() {
  const { courses } = await getCourseDashboardData();
  console.log("awww man", courses);
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <AppSidebar />
      <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all">
        <div className="flex flex-col flex-grow px-4">
          <Header />

          {/* Courses Table */}
          <div className="mb-4">
            <CourseDataTable courses={courses} />
          </div>
        </div>
        {/* Right Sidebar */}
        <Rightsidebar />
      </main>
    </div>
  );
}
