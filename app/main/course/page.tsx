import React from "react";
import { CourseDataTable } from "@/features/courses/components/course-data-table";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { getCourseDashboardData } from "@/features/courses/hook/course-dashboard";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { UserRole } from "@/lib/permission";
import { authOptions } from "@/lib/auth-options"; // Import your existing auth options

export default async function CourseDashboardPage() {
  // Pass authOptions to getServerSession
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/"); // Redirect to your sign-in page
  }

  const { courses } = await getCourseDashboardData();

  // Extract user info from session
  const userId = session.user.id;
  const userRole = session.user.role as UserRole;

  console.log("UserID: ", userId);
  console.log("userRole: ", userRole);
  console.log("Full session: ", session);

  // Redirect if no role or if student tries to access
  if (!userRole) {
    redirect("/"); // No role assigned
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <AppSidebar />
      <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all">
        <div className="flex flex-col flex-grow px-4">
          <Header />

          {/* Courses Table */}
          <div className="mb-4">
            <CourseDataTable
              courses={courses}
              userRole={userRole}
              userId={userId}
            />
          </div>
        </div>

        {/* Right Sidebar */}
        <Rightsidebar />
      </main>
    </div>
  );
}
