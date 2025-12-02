import React from "react";
import { CourseDataTable } from "@/features/courses/components/course-data-table";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { UserRole } from "@/lib/permission";
import { authOptions } from "@/lib/auth-options";
import { CourseDataTableWrapper } from "@/features/courses/components/course-data-table-wrapper";

// Route segment config for performance
export const dynamic = "force-dynamic";
export const revalidate = 60; // ISR: revalidate every 60s

export default async function CourseDashboardPage() {
  // Pass authOptions to getServerSession
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/"); // Redirect to your sign-in page
  }

  // Extract user info from session
  const userId = session.user.id;
  const userRoles = session.user.roles || [];
  const userRole = (userRoles[0] || "FACULTY") as UserRole;

  // Redirect if no roles assigned
  if (userRoles.length === 0) {
    redirect("/"); // No role assigned
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Header />
      <AppSidebar />

      <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all">
        <div className="flex flex-col flex-grow px-4 overflow-y-auto">
          <CourseDataTableWrapper userRole={userRole} userId={userId} />
        </div>

        {/* Right Sidebar */}
        <Rightsidebar />
      </main>
    </div>
  );
}
